const SHELL_CACHE = 'dabus-shell-v2'
const STOPS_CACHE = 'dabus-stops-v1'

// Pre-cached on install. index.html MUST be here: it's the offline fallback
// for navigations — when Android discards the PWA from recents and restores
// it on a flaky network, this cache is the only thing standing between the
// user and a blank screen.
const SHELL_ASSETS = ['/', '/index.html', '/dabus-icon.png', '/manifest.json']

const STOPS_PATTERNS = [
  '/api/nearby-stops-by-coords',
  '/api/search-stops',
  '/api/routes',
  '/api/route/',
  '/api/stop/',
  '/api/shape/',
]

const isStopsRequest = (url) =>
  STOPS_PATTERNS.some((p) => new URL(url).pathname.startsWith(p))

const isArrivalsRequest = (url) =>
  new URL(url).pathname.startsWith('/api/arrivals')

// Install: cache the app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== STOPS_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = request.url

  if (request.method !== 'GET') return

  // Arrivals are real-time — always go to network, no cache
  if (isArrivalsRequest(url)) return

  // Stops/routes data — network first, fall back to cache
  if (isStopsRequest(url)) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone()
          caches.open(STOPS_CACHE).then((c) => c.put(request, clone))
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // HTML navigation (loading the page) — network first so a new deployment's
  // index.html (with updated JS bundle hashes) is always fetched fresh.
  // Cache the fresh copy each time so the offline fallback never goes stale.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(SHELL_CACHE).then((c) => c.put('/index.html', clone))
          }
          return res
        })
        .catch(async () => {
          const cached = await caches.match('/index.html')
          // Never return undefined from respondWith — that breaks the
          // navigation outright (blank screen). Worst case, say so.
          return (
            cached ||
            new Response(
              '<h1>Offline</h1><p>Where Da Bus Stay? needs a connection for first load.</p>',
              { status: 503, headers: { 'Content-Type': 'text/html' } }
            )
          )
        })
    )
    return
  }

  // Static same-origin assets (JS, CSS, images) — cache first, and WRITE
  // successful fetches back to the cache. Vite's hashed filenames make the
  // cached copies permanently valid; without the write-back, the app shell
  // was never actually available offline and a discarded-tab restore on a
  // flaky network produced a black screen (bundle fetch failed, body is
  // dark-themed, no UI mounts).
  if (new URL(url).origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone()
              caches.open(SHELL_CACHE).then((c) => c.put(request, clone))
            }
            return res
          })
      )
    )
  }
})
