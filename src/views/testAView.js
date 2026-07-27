// ═══════════════════════════════════════════════════════════════════
// Test 1 — Tone Listening, single syllables (8 items, 2 per tone)
// New flow per APP UI UX.pptx slides 4–11.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { SYLLABLE_POOL, applyTone, shuffle, hasCharacter } from '../utils/pinyin.js'
import { playSyllable } from '../utils/audio.js'
import { hasRecording } from '../utils/recordingsManifest.js'
import { saveResult } from '../services/progressService.js'
import {
  analyzeSingleSyllable, buildReportHTML, TONE_REPORT_CSS, bindAccordion,
} from '../utils/toneReport.js'

const TOTAL = 8
const PER_TONE = 2          // 2 questions per tone × 4 tones = 8
const PASS_SCORE = 5        // ~58% threshold preserved

export function testAView(container) {
  // ── State ──
  let questions = []
  let currentQ = 0
  let score = 0
  let answered = false
  let answers = []
  let qStart = 0
  let testStart = 0
  let previousItems = new Set()

  // ── Generate ──
  function generate() {
    const tones = shuffle([1,1, 2,2, 3,3, 4,4])
    const used = new Set()
    questions = tones.map((t) => {
      const fresh = SYLLABLE_POOL.filter(s =>
        !used.has(s) && !previousItems.has(`${s}${t}`) && hasRecording(s, t) && hasCharacter(s, t))
      const cand = SYLLABLE_POOL.filter(s => !used.has(s) && hasRecording(s, t) && hasCharacter(s, t))
      // Last-resort fallback STILL requires a real character: combos that were
      // marked "_X" (no real Chinese character) must never be quizzed, even if a
      // recording exists for them. hasCharacter() is the authoritative gate.
      const pool = fresh.length ? fresh : (cand.length ? cand : SYLLABLE_POOL.filter(s => !used.has(s) && hasCharacter(s, t)))
      const syllable = pool[Math.floor(Math.random() * pool.length)]
      used.add(syllable)
      return { syllable, tone: t }
    })
    previousItems = new Set(questions.map(q => `${q.syllable}${q.tone}`))
  }

  // ── Mount ──
  container.innerHTML = `
    <div class="app-shell shell-top-center">
      <div class="back-row">
        <button class="app-logo" id="ta-home">Just4Tones</button>
      </div>
      <div class="testa-header">
        <h1><span class="title-badge">1</span>Recognizing — 1-Syllable Words</h1>
      </div>

      <!-- Intro (slide 4) -->
      <div id="ta-intro" class="card animate-in text-center">
        <p class="intro-copy">
          In this test, you are going to hear 8 different single-syllable Chinese words.
          Pick the correct tones.
        </p>
        <button class="btn btn-primary btn-lg" id="ta-start">START NOW</button>
      </div>

      <!-- Quiz -->
      <div id="ta-quiz" class="hidden">
        <div class="progress-wrap">
          <div class="progress-info">
            <span id="ta-prog-label">Question 1 of ${TOTAL}</span>
            <span class="progress-score" id="ta-prog-score">Score: 0</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="ta-prog-fill" style="width:0%"></div>
          </div>
        </div>
        <div class="card animate-in" id="ta-card">
          <div class="question-label">Listen and identify the tone</div>
          <div class="audio-area">
            <button class="play-btn" id="ta-play"><div class="play-icon"></div></button>
            <div class="play-hint" id="ta-hint">Tap to listen</div>
          </div>
          <div class="choices" id="ta-choices"></div>
        </div>
      </div>

      <!-- Report (accordion-style score screen → slides 5/6) -->
      <div id="ta-report" class="hidden"></div>
    </div>
    <div class="feedback-toast" id="ta-toast"></div>
  `

  const style = document.createElement('style')
  style.textContent = scopedCSS + TONE_REPORT_CSS
  container.appendChild(style)

  const $ = (id) => document.getElementById(id)
  $('ta-home').addEventListener('click', () => navigate('/'))
  $('ta-start').addEventListener('click', startTest)
  $('ta-play').addEventListener('click', playCurrent)

  function startTest() {
    generate()
    currentQ = 0; score = 0; answers = []; testStart = Date.now()
    // Restore the test chrome (hidden while the result screen is up).
    container.querySelector('.back-row')?.classList.remove('hidden')
    container.querySelector('.testa-header')?.classList.remove('hidden')
    $('ta-intro').classList.add('hidden')
    $('ta-quiz').classList.remove('hidden')
    $('ta-report').classList.add('hidden')
    loadQ()
  }

  function loadQ() {
    answered = false
    qStart = Date.now()
    const q = questions[currentQ]

    $('ta-prog-label').textContent = `Question ${currentQ + 1} of ${TOTAL}`
    $('ta-prog-score').textContent = `Score: ${score}`
    $('ta-prog-fill').style.width = `${(currentQ / TOTAL) * 100}%`
    $('ta-hint').textContent = 'Tap to listen'
    $('ta-play').classList.remove('playing')

    const order = shuffle([1, 2, 3, 4])
    const letters = ['A', 'B', 'C', 'D']
    const toneNames = ['', '1st tone ─', '2nd tone ／', '3rd tone ∨', '4th tone ＼']
    const el = $('ta-choices')
    el.innerHTML = ''

    order.forEach((t, idx) => {
      const btn = document.createElement('button')
      btn.className = 'choice-btn'
      btn.dataset.tone = t
      btn.innerHTML = `
        <span class="choice-letter">${letters[idx]}</span>
        <span class="choice-pinyin">${applyTone(q.syllable, t)}</span>
        <span class="choice-tone">${toneNames[t]}</span>
      `
      btn.addEventListener('click', () => pick(t, btn))
      el.appendChild(btn)
    })

    const card = $('ta-card')
    card.style.animation = 'none'
    card.offsetHeight
    card.style.animation = 'cardIn 0.4s ease-out'
  }

  function playCurrent() {
    const q = questions[currentQ]
    if (!q) return
    const btn = $('ta-play')
    btn.classList.add('playing')
    $('ta-hint').textContent = 'Listening…'
    playSyllable(q.syllable, q.tone, () => {
      btn.classList.remove('playing')
      $('ta-hint').textContent = 'Tap to replay'
    })
  }

  function pick(selected, btnEl) {
    if (answered) return
    answered = true
    const q = questions[currentQ]
    const ok = selected === q.tone
    if (ok) score++

    answers.push({
      syllable: q.syllable, tone: q.tone,
      selected, correct: ok, time: Date.now() - qStart,
    })

    document.querySelectorAll('#ta-choices .choice-btn').forEach(b => {
      const t = parseInt(b.dataset.tone)
      if (t === q.tone) b.classList.add('correct')
      else if (t === selected && !ok) b.classList.add('incorrect')
      b.classList.add('disabled')
    })

    $('ta-prog-score').textContent = `Score: ${score}`
    showToast(ok)

    setTimeout(() => {
      currentQ++
      if (currentQ >= TOTAL) showScoreScreen()
      else loadQ()
    }, 1500)
  }

  function showToast(ok) {
    const t = $('ta-toast')
    t.className = 'feedback-toast'
    const msgs = ok
      ? ['Correct! ✓','Nice ear! ✓','Spot on! ✓','Perfect! ✓']
      : ['Not quite ✗','Try next time ✗','Almost! ✗']
    t.textContent = msgs[Math.floor(Math.random() * msgs.length)]
    t.classList.add(ok ? 'correct' : 'incorrect')
    requestAnimationFrame(() => t.classList.add('show'))
    setTimeout(() => t.classList.remove('show'), 1100)
  }

  // ═══════════════════════════════════════════════════════════════
  // Score screen — slide 5 "You scored ( ), click to open your REPORT"
  // The report itself is hidden in an accordion below the score.
  // ═══════════════════════════════════════════════════════════════
  function showScoreScreen() {
    $('ta-quiz').classList.add('hidden')
    // Result screen stands on its own (slide 5) — hide the test chrome above it.
    container.querySelector('.back-row')?.classList.add('hidden')
    container.querySelector('.testa-header')?.classList.add('hidden')
    const el = $('ta-report')
    el.classList.remove('hidden')

    saveResult('A', score, TOTAL, { answers, totalTime: Date.now() - testStart })

    const analysis = analyzeSingleSyllable(answers)
    const reportInner = buildReportHTML({
      analysis, score, total: TOTAL,
      testLabel: 'Test 1 · Recognizing 1-syllable',
      shape: 'single',
      skill: 'recognizing',
      showSummary: false, // score already shown in the headline above
    })

    el.innerHTML = `
      <div class="result-shell animate-in">
        <button class="app-logo" id="ta-logo">Just4Tones</button>

        <div class="result-scorecard">
          <div class="rs-score">
            <span class="rs-score-label">You scored</span>
            <span class="rs-score-value">${score}/${TOTAL}</span>
          </div>
          <div class="rs-divider"></div>
          <div class="tr-report-head">Your REPORT</div>
          ${reportInner.html}
        </div>

        <button class="result-next" id="ta-next">
          <div class="result-next-head">Try Next Challenge!</div>
          <div class="result-next-title">Two Syllables words</div>
        </button>

        <p class="result-retake">
          Want another go? Scores go up and down when your ear is still tuning in — that's totally normal.
          <button class="result-retake-link" id="ta-retry">Test Again</button>
        </p>
      </div>
    `

    bindAccordion(el)
    document.getElementById('ta-logo').addEventListener('click', () => navigate('/'))
    document.getElementById('ta-retry').addEventListener('click', startTest)
    document.getElementById('ta-next').addEventListener('click', () => navigate('/test-2'))
  }
}

// ═══════════════════════════════════════════════════════════════════
// Scoped CSS for Test A
// ═══════════════════════════════════════════════════════════════════
const scopedCSS = `
  .testa-header {
    text-align: center;
    margin-bottom: 28px;
  }
  .testa-header h1 {
    font-size: 1.55rem;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .intro-copy {
    color: var(--text-primary);
    font-size: 1rem;
    line-height: 1.65;
    margin: 0 0 24px;
  }

  .progress-wrap { margin-bottom: 24px; }
  .progress-info {
    display: flex; justify-content: space-between;
    font-size: 0.82rem; color: var(--text-secondary);
    margin-bottom: 8px;
  }
  .progress-score { font-weight: 600; color: var(--accent); }
  .progress-track {
    height: 6px; background: var(--card-border);
    border-radius: 3px; overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), #818cf8);
    border-radius: 3px;
    transition: width 0.5s cubic-bezier(0.22,1,0.36,1);
  }

  .question-label {
    text-align: center; font-size: 0.85rem;
    color: var(--text-muted); margin-bottom: 20px;
  }
  .audio-area {
    display: flex; flex-direction: column;
    align-items: center; margin-bottom: 28px;
  }
  .play-btn {
    width: 96px; height: 96px; border-radius: 50%;
    border: 2px solid var(--accent);
    background: rgba(56,189,248,0.08);
    cursor: pointer; display: flex;
    align-items: center; justify-content: center;
    transition: all 0.25s ease;
  }
  .play-btn:hover {
    background: rgba(56,189,248,0.15);
    transform: scale(1.06);
    box-shadow: 0 0 32px rgba(56,189,248,0.2);
  }
  .play-btn:active { transform: scale(0.96); }
  .play-btn.playing {
    border-color: var(--correct);
    background: rgba(74,222,128,0.1);
    animation: pulse-ring 1s ease-out;
  }
  .play-icon {
    width: 0; height: 0;
    border-top: 18px solid transparent;
    border-bottom: 18px solid transparent;
    border-left: 28px solid var(--accent);
    margin-left: 6px; transition: border-color 0.2s;
  }
  .play-btn.playing .play-icon { border-left-color: var(--correct); }
  .play-hint {
    margin-top: 12px; font-size: 0.82rem; color: var(--text-muted);
  }

  .choices {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  }
  .choice-btn {
    background: var(--surface);
    border: 2px solid var(--card-border);
    border-radius: var(--radius-sm);
    padding: 16px 12px; cursor: pointer;
    text-align: center; transition: all 0.2s ease;
    font-family: inherit; color: var(--text-primary);
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .choice-btn:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
  .choice-btn:hover:not(.disabled) {
    border-color: var(--accent);
    background: var(--accent-glow);
    transform: translateY(-2px);
  }
  .choice-letter {
    display: block; font-size: 0.72rem; font-weight: 600;
    color: var(--text-muted); margin-bottom: 4px;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .choice-pinyin { font-size: 1.35rem; font-weight: 600; }
  .choice-tone { font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: block; }
  .choice-btn.correct { border-color: var(--correct); background: var(--correct-bg); }
  .choice-btn.correct .choice-pinyin { color: var(--correct); }
  .choice-btn.incorrect { border-color: var(--incorrect); background: var(--incorrect-bg); }
  .choice-btn.incorrect .choice-pinyin { color: var(--incorrect); }
  .choice-btn.disabled { cursor: default; opacity: 0.55; }
  .choice-btn.correct.disabled, .choice-btn.incorrect.disabled { opacity: 1; }

  /* ── Result screen (slide 5) ── */
  /* Score + REPORT accordion share one card (slide 5 mock). */
  .result-scorecard {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
    margin-bottom: 22px;
  }
  .rs-score { text-align: center; padding: 28px 20px 22px; }
  .rs-score-label {
    display: block; font-size: 0.8rem;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--accent); margin-bottom: 10px;
  }
  .rs-score-value {
    display: block; font-size: 3.2rem; font-weight: 700; line-height: 1;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .rs-divider { height: 1px; background: var(--card-border); }
  /* Neutralise the accordion's own shell so it sits flush inside the card. */
  .rs-acc {
    border: none !important;
    background: transparent !important;
    border-radius: 0 !important;
  }

  .result-next {
    width: 100%;
    display: block; text-align: center;
    background: linear-gradient(135deg, rgba(56,189,248,0.12), rgba(129,140,248,0.12));
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    padding: 20px 18px;
    cursor: pointer; font-family: inherit;
    color: var(--text-primary);
    transition: all 0.2s;
    margin-bottom: 24px;
  }
  .result-next:hover {
    background: linear-gradient(135deg, rgba(56,189,248,0.22), rgba(129,140,248,0.22));
    transform: translateY(-1px);
  }
  .result-next-head {
    font-size: 0.95rem; font-weight: 700;
    color: var(--accent); margin-bottom: 6px;
  }
  .result-next-title { font-size: 1.15rem; font-weight: 600; }

  .result-retake {
    text-align: center;
    font-style: italic;
    color: var(--text-muted);
    font-size: 0.85rem;
    line-height: 1.6;
    margin: 0;
    padding: 0 8px;
  }
  .result-retake-link {
    background: none; border: none; padding: 0; margin-left: 4px;
    font-family: inherit; font-size: 0.85rem;
    font-style: italic; font-weight: 700;
    color: var(--text-primary);
    text-decoration: underline;
    cursor: pointer;
  }
  .result-retake-link:hover { color: var(--accent); }

  @media (max-width: 480px) {
    .choices { gap: 10px; }
    .choice-btn { padding: 14px 8px; }
    .choice-pinyin { font-size: 1.15rem; }
    .play-btn { width: 80px; height: 80px; }
    .rs-score-value { font-size: 2.6rem; }
  }
`
