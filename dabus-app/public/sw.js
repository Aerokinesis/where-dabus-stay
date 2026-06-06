const SHELL_CACHE = 'dabus-shell-v1'
const STOPS_CACHE = 'dabus-stops-v1'

const SHELL_ASSETS = ['/', '/index.html']

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

  // App shell — cache first, fall back to network
  e.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  )
})
