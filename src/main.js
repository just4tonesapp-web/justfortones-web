// ═══════════════════════════════════════
// Just4Tones – Main entry point
// ═══════════════════════════════════════
import './styles/global.css'
import { route, startRouter, navigate } from './router.js'
import { authView } from './views/authView.js'
import { homeView } from './views/homeView.js'
import { homeViewOld } from './views/homeViewOld.js'
import { diagnoseView } from './views/diagnoseView.js'
import { testAView } from './views/testAView.js'
import { testAOldView } from './views/testAOldView.js'
import { testBView } from './views/testBView.js'
import { testBOldView } from './views/testBOldView.js'
import { testCView } from './views/testCView.js'
import { testCOldView } from './views/testCOldView.js'
import { testDOldView } from './views/testDOldView.js'
import { testXYZView } from './views/testXYZView.js'
import { diagnosticReportView } from './views/diagnosticReportView.js'
import { diagnosticReportOldView } from './views/diagnosticReportOldView.js'
import { practiceRecView } from './views/practiceRecView.js'
import { practiceProView } from './views/practiceProView.js'
import { practiceCharView } from './views/practiceCharView.js'
import { practiceType1View } from './views/practiceType1View.js'
import { practiceType2View } from './views/practiceType2View.js'
import { practiceType3View } from './views/practiceType3View.js'
import { historyView } from './views/historyView.js'
import { testYView } from './views/testYView.js'

// ── Auth state ──
// Username/password lives in OUR database (Supabase Postgres via pgcrypto RPCs),
// NOT Supabase Auth — so no email, no domain, no auth rate limit. A successful
// login stores a small session { id, username } in localStorage under j4t_user.
function getUser() {
  try { return JSON.parse(localStorage.getItem('j4t_user') || 'null') } catch { return null }
}

/** Check if user is authenticated (logged in or guest) */
function isAuthenticated() {
  return !!getUser() || sessionStorage.getItem('j4t_guest') === '1'
}

/** Wrap a view with auth guard */
function guarded(viewFn) {
  return (container) => {
    // Login is the 2nd page: it appears when a signed-out visitor tries to START
    // the test (the home "Test My Tone Skills Now" CTA → /diagnose), NOT as a wall
    // on the home page itself (which is unguarded). Remember the intended route so
    // we can resume there once they log in or continue as a guest.
    if (!isAuthenticated()) {
      sessionStorage.setItem('j4t_redirect', window.location.hash.replace('#', '') || '/diagnose')
      navigate('/login')
      return
    }
    return viewFn(container)
  }
}

// ── Global account bar (History · Log out) ──
// Shown on EVERY page when signed in with a real account. Lives on <body> (not
// inside #app), so it persists across view changes instead of being re-created
// per view. Hidden for guests/anonymous visitors.
const ICON_HISTORY = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>'
const ICON_LOGOUT = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>'

function setupAccountBar() {
  let bar = document.getElementById('account-bar')
  if (!bar) {
    bar = document.createElement('div')
    bar.id = 'account-bar'
    bar.className = 'account-bar'
    bar.innerHTML = `
      <button class="acct-link" id="acct-history" type="button">${ICON_HISTORY}<span>History</span></button>
      <button class="acct-link" id="acct-logout" type="button">${ICON_LOGOUT}<span>Log out</span></button>
    `
    document.body.appendChild(bar)
    bar.querySelector('#acct-history').addEventListener('click', () => navigate('/history'))
    bar.querySelector('#acct-logout').addEventListener('click', () => {
      localStorage.removeItem('j4t_user')
      sessionStorage.removeItem('j4t_guest')
      setupAccountBar()
      navigate('/login')
    })
  }
  bar.style.display = getUser() ? 'flex' : 'none'
}

// ── Register routes ──
route('/login', authView)
route('/', homeView) // home is viewable without login; login gates the test, not the landing
route('/diagnose', guarded(diagnoseView))
route('/test-1', guarded(testAView))
route('/test-2', guarded(testBView))
route('/test-3', guarded(testCView))

route('/test', guarded((container) => testCView(container, { debug: true })))
route('/test-xyz', guarded(testXYZView))
route('/test-x', guarded(testXYZView))
route('/test-y', guarded(testYView))
route('/report', guarded(diagnosticReportView))
route('/history', guarded(historyView))

// ── Legacy "old" flow (snapshot of pre-redesign UI) ──
route('/old', guarded(homeViewOld))
route('/old/test-a', guarded(testAOldView))
route('/old/test-b', guarded(testBOldView))
route('/old/test-c', guarded(testCOldView))
route('/old/test-d', guarded(testDOldView))
route('/old/test-xyz', guarded(testXYZView))
route('/old/test-x', guarded(testXYZView))
route('/old/test-y', guarded(testYView))
route('/old/report', guarded(diagnosticReportOldView))
route('/practice-1', guarded(practiceType1View)) // Practice Type I — tone recognition (pptx slide 25)
route('/practice-2', guarded(practiceType2View)) // Practice Type II — listen & speak (pptx slide 26)
route('/practice-3', guarded(practiceType3View)) // Practice Type III — tone-change rules (pptx slide 27)
route('/practice-recognition', guarded(practiceRecView))
route('/practice-production', guarded(practiceProView))
route('/practice-characters', guarded(practiceCharView))

// ── Init ──
// authView dispatches 'j4t-auth' after login/signup/logout so the account bar
// re-renders. No async session fetch — the session is purely local.
window.addEventListener('j4t-auth', setupAccountBar)
setupAccountBar()
startRouter()