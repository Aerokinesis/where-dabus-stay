// Parser for the public OTS Rider Alerts page (https://www.thebus.org/RiderAlerts.asp).
//
// We can't get the official GTFS-Realtime alerts feed without OTS handing out
// the URL, so this scrapes the human-facing HTML page they publish to riders
// and normalizes it into the shape the frontend expects.
//
// The page lists every alert as a link whose href contains "HTMLFILE/TheBus/Files/".
// The anchor text is the title, and the URL filename (e.g. "639159179827902691")
// is a stable ID we can use for dismissal tracking on the client.

import * as cheerio from "cheerio"

// Category heuristics applied to the alert title. Order matters — first match wins.
const CATEGORY_RULES = [
    { test: /(bus stop closure|bus stop modification|new bus stop)/i, category: "stop_modification" },
    { test: /service change/i, category: "service_change" },
    { test: /holiday/i, category: "holiday" },
    { test: /(rider alert|detour|reroute|construction|closure)/i, category: "rider_alert" },
]

// Short human label used on Route-tab badges and inline pills.
const CATEGORY_LABEL = {
    rider_alert: "Alert",
    stop_modification: "Stop change",
    service_change: "Service change",
    holiday: "Holiday",
    other: "Notice",
}

const categorize = (title) => {
    for (const { test, category } of CATEGORY_RULES) {
        if (test.test(title)) return category
    }
    return "other"
}

// Pull the stable numeric filename out of the URL, e.g.
// ".../Files/639159179827902691/639159179827902691.htm" -> "639159179827902691"
const extractId = (url) => {
    const m = url.match(/\/Files\/(\d+)\//)
    return m ? m[1] : url
}

// Find a date in the title like "5/31/2026" and return it as YYYY-MM-DD.
const extractPostedDate = (title) => {
    const m = title.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
    if (!m) return null
    const [, month, day, year] = m
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

// Walk the title looking for route mentions. Two shapes:
//   "Route 1", "Route 1L", "Route 317", "Route PH8"  -> 1, 1L, 317, PH8
//   "A Line", "U Line", "W Line"                       -> A, U, W
// Each token is bucketed: if knownRoutes recognizes it, it's an "affected_route"
// the frontend can cross-link; otherwise it's an "affected_route_name" we keep
// around for display but can't deep-link.
const extractAffectedRoutes = (title, knownRoutes) => {
    const inGtfs = new Set()
    const mentioned = new Set()

    const add = (token) => {
        if (!token) return
        if (knownRoutes.has(token)) inGtfs.add(token)
        else mentioned.add(token)
    }

    // "Route X" — accepts 1, 1L, 317, PH8, etc.
    const routeRe = /\bRoute\s+([A-Z]{0,3}\d{0,4}[A-Z]?)\b/gi
    let m
    while ((m = routeRe.exec(title)) !== null) {
        const token = m[1].toUpperCase()
        if (token) add(token)
    }

    // "A Line" / "U Line" / "W Line" / "Skyline" feeders (single uppercase letter
    // followed by " Line"). We avoid matching things like "Bus Line" by requiring
    // exactly one or two uppercase letters.
    const lineRe = /\b([A-Z]{1,2})\s+Line\b/g
    while ((m = lineRe.exec(title)) !== null) {
        const token = m[1]
        if (knownRoutes.has(token)) inGtfs.add(token)
        else mentioned.add(`${token} Line`)
    }

    return {
        affected_routes: [...inGtfs].sort(),
        affected_route_names: [...mentioned].sort(),
    }
}

// Parse the rider alerts HTML into an array of normalized alert objects.
// `knownRoutes` is a Set of route_short_name strings from the loaded GTFS.
export function parseAlerts(html, knownRoutes) {
    const $ = cheerio.load(html)
    const seen = new Set()
    const alerts = []

    $("a").each((_, el) => {
        const href = $(el).attr("href") || ""
        if (!href.includes("HTMLFILE/TheBus/Files/")) return
        const title = $(el).text().trim()
        if (!title) return

        const id = extractId(href)
        if (seen.has(id)) return
        seen.add(id)

        const url = href.startsWith("http") ? href : `https://www.thebus.org${href.startsWith("/") ? "" : "/"}${href}`
        const category = categorize(title)
        const { affected_routes, affected_route_names } = extractAffectedRoutes(title, knownRoutes)

        alerts.push({
            id,
            title,
            url,
            category,
            category_label: CATEGORY_LABEL[category] || CATEGORY_LABEL.other,
            affected_routes,
            affected_route_names,
            posted_date: extractPostedDate(title),
        })
    })

    return alerts
}
