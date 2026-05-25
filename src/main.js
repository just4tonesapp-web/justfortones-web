// ═══════════════════════════════════════
// Just4Tones – Main entry point
// ═══════════════════════════════════════
import './styles/global.css'
import { route, startRouter, navigate } from './router.js'
import { supabase } from './supabaseClient.js'
import { authView } from './views/authView.js'
import { homeView } from './views/homeView.js'
import { homeViewOld } from './views/homeViewOld.js'
import { testAView } from './views/testAView.js'
import { testAOldView } from './views/testAOldView.js'
import { testBView } from './views/testBView.js'
import { testBOldView } from './views/testBOldView.js'
import { testCView } from './views/testCView.js'
import { testCOldView } from './views/testCOldView.js'
import { testDView } from './views/testDView.js'
import { testDOldView } from './views/testDOldView.js'
import { testXYZView } from './views/testXYZView.js'
import { diagnosticReportView } from './views/diagnosticReportView.js'
import { diagnosticReportOldView } from './views/diagnosticReportOldView.js'
import { practiceRecView } from './views/practiceRecView.js'
import { practiceProView } from './views/practiceProView.js'
import { practiceCharView } from './views/practiceCharView.js'
import { historyView } from './views/historyView.js'
import { testYView } from './views/testYView.js'

// ── Auth state ──
let currentUser = null

/** Check if user is authenticated (logged in or guest) */
function isAuthenticated() {
  return currentUser || sessionStorage.getItem('j4t_guest') === '1'
}

/** Wrap a view with auth guard */
function guarded(viewFn) {
  return (container) => {
    if (!isAuthenticated()) {
      navigate('/login')
      return
    }
    return viewFn(container)
  }
}

// ── Register routes ──
route('/login', authView)
route('/', guarded(homeView))
route('/test-a', guarded(testAView))
route('/test-b', guarded(testBView))
route('/test-c', guarded(testCView))
route('/test-d', guarded(testDView))

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
route('/practice-recognition', guarded(practiceRecView))
route('/practice-production', guarded(practiceProView))
route('/practice-characters', guarded(practiceCharView))

// ── Init: check session then start ──
async function init() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    currentUser = session?.user || null
  } catch (e) {
    // Supabase not configured yet — allow guest mode
    console.warn('Supabase auth check failed (not configured?):', e.message)
  }

  // Listen for auth changes.
  // Supabase fires SIGNED_IN on token refresh and tab refocus, not just on a
  // fresh login — so we only navigate('/') when the user transitions from
  // signed-out to signed-in, otherwise the page would jump back to home every
  // few minutes while the user is mid-test.
  supabase.auth.onAuthStateChange((event, session) => {
    const wasLoggedIn = !!currentUser
    currentUser = session?.user || null
    const isLoggedIn = !!currentUser

    if (event === 'SIGNED_IN' && !wasLoggedIn && isLoggedIn) {
      sessionStorage.removeItem('j4t_guest')
      navigate('/')
    }
    if (event === 'SIGNED_OUT') {
      navigate('/login')
    }
  })

  startRouter()
}

init()