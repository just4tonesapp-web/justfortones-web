// ═══════════════════════════════════════════════════════════════════
// toneReport.js — shared per-test report templates (slides 6–14)
//
// Two report shapes:
//   • Single-syllable tests (A, C): per-tone correctness as 0 / 0.5 / 1
//     based on N questions per tone. Three feedback bands.
//   • Disyllabic tests (B, D):       per-tone "containing X" %
//     across the tone-pair combos. Same three bands.
//
// Both return { html, analysis }. `analysis` carries the structured
// per-tone numbers so the composite report (slide 21) can re-use them.
//
// "Recommended next tone" — when the worst band ties between multiple
// tones, the natural Mandarin distribution order 4 → 1 → 2 → 3 picks
// the winner (per the pptx note: "通过4，1，2,3 的自然分布顺序").
// ═══════════════════════════════════════════════════════════════════

const TONE_NAMES = {
  1: '1st tone (─ high level)',
  2: '2nd tone (／ rising)',
  3: '3rd tone (∨ dip)',
  4: '4th tone (＼ falling)',
}
const TONE_SHORT = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' }
const TONE_COLOR = { 1: 'var(--tone1)', 2: 'var(--tone2)', 3: 'var(--tone3)', 4: 'var(--tone4)' }
// Natural distribution order — tiebreak for the worst band.
const NATURAL_ORDER = [4, 1, 2, 3]

// ── Per-tone pronunciation guidance shown in the recommendation paragraph ──
// Verbatim from the deck's slide-6 speaker notes (kept in sync with the same
// TONE_GUIDANCE map in diagnosticReportView.js).
const TONE_FEATURE = {
  1: 'Maintain a steady high pitch — nearly at the top of your voice range. Imagine you are an opera singer using your highest pitch!',
  2: 'Start in the middle of your voice range and rise quickly to the top. Think of how you ask “What?” in English — that’s the contour of the 2nd tone!',
  3: 'Lower your chin: dip to the lowest of your range, then rise quickly to the middle. Don’t prolong it, or it will sound like a 2nd tone.',
  4: 'Start at the top of your range (just like the 1st tone), then fall sharply all the way down. Imagine saying “No!” decisively in English — that’s the 4th tone.',
}

// ═══════════════════════════════════════════════════════════════════
// Single-syllable analysis (Tests A & C)
//   answers: [{ tone: 1..4, correct: bool }, ...]
//   Each tone has N answers. score per tone = round((correct/N) * 2) / 2
//   → maps {0..N} → {0, 0.5, 1} band score.
//
//   Band rule:    band 1.0 = "Bravo"
//                 band 0.5 = "nascent"
//                 band 0.0 = "work needed"
// ═══════════════════════════════════════════════════════════════════
export function analyzeSingleSyllable(answers) {
  const perTone = {}
  for (let t = 1; t <= 4; t++) {
    const qs = answers.filter(a => a.tone === t)
    const correct = qs.filter(a => a.correct).length
    const total = qs.length || 1
    const ratio = correct / total
    // Three bands: 0, 0.5, 1 (mid-band when ratio is strictly between 0 and 1).
    const band = ratio >= 1 ? 1 : ratio <= 0 ? 0 : 0.5
    perTone[t] = { correct, total, ratio, band }
  }
  return summarize(perTone, 'syllable')
}

// ═══════════════════════════════════════════════════════════════════
// Disyllabic analysis (Tests B & D)
//   answers: [{ tones: [t1, t2], correct: bool }, ...]
//   Each tone t's "containing %" = (correct count among answers where
//   either syllable is t) / (total combos containing t).
//   Three bands: 67–100, 34–66, 0–33.
// ═══════════════════════════════════════════════════════════════════
export function analyzeDisyllabic(answers) {
  const perTone = {}
  for (let t = 1; t <= 4; t++) {
    const qs = answers.filter(a => a.tones && (a.tones[0] === t || a.tones[1] === t))
    const correct = qs.filter(a => a.correct).length
    const total = qs.length || 1
    const ratio = correct / total
    const pct = Math.round(ratio * 100)
    // Three bands: 67–100 / 34–66 / 0–33 per slide 12.
    const band = pct >= 67 ? 1 : pct >= 34 ? 0.5 : 0
    perTone[t] = { correct, total, ratio, pct, band }
  }
  return summarize(perTone, 'word')
}

// ── Shared bucketing + recommendation logic ──
function summarize(perTone, subject) {
  const bravoTones = []
  const nascentTones = []
  const workTones = []
  for (let t = 1; t <= 4; t++) {
    if (perTone[t].band === 1) bravoTones.push(t)
    else if (perTone[t].band === 0.5) nascentTones.push(t)
    else workTones.push(t)
  }

  // Worst band → recommendation candidates. Tiebreak by natural order 4,1,2,3.
  let pool
  if (workTones.length) pool = workTones
  else if (nascentTones.length) pool = nascentTones
  else pool = [] // perfect score on this test

  const recommendedTone = pool.length
    ? NATURAL_ORDER.find(t => pool.includes(t)) || pool[0]
    : null

  return {
    perTone,
    bravoTones,
    nascentTones,
    workTones,
    recommendedTone,
    isPerfect: pool.length === 0,
    subject, // 'syllable' or 'word'
  }
}

// ═══════════════════════════════════════════════════════════════════
// Build the report HTML
//   shape:  'single' | 'disyl'
// ═══════════════════════════════════════════════════════════════════
export function buildReportHTML({ analysis, score, total, testLabel, shape, showSummary = true, skill = 'recognizing' }) {
  const subject = shape === 'disyl' ? '2-syllable words containing the' : ''
  const subjectShort = shape === 'disyl' ? 'words' : 'tones'

  // Per-tone distribution rows.
  let rows = ''
  for (let t = 1; t <= 4; t++) {
    const p = analysis.perTone[t]
    const pct = shape === 'disyl' ? p.pct : Math.round(p.ratio * 100)
    const numLabel = `${p.correct}/${p.total}`
    rows += `
      <div class="tr-row">
        <div class="tr-dot"></div>
        <div class="tr-label">${TONE_NAMES[t]}</div>
        <div class="tr-bar"><div class="tr-bar-fill" style="width:${pct}%"></div></div>
        <div class="tr-pct">${pct}%</div>
        <div class="tr-num">${numLabel}</div>
      </div>`
  }

  // Feedback paragraphs.
  let feedback = ''
  if (analysis.isPerfect) {
    feedback += `<p class="tr-line tr-bravo">You are really good at ${skill} all four tones. Bravo!</p>`
    feedback += `<p class="tr-line tr-bravo">Are you a native speaker? 👀</p>`
  } else {
    if (analysis.bravoTones.length) {
      const names = analysis.bravoTones.map(t => TONE_SHORT[t]).join(', ')
      feedback += `<p class="tr-line tr-bravo">✨ You are really good at ${skill} ${shape === 'disyl' ? subject + ' ' : 'the '}${names} tone${analysis.bravoTones.length > 1 ? 's' : ''}. Bravo!</p>`
    }
    if (analysis.nascentTones.length) {
      const names = analysis.nascentTones.map(t => TONE_SHORT[t]).join(', ')
      feedback += `<p class="tr-line tr-nascent">🌱 You're getting the hang of ${skill} ${shape === 'disyl' ? subject + ' ' : 'the '}${names} tone${analysis.nascentTones.length > 1 ? 's' : ''} — keep going!</p>`
    }
    if (analysis.workTones.length) {
      const names = analysis.workTones.map(t => TONE_SHORT[t]).join(', ')
      feedback += `<p class="tr-line tr-work">💪 Your ${shape === 'disyl' ? subject + ' ' : ''}${names} tone${analysis.workTones.length > 1 ? 's' : ''} need${shape === 'disyl' || analysis.workTones.length > 1 ? '' : 's'} more practice.</p>`
    }
  }

  // Recommendation.
  let recommendation = ''
  if (analysis.recommendedTone) {
    const rt = analysis.recommendedTone
    recommendation = `
      <div class="tr-reco">
        <div class="tr-reco-head">🎯 Our recommendation</div>
        <p>Start with the <strong style="color:var(--accent)">${TONE_NAMES[rt]}</strong>${shape === 'disyl' ? ' in 2-syllable words' : ''} — it shows up everywhere in Chinese, so improving it pays off right away.</p>
        <p class="tr-feature">${TONE_FEATURE[rt]}</p>
      </div>`
  }

  const pct = Math.round((score / total) * 100)

  const summary = showSummary ? `
      <div class="tr-summary">
        <div class="tr-score-ring" style="--pct:${pct}">
          <span class="tr-score-num">${score}/${total}</span>
          <span class="tr-score-label">${pct}%</span>
        </div>
        <div class="tr-summary-text">
          <div class="tr-test-label">${testLabel}</div>
          <div class="tr-summary-sub">Correctness distribution by tone</div>
        </div>
      </div>` : ''

  // Progressive disclosure: reveal the per-tone feedback first (the teaser the
  // user actually cares about), and keep the distribution chart + recommendation
  // behind a salient "Open full report" toggle. Native <details> → no JS wiring.
  const html = `
    <div class="tr-card">
      ${summary}

      <div class="tr-feedback">${feedback}</div>

      <details class="tr-more">
        <summary class="tr-more-summary">
          <span>Open full report to view recommendation</span>
          <span class="tr-more-chevron">▾</span>
        </summary>
        <div class="tr-more-body">
          <div class="tr-rows">${rows}</div>
          ${recommendation}
        </div>
      </details>
    </div>
  `

  return { html, analysis }
}

// ═══════════════════════════════════════════════════════════════════
// Scoped CSS — injected once per page by the caller.
// ═══════════════════════════════════════════════════════════════════
export const TONE_REPORT_CSS = `
  .tr-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 20px;
  }
  .tr-summary {
    display: flex; align-items: center; gap: 18px;
    margin-bottom: 20px;
  }
  .tr-score-ring {
    width: 88px; height: 88px; border-radius: 50%;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative; flex-shrink: 0;
  }
  .tr-score-ring::before {
    content: ''; position: absolute; inset: 0; border-radius: 50%; padding: 4px;
    background: conic-gradient(var(--accent) calc(var(--pct) * 3.6deg), var(--card-border) 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 3px));
            mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 3px));
  }
  .tr-score-num { font-size: 1.4rem; font-weight: 700; line-height: 1; }
  .tr-score-label { font-size: 0.7rem; color: var(--text-secondary); margin-top: 2px; }
  .tr-test-label { font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
  .tr-summary-sub { font-size: 0.82rem; color: var(--text-muted); }

  .tr-rows { margin-bottom: 18px; }
  .tr-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .tr-row:last-child { margin-bottom: 0; }
  /* Distribution rows are monochrome (no per-tone colour) — the labels already
     name each tone, so the chart reads clean and premium rather than rainbow. */
  .tr-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; background: var(--text-muted); }
  .tr-label { flex: 0 0 150px; font-size: 0.82rem; color: var(--text-secondary); }
  .tr-bar { flex: 1; height: 8px; background: var(--surface); border-radius: 4px; overflow: hidden; }
  .tr-bar-fill { height: 100%; border-radius: 4px; background: var(--text-secondary); transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }
  .tr-pct { flex: 0 0 40px; text-align: right; font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); }
  .tr-num { flex: 0 0 64px; text-align: right; font-size: 0.72rem; color: var(--text-muted); }

  .tr-feedback { margin-bottom: 16px; }
  /* Refined feedback bands: clean primary text on a near-neutral surface, with a
     single muted colour cue on the left edge — premium, not rainbow. */
  .tr-line {
    font-size: 0.92rem; line-height: 1.55;
    margin: 6px 0; padding: 8px 12px 8px 14px;
    border-radius: var(--radius-sm);
    background: rgba(148,163,184,0.06);
    border-left: 3px solid var(--card-border);
    color: var(--text-primary);
  }
  .tr-bravo   { border-left-color: var(--tone3); }
  .tr-nascent { border-left-color: var(--tone2); }
  .tr-work    { border-left-color: var(--tone1); }

  .tr-reco {
    background: var(--accent-glow);
    border: 1px solid rgba(56,189,248,0.3);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
  }
  .tr-reco-head {
    font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--accent); font-weight: 600; margin-bottom: 6px;
  }
  .tr-reco p {
    font-size: 0.92rem; line-height: 1.55; color: var(--text-primary);
    margin: 4px 0;
  }
  .tr-feature { color: var(--text-secondary) !important; font-size: 0.85rem !important; }

  /* ── Progressive disclosure: feedback teaser first, detail behind a toggle ── */
  .tr-report-head {
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--text-muted); font-weight: 600; margin-bottom: 10px;
  }
  .tr-more { margin-top: 12px; }
  .tr-more > summary { list-style: none; }
  .tr-more > summary::-webkit-details-marker { display: none; }
  .tr-more-summary {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    cursor: pointer;
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    background: var(--accent-glow);
    border: 1px solid rgba(56,189,248,0.3);
    color: var(--accent);
    font-weight: 600; font-size: 0.92rem;
    user-select: none;
    transition: background 0.2s;
  }
  .tr-more-summary:hover { background: rgba(56,189,248,0.22); }
  .tr-more-chevron { transition: transform 0.25s; }
  .tr-more[open] .tr-more-chevron { transform: rotate(180deg); }
  .tr-more-body { padding-top: 16px; }

  /* Composite "not yet taken" placeholder card */
  .tr-card-empty { opacity: 0.55; }
  .tr-empty-label { font-weight: 600; font-size: 1rem; margin-bottom: 2px; }
  .tr-empty-sub { font-size: 0.8rem; color: var(--text-muted); }

  /* Accordion shell (slide 5 pattern) */
  .tr-accordion {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .tr-accordion-head {
    width: 100%;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 16px 20px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary);
    text-align: left;
  }
  .tr-accordion-head:hover { background: rgba(56,189,248,0.04); }
  .tr-accordion-head-text { flex: 1; }
  .tr-accordion-head-title { font-weight: 600; font-size: 1rem; margin-bottom: 2px; }
  .tr-accordion-head-sub { font-size: 0.8rem; color: var(--text-muted); }
  .tr-accordion-chevron { font-size: 1.2rem; color: var(--accent); transition: transform 0.25s; }
  .tr-accordion.open .tr-accordion-chevron { transform: rotate(180deg); }
  .tr-accordion-body {
    max-height: 0; overflow: hidden;
    transition: max-height 0.4s ease;
  }
  .tr-accordion.open .tr-accordion-body { max-height: 2000px; }
  .tr-accordion-body-inner { padding: 0 16px 16px; }

  @media (max-width: 480px) {
    .tr-label { flex: 0 0 110px; font-size: 0.75rem; }
    .tr-num { flex: 0 0 50px; font-size: 0.68rem; }
    .tr-pct { flex: 0 0 34px; font-size: 0.78rem; }
  }
`

// ═══════════════════════════════════════════════════════════════════
// Wire up an accordion (called after innerHTML is mounted).
// ═══════════════════════════════════════════════════════════════════
export function bindAccordion(rootEl) {
  rootEl.querySelectorAll('.tr-accordion').forEach((acc) => {
    const head = acc.querySelector('.tr-accordion-head')
    if (!head) return
    head.addEventListener('click', () => acc.classList.toggle('open'))
  })
}
