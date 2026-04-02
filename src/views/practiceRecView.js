// ═══════════════════════════════════════
// Interface II – Tone Recognition Practice
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { SYLLABLE_POOL, applyTone, getTTSChar, shuffle } from '../utils/pinyin.js'
import { speakChinese } from '../utils/audio.js'

// Simpler syllable subset for focused practice
const SYLLABLES = [
  'ba','ma','da','ta','na','la','ga','ka','ha','zha','cha','sha','fa','pa',
  'bo','mo','fo','de','ge','he','ke','le','se',
  'di','ti','ni','li','ji','qi','xi',
  'du','tu','nu','lu','gu','ku','hu','zhu','chu','shu','fu','bu','pu','mu',
]

export function practiceRecView(container) {
  // ── State ──
  let streak = 0
  let bestStreak = 0
  let total = 0
  let currentSyllable = ''
  let currentTone = 0
  let answered = false
  let autoAdvanceTimer = null

  // ── Pick next question ──
  function nextQuestion() {
    currentSyllable = SYLLABLES[Math.floor(Math.random() * SYLLABLES.length)]
    currentTone = Math.floor(Math.random() * 4) + 1
    answered = false
  }

  // ── Mount ──
  nextQuestion()

  container.innerHTML = `
    <div class="app-shell">
      <div class="pr-header">
        <button class="pr-back-btn" id="pr-back" aria-label="Back to home">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 16L7 10L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="pr-header-text">
          <h1>Tone Recognition Practice</h1>
          <p>Listen and identify — no pressure, just practice</p>
        </div>
      </div>

      <!-- Mode toggle -->
      <div class="pr-mode-bar">
        <button class="pr-mode-btn active" id="pr-mode-single">Single Syllable</button>
        <button class="pr-mode-btn" id="pr-mode-pairs" disabled>
          Minimal Pairs
          <span class="pr-coming-soon">Coming soon</span>
        </button>
      </div>

      <!-- Stats bar -->
      <div class="pr-stats card" id="pr-stats">
        <div class="pr-stat">
          <span class="pr-stat-label">Streak</span>
          <span class="pr-stat-value" id="pr-streak">0</span>
        </div>
        <div class="pr-stat-divider"></div>
        <div class="pr-stat">
          <span class="pr-stat-label">Best</span>
          <span class="pr-stat-value" id="pr-best">0</span>
        </div>
        <div class="pr-stat-divider"></div>
        <div class="pr-stat">
          <span class="pr-stat-label">Total</span>
          <span class="pr-stat-value" id="pr-total">0</span>
        </div>
      </div>

      <!-- Main card -->
      <div class="card animate-in" id="pr-card">
        <div class="question-label">Listen and identify the tone</div>
        <div class="audio-area">
          <button class="play-btn" id="pr-play"><div class="play-icon"></div></button>
          <div class="play-hint" id="pr-hint">Tap to listen</div>
        </div>
        <div class="choices" id="pr-choices"></div>
      </div>

      <!-- Correct answer reveal (shown after incorrect) -->
      <div class="pr-reveal hidden" id="pr-reveal"></div>
    </div>
    <div class="feedback-toast" id="pr-toast"></div>
  `

  // Inject scoped styles
  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)

  // ── Bind ──
  const $ = (id) => document.getElementById(id)
  $('pr-back').addEventListener('click', () => navigate('/'))
  $('pr-play').addEventListener('click', playCurrent)
  $('pr-mode-pairs').addEventListener('click', (e) => {
    e.preventDefault()
  })

  // ── Render choices ──
  function renderChoices() {
    const order = shuffle([1, 2, 3, 4])
    const letters = ['A', 'B', 'C', 'D']
    const toneNames = ['', '1st tone — high', '2nd tone — rising', '3rd tone — dip', '4th tone — falling']
    const el = $('pr-choices')
    el.innerHTML = ''

    order.forEach((t, idx) => {
      const btn = document.createElement('button')
      btn.className = 'choice-btn'
      btn.dataset.tone = t
      btn.innerHTML = `
        <span class="choice-letter">${letters[idx]}</span>
        <span class="choice-pinyin">${applyTone(currentSyllable, t)}</span>
        <span class="choice-tone">${toneNames[t]}</span>
      `
      btn.addEventListener('click', () => pick(t, btn))
      el.appendChild(btn)
    })
  }

  function updateStats() {
    $('pr-streak').textContent = streak
    $('pr-best').textContent = bestStreak
    $('pr-total').textContent = total
  }

  // ── Load a question ──
  function loadQuestion() {
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null }
    nextQuestion()
    renderChoices()
    updateStats()
    $('pr-hint').textContent = 'Tap to listen'
    $('pr-play').classList.remove('playing')
    $('pr-reveal').classList.add('hidden')
    $('pr-reveal').innerHTML = ''

    // Re-animate card
    const card = $('pr-card')
    card.style.animation = 'none'
    card.offsetHeight
    card.style.animation = 'cardIn 0.4s ease-out'
  }

  // ── Play current sound ──
  function playCurrent() {
    const btn = $('pr-play')
    btn.classList.add('playing')
    $('pr-hint').textContent = 'Listening...'
    const char = getTTSChar(currentSyllable, currentTone)
    speakChinese(char || applyTone(currentSyllable, currentTone), currentTone, () => {
      btn.classList.remove('playing')
      $('pr-hint').textContent = 'Tap to replay'
    })
  }

  // ── Handle answer ──
  function pick(selected, btnEl) {
    if (answered) return
    answered = true
    total++

    const ok = selected === currentTone

    if (ok) {
      streak++
      if (streak > bestStreak) bestStreak = streak
    } else {
      streak = 0
    }

    updateStats()

    // Highlight buttons
    document.querySelectorAll('#pr-choices .choice-btn').forEach(b => {
      const t = parseInt(b.dataset.tone)
      if (t === currentTone) b.classList.add('correct')
      else if (t === selected && !ok) b.classList.add('incorrect')
      b.classList.add('disabled')
    })

    showToast(ok)

    if (ok) {
      // Correct — auto-advance after 1s
      autoAdvanceTimer = setTimeout(loadQuestion, 1000)
    } else {
      // Incorrect — show correct answer, wait 2s, then play correct sound
      const correctPinyin = applyTone(currentSyllable, currentTone)
      const toneNames = ['', '1st tone (high)', '2nd tone (rising)', '3rd tone (dip)', '4th tone (falling)']
      const revealEl = $('pr-reveal')
      revealEl.classList.remove('hidden')
      revealEl.innerHTML = `
        <div class="pr-reveal-inner">
          <span class="pr-reveal-label">Correct answer:</span>
          <span class="pr-reveal-pinyin">${correctPinyin}</span>
          <span class="pr-reveal-tone">${toneNames[currentTone]}</span>
        </div>
      `

      // After 2s, play the correct sound then advance
      const syllable = currentSyllable
      const tone = currentTone
      autoAdvanceTimer = setTimeout(() => {
        const char = getTTSChar(syllable, tone)
        speakChinese(char || applyTone(syllable, tone), tone, () => {
          autoAdvanceTimer = setTimeout(loadQuestion, 1200)
        })
      }, 2000)
    }
  }

  function showToast(ok) {
    const t = $('pr-toast')
    t.className = 'feedback-toast'
    const msgs = ok
      ? ['Correct!', 'Nice ear!', 'Spot on!', 'Perfect!', 'Great!']
      : ['Not quite', 'Listen again', 'Almost!', 'Keep trying']
    t.textContent = msgs[Math.floor(Math.random() * msgs.length)]
    t.classList.add(ok ? 'correct' : 'incorrect')
    requestAnimationFrame(() => t.classList.add('show'))
    setTimeout(() => t.classList.remove('show'), 1200)
  }

  // ── Initial load ──
  renderChoices()
  updateStats()

  // ── Cleanup ──
  return () => {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer)
  }
}

// ═══════════════════════════════════════
// Scoped CSS for Practice Recognition
// ═══════════════════════════════════════
const scopedCSS = `
  /* Header */
  .pr-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 20px;
  }
  .pr-back-btn {
    flex-shrink: 0;
    width: 40px; height: 40px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--card-border);
    background: var(--surface);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  .pr-back-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(56,189,248,0.08);
  }
  .pr-header-text h1 {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 4px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .pr-header-text p {
    color: var(--text-secondary);
    font-size: 0.85rem;
    margin: 0;
  }

  /* Mode toggle bar */
  .pr-mode-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
  }
  .pr-mode-btn {
    flex: 1;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--card-border);
    background: var(--surface);
    color: var(--text-secondary);
    font-size: 0.82rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }
  .pr-mode-btn.active {
    border-color: var(--accent);
    background: rgba(56,189,248,0.1);
    color: var(--accent);
  }
  .pr-mode-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .pr-coming-soon {
    display: block;
    font-size: 0.65rem;
    font-weight: 400;
    color: var(--text-muted);
    margin-top: 2px;
  }

  /* Stats bar */
  .pr-stats {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 14px 20px;
    margin-bottom: 20px;
  }
  .pr-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .pr-stat-label {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }
  .pr-stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
  }
  .pr-stat-divider {
    width: 1px;
    height: 32px;
    background: var(--card-border);
  }

  /* Question card inner — reuse Test A patterns */
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

  /* Choices — 2x2 grid */
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
  }
  .choice-btn:hover:not(.disabled) {
    border-color: var(--accent);
    background: rgba(56,189,248,0.06);
    transform: translateY(-2px);
  }
  .choice-letter {
    display: block; font-size: 0.72rem; font-weight: 600;
    color: var(--text-muted); margin-bottom: 4px;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .choice-pinyin { font-size: 1.35rem; font-weight: 600; }
  .choice-tone { font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: block; }
  .choice-btn.correct {
    border-color: var(--correct);
    background: var(--correct-bg);
    animation: flashCorrect 0.4s ease-out;
  }
  .choice-btn.correct .choice-pinyin { color: var(--correct); }
  .choice-btn.incorrect {
    border-color: var(--incorrect);
    background: var(--incorrect-bg);
    animation: flashIncorrect 0.4s ease-out;
  }
  .choice-btn.incorrect .choice-pinyin { color: var(--incorrect); }
  .choice-btn.disabled { cursor: default; opacity: 0.55; }
  .choice-btn.correct.disabled, .choice-btn.incorrect.disabled { opacity: 1; }

  /* Correct answer reveal */
  .pr-reveal {
    margin-top: 16px;
    transition: all 0.3s ease;
  }
  .pr-reveal.hidden { display: none; }
  .pr-reveal-inner {
    background: var(--surface);
    border: 1px solid var(--correct);
    border-radius: var(--radius-sm);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    animation: slideUp 0.3s ease-out;
  }
  .pr-reveal-label {
    font-size: 0.82rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .pr-reveal-pinyin {
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--correct);
  }
  .pr-reveal-tone {
    font-size: 0.78rem;
    color: var(--text-secondary);
    margin-left: auto;
  }

  /* Feedback toast — reuse existing pattern */
  .feedback-toast {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    padding: 10px 24px;
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 600;
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s cubic-bezier(0.22,1,0.36,1);
    z-index: 100;
  }
  .feedback-toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  .feedback-toast.correct {
    background: var(--correct-bg);
    color: var(--correct);
    border: 1px solid var(--correct);
  }
  .feedback-toast.incorrect {
    background: var(--incorrect-bg);
    color: var(--incorrect);
    border: 1px solid var(--incorrect);
  }

  /* Animations */
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes flashCorrect {
    0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); }
    50% { box-shadow: 0 0 20px 4px rgba(74,222,128,0.3); }
    100% { box-shadow: none; }
  }
  @keyframes flashIncorrect {
    0% { box-shadow: 0 0 0 0 rgba(248,113,113,0.5); }
    50% { box-shadow: 0 0 20px 4px rgba(248,113,113,0.3); }
    100% { box-shadow: none; }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.4); }
    100% { box-shadow: 0 0 0 20px rgba(74,222,128,0); }
  }

  /* Responsive */
  @media (max-width: 480px) {
    .pr-header-text h1 { font-size: 1.2rem; }
    .choices { gap: 10px; }
    .choice-btn { padding: 14px 8px; }
    .choice-pinyin { font-size: 1.15rem; }
    .play-btn { width: 80px; height: 80px; }
    .pr-stat-value { font-size: 1.25rem; }
    .pr-reveal-inner { flex-wrap: wrap; gap: 8px; }
    .pr-reveal-tone { margin-left: 0; }
  }
`
