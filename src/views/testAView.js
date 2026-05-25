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
      const pool = fresh.length ? fresh : (cand.length ? cand : SYLLABLE_POOL.filter(s => !used.has(s)))
      const syllable = pool[Math.floor(Math.random() * pool.length)]
      used.add(syllable)
      return { syllable, tone: t }
    })
    previousItems = new Set(questions.map(q => `${q.syllable}${q.tone}`))
  }

  // ── Mount ──
  container.innerHTML = `
    <div class="app-shell">
      <div class="back-row">
        <button class="back-home-btn" id="ta-home">← Home</button>
      </div>
      <div class="testa-header">
        <span class="badge">Step 1 of 4</span>
        <h1>1️⃣ Listening — 1-Syllable Words</h1>
        <p>Find out exactly where your tone skills stand.</p>
      </div>

      <!-- Intro -->
      <div id="ta-intro" class="card animate-in text-center">
        <div style="font-size:3rem;margin-bottom:16px">🎧</div>
        <h2>Ready?</h2>
        <p style="color:var(--text-secondary);margin:12px 0;line-height:1.6">
          In this test, you are going to hear <strong>8 different single-syllable Chinese words</strong>.
          Pick the correct tones.
        </p>
        <div class="intro-rules">
          <strong>How it works:</strong><br>
          — 8 questions, one at a time<br>
          — Each tone appears exactly ${PER_TONE} times<br>
          — Tap the speaker to hear the syllable<br>
          — Pick the pinyin with the correct tone mark
        </div>
        <button class="btn btn-primary btn-lg" id="ta-start">Start Now</button>
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
    const el = $('ta-report')
    el.classList.remove('hidden')

    const passed = score >= PASS_SCORE
    saveResult('A', score, TOTAL, { answers, totalTime: Date.now() - testStart })

    const analysis = analyzeSingleSyllable(answers)
    const reportInner = buildReportHTML({
      analysis, score, total: TOTAL,
      testLabel: 'Test 1 · Listening 1-syllable',
      shape: 'single',
    })

    el.innerHTML = `
      <div class="app-shell animate-in">
        <div class="score-card">
          <div class="score-headline">🎯 You scored</div>
          <div class="score-big">${score}/${TOTAL}</div>
          <div class="score-sub">
            ${passed
              ? `Nice work — your ear is tuned!`
              : `Fluctuation in performance when listening to foreign sounds is totally expected.`}
          </div>
        </div>

        <div class="tr-accordion" id="ta-acc">
          <button class="tr-accordion-head" type="button">
            <div class="tr-accordion-head-text">
              <div class="tr-accordion-head-title">📊 Open your Report</div>
              <div class="tr-accordion-head-sub">Tap to see per-tone breakdown & recommendations</div>
            </div>
            <div class="tr-accordion-chevron">▾</div>
          </button>
          <div class="tr-accordion-body">
            <div class="tr-accordion-body-inner">
              ${reportInner.html}
            </div>
          </div>
        </div>

        <div class="next-challenge">
          <div class="next-challenge-head">Try Next Challenge!</div>
          <button class="next-challenge-btn" id="ta-next">
            <div class="next-challenge-icon">2️⃣</div>
            <div class="next-challenge-body">
              <div class="next-challenge-title">Listening — 2-Syllable Words</div>
              <div class="next-challenge-sub">15 questions · all tone combinations</div>
            </div>
            <div class="next-challenge-arrow">→</div>
          </button>
        </div>

        <div class="retake-row">
          <p class="retake-prompt">Do you want to take this test again? Fluctuation in performance is totally expected.</p>
          <button class="btn btn-secondary" id="ta-retry">🔄 Test Again</button>
        </div>
      </div>
    `

    bindAccordion(el)
    document.getElementById('ta-retry').addEventListener('click', startTest)
    document.getElementById('ta-next').addEventListener('click', () => navigate('/test-b'))
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
    margin: 10px 0 6px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .testa-header p {
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  .intro-rules {
    text-align: left;
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 16px 20px;
    margin: 20px 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.7;
  }
  .intro-rules strong { color: var(--text-primary); }

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

  /* Score screen */
  .score-card {
    text-align: center;
    padding: 24px 16px 28px;
    margin-bottom: 18px;
  }
  .score-headline { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-bottom: 8px; }
  .score-big {
    font-size: 3.2rem; font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1; margin-bottom: 8px;
  }
  .score-sub { color: var(--text-secondary); font-size: 0.92rem; line-height: 1.5; }

  .next-challenge {
    margin-top: 22px;
  }
  .next-challenge-head {
    text-align: center; font-size: 0.92rem; font-weight: 600;
    color: var(--text-primary); margin-bottom: 10px;
  }
  .next-challenge-btn {
    width: 100%;
    display: flex; align-items: center; gap: 14px;
    background: linear-gradient(135deg, rgba(56,189,248,0.15), rgba(129,140,248,0.15));
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    padding: 16px 18px;
    cursor: pointer; font-family: inherit;
    color: var(--text-primary);
    transition: all 0.2s;
  }
  .next-challenge-btn:hover {
    background: linear-gradient(135deg, rgba(56,189,248,0.25), rgba(129,140,248,0.25));
    transform: translateY(-1px);
  }
  .next-challenge-icon { font-size: 1.8rem; flex-shrink: 0; }
  .next-challenge-body { flex: 1; text-align: left; }
  .next-challenge-title { font-weight: 600; font-size: 1rem; margin-bottom: 2px; }
  .next-challenge-sub { font-size: 0.8rem; color: var(--text-secondary); }
  .next-challenge-arrow { font-size: 1.3rem; color: var(--accent); flex-shrink: 0; }

  .retake-row {
    margin-top: 22px; text-align: center;
  }
  .retake-prompt {
    color: var(--text-muted); font-size: 0.82rem;
    margin-bottom: 10px; line-height: 1.5;
  }

  @media (max-width: 480px) {
    .choices { gap: 10px; }
    .choice-btn { padding: 14px 8px; }
    .choice-pinyin { font-size: 1.15rem; }
    .play-btn { width: 80px; height: 80px; }
    .score-big { font-size: 2.6rem; }
  }
`
