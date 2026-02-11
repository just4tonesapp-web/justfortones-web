// ═══════════════════════════════════════
// Simple hash-based SPA router
// ═══════════════════════════════════════

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

    // run previous cleanup
    if (typeof currentCleanup === 'function') currentCleanup()

    if (handler) {
      app.innerHTML = '' // clear
      currentCleanup = handler(app) || null
    }
  }

  window.addEventListener('hashchange', resolve)
  resolve() // initial
}
