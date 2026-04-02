// ═══════════════════════════════════════
// Progress Service — persist and retrieve test results
//
// Authenticated users: Supabase `test_results` table
// Guest users: localStorage fallback
// ═══════════════════════════════════════
import { supabase } from '../supabaseClient.js'

const LS_KEY = 'j4t_progress'

/** Save a test result */
export async function saveResult(testType, score, total, details = {}) {
  const result = {
    test_type: testType,  // 'A', 'B', 'C', 'D', 'X', 'Y', 'Z'
    score,
    total,
    passed: score >= (total === 12 ? 10 : Math.ceil(total * 0.83)),
    details,              // per-tone breakdown, etc.
    created_at: new Date().toISOString(),
  }

  // Always save to localStorage as backup
  const local = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  local.push(result)
  localStorage.setItem(LS_KEY, JSON.stringify(local))

  // Try Supabase if authenticated
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await supabase.from('test_results').insert({
        user_id: session.user.id,
        ...result,
        details: JSON.stringify(details),
      })
    }
  } catch (e) {
    console.warn('[Progress] Supabase save failed:', e.message)
  }

  return result
}

/** Get all results for the current user */
export async function getResults() {
  // Try Supabase first
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { data } = await supabase
        .from('test_results')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      if (data?.length) return data
    }
  } catch (e) {
    // fall through to localStorage
  }

  return JSON.parse(localStorage.getItem(LS_KEY) || '[]').reverse()
}

/** Get the latest result for a specific test */
export async function getLatestResult(testType) {
  const results = await getResults()
  return results.find(r => r.test_type === testType) || null
}

/** Check which diagnostic step the user is at based on pass/fail history */
export async function getDiagnosticState() {
  const results = await getResults()

  const best = (type) => {
    const r = results.find(r => r.test_type === type && r.passed)
    return r ? r : null
  }

  const passedA = !!best('A')
  const passedB = !!best('B')
  const passedC = !!best('C')
  const passedD = !!best('D')
  const passedX = !!best('X')
  const passedY = !!best('Y')
  const passedZ = !!best('Z')

  // Step 1: Must pass both A and B
  const step1Done = passedA && passedB
  // Step 2: Must pass both C and D
  const step2Done = passedC && passedD
  // Step 3: Must pass all X, Y, Z
  const step3Done = passedX && passedY && passedZ

  return {
    results,
    passedA, passedB, passedC, passedD, passedX, passedY, passedZ,
    step1Done, step2Done, step3Done,
    // Which step should the user be on?
    currentStep: !step1Done ? 1 : !step2Done ? 2 : 3,
  }
}

/** Clear all local progress */
export function clearLocalProgress() {
  localStorage.removeItem(LS_KEY)
}
