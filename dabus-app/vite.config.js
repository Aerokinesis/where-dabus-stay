import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Unique id per deployment. Vercel exposes the commit SHA at build time;
// fall back to a timestamp for local builds.
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36)

// Emits /version.json into the build output. The running app compares its
// embedded __BUILD_ID__ against this file to detect new deployments
// (see src/hooks/useUpdateCheck.js).
const versionFilePlugin = () => ({
  name: 'emit-version-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ buildId }),
    })
  },
})

// Inlines the entry stylesheet into index.html so the first paint doesn't
// wait on a separate render-blocking CSS request (it's ~15 KiB). Screens
// loaded on demand still bring their own CSS files.
const inlineEntryCssPlugin = () => ({
  name: 'inline-entry-css',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      if (!ctx.bundle) return html
      return html.replace(
        /<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g,
        (tag, file) => {
          const asset = ctx.bundle[file]
          return asset && asset.type === 'asset' ? `<style>${asset.source}</style>` : tag
        },
      )
    },
  },
})

// Opens connections to the API and map-tile servers while the app bundle is
// still downloading, instead of only once the first request is made. The API
// is cross-origin fetch() (CORS), so its hint needs crossorigin; tiles are
// plain <img> loads, so theirs doesn't.
const preconnectPlugin = (apiBase) => ({
  name: 'preconnect-origins',
  apply: 'build',
  transformIndexHtml() {
    const tags = [
      { tag: 'link', attrs: { rel: 'preconnect', href: 'https://tile.openstreetmap.org' }, injectTo: 'head' },
    ]
    try {
      const { origin } = new URL(apiBase)
      tags.unshift({ tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: '' }, injectTo: 'head' })
    } catch {
      // Same-origin API (VITE_API_BASE empty or relative): nothing to preconnect.
    }
    return tags
  },
})

// The CSP in vercel.json allows index.html's inline <script> by its hash.
// Editing that script changes the hash, so check it on every build and print
// the value to paste in rather than letting the policy go stale silently.
const cspHashCheckPlugin = () => ({
  name: 'csp-inline-script-hash',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const vercel = readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')
      for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
        const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`
        if (!vercel.includes(hash)) {
          console.warn(`
[csp] index.html inline script hash not in vercel.json script-src: ${hash}
`)
        }
      }
      return html
    },
  },
})

export default defineConfig(({ mode }) => ({
  plugins:
    mode === 'development'
      ? [react(), basicSsl()]
      : [
          react(),
          versionFilePlugin(),
          inlineEntryCssPlugin(),
          preconnectPlugin(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE),
          cspHashCheckPlugin(),
        ],
  server: {
    proxy: {
      // Dev only: forward /api to the local Express backend so the HTTPS dev
      // server (basicSsl) and HTTP backend don't trip mixed-content or CORS.
      '/api': { target: 'http://localhost:3001', changeOrigin: true, secure: false },
    },
  },
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
}))
