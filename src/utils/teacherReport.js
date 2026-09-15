// ═══════════════════════════════════════════════════════════════════
// teacherReport.js — turn raw app_results rows into per-activity answer
// buckets the tone-report renderer can draw, for the teacher dashboard's
// weak-tone breakdowns (per-student and whole-class — same buckets, just fed
// more students' rows).
//
// Two things here differ deliberately from the student's own report, and both
// exist because the teacher view aggregates ACROSS attempts and students:
//
//   1. One attempt per student per activity (the most recent). Pooling every
//      attempt made a student who replayed 20 times outweigh 14 classmates,
//      and made the per-student page disagree with the student's own composite
//      report, which is latest-attempt-only (diagnosticReportView.js).
//   2. Percentage bands (≥67 / ≥34 / else) for single-syllable data instead of
//      toneReport's all-or-nothing rule. That rule is correct for ONE attempt
//      with 2 questions per tone (Test 1/3 draw exactly that), where it agrees
//      with the percentage bands exactly — but on pooled data a tone is almost
//      never 0% or 100%, so every tone collapsed into the middle band and the
//      recommendation degenerated to "4th tone" no matter what the class did.
//
// Per-test-type field quirks mirror the decoding diagnosticReportView.js
// already does (Test C stores `passed`, not `correct`, per question) — kept in
// sync so the numbers never disagree between student and teacher views.
// ═══════════════════════════════════════════════════════════════════
import { analyzeDisyllabic, summarize } from './toneReport.js'

export const ACTIVITY_META = {
  A: { shape: 'single', label: 'Test 1 · Single-syllable recognition', skill: 'recognizing' },
  B: { shape: 'disyl', label: 'Test 2 · Disyllable recognition', skill: 'recognizing' },
  C: { shape: 'single', label: 'Test 3 · Speaking', skill: 'speaking' },
  'P5-single': { shape: 'single', label: 'Practice V · Single characters', skill: 'reading' },
  'P5-word': { shape: 'disyl', label: 'Practice V · 2-character words', skill: 'reading' },
}

function parseDetails(result) {
  let det = result.details
  if (typeof det === 'string') {
    try { det = JSON.parse(det) } catch { det = null }
  }
  return det || {}
}

/** Which weak-tone activity a raw row belongs to, or null if it carries none. */
function activityKey(result, det) {
  if (result.test_type === 'P5') return det.set === 'word' ? 'P5-word' : 'P5-single'
  return ACTIVITY_META[result.test_type] ? result.test_type : null
}

/** Per-test-type answer decoding → the { tone } / { tones } shape the analyzers take. */
function decode(key, raw) {
  const single = (x, correct) => ({ tone: x.tone, correct })
  const pair = (x, correct) => ({ tones: x.tones || [x.tone1, x.tone2], correct })
  let out
  switch (key) {
    case 'A': out = raw.map(x => single(x, !!x.correct)); break
    case 'C': out = raw.map(x => single(x, !!x.passed)); break // Test 3 stores `passed`
    case 'P5-single': out = raw.map(x => single(x, !!x.correct)); break
    case 'B': case 'P5-word': out = raw.map(x => pair(x, !!x.correct)); break
    default: return []
  }
  return ACTIVITY_META[key].shape === 'disyl'
    ? out.filter(a => Array.isArray(a.tones) && a.tones.length === 2)
    : out.filter(a => a.tone >= 1 && a.tone <= 4)
}

/**
 * Group raw app_results rows into per-activity answer arrays, keeping only each
 * student's most recent attempt per activity. Rows may come from one student
 * (app_teacher_student_results) or a whole class (app_teacher_class_results,
 * which tags each row with `username`).
 */
export function bucketAnswers(results) {
  const latest = new Map()
  for (const r of results || []) {
    const det = parseDetails(r)
    const raw = det.answers || []
    if (!raw.length) continue // attempts saved before per-question data existed
    const key = activityKey(r, det)
    if (!key) continue
    const slot = `${r.username ?? ''}|${key}`
    const at = Date.parse(r.created_at) || 0
    const prev = latest.get(slot)
    if (!prev || at > prev.at) latest.set(slot, { key, raw, at })
  }
  const buckets = {}
  for (const { key, raw } of latest.values()) {
    const decoded = decode(key, raw)
    if (decoded.length) (buckets[key] ??= []).push(...decoded)
  }
  return buckets
}

// Slide-12 percentage bands, the same thresholds analyzeDisyllabic uses.
const band = (pct) => (pct >= 67 ? 1 : pct >= 34 ? 0.5 : 0)

/** Single-syllable analysis with percentage bands — see note 2 in the header. */
function analyzePooledSingle(answers) {
  const perTone = {}
  for (let t = 1; t <= 4; t++) {
    const qs = answers.filter(a => a.tone === t)
    const correct = qs.filter(a => a.correct).length
    const total = qs.length // 0 = never asked; summarize() skips it
    const ratio = total ? correct / total : 0
    const pct = Math.round(ratio * 100)
    perTone[t] = { correct, total, ratio, pct, band: total === 0 ? 0 : band(pct) }
  }
  return summarize(perTone, 'syllable')
}

/** Run the shape-appropriate analyzer for one activity bucket. */
export function analyzeBucket(key, answers) {
  return ACTIVITY_META[key].shape === 'disyl' ? analyzeDisyllabic(answers) : analyzePooledSingle(answers)
}
