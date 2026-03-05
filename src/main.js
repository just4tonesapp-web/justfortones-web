// ═══════════════════════════════════════
// Just4Tones – Main entry point
// ═══════════════════════════════════════
import './styles/global.css'
import { route, startRouter, navigate } from './router.js'
import { supabase } from './supabaseClient.js'
import { authView } from './views/authView.js'
import { homeView } from './views/homeView.js'
import { testAView } from './views/testAView.js'
import { testBView } from './views/testBView.js'
import { testCView } from './views/testCView.js'

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

// Future routes:
// route('/test-d', guarded(testDView))
// route('/practice-recognition', guarded(practiceRecView))

// ── Init: check session then start ──
async function init() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    currentUser = session?.user || null
  } catch (e) {
    // Supabase not configured yet — allow guest mode
    console.warn('Supabase auth check failed (not configured?):', e.message)
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null
    if (_event === 'SIGNED_IN') {
      sessionStorage.removeItem('j4t_guest')
      navigate('/')
    }
    if (_event === 'SIGNED_OUT') {
      navigate('/login')
    }
  })

  startRouter()
}

init()