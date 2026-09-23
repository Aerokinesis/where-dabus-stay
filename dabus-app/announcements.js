// Community announcements — read side.
//
// Posts live in Supabase (see supabase/0001_announcements.sql). Editors write
// them from the in-app /admin page directly against Supabase; this module is
// the READ path the public app uses, proxied through Express so:
//   - the frontend keeps one API origin (same as /api/alerts, /api/arrivals)
//   - we cache for a minute and absorb Supabase hiccups by serving stale data
//   - route-targeted posts can be merged into /api/alerts in the same shape as
//     the scraped OTS alerts, so RouteAlerts renders them with zero changes.
//
// Reads use the anon key: RLS only exposes posts whose visibility window is
// currently open, which is exactly what the public app should see.

const CACHE_MS = 60 * 1000

const CATEGORY_LABEL = {
    service_change: "Service change",
    event: "Event",
    volunteer: "Volunteer",
    otr_update: "OTR update",
}

let cache = { posts: null, fetchedAt: 0 }

export const isConfigured = () =>
    Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)

const fetchPostsFromSupabase = async () => {
    const base = process.env.SUPABASE_URL.replace(/\/$/, "")
    const key = process.env.SUPABASE_ANON_KEY
    const params = new URLSearchParams({
        select: "id,category,title,body,route_ids,stop_ids,images,link_url,pinned,starts_at,ends_at,created_at,updated_at",
        order: "pinned.desc,starts_at.desc",
        limit: "100",
    })
    const r = await fetch(`${base}/rest/v1/posts?${params}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) throw new Error(`Supabase ${r.status}`)
    const rows = await r.json()
    return rows.map((p) => ({
        ...p,
        category_label: CATEGORY_LABEL[p.category] || "Notice",
        images: Array.isArray(p.images) ? p.images : [],
        route_ids: Array.isArray(p.route_ids) ? p.route_ids : [],
        stop_ids: Array.isArray(p.stop_ids) ? p.stop_ids : [],
    }))
}

// Returns { posts, stale, fetchedAt }. Never throws once we've had one
// successful fetch — a Supabase outage degrades to stale data, not a 5xx.
export const getPosts = async () => {
    if (!isConfigured()) return { posts: [], stale: false, fetchedAt: 0, configured: false }
    const now = Date.now()
    if (cache.posts && now - cache.fetchedAt < CACHE_MS) {
        return { posts: cache.posts, stale: false, fetchedAt: cache.fetchedAt, configured: true }
    }
    try {
        const posts = await fetchPostsFromSupabase()
        cache = { posts, fetchedAt: now }
        return { posts, stale: false, fetchedAt: now, configured: true }
    } catch (err) {
        console.error("announcements fetch failed:", err.message)
        if (cache.posts) return { posts: cache.posts, stale: true, fetchedAt: cache.fetchedAt, configured: true }
        throw err
    }
}

// Route-targeted posts reshaped into the alert objects alerts.js produces, so
// the frontend's per-route alert indexing (useAlerts) and RouteAlerts UI just
// work. `knownRoutes` is the set of route_short_names in the loaded GTFS —
// only those are deep-linkable; anything else is displayed as text.
export const postsToAlerts = (posts, knownRoutes) =>
    posts
        .filter((p) => p.route_ids.length > 0 || p.stop_ids.length > 0)
        .map((p) => {
            const inGtfs = p.route_ids.filter((r) => knownRoutes.has(r))
            const unknown = p.route_ids.filter((r) => !knownRoutes.has(r))
            return {
                id: `community-${p.id}`,
                source: "community",
                title: p.title,
                description: p.body || null,
                url: p.link_url || null,
                category: p.category,
                category_label: p.category_label,
                affected_routes: inGtfs.sort(),
                affected_route_names: unknown,
                affected_stops: p.stop_ids,
                posted_date: p.starts_at ? p.starts_at.slice(0, 10) : null,
                images: p.images,
            }
        })
