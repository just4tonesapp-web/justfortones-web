// ═══════════════════════════════════════
// Progress Service — persist and retrieve test results
//
// Logged-in users (username/password in OUR database — app_users, not
// Supabase Auth): Supabase `app_results` via the security-definer RPCs
// app_save_result / app_get_results (see scripts/sql/app_results.sql).
// Guests: localStorage only.
//
// localStorage is always written first as a backup; rows that reached the
// cloud carry `synced: true`. getResults() re-uploads any unsynced rows
// (taken as guest, or while the server was unreachable) before reading, so
// history survives new devices and cleared browsers once the user logs in.
// ═══════════════════════════════════════
import { supabase } from '../supabaseClient.js'

const LS_KEY = 'j4t_progress'

function currentUser() {
  try { return JSON.parse(localStorage.getItem('j4t_user') || 'null') } catch { return null }
}

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}

function writeLocal(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list))
}

// created_at comes back from Postgres in a different string format than the
// ISO string we stored locally — compare as epoch millis.
function rowKey(r) {
  return `${r.test_type}|${new Date(r.created_at).getTime()}`
}

async function uploadResult(userId, r) {
  const { data, error } = await supabase.rpc('app_save_result', {
    p_user_id: userId,
    p_test_type: r.test_type,
    p_score: r.score,
    p_total: r.total,
    p_passed: r.passed,
    p_details: r.details ?? {},
    p_created_at: r.created_at,
  })
  if (error || data?.error) throw new Error(error?.message || data.error)
}

/** Save a test result */
export async function saveResult(testType, score, total, details = {}) {
  const result = {
    test_type: testType,  // 'A', 'B', 'C', 'D', 'X', 'Y', 'Z'
    score,
    total,
    passed: score >= (total === 12 ? 7 : Math.ceil(total * 0.58)),
    details,              // per-tone breakdown, etc.
    created_at: new Date().toISOString(),
  }

  // Always save to localStorage first
  const local = readLocal()
  local.push(result)
  writeLocal(local)

  const user = currentUser()
  if (user?.id) {
    try {
      await uploadResult(user.id, result)
      // Mark the stored copy as synced (re-read: another save may have landed)
      const fresh = readLocal()
      const mine = fresh.find(r => rowKey(r) === rowKey(result))
      if (mine) { mine.synced = true; writeLocal(fresh) }
    } catch (e) {
      console.warn('[Progress] cloud save failed (kept locally, will retry):', e?.message)
    }
  }

  return result
}

/** Get all results for the current user, most recent first */
export async function getResults() {
  const user = currentUser()
  const local = readLocal()
  if (!user?.id) return local.slice().reverse()

  try {
    // Push up local rows the cloud doesn't have yet (guest runs, offline runs).
    const pending = local.filter(r => !r.synced)
    let uploaded = false
    for (const r of pending) {
      try { await uploadResult(user.id, r); r.synced = true; uploaded = true }
      catch { break } // server unreachable — stop, keep rows for next time
    }
    if (uploaded) writeLocal(local)

    const { data, error } = await supabase.rpc('app_get_results', { p_user_id: user.id })
    if (error) throw error
    if (Array.isArray(data)) {
      // Cloud is authoritative; append local rows it doesn't have (sync failed)
      const seen = new Set(data.map(rowKey))
      const extras = local.filter(r => !seen.has(rowKey(r)))
      return [...data, ...extras]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
  } catch (e) {
    console.warn('[Progress] cloud fetch failed, using local history:', e?.message)
  }
  return local.slice().reverse()
}

/** Max completed attempts allowed per test, per user, per (local) day */
export const DAILY_TEST_LIMIT = 2

/** How many times this test was completed today (local time) */
export async function attemptsToday(testType) {
  const results = await getResults()
  const now = new Date()
  return results.filter(r => {
    if (r.test_type !== testType) return false
    const d = new Date(r.created_at)
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate()
  }).length
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

  // Step 1: Must pass both A and B
  const step1Done = passedA && passedB
  // Step 2: Must pass both C and D
  const step2Done = passedC && passedD
  // Step 3: Must pass X (Y is in-progress and not yet enforced)
  const step3Done = passedX

  return {
    results,
    passedA, passedB, passedC, passedD, passedX, passedY,
    // legacy fields kept for any older callers
    passedZ: false,
    step1Done, step2Done, step3Done,
    currentStep: !step1Done ? 1 : !step2Done ? 2 : 3,
  }
}

/** Clear all local progress */
export function clearLocalProgress() {
  localStorage.removeItem(LS_KEY)
}
