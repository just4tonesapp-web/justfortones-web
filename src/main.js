// ═══════════════════════════════════════
// Just4Tones – Main entry point
// ═══════════════════════════════════════
import './styles/global.css'
import { route, startRouter } from './router.js'
import { homeView } from './views/homeView.js'
import { testAView } from './views/testAView.js'

// Register views
route('/', homeView)
route('/test-a', testAView)

// Future routes:
// route('/test-b', testBView)
// route('/test-c', testCView)
// route('/practice-recognition', practiceRecView)

// Go
startRouter()
