// ═══════════════════════════════════════
// Test B – Two-Syllable Tone Listening (12 items)
// Identical to Test A but with two-character combos
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { SYLLABLE_POOL, applyTone, shuffle, makeTwoSyllableItem, formatTwoSyllable } from '../utils/pinyin.js'
import { speakChinese } from '../utils/audio.js'

const TOTAL = 12
const PASS_SCORE = 10

// Pre-build all 16 tone pair combos, then pick 12 ensuring variety
const ALL_PAIRS = []
for (let a = 1; a <= 4; a++) {
  for (let b = 1; b <= 4; b++) {
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

  // Generate 12 two-syllable questions
  // Each of the 4 tones appears at least ~3 times across the 24 syllable slots
  function generate() {
    // Pick 12 random tone pairs from the 16 combos
    const pairs = shuffle(ALL_PAIRS).slice(0, 12)
    const pool = shuffle(SYLLABLE_POOL)
    let poolIdx = 0

    questions = pairs.map(([t1, t2]) => {
      const syl1 = pool[poolIdx++]
      const syl2 = pool[poolIdx++]
      return { syl1, tone1: t1, syl2, tone2: t2 }
    })
  }

  // Build 4 choices: correct pair + 3 distractors (vary tone combos)
  function makeChoices(q) {
    const correct = { t1: q.tone1, t2: q.tone2 }
    const choices = [correct]

    // Generate 3 unique distractor tone combos
    const allCombos = []
    for (let a = 1; a <= 4; a++) {
      for (let b = 1; b <= 4; b++) {
        if (a !== correct.t1 || b !== correct.t2) {
          allCombos.push({ t1: a, t2: b })
        }
      }
    }
    const distractors = shuffle(allCombos).slice(0, 3)
    choices.push(...distractors)

    return shuffle(choices)
  }

  // ── Mount ──
  container.innerHTML = `
    <div class="app-shell">
      <div class="testb-header">
        <span class="badge">Diagnostic Step 1b</span>
        <h1>Test B — Tone Pairs</h1>
        <p>Can you identify tones in two-syllable combinations?</p>
      </div>

      <!-- Intro -->
      <div id="tb-intro" class="card animate-in text-center">
        <div style="font-size:3rem;margin-bottom:16px">🎧🎧</div>
        <h2>Two syllables this time!</h2>
        <p style="color:var(--text-secondary);margin:12px 0;line-height:1.6">
          You'll hear 12 two-syllable combinations.<br>
          Pick the pinyin with the correct tone marks for both syllables.
        </p>
        <div class="intro-rules">
          <strong>How it works:</strong><br>
          — 12 questions, one at a time<br>
          — Each item has two syllables with their own tones<br>
          — Tap the speaker to hear the combination<br>
          — Score ${PASS_SCORE}+ out of 12 to pass ✓
        </div>
        <button class="btn btn-primary btn-lg" id="tb-start">Start Test B</button>
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

      <!-- Report -->
      <div id="tb-report" class="hidden"></div>
    </div>
    <div class="feedback-toast" id="tb-toast"></div>
  `

  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)

  const $ = (id) => document.getElementById(id)
  $('tb-start').addEventListener('click', startTest)
  $('tb-play').addEventListener('click', playCurrent)

  function startTest() {
    generate()
    currentQ = 0; score = 0; answers = []; testStart = Date.now()
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

    // Speak first syllable, then second
    const text = applyTone(q.syl1, q.tone1) + applyTone(q.syl2, q.tone2)
    speakChinese(text, q.tone1, () => {
      btn.classList.remove('playing')
      $('tb-hint').textContent = 'Tap to replay'
    })
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
      selT1: selected.t1, selT2: selected.t2,
      correct: ok,
      correctPinyin,
      selectedPinyin,
      time: Date.now() - qStart,
    })

    // Highlight choices
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
      if (currentQ >= TOTAL) showReport()
      else loadQ()
    }, 1600)
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
    setTimeout(() => t.classList.remove('show'), 1200)
  }

  // ── Report ──
  function showReport() {
    $('tb-quiz').classList.add('hidden')
    const el = $('tb-report')
    el.classList.remove('hidden')

    const pct = Math.round((score / TOTAL) * 100)
    const passed = score >= PASS_SCORE

    // Detail rows
    let details = ''
    answers.forEach((a, i) => {
      const icon = a.correct ? '✅' : '❌'
      const ts = (a.time / 1000).toFixed(1) + 's'
      const display = a.correct ? a.correctPinyin : `${a.selectedPinyin} → ${a.correctPinyin}`
      details += `
        <div class="detail-item">
          <span class="detail-icon">${icon}</span>
          <span class="detail-qn">${i + 1}.</span>
          <span class="detail-pinyin">${display}</span>
          <span class="detail-time">${ts}</span>
        </div>`
    })

    let verdict = ''
    if (passed) {
      verdict = `🎉 Excellent! You scored <strong>${score}/${TOTAL}</strong> on Test B. It seems that you can identify and distinguish the four tones competently! Now let's see if you can pronounce the four tones like a Chinese native!`
    } else {
      verdict = `You scored <strong>${score}/${TOTAL}</strong> on Test B. It seems that you have some work to do with your ears! Let's practice tone recognition.`
    }

    el.innerHTML = `
      <div class="app-shell animate-in">
        <div class="text-center" style="margin-bottom:28px">
          <h2 style="font-size:1.5rem;margin-bottom:4px">Test B — Results</h2>
          <div class="score-ring" style="--pct:${pct}">
            <span class="score-num">${score}/${TOTAL}</span>
            <span class="score-label">${pct}%</span>
          </div>
          <div style="color:var(--text-secondary);line-height:1.5;padding:0 12px">${verdict}</div>
        </div>

        <div class="card" style="margin-bottom:28px">
          <h3 class="section-head">Question Details</h3>
          ${details}
        </div>

        <div class="report-actions">
          <button class="btn btn-secondary" id="tb-retry">🔄 Retake</button>
          <button class="btn btn-primary" id="tb-continue">
            ${passed ? '→ Continue to Step 2' : '→ Practice Tones'}
          </button>
        </div>
      </div>
    `

    document.getElementById('tb-retry').addEventListener('click', startTest)
    document.getElementById('tb-continue').addEventListener('click', () => {
      if (passed) {
        // TODO: navigate('/test-c') — Step 2 pronunciation test
        alert('Next: Step 2 — Pronunciation Test (Test C) — coming soon!')
      } else {
        // TODO: navigate('/practice-recognition') — Interface II
        alert('Next: Tone Recognition Exercises (Interface II) — coming soon!')
      }
    })
  }
}

// ═══════════════════════════════════════
// Scoped CSS (reuses most of Test A styles + overrides)
// ═══════════════════════════════════════
const scopedCSS = `
  .testb-header {
    text-align: center;
    margin-bottom: 28px;
  }
  .testb-header h1 {
    font-size: 1.65rem;
    font-weight: 700;
    margin: 10px 0 6px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .testb-header p {
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
  }
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

  /* Report */
  .score-ring {
    width: 120px; height: 120px; border-radius: 50%;
    margin: 0 auto 16px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; position: relative;
  }
  .score-ring::before {
    content: ''; position: absolute; inset: 0; border-radius: 50%; padding: 4px;
    background: conic-gradient(var(--accent) calc(var(--pct) * 3.6deg), var(--card-border) 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 3px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 3px));
  }
  .score-num { font-size: 2.2rem; font-weight: 700; line-height: 1; }
  .score-label { font-size: 0.78rem; color: var(--text-secondary); }

  .section-head {
    font-size: 0.85rem; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 16px;
  }

  .detail-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 0; border-bottom: 1px solid var(--card-border); font-size: 0.88rem;
  }
  .detail-item:last-child { border-bottom: none; }
  .detail-icon { flex-shrink: 0; font-size: 1rem; }
  .detail-qn { flex: 0 0 24px; color: var(--text-muted); font-size: 0.78rem; }
  .detail-pinyin { flex: 1; font-weight: 600; }
  .detail-time { flex: 0 0 36px; text-align: right; color: var(--text-muted); font-size: 0.78rem; }

  .report-actions { display: flex; gap: 12px; }

  @media (max-width: 480px) {
    .play-btn { width: 80px; height: 80px; }
    .report-actions { flex-direction: column; }
  }
`