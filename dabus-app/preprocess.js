// Run once locally to generate data/processed.json
// Usage: node preprocess.js
//
// This avoids loading the huge stop_times.txt and shapes.txt at server
// startup, keeping Railway memory usage well under 512MB.

import fs from "fs"
import { parse } from "csv-parse/sync"

const read = (file) => parse(fs.readFileSync(`./data/${file}`, "utf8"), {
    columns: true, skip_empty_lines: true
})

console.log("Loading GTFS files...")
const stops    = read("stops.txt")
const routes   = read("routes.txt")
const trips    = read("trips.txt")
const stopTimes = read("stop_times.txt")
const shapesRaw = read("shapes.txt")

console.log(`  stops: ${stops.length}, trips: ${trips.length}, stop_times: ${stopTimes.length}, shapes: ${shapesRaw.length}`)

const displayStopId = (id) => (typeof id === "string" ? id.replace(/_merge$/, "") : id)

// Index stops by stop_id
const stopsById = stops.reduce((acc, s) => { acc[s.stop_id] = s; return acc }, {})

// Index stop_times by trip_id
console.log("Indexing stop times...")
const stopTimesByTrip = stopTimes.reduce((acc, row) => {
    if (!acc[row.trip_id]) acc[row.trip_id] = []
    acc[row.trip_id].push(row)
    return acc
}, {})

// Build shapes: shape_id -> [[lat, lon], ...]
console.log("Processing shapes...")
const shapesTemp = shapesRaw.reduce((acc, row) => {
    if (!acc[row.shape_id]) acc[row.shape_id] = []
    acc[row.shape_id].push({
        seq: parseInt(row.shape_pt_sequence),
        coords: [parseFloat(row.shape_pt_lat), parseFloat(row.shape_pt_lon)]
    })
    return acc
}, {})
const shapes = {}
for (const [id, pts] of Object.entries(shapesTemp)) {
    shapes[id] = pts.sort((a, b) => a.seq - b.seq).map(p => p.coords)
}

// Build routeDirections and shapeStops
console.log("Building route directions...")
const tripsByRoute = trips.reduce((acc, trip) => {
    if (!acc[trip.route_id]) acc[trip.route_id] = []
    acc[trip.route_id].push(trip)
    return acc
}, {})

// shape_id -> ordered stop list (for bus tracking endpoint)
const shapeStops = {}

const routeDirections = []
for (const [routeId, routeTrips] of Object.entries(tripsByRoute)) {
    const route = routes.find(r => r.route_id === routeId)
    if (!route) continue

    const directions = {}
    for (const trip of routeTrips) {
        const dir = trip.direction_id ?? "0"
        if (!directions[dir]) directions[dir] = trip
    }

    for (const [directionId, trip] of Object.entries(directions)) {
        const times = (stopTimesByTrip[trip.trip_id] || [])
            .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))

        const seen = new Set()
        const dirStops = times.flatMap(st => {
            if (seen.has(st.stop_id)) return []
            seen.add(st.stop_id)
            const stop = stopsById[st.stop_id]
            const lat = parseFloat(stop?.stop_lat)
            const lon = parseFloat(stop?.stop_lon)
            if (isNaN(lat) || isNaN(lon)) return []
            return [{ stop_id: displayStopId(st.stop_id), stop_name: stop?.stop_name || "Unknown", stop_lat: lat, stop_lon: lon }]
        })

        // Store stops keyed by shape_id for the bus tracking fallback
        if (trip.shape_id && !shapeStops[trip.shape_id]) {
            shapeStops[trip.shape_id] = times.map(st => {
                const stop = stopsById[st.stop_id]
                return {
                    stop_id: displayStopId(st.stop_id),
                    stop_name: stop?.stop_name || "Unknown",
                    stop_lat: parseFloat(stop?.stop_lat),
                    stop_lon: parseFloat(stop?.stop_lon),
                    arrival_time: st.arrival_time,
                    sequence: parseInt(st.stop_sequence)
                }
            }).filter(s => !isNaN(s.stop_lat) && !isNaN(s.stop_lon))
        }

        routeDirections.push({
            id: `${routeId}-${directionId}`,
            route_id: routeId,
            direction_id: directionId,
            route_short_name: route.route_short_name,
            route_long_name: route.route_long_name,
            headsign: trip.trip_headsign,
            shape_id: trip.shape_id,
            stops: dirStops,
        })
    }
}

routeDirections.sort((a, b) =>
    a.route_short_name.localeCompare(b.route_short_name, undefined, { numeric: true })
)

// Fill in shapeStops for ALL shape_ids in the GTFS dataset.
// The loop above only captures one representative trip per route direction (236 entries).
// Live OTS buses can report any shape_id, so we index every unique shape_id to avoid
// the tracking view showing no stops when the shape_id is not a representative one.
console.log("Filling shapeStops for all shape_ids...")
const tripsByShape = trips.reduce((acc, trip) => {
    if (trip.shape_id && !acc[trip.shape_id]) acc[trip.shape_id] = trip
    return acc
}, {})
for (const [shapeId, trip] of Object.entries(tripsByShape)) {
    if (shapeStops[shapeId]) continue
    const times = (stopTimesByTrip[trip.trip_id] || [])
        .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
    shapeStops[shapeId] = times.map(st => {
        const stop = stopsById[st.stop_id]
        return {
            stop_id: displayStopId(st.stop_id),
            stop_name: stop?.stop_name || "Unknown",
            stop_lat: parseFloat(stop?.stop_lat),
            stop_lon: parseFloat(stop?.stop_lon),
            arrival_time: st.arrival_time,
            sequence: parseInt(st.stop_sequence)
        }
    }).filter(s => !isNaN(s.stop_lat) && !isNaN(s.stop_lon))
}

// Compute travel bearing per stop using circular averaging across all route directions.
// Bearing 0 = North, 90 = East, etc.
const toRad = (deg) => deg * Math.PI / 180
const toDeg = (rad) => rad * 180 / Math.PI

function computeBearing(lat1, lon1, lat2, lon2) {
    const dLon = toRad(lon2 - lon1)
    const lat1r = toRad(lat1)
    const lat2r = toRad(lat2)
    const y = Math.sin(dLon) * Math.cos(lat2r)
    const x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon)
    return (toDeg(Math.atan2(y, x)) + 360) % 360
}

console.log("Computing stop bearings...")
const bearingAccum = {}
for (const rd of routeDirections) {
    const s = rd.stops
    if (s.length < 2) continue
    for (let i = 0; i < s.length; i++) {
        const b = i < s.length - 1
            ? computeBearing(s[i].stop_lat, s[i].stop_lon, s[i + 1].stop_lat, s[i + 1].stop_lon)
            : computeBearing(s[i - 1].stop_lat, s[i - 1].stop_lon, s[i].stop_lat, s[i].stop_lon)
        if (!bearingAccum[s[i].stop_id]) bearingAccum[s[i].stop_id] = { s: 0, c: 0 }
        bearingAccum[s[i].stop_id].s += Math.sin(toRad(b))
        bearingAccum[s[i].stop_id].c += Math.cos(toRad(b))
    }
}
const stopBearings = {}
for (const [id, { s, c }] of Object.entries(bearingAccum)) {
    stopBearings[id] = Math.round((toDeg(Math.atan2(s, c)) + 360) % 360)
}

const out = { routeDirections, shapes, shapeStops, stopBearings }
fs.writeFileSync("./data/processed.json", JSON.stringify(out))
console.log(`Done. Wrote data/processed.json (${(fs.statSync("./data/processed.json").size / 1024 / 1024).toFixed(1)} MB)`)
console.log(`  routeDirections: ${routeDirections.length}, shapes: ${Object.keys(shapes).length}, shapeStops: ${Object.keys(shapeStops).length}, stopBearings: ${Object.keys(stopBearings).length}`)
