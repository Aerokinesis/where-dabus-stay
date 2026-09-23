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
import { parseListingAlerts, parseDisruptionAlerts, mergeAlerts } from "./alerts.js"
import { getPosts, postsToAlerts, isConfigured as announcementsConfigured } from "./announcements.js"

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

// CORS: allow only origins listed in ALLOWED_ORIGINS (comma-separated),
// plus any Vercel preview URL, so a new preview deployment works without
// having to update ALLOWED_ORIGINS by hand every time.
// Defaults to common local dev origins if the env var is unset.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "https://localhost:5173,https://192.168.4.27:5173")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean)

// Matches any *.vercel.app origin — covers both the per-commit preview URL
// and the stable per-branch preview URL Vercel generates.
const vercelPreviewPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i

app.use(cors({
    origin: (origin, cb) => {
        // Allow non-browser tools (curl, server-to-server), explicitly listed
        // origins, and any Vercel preview deployment
        if (!origin || allowedOrigins.includes(origin) || vercelPreviewPattern.test(origin)) {
            return cb(null, true)
        }
        return cb(new Error("Not allowed by CORS"))
    },
}))

// Load stops from GTFS stops.txt (small — needed for search/nearby/stop-info endpoints)
const stopsData = fs.readFileSync("./data/stops.txt", "utf8")
const stops = parse(stopsData, { columns: true, skip_empty_lines: true })

// Load pre-processed route/shape data (replaces the heavy shapes.txt, trips.txt,
// stop_times.txt, and routes.txt that would blow the 512MB Railway memory limit).
// Re-generate with: node preprocess.js
const { routeDirections, shapes, shapeStops, stopBearings, feedInfo } = JSON.parse(
    fs.readFileSync("./data/processed.json", "utf8")
)

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
    } catch {
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
            route_short_name: route_short_name || route_long_name || "–",
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
            bearing: stopBearings?.[displayStopId(stop.stop_id)] ?? null,
        }))
        .slice(0, 20)

    res.json({ stops: results })
})

// ── Stop suggestions (admin editor) ─────────────────────────────────────────
// Typeahead for the /admin "Stops" field. Different from /api/search-stops on
// purpose: that one needs whole words, so it finds nothing mid-word ("beret")
// and nothing for "S Beretania St + Punchbowl St" because of the "+". Here
// every typed term only has to be the START of a word in the stop name, and
// punctuation is ignored ("S." and "S" match the same stop).
//
// Stops served by the routes the editor already entered (?routes=2,13) rank
// first — at Beretania + Punchbowl there are two stops (#45 and #4860) and the
// route is what tells them apart.

// display stop id -> Set of route_short_names serving it.
const routesByStop = new Map()
for (const r of routeDirections) {
    for (const s of r.stops || []) {
        const id = displayStopId(String(s.stop_id))
        if (!routesByStop.has(id)) routesByStop.set(id, new Set())
        if (r.route_short_name) routesByStop.get(id).add(r.route_short_name)
    }
}
const byRouteNumber = (a, b) => a.localeCompare(b, undefined, { numeric: true })
const routesForStop = (id) => [...(routesByStop.get(id) || [])].sort(byRouteNumber)

const normalizeStopText = (str) =>
    normalizeQuery(
        String(str)
            .toLowerCase()
            .replace(/[.,'’`]/g, "")
            .replace(/[+&@/()-]/g, " ")
    )
        .replace(/\b(and|at)\b/g, " ")
        .split(/\s+/)
        .filter(Boolean)

// Built once: one entry per displayed stop id.
const stopSearchIndex = []
{
    const seen = new Set()
    for (const stop of stops) {
        const id = displayStopId(stop.stop_id)
        if (seen.has(id)) continue
        seen.add(id)
        stopSearchIndex.push({ id, name: stop.stop_name, words: normalizeStopText(stop.stop_name) })
    }
}

const stopSummary = (id, name) => ({ stop_id: id, stop_name: name, routes: routesForStop(id) })

const parseRouteParam = (raw) =>
    String(raw || "")
        .split(",")
        .map((r) => r.trim().toUpperCase())
        .filter((r) => /^[A-Z0-9 ]{1,12}$/.test(r))
        .slice(0, 20)

app.get("/api/stops/suggest", (req, res) => {
    const raw = String(req.query.q ?? "").slice(0, 80)
    const terms = normalizeStopText(raw)
    if (terms.length === 0) return res.json({ stops: [] })
    const wanted = new Set(parseRouteParam(req.query.routes))
    const digitsOnly = /^\d+$/.test(raw.trim())

    const scored = []
    for (const s of stopSearchIndex) {
        const nameMatch = terms.every((t) => s.words.some((w) => w.startsWith(t)))
        const idMatch = digitsOnly && s.id.startsWith(raw.trim())
        if (!nameMatch && !idMatch) continue
        const served = routesByStop.get(s.id)
        const onRoute = wanted.size > 0 && served && [...wanted].some((r) => served.has(r))
        let score = 0
        if (digitsOnly && s.id === raw.trim()) score += 1000
        if (onRoute) score += 100
        if (terms.every((t) => s.words.includes(t))) score += 10
        if (idMatch) score += 5
        scored.push({ s, score, onRoute })
    }
    scored.sort((a, b) => b.score - a.score || a.s.name.length - b.s.name.length || byRouteNumber(a.s.id, b.s.id))

    res.json({
        stops: scored.slice(0, 12).map(({ s, onRoute }) => ({
            ...stopSummary(s.id, s.name),
            on_selected_routes: Boolean(onRoute),
        })),
    })
})

// Names + routes for stop ids already on a post (so the editor can show
// "#45 S Beretania St + Punchbowl St" instead of a bare number).
app.get("/api/stops/lookup", (req, res) => {
    const ids = String(req.query.ids ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^\d{1,6}$/.test(s))
        .slice(0, 50)
    res.json({
        stops: ids.map((id) => {
            const stop = getStopByDisplayId(id)
            return stop ? stopSummary(id, stop.stop_name) : { stop_id: id, stop_name: null, routes: [] }
        }),
    })
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
            bearing: stopBearings?.[displayStopId(stop.stop_id)] ?? null,
            distance: getDistance(lat, lon, parseFloat(stop.stop_lat), parseFloat(stop.stop_lon))
        }))
        .filter(stop => stop.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20)

    res.json({ stops: nearbyStops })
})

// App metadata endpoint — currently just exposes the GTFS feed's vintage so
// the frontend can show "Data updated: <date>" without a hardcoded string
// that goes stale every refresh.
app.get("/api/meta", (req, res) => {
    res.json({
        gtfs_feed_version: feedInfo?.feed_version ?? null,
        gtfs_feed_start_date: feedInfo?.feed_start_date ?? null,
    })
})

// Stop info endpoint
app.get("/api/stop/:stopId", (req, res) => {
    const stopId = req.params.stopId
    if (!isSafeId(stopId)) return res.status(400).json({ error: "Invalid stop id" })
    const stop = getStopByDisplayId(stopId)
    if (!stop) return res.status(404).json({ error: "Stop not found" })
    res.json({ stop_id: displayStopId(stop.stop_id), stop_name: stop.stop_name })
})

// Service alerts endpoint — scrapes two public OTS pages since OTS doesn't
// publish the GTFS-Realtime feed URL. As of mid-2026 RiderAlerts.asp is just a
// landing page; the actual content lives on these two (see alerts.js header
// comment for details). 5-minute in-memory cache; on upstream failure we serve
// stale cache rather than erroring out, and a failure on one source still lets
// the other's alerts through.
const ALERTS_LISTING_URL = "https://www.thebus.org/RiderAlerts_Listing.asp"
const ALERTS_DISRUPTION_URL = "https://www.thebus.org/Updates/ServiceDisruption.asp"
const ALERTS_CACHE_MS = 5 * 60 * 1000
let alertsCache = { alerts: null, fetchedAt: 0 }

const fetchAlertSource = async (url, parse) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`Upstream ${r.status} for ${url}`)
    const html = await r.text()
    return parse(html, knownRouteShortNames)
}

// Appends community (Supabase) alerts to a scraped-alerts list. Never throws:
// if Supabase is unreachable and nothing is cached, the OTS list goes out alone.
const withCommunityAlerts = async (scraped) => {
    if (!announcementsConfigured()) return scraped
    try {
        const { posts } = await getPosts()
        return [...postsToAlerts(posts, knownRouteShortNames), ...scraped]
    } catch {
        return scraped
    }
}

app.get("/api/alerts", async (req, res) => {
    const now = Date.now()
    if (alertsCache.alerts && now - alertsCache.fetchedAt < ALERTS_CACHE_MS) {
        return res.json({
            alerts: await withCommunityAlerts(alertsCache.alerts),
            cached: true,
            stale: false,
            fetched_at: alertsCache.fetchedAt,
        })
    }
    const results = await Promise.allSettled([
        fetchAlertSource(ALERTS_LISTING_URL, parseListingAlerts),
        fetchAlertSource(ALERTS_DISRUPTION_URL, parseDisruptionAlerts),
    ])
    const fulfilled = results.filter((r) => r.status === "fulfilled").map((r) => r.value)

    if (fulfilled.length > 0) {
        // At least one source came through — merge what we have. A single
        // source failing (OTS reshuffles pages again, one page times out) is
        // still better served as a partial list than as a stale/error response.
        const parsed = mergeAlerts(...fulfilled)
        alertsCache = { alerts: parsed, fetchedAt: now }
        res.json({ alerts: await withCommunityAlerts(parsed), cached: false, stale: false, fetched_at: now })
    } else if (alertsCache.alerts) {
        // Better to serve a stale list than a hard error — alerts are advisory.
        res.json({
            alerts: await withCommunityAlerts(alertsCache.alerts),
            cached: true,
            stale: true,
            fetched_at: alertsCache.fetchedAt,
        })
    } else {
        // OTS is down and we have nothing cached — still surface any
        // community-posted alerts rather than a hard error.
        const community = await withCommunityAlerts([])
        if (community.length > 0) {
            return res.json({ alerts: community, cached: false, stale: true, fetched_at: now })
        }
        res.status(502).json({ error: "Could not fetch alerts" })
    }
})

// ── Community announcements ──────────────────────────────────────────────────
// Editor-authored posts from Supabase (see announcements.js). Served as their
// own feed for the Announcements tab, and route/stop-targeted ones are also
// appended to /api/alerts above so they show on Routes and arrivals.
app.get("/api/announcements", async (req, res) => {
    try {
        const { posts, stale, fetchedAt, configured } = await getPosts()
        // Attach stop names so the News card can say where, not just "#45".
        const withStops = posts.map((p) => ({
            ...p,
            stops: p.stop_ids.map((id) => ({ id, name: getStopByDisplayId(id)?.stop_name || null })),
        }))
        res.json({ posts: withStops, stale, fetched_at: fetchedAt, configured })
    } catch {
        res.status(502).json({ error: "Could not fetch announcements" })
    }
})

// ── Contact form ─────────────────────────────────────────────────────────────
// Tighter bucket than the global /api limiter: contact spam is a thing.
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many messages — please try again later." },
})

const CONTACT_CATEGORIES = { bug: "Bug report", feature: "Feature idea", other: "Feedback" }

app.post("/api/contact", contactLimiter, express.json({ limit: "16kb" }), async (req, res) => {
    const { message, email, category, website, appVersion, platform } = req.body || {}

    // Honeypot: humans never see the field; bots fill every input.
    // Pretend success so the bot moves on, deliver nothing.
    if (typeof website === "string" && website.trim() !== "") {
        return res.json({ ok: true })
    }

    if (typeof message !== "string" || message.trim().length < 10 || message.trim().length > 1000) {
        return res.status(400).json({ error: "Message must be between 10 and 1000 characters." })
    }
    const cleanMessage = message.trim()

    let cleanEmail = ""
    if (email != null && String(email).trim() !== "") {
        cleanEmail = String(email).trim()
        if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ error: "That email address doesn't look valid." })
        }
    }

    const cleanCategory = Object.prototype.hasOwnProperty.call(CONTACT_CATEGORIES, category) ? category : "other"
    const cleanVersion = typeof appVersion === "string" ? appVersion.slice(0, 32) : "unknown"
    const cleanPlatform = typeof platform === "string" ? platform.slice(0, 256) : "unknown"

    const subject = `[WhereDaBusStay] ${CONTACT_CATEGORIES[cleanCategory]}`
    const text = [
        cleanMessage,
        "",
        "———",
        `Category: ${cleanCategory}`,
        `From: ${cleanEmail || "(no email provided)"}`,
        `App version: ${cleanVersion}`,
        `Device: ${cleanPlatform}`,
        `Received: ${new Date().toISOString()}`,
    ].join("\n")

    const apiKey = process.env.RESEND_API_KEY
    const to = process.env.CONTACT_TO_EMAIL
    if (!apiKey || !to) {
        // Not configured (e.g. local dev) — log so the submission isn't lost.
        console.log(`[contact] RESEND_API_KEY/CONTACT_TO_EMAIL not set — logging only:\n${subject}\n${text}`)
        return res.json({ ok: true })
    }

    try {
        const payload = {
            // Resend's shared sender works without a verified domain, but can
            // only deliver to the account owner's own email — exactly this case.
            from: process.env.CONTACT_FROM_EMAIL || "WhereDaBusStay <onboarding@resend.dev>",
            to: [to],
            subject,
            text,
        }
        if (cleanEmail) payload.reply_to = cleanEmail

        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        })
        if (!r.ok) {
            const detail = await r.text().catch(() => "")
            console.error(`[contact] Resend error ${r.status}: ${detail}`)
            return res.status(502).json({ error: "Could not send your message. Please try again later." })
        }
        res.json({ ok: true })
    } catch (err) {
        console.error("[contact] send failed:", err)
        res.status(502).json({ error: "Could not send your message. Please try again later." })
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

