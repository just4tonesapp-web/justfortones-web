// ═══════════════════════════════════════
// Simple hash-based SPA router
// ═══════════════════════════════════════
import { stopAllAudio } from './utils/audio.js'
import { showLoader, hideLoader } from './utils/loader.js'

const routes = {}
let currentCleanup = null

/**
 * Register a route
 * @param {string} path - hash path, e.g. '/' or '/test-a'
 * @param {(container: HTMLElement) => (() => void)|void} handler
 *   receives the #app element, optionally returns a cleanup function
 */
export function route(path, handler) {
  routes[path] = handler
}

/** Navigate programmatically */
export function navigate(path) {
  window.location.hash = path === '/' ? '' : path
}

/** Start listening */
export function startRouter() {
  const resolve = () => {
    const hash = window.location.hash.replace('#', '') || '/'
    const handler = routes[hash] || routes['/']
    const app = document.getElementById('app')

    // Always stop any in-flight audio when changing views
    stopAllAudio()

    // run previous cleanup
    if (typeof currentCleanup === 'function') currentCleanup()

    if (handler) {
      app.innerHTML = '' // clear
      const result = handler(app)
      // Async views (return a Promise) get a loading spinner until they render.
      if (result && typeof result.then === 'function') {
        showLoader()
        currentCleanup = null
        result.finally(() => hideLoader())
      } else {
        hideLoader()
        currentCleanup = result || null
      }
    }
  }

  window.addEventListener('hashchange', resolve)
  resolve() // initial
}
