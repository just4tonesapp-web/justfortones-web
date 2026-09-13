// ═══════════════════════════════════════════════════════════════════
// teacherReport.js — turn raw app_results rows into per-activity answer
// buckets that toneReport.js's analyzeSingleSyllable/analyzeDisyllabic can
// consume directly, for the teacher dashboard's weak-tone breakdowns
// (per-student and whole-class — same buckets, just fed more rows).
//
// Per-test-type field quirks mirror the decoding diagnosticReportView.js
// already does for the student's own composite report (Test C stores
// `passed`, not `correct`, per question) — kept in sync so the numbers
// never disagree between the student's report and the teacher's view.
// ═══════════════════════════════════════════════════════════════════
import { analyzeSingleSyllable, analyzeDisyllabic } from './toneReport.js'

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

/** Group raw app_results rows into per-activity answer arrays. */
export function bucketAnswers(results) {
  const buckets = {}
  const push = (key, arr) => { if (arr.length) (buckets[key] ??= []).push(...arr) }
  for (const r of results || []) {
    const det = parseDetails(r)
    const raw = det.answers || []
    if (!raw.length) continue
    if (r.test_type === 'A') push('A', raw.map(x => ({ tone: x.tone, correct: !!x.correct })))
    else if (r.test_type === 'B') push('B', raw.map(x => ({ tones: x.tones || [x.tone1, x.tone2], correct: !!x.correct })))
    else if (r.test_type === 'C') push('C', raw.map(x => ({ tone: x.tone, correct: !!x.passed })))
    else if (r.test_type === 'P5') {
      const isWord = det.set === 'word'
      push(isWord ? 'P5-word' : 'P5-single', isWord
        ? raw.map(x => ({ tones: x.tones, correct: !!x.correct }))
        : raw.map(x => ({ tone: x.tone, correct: !!x.correct })))
    }
  }
  return buckets
}

/** Run the shape-appropriate analyzer for one activity bucket. */
export function analyzeBucket(key, answers) {
  return ACTIVITY_META[key].shape === 'disyl' ? analyzeDisyllabic(answers) : analyzeSingleSyllable(answers)
}
