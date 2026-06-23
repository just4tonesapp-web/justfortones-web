// ═══════════════════════════════════════════════════════════════════
// Single-attempt report — opened from the History list.
// Renders the same per-test report (feedback + distribution) for ONE saved
// attempt, so users don't have to finish all 3 tests to see a report.
// The attempt is handed over via sessionStorage('j4t_attempt').
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { analyzeSingleSyllable, analyzeDisyllabic, buildReportHTML, TONE_REPORT_CSS } from '../utils/toneReport.js'

const META = {
  A: { label: 'Test 1 · Recognizing 1-syllable', shape: 'single', skill: 'recognizing' },
  B: { label: 'Test 2 · Recognizing 2-syllable', shape: 'disyl',  skill: 'recognizing' },
  C: { label: 'Test 3 · Speaking 1-syllable',    shape: 'single', skill: 'speaking' },
}

export function attemptReportView(container) {
  let a = null
  try { a = JSON.parse(sessionStorage.getItem('j4t_attempt') || 'null') } catch { /* ignore */ }
  if (!a || !META[a.test_type]) { navigate('/history'); return }
  const meta = META[a.test_type]

  let det = a.details
  if (typeof det === 'string') { try { det = JSON.parse(det) } catch { det = null } }
  const answers = det?.answers || []

  let body, analysis = null
  if (!answers.length) {
    // Older attempts saved without per-question detail — show the score only.
    const pct = Math.round((a.score / a.total) * 100)
    body = `<div class="tr-card"><div class="tr-summary">
        <div class="tr-score-ring" style="--pct:${pct}"><span class="tr-score-num">${a.score}/${a.total}</span><span class="tr-score-label">${pct}%</span></div>
        <div class="tr-summary-text"><div class="tr-test-label">${meta.label}</div><div class="tr-summary-sub">No per-tone breakdown saved for this attempt.</div></div>
      </div></div>`
  } else {
    analysis = a.test_type === 'B'
      ? analyzeDisyllabic(answers.map(x => ({ tones: x.tones || [x.tone1, x.tone2], correct: !!x.correct })))
      : analyzeSingleSyllable(answers.map(x => ({ tone: x.tone, correct: a.test_type === 'C' ? !!x.passed : !!x.correct })))
    body = buildReportHTML({ analysis, score: a.score, total: a.total, testLabel: meta.label, shape: meta.shape, skill: meta.skill, showSummary: true }).html
  }

  // Jump straight into the matching adaptive practice (recognition tests 1 & 2 →
  // Practice I; speaking test 3 → Practice II), seeded with this report's weak tone.
  const practiceRoute = a.test_type === 'C' ? '/practice-2' : '/practice-1'
  const practiceLabel = a.test_type === 'C' ? 'Start speaking practice →' : 'Start recognition practice →'

  container.innerHTML = `
    <div class="app-shell shell-top-center">
      <button class="ar-back" id="ar-back">← Back to history</button>
      <h1 class="ar-title">Test Report</h1>
      <div class="ar-date">${formatDate(a.created_at)}</div>
      ${body}
      <button class="btn btn-primary btn-lg ar-cta" id="ar-practice">${practiceLabel}</button>
    </div>
  `
  const style = document.createElement('style')
  style.textContent = TONE_REPORT_CSS + arCSS
  container.appendChild(style)
  document.getElementById('ar-back').addEventListener('click', () => navigate('/history'))
  document.getElementById('ar-practice').addEventListener('click', () => {
    if (analysis?.recommendedTone) sessionStorage.setItem('j4t_focus_tone', String(analysis.recommendedTone))
    navigate(practiceRoute)
  })
}

function formatDate(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const arCSS = `
  .ar-back {
    align-self: flex-start; background: transparent; border: none; color: var(--text-secondary);
    font-family: inherit; font-size: 0.85rem; cursor: pointer; padding: 6px 4px; margin-bottom: 8px;
  }
  .ar-back:hover { color: var(--accent); }
  .ar-title {
    text-align: center; font-size: 1.5rem; font-weight: 700; margin-bottom: 4px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .ar-date { text-align: center; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 20px; }
  .ar-cta { width: 100%; margin-top: 18px; }
`
