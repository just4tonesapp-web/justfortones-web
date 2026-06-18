// ═══════════════════════════════════════
// Global loading overlay
//
// showLoader() is debounced — the spinner only appears if the work it's
// guarding takes longer than `delay` ms, so fast (synchronous) view renders
// don't flash a spinner. hideLoader() cancels a pending show or removes it.
// ═══════════════════════════════════════
let el = null
let timer = null

export function showLoader(delay = 150) {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (el) return
    el = document.createElement('div')
    el.className = 'loader-overlay'
    el.innerHTML = '<div class="loader-spinner"></div>'
    document.body.appendChild(el)
  }, delay)
}

export function hideLoader() {
  clearTimeout(timer)
  if (el) { el.remove(); el = null }
}
