// ═══════════════════════════════════════════════════════════════════
// Composite Diagnostic Report — slide 21
//
// After all 4 tests, this screen presents:
//   • bilingual motivational summary
//   • aggregated per-tone analysis across all 4 tests
//   • a single "tone to focus on first" recommendation
//   • 4 expandable sub-reports (one per test)
//   • CTA to adaptive exercises
//
// If a user lands here without having taken all 4 tests, we still show
// what data we have and gentle prompts for the missing ones.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { getDiagnosticState } from '../services/progressService.js'
import {
  analyzeSingleSyllable, analyzeDisyllabic, buildReportHTML,
  TONE_REPORT_CSS, bindAccordion,
} from '../utils/toneReport.js'

const TONE_NAMES = {
  1: '1st tone (─)', 2: '2nd tone (／)', 3: '3rd tone (∨)', 4: '4th tone (＼)',
}
const NATURAL_ORDER = [4, 1, 2, 3]
const TONE_COLOR = { 1: 'var(--tone1)', 2: 'var(--tone2)', 3: 'var(--tone3)', 4: 'var(--tone4)' }

export async function diagnosticReportView(container) {
  const state = await getDiagnosticState()
  const { results } = state

  // Best (highest score) attempt per test.
  const best = (type) => {
    const matching = results.filter(r => r.test_type === type)
    if (!matching.length) return null
    return matching.reduce((a, b) => (a.score > b.score ? a : b))
  }

  const a = best('A')
  const b = best('B')
  const c = best('C')
  const d = best('D')

  // ── Decode stored `details` (may be JSON string from Supabase) ──
  const decodeAnswers = (r) => {
    if (!r) return []
    let det = r.details
    if (typeof det === 'string') {
      try { det = JSON.parse(det) } catch { det = null }
    }
    return det?.answers || []
  }

  const aAnswers = decodeAnswers(a)
  const bAnswers = decodeAnswers(b)
  const cAnswers = decodeAnswers(c)
  const dAnswers = decodeAnswers(d)

  // ── Per-test analyses ──
  const aAdapt = aAnswers.map(x => ({ tone: x.tone, correct: !!x.correct }))
  const bAdapt = bAnswers.map(x => ({ tones: x.tones || [x.tone1, x.tone2], correct: !!x.correct }))
  const cAdapt = cAnswers.map(x => ({ tone: x.tone, correct: !!x.passed }))
  const dAdapt = dAnswers.map(x => ({ tones: x.tones, correct: !!x.passed }))

  const aAna = aAnswers.length ? analyzeSingleSyllable(aAdapt) : null
  const bAna = bAnswers.length ? analyzeDisyllabic(bAdapt)    : null
  const cAna = cAnswers.length ? analyzeSingleSyllable(cAdapt) : null
  const dAna = dAnswers.length ? analyzeDisyllabic(dAdapt)    : null

  // ── Cross-test aggregate: average band per tone ──
  // Each test's analysis exposes `perTone[t].band` in {0, 0.5, 1}.
  // Average across the tests the user completed.
  const aggBand = { 1: null, 2: null, 3: null, 4: null }
  const aggSources = { 1: [], 2: [], 3: [], 4: [] }
  ;[aAna, bAna, cAna, dAna].forEach(ana => {
    if (!ana) return
    for (let t = 1; t <= 4; t++) aggSources[t].push(ana.perTone[t].band)
  })
  for (let t = 1; t <= 4; t++) {
    if (aggSources[t].length) {
      aggBand[t] = aggSources[t].reduce((s, x) => s + x, 0) / aggSources[t].length
    }
  }

  // Worst tone overall — tiebreak by natural order 4,1,2,3.
  let worstTone = null
  let worstBand = 999
  for (const t of NATURAL_ORDER) {
    if (aggBand[t] != null && aggBand[t] < worstBand) {
      worstBand = aggBand[t]
      worstTone = t
    }
  }

  const completedCount = [a, b, c, d].filter(Boolean).length
  const isComplete = completedCount === 4

  // ── Aggregate per-tone bar chart ──
  let aggregateRows = ''
  for (let t = 1; t <= 4; t++) {
    const band = aggBand[t]
    const pct = band == null ? 0 : Math.round(band * 100)
    const label = band == null
      ? 'No data'
      : band >= 0.85 ? 'Strong'
      : band >= 0.45 ? 'Developing'
      : 'Needs work'
    aggregateRows += `
      <div class="cr-row">
        <div class="cr-dot" style="background:${TONE_COLOR[t]}"></div>
        <div class="cr-label">${TONE_NAMES[t]}</div>
        <div class="cr-bar"><div class="cr-bar-fill" style="width:${pct}%;background:${TONE_COLOR[t]}"></div></div>
        <div class="cr-pct" style="color:${TONE_COLOR[t]}">${pct}%</div>
        <div class="cr-tag">${label}</div>
      </div>`
  }

  // ── Per-test accordion entries ──
  const subReport = (label, score, total, ana, shape) => {
    if (!ana) {
      return `
        <div class="tr-accordion">
          <button class="tr-accordion-head" type="button" disabled style="cursor:default;opacity:0.55">
            <div class="tr-accordion-head-text">
              <div class="tr-accordion-head-title">${label}</div>
              <div class="tr-accordion-head-sub">Not yet taken</div>
            </div>
            <div class="tr-accordion-chevron" style="opacity:0">▾</div>
          </button>
        </div>`
    }
    const inner = buildReportHTML({ analysis: ana, score, total, testLabel: label, shape })
    return `
      <div class="tr-accordion">
        <button class="tr-accordion-head" type="button">
          <div class="tr-accordion-head-text">
            <div class="tr-accordion-head-title">${label}</div>
            <div class="tr-accordion-head-sub">Score: ${score}/${total}</div>
          </div>
          <div class="tr-accordion-chevron">▾</div>
        </button>
        <div class="tr-accordion-body">
          <div class="tr-accordion-body-inner">${inner.html}</div>
        </div>
      </div>`
  }

  // ── Bilingual motivational message (slide 21) ──
  let intro
  if (isComplete) {
    const ws = worstTone ? TONE_NAMES[worstTone] : ''
    intro = `
      <p class="cr-intro-zh">
        谢谢你走到这里！你的学习热情让我吃惊，一定可以的。
        只有 30% 的人能完成这个测试 — 学语言是终生的，四声 notoriously difficult，
        但是我们一定可以做到。
      </p>
      <p class="cr-intro-en">
        Thank you for getting this far. Only about 30% of learners finish the full diagnostic —
        the four tones are notoriously difficult, and language is a lifelong journey.
        ${worstTone
          ? `Across your four tests, your <strong style="color:${TONE_COLOR[worstTone]}">${ws}</strong>
             needs the most attention. We recommend you start there — even with listening exercises first.
             It may feel counter-intuitive, but to <em>speak</em> a tone well you must first <em>hear</em> it well.`
          : 'You demonstrated strong tone skills across the board — are you a native speaker? 👀'}
      </p>`
  } else {
    intro = `
      <p class="cr-intro-en">
        You've completed <strong>${completedCount} of 4</strong> diagnostic tests so far.
        Finish them all to unlock your full composite report.
      </p>`
  }

  // ── Adaptive exercises CTA target ──
  // Routes to the practice that targets the recommended tone if possible.
  // (For now, fall through to practice-recognition — the new adaptive-practice
  // surface is part of next steps per slide 24.)
  const adaptiveTarget = '/practice-recognition'

  container.innerHTML = `
    <div class="app-shell">
      <div class="back-row">
        <button class="back-home-btn" id="cr-home">← Home</button>
      </div>
      <div class="cr-header">
        <span class="badge">Composite Report</span>
        <h1>Your Tone Profile</h1>
        <p>Based on your best run of each test</p>
      </div>

      <div class="cr-intro card animate-in">
        ${intro}
      </div>

      ${isComplete && worstTone ? `
        <div class="cr-focus card animate-in" style="animation-delay:.05s">
          <div class="cr-focus-head">🎯 Recommended focus</div>
          <div class="cr-focus-body">
            Start with the <strong style="color:${TONE_COLOR[worstTone]}">${TONE_NAMES[worstTone]}</strong>.
            You'll see huge gains immediately.
          </div>
        </div>` : ''}

      <div class="card animate-in" style="margin-top:18px;animation-delay:.1s">
        <h3 class="section-head">Across all four tests</h3>
        ${aggregateRows}
      </div>

      <div class="cr-subs">
        <h3 class="section-head" style="margin-top:18px">Per-test reports</h3>
        ${subReport('1️⃣ Listening · 1-syllable',  a?.score ?? 0, a?.total ?? 8,  aAna, 'single')}
        ${subReport('2️⃣ Listening · 2-syllable',  b?.score ?? 0, b?.total ?? 15, bAna, 'disyl')}
        ${subReport('3️⃣ Speaking · 1-syllable',   c?.score ?? 0, c?.total ?? 12, cAna, 'single')}
        ${subReport('4️⃣ Speaking · 2-syllable',   d?.score ?? 0, d?.total ?? 12, dAna, 'disyl')}
      </div>

      <div class="cr-next animate-in" style="animation-delay:.2s">
        ${isComplete ? `
          <h3 class="cr-next-head">Ready for some exercises?</h3>
          <p class="cr-next-sub">These adaptive exercises will help you improve perception and pronunciation of tones.</p>
          <button class="btn btn-primary btn-lg" id="cr-next">→ Start Adaptive Exercises</button>
        ` : `
          <h3 class="cr-next-head">Finish the diagnostic</h3>
          <p class="cr-next-sub">Take the remaining test${4 - completedCount > 1 ? 's' : ''} to unlock your full composite analysis.</p>
          <button class="btn btn-primary btn-lg" id="cr-next">→ Continue Diagnostic</button>
        `}
      </div>
    </div>
  `

  const style = document.createElement('style')
  style.textContent = TONE_REPORT_CSS + scopedCSS
  container.appendChild(style)

  bindAccordion(container)

  document.getElementById('cr-home').addEventListener('click', () => navigate('/'))
  document.getElementById('cr-next').addEventListener('click', () => {
    if (isComplete) navigate(adaptiveTarget)
    else if (!a) navigate('/test-a')
    else if (!b) navigate('/test-b')
    else if (!c) navigate('/test-c')
    else navigate('/test-d')
  })
}

const scopedCSS = `
  .cr-header {
    text-align: center;
    margin-bottom: 18px;
  }
  .cr-header h1 {
    font-size: 1.6rem; font-weight: 700; margin: 10px 0 6px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .cr-header p { color: var(--text-secondary); font-size: 0.95rem; }

  .cr-intro {
    padding: 18px 20px;
    margin-bottom: 12px;
  }
  .cr-intro-zh {
    font-size: 0.95rem; line-height: 1.7; color: var(--text-primary);
    margin: 0 0 12px;
  }
  .cr-intro-en {
    font-size: 0.92rem; line-height: 1.65; color: var(--text-secondary);
    margin: 0;
  }
  .cr-intro-en em { color: var(--accent); font-style: normal; }
  .cr-intro-en strong { color: var(--text-primary); }

  .cr-focus {
    padding: 14px 18px;
    border: 1px solid var(--accent);
    background: var(--accent-glow);
  }
  .cr-focus-head {
    font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--accent); font-weight: 600; margin-bottom: 6px;
  }
  .cr-focus-body { font-size: 0.95rem; line-height: 1.5; color: var(--text-primary); }

  .section-head {
    font-size: 0.85rem; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 14px;
  }

  /* Aggregate per-tone rows */
  .cr-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .cr-row:last-child { margin-bottom: 0; }
  .cr-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .cr-label { flex: 0 0 130px; font-size: 0.82rem; color: var(--text-secondary); }
  .cr-bar { flex: 1; height: 8px; background: var(--surface); border-radius: 4px; overflow: hidden; }
  .cr-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }
  .cr-pct { flex: 0 0 40px; text-align: right; font-size: 0.82rem; font-weight: 600; }
  .cr-tag {
    flex: 0 0 84px; text-align: right; font-size: 0.72rem;
    color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;
  }

  .cr-subs {
    display: flex; flex-direction: column; gap: 10px;
    margin-bottom: 22px;
  }
  .cr-subs .tr-accordion + .tr-accordion { margin-top: 0; }

  .cr-next {
    text-align: center;
    padding: 22px 16px;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    margin-top: 12px;
  }
  .cr-next-head {
    font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;
    color: var(--text-primary);
  }
  .cr-next-sub {
    color: var(--text-secondary); font-size: 0.9rem;
    line-height: 1.5; margin-bottom: 16px;
  }

  @media (max-width: 480px) {
    .cr-label { flex: 0 0 100px; font-size: 0.74rem; }
    .cr-tag   { flex: 0 0 70px; font-size: 0.66rem; }
  }
`
