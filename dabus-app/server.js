import express from "express"
import cors from "cors"
import fetch from "node-fetch"
import dotenv from "dotenv"
import fs from "fs"
import { parse } from "csv-parse/sync"

dotenv.config()

const app = express()
app.use(cors())

// Load stops from GTFS stops.txt
const stopsData = fs.readFileSync("./data/stops.txt", "utf8")
const stops = parse(stopsData, {
    columns: true,
    skip_empty_lines: true
})

// Loads shapes from GTFS shapes.txt
const shapesData = fs.readFileSync("./data/shapes.txt", "utf8")
const shapesRaw = parse(shapesData, {
    columns: true,
    skip_empty_lines: true
})

// Group shapes by shape_id sorted by sequence
const shapes = shapesRaw.reduce((acc, row) => {
    if (!acc[row.shape_id]) acc[row.shape_id] = []
    acc[row.shape_id].push({
        seq: parseInt(row.shape_pt_sequence),
        coords: [parseFloat(row.shape_pt_lat), parseFloat(row.shape_pt_lon)]
    })
    return acc
}, {})

// Load trips and stop_times from GTFS
const tripsData = fs.readFileSync("./data/trips.txt", "utf8")
const tripsRaw = parse(tripsData, {
    columns: true,
    skip_empty_lines: true
})

const stopTimesData = fs.readFileSync("./data/stop_times.txt", "utf8")
const stopTimesRaw = parse(stopTimesData, {
    columns: true,
    skip_empty_lines: true
})

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

// Sort each shape by sequence and extract just the coordinates
Object.keys(shapes).forEach(id => {
    shapes[id] = shapes[id]
        .sort((a, b) => a.seq - b.seq)
        .map(p => p.coords)
})

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
    if (!shape) {
        return res.status(404).json({ error: "Shape not found" })
    }
    res.json({ shape })
})

// Trip stops endpoint
app.get("/api/trip/:tripId/stops", (req, res) => {
    const tripId = req.params.tripId
    const stopTimes = stopTimesByTrip[tripId]

    if (!stopTimes) {
        return res.status(404).json({ error: "Trip not found" })
    }

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

// Nearby stops endpoint
app.get("/api/nearby-stops", async (req, res) => {
    const address = req.query.address

    try {
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ", Honolulu, HI")}&format=json&limit=1`
        const geocodeResponse = await fetch(geocodeUrl, {
            headers: { "User-Agent": "DaBusApp/1.0" }
        })
        const geocodeData = await geocodeResponse.json()

        if (!geocodeData.length) {
            return res.status(404).json({ error: "Address not found" })
        }

        const lat = parseFloat(geocodeData[0].lat)
        const lon = parseFloat(geocodeData[0].lon)

        const nearbyStops = stops
            .map(stop => ({
                stop_id: stop.stop_id,
                stop_name: stop.stop_name,
                stop_lat: stop.stop_lat,
                stop_lon: stop.stop_lon,
                distance: getDistance(lat, lon, parseFloat(stop.stop_lat), parseFloat(stop.stop_lon))
            }))
            .filter(stop => stop.distance <= 0.25)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 10)

        res.json({ lat, lon, stops: nearbyStops })
    } catch (_err) {
        res.status(500).json({ error: "Failed to find nearby stops" })
    }
})

// Nearby stops by coordinates endpoint
app.get("/api/nearby-stops-by-coords", (req, res) => {
    const lat = parseFloat(req.query.lat)
    const lon = parseFloat(req.query.lon)

    if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: "Invalid coordinates" })
    }

    const nearbyStops = stops
        .map(stop => ({
            stop_id: stop.stop_id,
            stop_name: stop.stop_name,
            stop_lat: stop.stop_lat,
            stop_lon: stop.stop_lon,
            distance: getDistance(lat, lon, parseFloat(stop.stop_lat), parseFloat(stop.stop_lon))
        }))
        .filter(stop => stop.distance <= 0.25)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20)

    res.json({ stops: nearbyStops })
})

app.listen(3001, () => {
    console.log("Server running on http://localhost:3001")
})