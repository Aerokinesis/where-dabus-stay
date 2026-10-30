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
const feedInfoRaw = read("feed_info.txt")
const feedInfo = feedInfoRaw[0] || null

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

    // Pick the trip with the MOST stops per direction, not the first one found.
    // Some routes (notably Skyline) have short-turn/partial trips; if one of
    // those is picked as the representative, the Routes page only shows a
    // segment of the route's stops and a truncated shape polyline.
    const directions = {}
    for (const trip of routeTrips) {
        const dir = trip.direction_id ?? "0"
        const count = (stopTimesByTrip[trip.trip_id] || []).length
        if (!directions[dir] || count > directions[dir].count) {
            directions[dir] = { trip, count }
        }
    }

    for (const [directionId, { trip }] of Object.entries(directions)) {
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

// Compute the travel direction shown by each stop's map arrow.
// Bearing 0 = North, 90 = East, etc.
//
// For each route direction serving a stop, take the heading of the route's
// road shape where it passes the stop (not a straight line to the next stop,
// which cuts across loops and transit-center bays). Stops are projected onto
// the shape in order, so a route passing the same spot twice resolves to the
// right pass. If the shape doesn't come within STOP_SHAPE_MAX_M of the stop,
// fall back to the straight line.
//
// A stop's arrow follows the buses that depart from it: a route that ends at
// the stop only counts when no route departs from it (otherwise every
// terminal would average arrivals and departures, which usually point
// opposite ways). Headings are averaged on the circle; if they don't mostly
// agree (resultant length below MIN_BEARING_AGREEMENT, e.g. a rail platform
// served in both directions, or a transit center with buses leaving every
// way), the stop gets no arrow rather than a misleading one.
const toRad = (deg) => deg * Math.PI / 180
const toDeg = (rad) => rad * 180 / Math.PI
const STOP_SHAPE_MAX_M = 40
const MIN_BEARING_AGREEMENT = 0.6

function computeBearing(lat1, lon1, lat2, lon2) {
    const dLon = toRad(lon2 - lon1)
    const lat1r = toRad(lat1)
    const lat2r = toRad(lat2)
    const y = Math.sin(dLon) * Math.cos(lat2r)
    const x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon)
    return (toDeg(Math.atan2(y, x)) + 360) % 360
}

// Distance in metres from point p to segment a-b ([lat, lon] pairs), using a
// local flat projection (fine at stop-to-road scale).
function distToSegmentM(p, a, b) {
    const kx = Math.cos(toRad(p[0]))
    const ax = a[1] * kx, ay = a[0], bx = b[1] * kx, by = b[0], px = p[1] * kx, py = p[0]
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111320
}

// Road heading at each stop of a route direction, or null where the shape
// isn't close enough to trust.
//
// Each stop matches the FIRST stretch of shape (after the previous stop's
// match) that comes within STOP_SHAPE_MAX_M, at that stretch's closest point.
// Taking the overall closest segment instead picks the wrong pass on roads a
// route runs out and back along: the shape traces one centreline for both
// directions, so the return pass is often a hair closer, which flips the
// arrow and pushes every later stop's search past its real pass.
function shapeHeadings(rd) {
    const shape = shapes[rd.shape_id]
    if (!shape || shape.length < 2) return rd.stops.map(() => null)
    let from = 0
    return rd.stops.map((st) => {
        const p = [st.stop_lat, st.stop_lon]
        let best = -1, bestDist = Infinity
        for (let i = from; i < shape.length - 1; i++) {
            const d = distToSegmentM(p, shape[i], shape[i + 1])
            if (best >= 0 && d > bestDist) break // past this stretch's closest point
            if (d <= STOP_SHAPE_MAX_M && d < bestDist) { bestDist = d; best = i }
        }
        if (best < 0) return null
        from = best
        // Skip zero-length segments (repeated points) to get a real heading.
        let j = best
        while (j < shape.length - 2 && shape[j][0] === shape[j + 1][0] && shape[j][1] === shape[j + 1][1]) j++
        const [a, b] = [shape[j], shape[j + 1]]
        if (a[0] === b[0] && a[1] === b[1]) return null
        return computeBearing(a[0], a[1], b[0], b[1])
    })
}

const angleBetween = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }

console.log("Computing stop bearings...")
const bearingAccum = {} // stop_id -> { departing: [deg], arriving: [deg] }
for (const rd of routeDirections) {
    const s = rd.stops
    if (s.length < 2) continue
    const road = shapeHeadings(rd)
    for (let i = 0; i < s.length; i++) {
        const last = i === s.length - 1
        const chord = last
            ? computeBearing(s[i - 1].stop_lat, s[i - 1].stop_lon, s[i].stop_lat, s[i].stop_lon)
            : computeBearing(s[i].stop_lat, s[i].stop_lon, s[i + 1].stop_lat, s[i + 1].stop_lon)
        // A road heading nearly opposite the way to the next stop means the
        // shape match went wrong (e.g. matched the other direction's pass);
        // fall back to the straight line.
        const b = road[i] != null && angleBetween(road[i], chord) <= 135 ? road[i] : chord
        const acc = (bearingAccum[s[i].stop_id] ||= { departing: [], arriving: [] })
        acc[last ? "arriving" : "departing"].push(b)
    }
}
const stopBearings = {}
for (const [id, { departing, arriving }] of Object.entries(bearingAccum)) {
    const bs = departing.length ? departing : arriving
    let sin = 0, cos = 0
    for (const b of bs) { sin += Math.sin(toRad(b)); cos += Math.cos(toRad(b)) }
    const agreement = Math.hypot(sin, cos) / bs.length
    stopBearings[id] = agreement >= MIN_BEARING_AGREEMENT
        ? Math.round((toDeg(Math.atan2(sin, cos)) + 360) % 360)
        : null
}

const out = { routeDirections, shapes, shapeStops, stopBearings, feedInfo }
fs.writeFileSync("./data/processed.json", JSON.stringify(out))
console.log(`Done. Wrote data/processed.json (${(fs.statSync("./data/processed.json").size / 1024 / 1024).toFixed(1)} MB)`)
console.log(`  routeDirections: ${routeDirections.length}, shapes: ${Object.keys(shapes).length}, shapeStops: ${Object.keys(shapeStops).length}, stopBearings: ${Object.keys(stopBearings).length}`)
