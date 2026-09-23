import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AdminPage from './admin/AdminLazy.jsx'

// /admin is the editors' announcements dashboard. Lazy so its Supabase
// client never lands in the rider-facing bundle. (vercel.json rewrites every
// path to index.html, so this works without a router.)
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

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
  </StrictMode>,
)
