// ═══════════════════════════════════════════════════════════════════
// Test 2 — Two-syllable Tone Listening (15 items)
// One question per tone-pair combo, excluding 3+3 sandhi → 4*4-1 = 15.
// New flow per APP UI UX.pptx slides 12–16.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { SYLLABLE_POOL, applyTone, getTTSChar, shuffle, hasCharacter } from '../utils/pinyin.js'
import { speakChinese, playDisyllable } from '../utils/audio.js'
import { DISYLLABLE_BY_PAIR, hasDisyllableRecording } from '../utils/disyllableManifest.js'
import { saveResult } from '../services/progressService.js'
import {
  analyzeDisyllabic, buildReportHTML, TONE_REPORT_CSS, bindAccordion,
} from '../utils/toneReport.js'

const TOTAL = 15
const PASS_SCORE = 9   // ~58% threshold preserved

// 15 tone pair combos: every (t1, t2) where t1, t2 ∈ {1..4} minus 3+3.
const ALL_PAIRS = []
for (let a = 1; a <= 4; a++) {
  for (let b = 1; b <= 4; b++) {
    if (a === 3 && b === 3) continue
    ALL_PAIRS.push([a, b])
  }
}

export function testBView(container) {
  let questions = []
  let currentQ = 0
  let score = 0
  let answered = false
  let answers = []
  let qStart = 0
  let testStart = 0
  let previousFiles = new Set()

  function generate() {
    // 15q test → use every combo exactly once, shuffled.
    const pairs = shuffle(ALL_PAIRS.slice())
    const usedFiles = new Set()

    const pickRecorded = (t1, t2) => {
      const key = `${t1}${t2}`
      const items = DISYLLABLE_BY_PAIR[key] || []
      const fresh = items.filter(it => !usedFiles.has(`${key}/${it.file}`) && !previousFiles.has(`${key}/${it.file}`))
      const cand = items.filter(it => !usedFiles.has(`${key}/${it.file}`))
      const pool = fresh.length ? fresh : (cand.length ? cand : items)
      if (!pool.length) return null
      const hit = pool[Math.floor(Math.random() * pool.length)]
      usedFiles.add(`${key}/${hit.file}`)
      return { syl1: hit.syl1, tone1: t1, syl2: hit.syl2, tone2: t2, file: hit.file, pairKey: key }
    }

    const usedSyls = new Set()
    const pickSynth = (tone) => {
      const cand = SYLLABLE_POOL.filter(s => !usedSyls.has(s) && hasCharacter(s, tone))
      const pool = cand.length ? cand : SYLLABLE_POOL.filter(s => hasCharacter(s, tone))
      const pick = pool[Math.floor(Math.random() * pool.length)]
      usedSyls.add(pick)
      return pick
    }

    questions = pairs.map(([t1, t2]) => {
      return pickRecorded(t1, t2) || {
        syl1: pickSynth(t1), tone1: t1,
        syl2: pickSynth(t2), tone2: t2,
      }
    })
    previousFiles = new Set(questions.filter(q => q.file).map(q => `${q.pairKey}/${q.file}`))
  }

  // 4 multiple-choice options: correct combo + 3 distractors.
  function makeChoices(q) {
    const correct = { t1: q.tone1, t2: q.tone2 }
    const allCombos = []
    for (let a = 1; a <= 4; a++) {
      for (let b = 1; b <= 4; b++) {
        if (a === 3 && b === 3) continue
        if (a !== correct.t1 || b !== correct.t2) {
          allCombos.push({ t1: a, t2: b })
        }
      }
    }
    const distractors = shuffle(allCombos).slice(0, 3)
    return shuffle([correct, ...distractors])
  }

  // ── Mount ──
  container.innerHTML = `
    <div class="app-shell shell-top-center">
      <div class="back-row">
        <button class="app-logo" id="tb-home">Just4Tones</button>
      </div>
      <div class="testb-header">
        <h1><span class="title-badge">2</span>Recognizing — 2-Syllable Words</h1>
      </div>

      <!-- Intro (slide 15) -->
      <div id="tb-intro" class="card animate-in text-center">
        <p class="intro-copy">
          In this test, you are going to hear 15 different two-syllable Chinese words.
          Pick the correct tones.
        </p>
        <button class="btn btn-primary btn-lg" id="tb-start">START NOW</button>
      </div>

      <!-- Quiz -->
      <div id="tb-quiz" class="hidden">
        <div class="progress-wrap">
          <div class="progress-info">
            <span id="tb-prog-label">Question 1 of ${TOTAL}</span>
            <span class="progress-score" id="tb-prog-score">Score: 0</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="tb-prog-fill" style="width:0%"></div>
          </div>
        </div>
        <div class="card animate-in" id="tb-card">
          <div class="question-label">Listen and identify both tones</div>
          <div class="audio-area">
            <button class="play-btn" id="tb-play"><div class="play-icon"></div></button>
            <div class="play-hint" id="tb-hint">Tap to listen</div>
          </div>
          <div class="choices tb-choices" id="tb-choices"></div>
        </div>
      </div>

      <!-- Score screen (accordion-style report) -->
      <div id="tb-report" class="hidden"></div>
    </div>
    <div class="feedback-toast" id="tb-toast"></div>
  `

  const style = document.createElement('style')
  style.textContent = scopedCSS + TONE_REPORT_CSS
  container.appendChild(style)

  const $ = (id) => document.getElementById(id)
  $('tb-home').addEventListener('click', () => navigate('/'))
  $('tb-start').addEventListener('click', startTest)
  $('tb-play').addEventListener('click', playCurrent)

  function startTest() {
    generate()
    currentQ = 0; score = 0; answers = []; testStart = Date.now()
    container.querySelector('.back-row')?.classList.remove('hidden')
    container.querySelector('.testb-header')?.classList.remove('hidden')
    $('tb-intro').classList.add('hidden')
    $('tb-quiz').classList.remove('hidden')
    $('tb-report').classList.add('hidden')
    loadQ()
  }

  function loadQ() {
    answered = false
    qStart = Date.now()
    const q = questions[currentQ]

    $('tb-prog-label').textContent = `Question ${currentQ + 1} of ${TOTAL}`
    $('tb-prog-score').textContent = `Score: ${score}`
    $('tb-prog-fill').style.width = `${(currentQ / TOTAL) * 100}%`
    $('tb-hint').textContent = 'Tap to listen'
    $('tb-play').classList.remove('playing')

    const choices = makeChoices(q)
    const letters = ['A', 'B', 'C', 'D']
    const el = $('tb-choices')
    el.innerHTML = ''

    choices.forEach((c, idx) => {
      const btn = document.createElement('button')
      btn.className = 'choice-btn'
      btn.dataset.t1 = c.t1
      btn.dataset.t2 = c.t2
      const pinyin = applyTone(q.syl1, c.t1) + applyTone(q.syl2, c.t2)
      btn.innerHTML = `
        <span class="choice-letter">${letters[idx]}</span>
        <span class="choice-pinyin">${pinyin}</span>
      `
      btn.addEventListener('click', () => pick(c, btn))
      el.appendChild(btn)
    })

    const card = $('tb-card')
    card.style.animation = 'none'
    card.offsetHeight
    card.style.animation = 'cardIn 0.4s ease-out'
  }

  function playCurrent() {
    const q = questions[currentQ]
    if (!q) return
    const btn = $('tb-play')
    btn.classList.add('playing')
    $('tb-hint').textContent = 'Listening…'

    const done = () => {
      btn.classList.remove('playing')
      $('tb-hint').textContent = 'Tap to replay'
    }

    if (hasDisyllableRecording(q.syl1, q.tone1, q.syl2, q.tone2)) {
      playDisyllable(q.syl1, q.tone1, q.syl2, q.tone2, done)
      return
    }

    const char1 = getTTSChar(q.syl1, q.tone1) ?? ''
    const char2 = getTTSChar(q.syl2, q.tone2) ?? ''
    speakChinese(char1 + char2 || null, q.tone1, done)
  }

  function pick(selected, btnEl) {
    if (answered) return
    answered = true
    const q = questions[currentQ]
    const ok = selected.t1 === q.tone1 && selected.t2 === q.tone2
    if (ok) score++

    const correctPinyin = applyTone(q.syl1, q.tone1) + applyTone(q.syl2, q.tone2)
    const selectedPinyin = applyTone(q.syl1, selected.t1) + applyTone(q.syl2, selected.t2)

    answers.push({
      syl1: q.syl1, syl2: q.syl2,
      tone1: q.tone1, tone2: q.tone2,
      tones: [q.tone1, q.tone2],     // for analyzeDisyllabic
      selT1: selected.t1, selT2: selected.t2,
      correct: ok,
      correctPinyin, selectedPinyin,
      time: Date.now() - qStart,
    })

    document.querySelectorAll('#tb-choices .choice-btn').forEach(b => {
      const bt1 = parseInt(b.dataset.t1)
      const bt2 = parseInt(b.dataset.t2)
      const isCorrect = bt1 === q.tone1 && bt2 === q.tone2
      const isSelected = bt1 === selected.t1 && bt2 === selected.t2
      if (isCorrect) b.classList.add('correct')
      else if (isSelected && !ok) b.classList.add('incorrect')
      b.classList.add('disabled')
    })

    $('tb-prog-score').textContent = `Score: ${score}`
    showToast(ok)

    setTimeout(() => {
      currentQ++
      if (currentQ >= TOTAL) showScoreScreen()
      else loadQ()
    }, 1500)
  }

  function showToast(ok) {
    const t = $('tb-toast')
    t.className = 'feedback-toast'
    const msgs = ok
      ? ['Correct! ✓','Nice ear! ✓','Spot on! ✓','Perfect! ✓']
      : ['Not quite ✗','Try next time ✗','Almost! ✗']
    t.textContent = msgs[Math.floor(Math.random() * msgs.length)]
    t.classList.add(ok ? 'correct' : 'incorrect')
    requestAnimationFrame(() => t.classList.add('show'))
    setTimeout(() => t.classList.remove('show'), 1100)
  }

  function showScoreScreen() {
    $('tb-quiz').classList.add('hidden')
    container.querySelector('.back-row')?.classList.add('hidden')
    container.querySelector('.testb-header')?.classList.add('hidden')
    const el = $('tb-report')
    el.classList.remove('hidden')

    saveResult('B', score, TOTAL, { answers, totalTime: Date.now() - testStart })

    const analysis = analyzeDisyllabic(answers)
    const reportInner = buildReportHTML({
      analysis, score, total: TOTAL,
      testLabel: 'Test 2 · Recognizing 2-syllable',
      shape: 'disyl',
      skill: 'recognizing',
      showSummary: false, // score already shown in the headline above
    })

    el.innerHTML = `
      <div class="result-shell animate-in">
        <button class="app-logo" id="tb-logo">Just4Tones</button>

        <div class="result-scorecard">
          <div class="rs-score">
            <span class="rs-score-label">You scored</span>
            <span class="rs-score-value">${score}/${TOTAL}</span>
          </div>
          <div class="rs-divider"></div>
          <div class="tr-report-head">Your REPORT</div>
          ${reportInner.html}
        </div>

        <button class="result-next" id="tb-next">
          <div class="result-next-title">Jump to Speaking Challenges</div>
        </button>

        <p class="result-retake">
          Do you want to take that test again? Fluctuation in performance in listening foreign sounds is totally expected.
          <button class="result-retake-link" id="tb-retry">Test Again</button>
        </p>
      </div>
    `

    bindAccordion(el)
    document.getElementById('tb-logo').addEventListener('click', () => navigate('/'))
    document.getElementById('tb-retry').addEventListener('click', startTest)
    document.getElementById('tb-next').addEventListener('click', () => navigate('/test-3'))
  }
}

// ═══════════════════════════════════════════════════════════════════
// Scoped CSS
// ═══════════════════════════════════════════════════════════════════
const scopedCSS = `
  .testb-header {
    text-align: center;
    margin-bottom: 28px;
  }
  .testb-header h1 {
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

  /* Test B uses a single-column layout for longer pinyin */
  .tb-choices {
    display: flex !important;
    flex-direction: column !important;
    gap: 10px;
  }
  .choice-btn {
    background: var(--surface);
    border: 2px solid var(--card-border);
    border-radius: var(--radius-sm);
    padding: 14px 16px; cursor: pointer;
    text-align: center; transition: all 0.2s ease;
    font-family: inherit; color: var(--text-primary);
    display: flex; align-items: center; gap: 12px;
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
    font-size: 0.75rem; font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.08em;
    flex-shrink: 0; width: 24px;
  }
  .choice-pinyin { font-size: 1.2rem; font-weight: 600; }
  .choice-btn.correct { border-color: var(--correct); background: var(--correct-bg); }
  .choice-btn.correct .choice-pinyin { color: var(--correct); }
  .choice-btn.incorrect { border-color: var(--incorrect); background: var(--incorrect-bg); }
  .choice-btn.incorrect .choice-pinyin { color: var(--incorrect); }
  .choice-btn.disabled { cursor: default; opacity: 0.55; }
  .choice-btn.correct.disabled, .choice-btn.incorrect.disabled { opacity: 1; }

  /* ── Result screen (slide 16) ── */
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
    .play-btn { width: 80px; height: 80px; }
    .rs-score-value { font-size: 2.6rem; }
  }
`
