// ═══════════════════════════════════════
// Test Y – Disyllabic Word Tone Knowledge
// 10 sub-rounds (Y1…Y10), 20 items each, drawn from successive 50-word
// slices of the top-500 HSK 1–3 disyllabic words. Pass at 16+ per round.
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { saveResult } from '../services/progressService.js'
import { HSK_DISYLLABIC_WORDS as RAW_HSK } from '../utils/hskDisyllabicWords.js'

// Omit 3+3 words — tone-3 sandhi makes the natural pronunciation 2+3, which
// mismatches the written tones used by the test choices.
const HSK_DISYLLABIC_WORDS = RAW_HSK.filter(w => w.pattern !== '33')

const TOTAL = 20
const PASS_SCORE = 16
const ROUND_SLICE_SIZE = 50
const ROUND_COUNT = 10  // Y1…Y10

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const TONE_MARKS = 'āáǎàēéěèīíǐìōóǒòūúǔǜǖǘǚǜüńňǹ'
const TONE_BARE = 'aaaaeeeeiiiiooooùuuüuuuuünnnn'
function stripTones(s) {
  let out = ''
  for (const ch of s) {
    const idx = TONE_MARKS.indexOf(ch)
    out += idx >= 0 ? TONE_BARE[idx] : ch
  }
  return out
}

function patternLabel(p) {
  const names = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '·' }
  return `${names[p[0]] || p[0]} – ${names[p[1]] || p[1]}`
}

export function testYView(container) {
  const rawRound = parseInt(sessionStorage.getItem('j4t_test_y_round') || '1', 10)
  const round = Math.min(Math.max(rawRound, 1), ROUND_COUNT)

  // Words for this round: slice [start, start+50), pick 20 of them
  const start = (round - 1) * ROUND_SLICE_SIZE
  const slice = HSK_DISYLLABIC_WORDS.slice(start, start + ROUND_SLICE_SIZE)

  if (slice.length === 0) {
    renderUnavailable(container, round)
    return
  }

  let questions = []
  let currentQ = 0
  let score = 0
  let answered = false
  let answers = []

  function generate() {
    questions = shuffle(slice).slice(0, Math.min(TOTAL, slice.length))
  }

  function buildChoices(correctPattern) {
    const allPatterns = []
    for (let a = 1; a <= 4; a++) {
      for (let b = 1; b <= 4; b++) {
        const p = `${a}${b}`
        if (p === '33') continue // sandhi target — not a valid answer choice
        if (p !== correctPattern) allPatterns.push(p)
      }
    }
    const distractors = shuffle(allPatterns).slice(0, 3)
    return shuffle([correctPattern, ...distractors])
  }

  container.innerHTML = `
    <div class="app-shell">
      <div class="ty-header">
        <button class="ty-back-btn" id="ty-back" aria-label="Back to home">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 16L7 10L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="ty-header-text">
          <span class="badge">Diagnostic Step 3 · Round Y${round}</span>
          <h1>Disyllabic Word Tones</h1>
        </div>
      </div>

      <!-- Intro -->
      <div id="ty-intro" class="card animate-in text-center">
        <div style="font-size:3rem;margin-bottom:16px">📚</div>
        <h2 style="font-size:1.35rem;margin-bottom:12px">Round Y${round} (words ${start + 1}–${start + slice.length})</h2>
        <p style="color:var(--text-secondary);line-height:1.6;margin-bottom:16px">
          ${round === 1
            ? `Here are the top 500 disyllabic Chinese words from HSK level 1 to level 3. Let's see if you know their tones!`
            : `Round Y${round} of ${ROUND_COUNT}. Care for more?`}
        </p>
        <div class="ty-round-picker">
          <span class="ty-picker-label">Pick a round:</span>
          <div class="ty-picker-chips">
            ${Array.from({ length: ROUND_COUNT }, (_, i) => {
              const r = i + 1
              const s = (r - 1) * ROUND_SLICE_SIZE
              const e = Math.min(s + ROUND_SLICE_SIZE, HSK_DISYLLABIC_WORDS.length)
              const disabled = e <= s
              return `<button class="ty-picker-chip ${r === round ? 'active' : ''}" data-round="${r}" ${disabled ? 'disabled' : ''}>Y${r}</button>`
            }).join('')}
          </div>
        </div>
        <div class="ty-rules">
          — ${TOTAL} questions per round<br>
          — Each question shows a word; pick the correct tone pattern<br>
          — Score ${PASS_SCORE}+ to advance to Y${Math.min(round + 1, ROUND_COUNT)}
        </div>
        <button class="btn btn-primary btn-lg" id="ty-start">Start Round Y${round}</button>
      </div>

      <!-- Quiz -->
      <div id="ty-quiz" class="hidden">
        <div class="ty-progress-wrap">
          <div class="ty-progress-info">
            <span id="ty-prog-label">Question 1 of ${TOTAL}</span>
            <span class="ty-progress-score" id="ty-prog-score">Score: 0</span>
          </div>
          <div class="ty-progress-track">
            <div class="ty-progress-fill" id="ty-prog-fill" style="width:0%"></div>
          </div>
        </div>
        <div class="card animate-in" id="ty-card">
          <div class="ty-question-label">What's the tone pattern of this word?</div>
          <div class="ty-word-area">
            <div class="ty-word-chars" id="ty-chars"></div>
            <div class="ty-word-bare" id="ty-bare"></div>
            <div class="ty-word-meaning" id="ty-meaning"></div>
          </div>
          <div class="ty-choices" id="ty-choices"></div>
        </div>
      </div>

      <!-- Report -->
      <div id="ty-report" class="hidden"></div>
    </div>
    <div class="feedback-toast" id="ty-toast"></div>
  `

  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)

  const $ = (id) => document.getElementById(id)
  $('ty-back').addEventListener('click', () => {
    sessionStorage.removeItem('j4t_test_y_round')
    navigate('/')
  })
  $('ty-start').addEventListener('click', startQuiz)
  document.querySelectorAll('.ty-picker-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const r = parseInt(chip.dataset.round, 10)
      if (r === round || chip.disabled) return
      sessionStorage.setItem('j4t_test_y_round', String(r))
      location.reload()
    })
  })

  function startQuiz() {
    generate()
    currentQ = 0
    score = 0
    answers = []
    $('ty-intro').classList.add('hidden')
    $('ty-report').classList.add('hidden')
    $('ty-quiz').classList.remove('hidden')
    loadQ()
  }

  function loadQ() {
    answered = false
    const q = questions[currentQ]

    $('ty-prog-label').textContent = `Question ${currentQ + 1} of ${TOTAL}`
    $('ty-prog-score').textContent = `Score: ${score}`
    $('ty-prog-fill').style.width = `${(currentQ / TOTAL) * 100}%`

    $('ty-chars').textContent = q.chars
    $('ty-bare').textContent = stripTones(q.pinyin)
    $('ty-meaning').textContent = q.meaning

    const choices = buildChoices(q.pattern)
    const el = $('ty-choices')
    el.innerHTML = ''
    choices.forEach(p => {
      const btn = document.createElement('button')
      btn.className = 'ty-choice-btn'
      btn.dataset.pattern = p
      btn.innerHTML = `<span class="ty-choice-pattern">${patternLabel(p)}</span>`
      btn.addEventListener('click', () => pick(p, btn))
      el.appendChild(btn)
    })

    const card = $('ty-card')
    card.style.animation = 'none'
    card.offsetHeight
    card.style.animation = 'cardIn 0.4s ease-out'
  }

  function pick(selected, btnEl) {
    if (answered) return
    answered = true
    const q = questions[currentQ]
    const ok = selected === q.pattern
    if (ok) score++

    answers.push({
      chars: q.chars,
      pinyin: q.pinyin,
      pattern: q.pattern,
      selected,
      correct: ok,
    })

    // Highlight
    document.querySelectorAll('#ty-choices .ty-choice-btn').forEach(b => {
      const p = b.dataset.pattern
      if (p === q.pattern) b.classList.add('correct')
      else if (p === selected && !ok) b.classList.add('incorrect')
      b.classList.add('disabled')
    })

    $('ty-prog-score').textContent = `Score: ${score}`
    showToast(ok)

    setTimeout(() => {
      currentQ++
      if (currentQ >= questions.length) finishRound()
      else loadQ()
    }, 1400)
  }

  function showToast(ok) {
    const t = $('ty-toast')
    t.className = 'feedback-toast'
    t.textContent = ok ? 'Correct! ✓' : 'Not quite ✗'
    t.classList.add(ok ? 'correct' : 'incorrect')
    requestAnimationFrame(() => t.classList.add('show'))
    setTimeout(() => t.classList.remove('show'), 1100)
  }

  function finishRound() {
    saveResult(`Y${round}`, score, questions.length)
    // Also save under generic 'Y' so older callers see passedY
    saveResult('Y', score, questions.length)
    $('ty-quiz').classList.add('hidden')
    showReport()
  }

  function showReport() {
    const el = $('ty-report')
    el.classList.remove('hidden')

    const pct = Math.round((score / questions.length) * 100)
    const passed = score >= PASS_SCORE
    const isLastRound = round >= ROUND_COUNT

    let details = ''
    answers.forEach((a, i) => {
      const icon = a.correct ? '✓' : '✗'
      const display = a.correct
        ? a.pinyin
        : `${a.pinyin} (you picked ${patternLabel(a.selected)})`
      details += `
        <div class="ty-detail-item">
          <span class="ty-detail-icon">${icon}</span>
          <span class="ty-detail-qn">${i + 1}.</span>
          <span class="ty-detail-chars">${a.chars}</span>
          <span class="ty-detail-pinyin">${display}</span>
        </div>`
    })

    const verdict = passed
      ? `🎉 Impressive! ${isLastRound ? 'You\'ve completed all 10 rounds — you really know your disyllabic words!' : 'Care for more?'}`
      : `You scored <strong>${score}/${questions.length}</strong> on Round Y${round}. Practice makes perfect!`

    el.innerHTML = `
      <div class="app-shell animate-in">
        <div class="text-center" style="margin-bottom:24px">
          <h2 style="font-size:1.5rem;margin-bottom:4px">Round Y${round} — Results</h2>
          <div class="score-ring" style="--pct:${pct}">
            <span class="score-num">${score}/${questions.length}</span>
            <span class="score-label">${pct}%</span>
          </div>
          <div style="color:var(--text-secondary);line-height:1.5;padding:0 12px">${verdict}</div>
        </div>

        <div class="card" style="margin-bottom:24px">
          <h3 class="ty-section-head">Question Details</h3>
          ${details}
        </div>

        <div class="ty-actions">
          ${passed ? (isLastRound ? `
            <button class="btn btn-primary" id="ty-home">→ Back to Home</button>
          ` : `
            <button class="btn btn-secondary" id="ty-retry">🔄 Retake Y${round}</button>
            <button class="btn btn-primary" id="ty-next">→ Continue to Y${round + 1}</button>
          `) : `
            <button class="btn btn-primary" id="ty-retry">🔄 Retake the Test</button>
            <button class="btn btn-primary" id="ty-practice">📚 Word Tone Practice</button>
          `}
        </div>
      </div>
    `

    document.getElementById('ty-retry')?.addEventListener('click', () => {
      el.classList.add('hidden')
      $('ty-intro').classList.remove('hidden')
    })
    document.getElementById('ty-next')?.addEventListener('click', () => {
      sessionStorage.setItem('j4t_test_y_round', String(round + 1))
      navigate('/test-y')
      // Force re-render even though hash didn't change
      setTimeout(() => location.reload(), 50)
    })
    document.getElementById('ty-practice')?.addEventListener('click', () => {
      navigate('/practice-characters')
    })
    document.getElementById('ty-home')?.addEventListener('click', () => {
      sessionStorage.removeItem('j4t_test_y_round')
      navigate('/')
    })
  }
}

function renderUnavailable(container, round) {
  container.innerHTML = `
    <div class="app-shell">
      <div class="card animate-in text-center" style="padding:36px 24px">
        <h2 style="font-size:1.25rem">Round Y${round} not available</h2>
        <p style="color:var(--text-secondary);margin:12px 0 24px">
          Word data for this round hasn't been loaded.
        </p>
        <button class="btn btn-secondary" id="ty-back-home">← Back to Home</button>
      </div>
    </div>
  `
  document.getElementById('ty-back-home').addEventListener('click', () => {
    sessionStorage.removeItem('j4t_test_y_round')
    navigate('/')
  })
}

const scopedCSS = `
  .ty-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 24px;
  }
  .ty-back-btn {
    width: 40px; height: 40px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--card-border);
    background: var(--surface);
    color: var(--text-secondary);
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ty-back-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .ty-header-text h1 {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 6px 0 0;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .ty-round-picker {
    margin: 8px 0 18px;
  }
  .ty-picker-label {
    display: block;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .ty-picker-chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }
  .ty-picker-chip {
    background: var(--surface);
    border: 1px solid var(--card-border);
    color: var(--text-secondary);
    padding: 6px 12px;
    border-radius: 16px;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    min-width: 44px;
  }
  .ty-picker-chip:hover:not(:disabled):not(.active) {
    border-color: var(--accent);
    color: var(--accent);
  }
  .ty-picker-chip.active {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }
  .ty-picker-chip:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .ty-rules {
    background: var(--surface);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-sm);
    padding: 14px;
    margin: 12px 0 20px;
    color: var(--text-secondary);
    font-size: 0.85rem;
    line-height: 1.7;
    text-align: left;
  }

  .ty-progress-wrap { margin-bottom: 16px; }
  .ty-progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }
  .ty-progress-score { font-weight: 600; color: var(--text-primary); }
  .ty-progress-track {
    height: 6px;
    background: var(--surface);
    border-radius: 3px;
    overflow: hidden;
  }
  .ty-progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.4s ease;
  }

  .ty-question-label {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
    margin-bottom: 16px;
  }
  .ty-word-area {
    text-align: center;
    margin-bottom: 24px;
  }
  .ty-word-chars {
    font-size: 3rem;
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 8px;
  }
  .ty-word-bare {
    font-size: 1.05rem;
    color: var(--text-secondary);
    font-style: italic;
  }
  .ty-word-meaning {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .ty-choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .ty-choice-btn {
    background: var(--surface);
    border: 2px solid var(--card-border);
    border-radius: var(--radius-sm);
    padding: 18px 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    color: var(--text-primary);
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .ty-choice-btn:focus-visible {
    box-shadow: 0 0 0 2px var(--accent);
  }
  .ty-choice-btn:hover:not(.disabled) {
    border-color: var(--accent);
    background: rgba(56,189,248,0.06);
    transform: translateY(-2px);
  }
  .ty-choice-btn.correct {
    border-color: var(--correct);
    background: var(--correct-bg);
  }
  .ty-choice-btn.incorrect {
    border-color: var(--incorrect);
    background: var(--incorrect-bg);
  }
  .ty-choice-btn.disabled { cursor: default; opacity: 0.55; }
  .ty-choice-btn.correct.disabled, .ty-choice-btn.incorrect.disabled { opacity: 1; }
  .ty-choice-pattern {
    display: block;
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .ty-section-head {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 16px;
  }
  .ty-detail-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--card-border);
    font-size: 0.85rem;
  }
  .ty-detail-item:last-child { border-bottom: none; }
  .ty-detail-icon { flex-shrink: 0; width: 20px; }
  .ty-detail-qn { flex-shrink: 0; color: var(--text-muted); width: 28px; }
  .ty-detail-chars { font-size: 1rem; flex-shrink: 0; }
  .ty-detail-pinyin { color: var(--text-secondary); flex: 1; }

  .ty-actions {
    display: flex;
    gap: 12px;
  }
  .ty-actions .btn { flex: 1; }
  @media (max-width: 480px) {
    .ty-actions { flex-direction: column; }
    .ty-word-chars { font-size: 2.4rem; }
    .ty-choices { gap: 10px; }
    .ty-choice-pattern { font-size: 1.2rem; }
  }

  .score-ring {
    width: 120px; height: 120px; border-radius: 50%;
    margin: 0 auto 16px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative;
  }
  .score-ring::before {
    content: ''; position: absolute; inset: 0; border-radius: 50%; padding: 4px;
    background: conic-gradient(var(--accent) calc(var(--pct) * 3.6deg), var(--card-border) 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 3px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 3px));
  }
  .score-num { font-size: 1.8rem; font-weight: 700; line-height: 1; }
  .score-label { font-size: 0.72rem; color: var(--text-secondary); }
`
