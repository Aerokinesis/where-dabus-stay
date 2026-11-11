import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import { applyTheme, savedThemeSetting } from './theme'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AdminPage from './admin/AdminLazy.jsx'

// Set the theme before the first render so a light-theme device doesn't
// flash the dark default while the app loads.
applyTheme(savedThemeSetting())

// /admin is the editors' announcements dashboard. Lazy so its Supabase
// client never lands in the rider-facing bundle. (vercel.json rewrites every
// path to index.html, so this works without a router.)
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

// The service worker is normally skipped in local dev — its cache-first
// asset handling fights Vite's HMR. But Chrome refuses to fire
// beforeinstallprompt without a registered SW, so install can't be
// tested locally at all while it's off. ?sw=1 opts back in for that.
// (Registered from here rather than an inline <script> so the page can run
// under a CSP that only allows the app's own script files.)
if ('serviceWorker' in navigator) {
  const isLocal =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  const forced = new URLSearchParams(location.search).has('sw')
  if (!isLocal || forced) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
    })
  }
}

// Vercel Web Analytics (cookie-free page view and visitor counts, viewed in
// the Vercel dashboard). Only the path is reported: the query string is
// dropped so the stop or route a rider opened (?stop=…, ?route=…) isn't
// recorded, and the editors' /admin page isn't counted at all. It only
// sends data from a deployed site, not from local dev.
const analyticsBeforeSend = (event) => {
  const url = new URL(event.url)
  if (url.pathname.replace(/\/+$/, '') === '/admin') return null
  return { ...event, url: url.origin + url.pathname }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Root boundary: a crash anywhere outside the inner boundaries would
        otherwise unmount everything — on the dark theme that reads as a
        "black blank screen" with no way out but restarting the app. */}
    <ErrorBoundary>
      {isAdmin ? (
        <Suspense fallback={null}>
          <AdminPage />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
    <Analytics beforeSend={analyticsBeforeSend} />
  </StrictMode>,
)
