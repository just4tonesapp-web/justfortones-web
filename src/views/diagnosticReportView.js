// ═══════════════════════════════════════════════════════════════════
// Composite Report — pptx slide 21
//
// Structure (verbatim where possible):
//   1. Title "Composite Report"
//   2. Bilingual opening (gratitude + 30% completion + lifelong learning)
//   3. Personalised tone-ranking prose
//      "在四声中，你对于X声真的很敏锐，..."
//      "然后 X、X声，次之"
//      "你的X声，确实需要加强"
//   4. Recommended focus: "我们认为... 请你从听开始，专注在X声的学习上"
//      "You are getting there"
//   5. Four "Open Report of X" buttons (separate accordions)
//   6. "Ready for some exercises?" CTA
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { getDiagnosticState } from '../services/progressService.js'
import {
  analyzeSingleSyllable, analyzeDisyllabic, buildReportHTML,
  TONE_REPORT_CSS, bindAccordion,
} from '../utils/toneReport.js'

const TONE_ZH = { 1: '一声', 2: '二声', 3: '三声', 4: '四声' }
const TONE_EN = { 1: '1st tone', 2: '2nd tone', 3: '3rd tone', 4: '4th tone' }
const TONE_COLOR = { 1: 'var(--tone1)', 2: 'var(--tone2)', 3: 'var(--tone3)', 4: 'var(--tone4)' }
const NATURAL_ORDER = [4, 1, 2, 3]

export async function diagnosticReportView(container) {
  const state = await getDiagnosticState()
  const { results } = state

  // Most recent attempt per test — NOT the historical best. `results` is sorted
  // newest-first, so the first match is the latest. This makes the report reflect
  // how the user just did, and avoids resurrecting scores from older test versions
  // (e.g. the old 12-question tests showing up as 11/12).
  const latest = (type) => results.find(r => r.test_type === type) || null

  const a = latest('A'), b = latest('B'), c = latest('C')

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

  const aAdapt = aAnswers.map(x => ({ tone: x.tone, correct: !!x.correct }))
  const bAdapt = bAnswers.map(x => ({ tones: x.tones || [x.tone1, x.tone2], correct: !!x.correct }))
  const cAdapt = cAnswers.map(x => ({ tone: x.tone, correct: !!x.passed }))

  const aAna = aAnswers.length ? analyzeSingleSyllable(aAdapt) : null
  const bAna = bAnswers.length ? analyzeDisyllabic(bAdapt)    : null
  const cAna = cAnswers.length ? analyzeSingleSyllable(cAdapt) : null

  const completedCount = [a, b, c].filter(Boolean).length
  const isComplete = completedCount === 3

  // ── Per-tone aggregate band (average across all 3 tests) ──
  const aggBand = { 1: null, 2: null, 3: null, 4: null }
  ;[aAna, bAna, cAna].forEach(ana => {
    if (!ana) return
    for (let t = 1; t <= 4; t++) {
      aggBand[t] = (aggBand[t] ?? 0) + ana.perTone[t].band
    }
  })
  if (isComplete) {
    for (let t = 1; t <= 4; t++) aggBand[t] = aggBand[t] / 3
  }

  // ── Rank tones from strongest → weakest. Tiebreak by 4,1,2,3 (natural order). ──
  const ranking = isComplete
    ? [1,2,3,4].slice().sort((x, y) => {
        const dy = aggBand[y] - aggBand[x]
        if (dy !== 0) return dy
        return NATURAL_ORDER.indexOf(x) - NATURAL_ORDER.indexOf(y)
      })
    : []

  // Buckets: strong (≥0.85), mid (0.45–0.85), weak (<0.45).
  const bucketOf = (band) => band >= 0.85 ? 'strong' : band >= 0.45 ? 'mid' : 'weak'

  let strong = [], mid = [], weak = []
  if (isComplete) {
    for (const t of ranking) {
      const b = bucketOf(aggBand[t])
      if (b === 'strong') strong.push(t)
      else if (b === 'mid') mid.push(t)
      else weak.push(t)
    }
  }

  // Recommended focus: worst bucket, then natural-order tiebreak.
  const focusPool = weak.length ? weak : mid.length ? mid : []
  const focusTone = focusPool.length
    ? NATURAL_ORDER.find(t => focusPool.includes(t)) || focusPool[0]
    : null

  // ── Personalised prose (slide 21 cadence) ──
  let proseZh = '', proseEn = ''
  if (isComplete) {
    if (strong.length) {
      const t = strong[0]
      proseZh += `在四声中，你对于<strong style="color:${TONE_COLOR[t]}">${TONE_ZH[t]}</strong>真的很敏锐，不仅能听出双音节，还能听出单音节，并且说都说得很好。`
      proseEn += `Across the four tones, you are remarkably sharp on the <strong style="color:${TONE_COLOR[t]}">${TONE_EN[t]}</strong> — you hear it in single and 2-syllable words, and you can produce it well.`
    }
    if (mid.length) {
      const names = mid.map(t => TONE_ZH[t]).join('、')
      proseZh += `<br>然后 <strong>${names}</strong>，次之。`
      proseEn += ` Your ${mid.map(t => TONE_EN[t]).join(' & ')} ${mid.length > 1 ? 'come' : 'comes'} next.`
    }
    if (weak.length) {
      const t = weak[0]
      proseZh += `<br>你的<strong style="color:${TONE_COLOR[t]}">${TONE_ZH[t]}</strong>，确实需要加强。`
      proseEn += ` Your <strong style="color:${TONE_COLOR[t]}">${TONE_EN[t]}</strong> still needs strengthening.`
    }
  }

  let recoZh = '', recoEn = ''
  if (focusTone) {
    recoZh = `我们建议你选择一个突破口 — 尤其是在说含有<strong style="color:${TONE_COLOR[focusTone]}">${TONE_ZH[focusTone]}</strong>双音节词的时候。请你从<strong>听</strong>开始，专注在${TONE_ZH[focusTone]}的学习上。这可能是反直觉，但是如果你想说得更好，你得先听得更好。`
    recoEn = `We recommend picking one breakthrough point — especially with 2-syllable words containing the <strong style="color:${TONE_COLOR[focusTone]}">${TONE_EN[focusTone]}</strong>. Start with <strong>listening</strong>, and focus on this tone first. It may feel counter-intuitive, but to <em>speak</em> better, you must first <em>hear</em> better.`
  }

  // ── Per-test sub-reports (slide 21 "Open Report of X") ──
  const subReport = (label, score, total, ana, shape, skill) => {
    if (!ana) {
      return `
        <div class="tr-card tr-card-empty">
          <div class="tr-empty-label">${label}</div>
          <div class="tr-empty-sub">Not yet taken</div>
        </div>`
    }
    // Card surfaces the score + feedback teaser up front; the distribution chart
    // and recommendation sit behind the in-card "Open full report" toggle.
    return buildReportHTML({ analysis: ana, score, total, testLabel: label, shape, skill, showSummary: true }).html
  }

  container.innerHTML = `
    <div class="app-shell shell-top-center">
      <div class="back-row">
        <button class="app-logo" id="cr-home">Just4Tones</button>
      </div>

      <h1 class="cr-title">Composite Report</h1>

      ${isComplete ? `
        <div class="cr-prose card animate-in">
          <p class="cr-en">
            Thank you for getting here. Only about 30% of learners complete this diagnostic.
            Language is a lifelong journey, and the four tones are notoriously difficult —
            but we can absolutely do this.
          </p>

          <p class="cr-en cr-rank">${proseEn}</p>

          ${focusTone ? `
            <p class="cr-en cr-reco">${recoEn}</p>
            <p class="cr-encourage">You are getting there.</p>
          ` : `
            <p class="cr-en cr-reco">You demonstrated strong tone skills across the board — are you a native speaker? 👀</p>
          `}
        </div>
      ` : `
        <div class="cr-prose card animate-in">
          <p class="cr-en">
            You've completed <strong>${completedCount} of 3</strong> diagnostic tests so far.
            Finish them all to unlock your full composite report.
          </p>
        </div>
      `}

      <div class="cr-subs animate-in" style="animation-delay:.1s">
        ${subReport('Recognizing — 1-syllable words', a?.score ?? 0, a?.total ?? 8,  aAna, 'single', 'recognizing')}
        ${subReport('Recognizing — 2-syllable words', b?.score ?? 0, b?.total ?? 15, bAna, 'disyl',  'recognizing')}
        ${subReport('Speaking — 1-syllable words',    c?.score ?? 0, c?.total ?? 8,  cAna, 'single', 'speaking')}
      </div>

      <div class="cr-cta animate-in" style="animation-delay:.2s">
        <p class="cr-cta-line">
          ${isComplete
            ? 'Ready for some exercises? These adaptive exercises will help you improve on perception and pronunciation of tones!'
            : 'Take the remaining tests to unlock your full composite analysis.'}
        </p>
        <button class="btn btn-primary btn-lg" id="cr-next">
          ${isComplete ? 'Start Adaptive Exercises' : 'Continue Diagnostic'}
        </button>
      </div>
    </div>
  `

  const style = document.createElement('style')
  style.textContent = TONE_REPORT_CSS + scopedCSS
  container.appendChild(style)

  bindAccordion(container)

  document.getElementById('cr-home').addEventListener('click', () => navigate('/'))
  document.getElementById('cr-next').addEventListener('click', () => {
    if (isComplete) navigate('/practice-1')
    else if (!a) navigate('/test-1')
    else if (!b) navigate('/test-2')
    else navigate('/test-3')
  })
}

const scopedCSS = `
  .cr-title {
    text-align: center;
    font-size: 1.65rem;
    font-weight: 700;
    margin-bottom: 18px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .cr-prose {
    padding: 20px 22px;
    margin-bottom: 20px;
  }
  .cr-zh {
    font-size: 0.98rem;
    line-height: 1.85;
    color: var(--text-primary);
    margin: 0 0 12px;
  }
  .cr-en {
    font-size: 0.9rem;
    line-height: 1.65;
    color: var(--text-secondary);
    margin: 0 0 12px;
  }
  .cr-rank {
    padding-left: 12px;
    border-left: 2px solid var(--card-border);
    margin-top: 14px;
  }
  .cr-reco {
    background: var(--accent-glow);
    border: 1px solid rgba(56,189,248,0.3);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    border-left: none;
  }
  .cr-en strong, .cr-zh strong { font-weight: 700; }
  .cr-en em { font-style: italic; color: var(--accent); }
  .cr-encourage {
    text-align: center;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--accent);
    margin: 14px 0 0;
    font-style: italic;
  }

  .cr-subs {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 22px;
  }

  .cr-cta {
    text-align: center;
    padding: 20px 16px;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
  }
  .cr-cta-line {
    color: var(--text-primary);
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 0 0 14px;
  }
`
