import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import fetch from "node-fetch"
import dotenv from "dotenv"
import fs from "fs"
import { parse } from "csv-parse/sync"
import http from "http"
import https from "https"
import { parseAlerts } from "./alerts.js"

dotenv.config()

const app = express()

// Security headers
app.use(helmet())

// Rate limit: 60 requests per minute per IP across all /api routes
app.use("/api", rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, slow down." },
}))

// CORS: allow only origins listed in ALLOWED_ORIGINS (comma-separated).
// Defaults to common local dev origins if the env var is unset.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://localhost:5173,https://192.168.4.27:5173")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean)

app.use(cors({
    origin: (origin, cb) => {
        // Allow non-browser tools (curl, server-to-server) and explicitly listed origins
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
        return cb(new Error("Not allowed by CORS"))
    },
}))

console.log("[startup] loading stops.txt...")
const stopsData = fs.readFileSync("./data/stops.txt", "utf8")
const stops = parse(stopsData, { columns: true, skip_empty_lines: true })
console.log(`[startup] stops loaded: ${stops.length}`)

console.log("[startup] loading processed.json...")
const { routeDirections, shapes, shapeStops } = JSON.parse(
    fs.readFileSync("./data/processed.json", "utf8")
)
console.log(`[startup] processed.json loaded: ${routeDirections.length} routes, ${Object.keys(shapes).length} shapes`)

// Index stops by stop_id
const stopsById = stops.reduce((acc, stop) => {
    acc[stop.stop_id] = stop
    return acc
}, {})

// Strip GTFS internal "_merge" suffix so the frontend always sees the user-visible
// stop code (e.g. "4511_merge" -> "4511"). The bus signage and OTS API use the bare
// code; only GTFS internals carry the suffix.
const displayStopId = (id) => (typeof id === "string" ? id.replace(/_merge$/, "") : id)

// Look up a stop by either its displayed ID or its raw GTFS stop_id, so frontend
// callers can use the user-visible code without knowing about the "_merge" quirk.
const getStopByDisplayId = (id) => {
    if (Object.prototype.hasOwnProperty.call(stopsById, id)) return stopsById[id]
    const mergeKey = `${id}_merge`
    if (Object.prototype.hasOwnProperty.call(stopsById, mergeKey)) return stopsById[mergeKey]
    return null
}

// Set of route_short_name values present in our GTFS bundle. Used by the alerts
// parser to decide which mentioned routes the frontend can deep-link to.
const knownRouteShortNames = new Set(
    routeDirections.map(r => r.route_short_name).filter(Boolean)
)

// Calculate distance between two lat/lon points in miles
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

const abbreviations = {
    "street": "st", "road": "rd", "avenue": "ave", "highway": "hwy",
    "drive": "dr", "place": "pl", "boulevard": "bl", "parkway": "pkwy",
    "loop": "lp", "lane": "ln",
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// Allow only safe id chars (digits, letters, underscore, hyphen, dot).
// Rejects URL escapes, special regex chars, and __proto__/constructor lookups.
const isSafeId = (s) => typeof s === "string" && /^[\w.-]+$/.test(s) && s !== "__proto__" && s !== "constructor" && s !== "prototype"

const normalizeQuery = (query) => {
    let q = query.toLowerCase()
    Object.entries(abbreviations).forEach(([full, abbr]) => {
        q = q.replace(new RegExp(`\\b${full}\\b`, "g"), abbr)
    })
    return q
}

// Arrivals endpoint
app.get("/api/arrivals", async (req, res) => {
    const stop = req.query.stop
    if (!/^\d+$/.test(stop || "")) {
        return res.status(400).json({ error: "Invalid stop number" })
    }
    const apiKey = process.env.THEBUS_API_KEY
    const url = new URL("http://api.thebus.org/arrivalsJSON/")
    url.searchParams.set("key", apiKey)
    url.searchParams.set("stop", stop)
    try {
        const response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
        const data = await response.json()
        res.json(data)
    } catch (_err) {
        res.status(500).json({ error: "Failed to fetch arrivals" })
    }
})

// Shape endpoint
app.get("/api/shape/:shapeId", (req, res) => {
    const shapeId = req.params.shapeId
    if (!isSafeId(shapeId)) return res.status(400).json({ error: "Invalid shape id" })
    const shape = Object.prototype.hasOwnProperty.call(shapes, shapeId) ? shapes[shapeId] : null
    if (!shape) return res.status(404).json({ error: "Shape not found" })
    res.json({ shape })
})

// Trip stops endpoint — used for bus tracking route display.
// Live trip IDs from the OTS API won't be in GTFS, so we always fall back
// to the pre-processed shapeStops index keyed by shape_id.
app.get("/api/trip/:tripId/stops", (req, res) => {
    const tripId = req.params.tripId
    if (!isSafeId(tripId)) return res.status(400).json({ error: "Invalid trip id" })

    const shapeId = req.query.shape
    if (shapeId && isSafeId(shapeId) && Object.prototype.hasOwnProperty.call(shapeStops, shapeId)) {
        return res.json({ stops: shapeStops[shapeId] })
    }

    res.status(404).json({ error: "Trip not found" })
})

// All routes endpoint — one entry per direction
app.get("/api/routes", (req, res) => {
    res.json({
        routes: routeDirections.map(({ id, route_short_name, route_long_name, headsign }) => ({
            route_id: id,
            route_short_name: route_short_name || "–",
            route_long_name: headsign
                ? headsign.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
                : route_long_name,
            route_description: route_long_name,
        }))
    })
})

// Stops for a specific route direction
app.get("/api/route/:routeId/stops", (req, res) => {
    const routeId = req.params.routeId
    if (!isSafeId(routeId)) return res.status(400).json({ error: "Invalid route id" })
    const entry = routeDirections.find(r => r.id === routeId)
    if (!entry) return res.status(404).json({ error: "Route not found" })
    const shape = entry.shape_id && Object.prototype.hasOwnProperty.call(shapes, entry.shape_id)
        ? shapes[entry.shape_id]
        : []
    res.json({ stops: entry.stops, shape })
})

// Stop name search endpoint
app.get("/api/search-stops", (req, res) => {
    const query = normalizeQuery(req.query.q ?? "")
    if (!query) return res.status(400).json({ error: "No search query provided" })

    const terms = query.split(/\s+/).filter(Boolean)
    const results = stops
        .filter(stop =>
            terms.every(term =>
                new RegExp(`\\b${escapeRegex(term)}(\\s|$)`, "i").test(stop.stop_name)
            )
        )
        .map(stop => ({
            stop_id: displayStopId(stop.stop_id),
            stop_name: stop.stop_name,
            stop_lat: stop.stop_lat,
            stop_lon: stop.stop_lon,
        }))
        .slice(0, 20)

    res.json({ stops: results })
})

// Nearby stops by coordinates endpoint
app.get("/api/nearby-stops-by-coords", (req, res) => {
    const lat = parseFloat(req.query.lat)
    const lon = parseFloat(req.query.lon)
    const radius = parseFloat(req.query.radius) || 0.25
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: "Invalid coordinates" })

    const nearbyStops = stops
        .map(stop => ({
            stop_id: displayStopId(stop.stop_id),
            stop_name: stop.stop_name,
            stop_lat: stop.stop_lat,
            stop_lon: stop.stop_lon,
            distance: getDistance(lat, lon, parseFloat(stop.stop_lat), parseFloat(stop.stop_lon))
        }))
        .filter(stop => stop.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20)

    res.json({ stops: nearbyStops })
})

// Stop info endpoint
app.get("/api/stop/:stopId", (req, res) => {
    const stopId = req.params.stopId
    if (!isSafeId(stopId)) return res.status(400).json({ error: "Invalid stop id" })
    const stop = getStopByDisplayId(stopId)
    if (!stop) return res.status(404).json({ error: "Stop not found" })
    res.json({ stop_id: displayStopId(stop.stop_id), stop_name: stop.stop_name })
})

// Service alerts endpoint — scrapes the public OTS rider alerts page since OTS
// doesn't publish the GTFS-Realtime feed URL. 5-minute in-memory cache; on
// upstream failure we serve stale cache rather than erroring out.
const ALERTS_URL = "https://www.thebus.org/RiderAlerts.asp"
const ALERTS_CACHE_MS = 5 * 60 * 1000
let alertsCache = { alerts: null, fetchedAt: 0 }

app.get("/api/alerts", async (req, res) => {
    const now = Date.now()
    if (alertsCache.alerts && now - alertsCache.fetchedAt < ALERTS_CACHE_MS) {
        return res.json({
            alerts: alertsCache.alerts,
            cached: true,
            stale: false,
            fetched_at: alertsCache.fetchedAt,
        })
    }
    try {
        const r = await fetch(ALERTS_URL, { signal: AbortSignal.timeout(10000) })
        if (!r.ok) throw new Error(`Upstream ${r.status}`)
        const html = await r.text()
        const parsed = parseAlerts(html, knownRouteShortNames)
        alertsCache = { alerts: parsed, fetchedAt: now }
        res.json({ alerts: parsed, cached: false, stale: false, fetched_at: now })
    } catch (_err) {
        // Better to serve a stale list than a hard error — alerts are advisory.
        if (alertsCache.alerts) {
            return res.json({
                alerts: alertsCache.alerts,
                cached: true,
                stale: true,
                fetched_at: alertsCache.fetchedAt,
            })
        }
        res.status(502).json({ error: "Could not fetch alerts" })
    }
})

const PORT = process.env.PORT || 3001
const USE_HTTPS = process.env.USE_HTTPS !== "false"

if (USE_HTTPS) {
    // Local dev: TLS via mkcert certs. Set USE_HTTPS=false in production
    // where TLS is terminated upstream (Railway, Render, etc.).
    const httpsOptions = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH || "./192.168.4.27+2-key.pem"),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH || "./192.168.4.27+2.pem"),
    }
    https.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`Server running on https://localhost:${PORT}`)
    })
} else {
    http.createServer(app).listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`)
    })
}

