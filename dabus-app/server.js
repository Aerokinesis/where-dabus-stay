import express from "express"
import cors from "cors"
import fetch from "node-fetch"
import dotenv from "dotenv"
import fs from "fs"
import { parse } from "csv-parse/sync"
import https from "https"

dotenv.config()

const app = express()
app.use(cors())

// Load stops from GTFS stops.txt
const stopsData = fs.readFileSync("./data/stops.txt", "utf8")
const stops = parse(stopsData, { columns: true, skip_empty_lines: true })

// Load shapes from GTFS shapes.txt
const shapesData = fs.readFileSync("./data/shapes.txt", "utf8")
const shapesRaw = parse(shapesData, { columns: true, skip_empty_lines: true })

// Group shapes by shape_id sorted by sequence
const shapes = shapesRaw.reduce((acc, row) => {
    if (!acc[row.shape_id]) acc[row.shape_id] = []
    acc[row.shape_id].push({
        seq: parseInt(row.shape_pt_sequence),
        coords: [parseFloat(row.shape_pt_lat), parseFloat(row.shape_pt_lon)]
    })
    return acc
}, {})

// Sort each shape by sequence and extract just the coordinates
Object.keys(shapes).forEach(id => {
    shapes[id] = shapes[id]
        .sort((a, b) => a.seq - b.seq)
        .map(p => p.coords)
})

// Load trips from GTFS trips.txt
const tripsData = fs.readFileSync("./data/trips.txt", "utf8")
const tripsRaw = parse(tripsData, { columns: true, skip_empty_lines: true })

// Load stop_times from GTFS stop_times.txt
const stopTimesData = fs.readFileSync("./data/stop_times.txt", "utf8")
const stopTimesRaw = parse(stopTimesData, { columns: true, skip_empty_lines: true })

// Load routes from GTFS routes.txt
const routesData = fs.readFileSync("./data/routes.txt", "utf8")
const routesRaw = parse(routesData, { columns: true, skip_empty_lines: true })

// Index stop times by trip_id
const stopTimesByTrip = stopTimesRaw.reduce((acc, row) => {
    if (!acc[row.trip_id]) acc[row.trip_id] = []
    acc[row.trip_id].push(row)
    return acc
}, {})

// Index stops by stop_id
const stopsById = stops.reduce((acc, stop) => {
    acc[stop.stop_id] = stop
    return acc
}, {})

// Index trips by route_id
const tripsByRoute = tripsRaw.reduce((acc, trip) => {
    if (!acc[trip.route_id]) acc[trip.route_id] = []
    acc[trip.route_id].push(trip)
    return acc
}, {})

// Build one entry per direction per route
const routeDirections = []

Object.entries(tripsByRoute).forEach(([routeId, trips]) => {
    const route = routesRaw.find(r => r.route_id === routeId)
    if (!route) return

    const directions = {}
    trips.forEach(trip => {
        const dir = trip.direction_id ?? "0"
        if (!directions[dir]) directions[dir] = trip
    })

    Object.entries(directions).forEach(([directionId, trip]) => {
        const stopTimes = stopTimesByTrip[trip.trip_id] || []
        const seen = new Set()
        const dirStops = stopTimes
            .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
            .filter(st => {
                if (seen.has(st.stop_id)) return false
                seen.add(st.stop_id)
                return true
            })
            .map(st => {
                const stop = stopsById[st.stop_id]
                return {
                    stop_id: st.stop_id,
                    stop_name: stop?.stop_name || "Unknown",
                }
            })

        routeDirections.push({
            id: `${routeId}-${directionId}`,
            route_id: routeId,
            direction_id: directionId,
            route_short_name: route.route_short_name,
            route_long_name: route.route_long_name,
            headsign: trip.trip_headsign,
            stops: dirStops,
        })
    })
})

// Sort by route number then direction
routeDirections.sort((a, b) =>
    a.route_short_name.localeCompare(b.route_short_name, undefined, { numeric: true })
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
    const apiKey = process.env.VITE_THEBUS_API_KEY
    const url = `http://api.thebus.org/arrivalsJSON/?key=${apiKey}&stop=${stop}`
    try {
        const response = await fetch(url)
        const data = await response.json()
        res.json(data)
    } catch (_err) {
        res.status(500).json({ error: "Failed to fetch arrivals" })
    }
})

// Shape endpoint
app.get("/api/shape/:shapeId", (req, res) => {
    const shapeId = req.params.shapeId
    const shape = shapes[shapeId]
    if (!shape) return res.status(404).json({ error: "Shape not found" })
    res.json({ shape })
})

// Trip stops endpoint
app.get("/api/trip/:tripId/stops", (req, res) => {
    const tripId = req.params.tripId
    const stopTimes = stopTimesByTrip[tripId]
    if (!stopTimes) return res.status(404).json({ error: "Trip not found" })

    const tripStops = stopTimes
        .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
        .map(st => {
            const stop = stopsById[st.stop_id]
            return {
                stop_id: st.stop_id,
                stop_name: stop?.stop_name || "Unknown",
                stop_lat: parseFloat(stop?.stop_lat),
                stop_lon: parseFloat(stop?.stop_lon),
                arrival_time: st.arrival_time,
                sequence: parseInt(st.stop_sequence)
            }
        })
        .filter(s => !isNaN(s.stop_lat) && !isNaN(s.stop_lon))

    res.json({ stops: tripStops })
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
    const entry = routeDirections.find(r => r.id === req.params.routeId)
    if (!entry) return res.status(404).json({ error: "Route not found" })
    res.json({ stops: entry.stops })
})

// Stop name search endpoint
app.get("/api/search-stops", (req, res) => {
    const query = normalizeQuery(req.query.q ?? "")
    if (!query) return res.status(400).json({ error: "No search query provided" })

    const terms = query.split(/\s+/).filter(Boolean)
    const results = stops
        .filter(stop =>
            terms.every(term =>
                new RegExp(`\\b${term}(\\s|$)`, "i").test(stop.stop_name)
            )
        )
        .map(stop => ({
            stop_id: stop.stop_id,
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
    const radius = parseFloat(req.query.radius) || 0.25   // add this
    console.log("nearby stops request — radius:", radius, "raw:", req.query.radius)
    if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: "Invalid coordinates" })

    const nearbyStops = stops
        .map(stop => ({
            stop_id: stop.stop_id,
            stop_name: stop.stop_name,
            stop_lat: stop.stop_lat,
            stop_lon: stop.stop_lon,
            distance: getDistance(lat, lon, parseFloat(stop.stop_lat), parseFloat(stop.stop_lon))
        }))
        .filter(stop => stop.distance <= radius)           // was: <= 0.25
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20)

    res.json({ stops: nearbyStops })
})

// Stop info endpoint
app.get("/api/stop/:stopId", (req, res) => {
    const stopId = req.params.stopId
    const stop = stopsById[stopId]
    if (!stop) return res.status(404).json({ error: "Stop not found" })
    res.json({ stop_id: stop.stop_id, stop_name: stop.stop_name })
})

// Start HTTPS server with mkcert certificates
const httpsOptions = {
    key: fs.readFileSync("./192.168.4.27+2-key.pem"),
    cert: fs.readFileSync("./192.168.4.27+2.pem"),
}

https.createServer(httpsOptions, app).listen(3001, () => {
    console.log("Server running on https://localhost:3001")
})