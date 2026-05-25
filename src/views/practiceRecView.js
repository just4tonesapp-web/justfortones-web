// ═══════════════════════════════════════
// Interface II – Tone Recognition Practice
// Two tabs: Single Syllables, Disyllabic Words
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { SYLLABLE_POOL, applyTone, shuffle, hasCharacter } from '../utils/pinyin.js'
import { playSyllable, playDisyllable, stopAllAudio } from '../utils/audio.js'
import { hasRecording } from '../utils/recordingsManifest.js'
import { DISYLLABLE_BY_PAIR } from '../utils/disyllableManifest.js'

// Single-syllable subset for focused practice
const SYLLABLES = [
  'ba','ma','da','ta','na','la','ga','ka','ha','zha','cha','sha','fa','pa',
  'bo','mo','fo','de','ge','he','ke','le','se',
  'di','ti','ni','li','ji','qi','xi',
  'du','tu','nu','lu','gu','ku','hu','zhu','chu','shu','fu','bu','pu','mu',
]

const SET_SIZE = 12
const PER_TONE = 3

// All 15 disyllabic tone-pair combos — 3+3 omitted (tone-3 sandhi makes the
// natural pronunciation 2+3, which mismatches the written tones).
const ALL_PAIRS = []
for (let a = 1; a <= 4; a++) {
  for (let b = 1; b <= 4; b++) {
    if (a === 3 && b === 3) continue
    ALL_PAIRS.push([a, b])
  }
}

export function practiceRecView(container) {
  // ── Mode ──
  // Set mode: invoked from a failed test — fixed 12-item set with end screen.
  // Infinite mode: home-page entry — endless drilling.
  const setMode = sessionStorage.getItem('j4t_practice_set') === '1'
  const returnRoute = sessionStorage.getItem('j4t_practice_return') || '/'

  // Tab: 'single' (after Test A) or 'pairs' (after Test B). In infinite mode
  // we let the user toggle; in set mode we lock to the matching tab.
  let tab = 'single'
  if (setMode) {
    tab = returnRoute === '/test-b' ? 'pairs' : 'single'
  }

  // ── State ──
  let streak = 0
  let bestStreak = 0
  let total = 0
  let answered = false
  let autoAdvanceTimer = null

  // Single-syllable question state
  let currentSyllable = ''
  let currentTone = 0

  // Disyllabic question state
  let currentPair = null  // { syl1, tone1, syl2, tone2 }

  // Set-mode state (per tab — rebuilt when tab switches)
  let setQueue = []
  let setIndex = 0
  let setCorrect = 0

  // ── Build a balanced 12-item set ──
  function buildSingleSet() {
    const items = []
    for (let t = 1; t <= 4; t++) {
      const candidates = SYLLABLES.filter(s => hasCharacter(s, t) && hasRecording(s, t))
      const picks = shuffle(candidates).slice(0, PER_TONE)
      for (const s of picks) items.push({ kind: 'single', syllable: s, tone: t })
    }
    return shuffle(items)
  }

  function buildPairSet() {
    // Pick 12 of the 16 tone-pair combos at random; for each one, pick a
    // random recorded combo from that pair's pool.
    const pairs = shuffle(ALL_PAIRS).slice(0, SET_SIZE)
    const items = []
    for (const [t1, t2] of pairs) {
      const pool = DISYLLABLE_BY_PAIR[`${t1}${t2}`] || []
      if (!pool.length) continue
      const hit = pool[Math.floor(Math.random() * pool.length)]
      items.push({ kind: 'pairs', syl1: hit.syl1, tone1: t1, syl2: hit.syl2, tone2: t2 })
    }
    // Top up if any pair had no recordings (shouldn't happen but be safe)
    while (items.length < SET_SIZE) {
      const [t1, t2] = ALL_PAIRS[Math.floor(Math.random() * ALL_PAIRS.length)]
      const pool = DISYLLABLE_BY_PAIR[`${t1}${t2}`] || []
      if (!pool.length) break
      const hit = pool[Math.floor(Math.random() * pool.length)]
      items.push({ kind: 'pairs', syl1: hit.syl1, tone1: t1, syl2: hit.syl2, tone2: t2 })
    }
    return items
  }

  // ── Pick next question (infinite mode) ──
  function nextQuestionInfinite() {
    if (tab === 'single') {
      // Pick a syllable+tone combo that has a real recording.
      let attempts = 0
      while (attempts < 30) {
        const syl = SYLLABLES[Math.floor(Math.random() * SYLLABLES.length)]
        const t = Math.floor(Math.random() * 4) + 1
        if (hasRecording(syl, t) && hasCharacter(syl, t)) {
          currentSyllable = syl
          currentTone = t
          return
        }
        attempts++
      }
      // fallback
      currentSyllable = SYLLABLES[0]
      currentTone = 1
    } else {
      const [t1, t2] = ALL_PAIRS[Math.floor(Math.random() * ALL_PAIRS.length)]
      const pool = DISYLLABLE_BY_PAIR[`${t1}${t2}`] || []
      if (pool.length) {
        const hit = pool[Math.floor(Math.random() * pool.length)]
        currentPair = { syl1: hit.syl1, tone1: t1, syl2: hit.syl2, tone2: t2 }
      }
    }
  }

  function nextQuestion() {
    if (setMode) {
      const q = setQueue[setIndex]
      if (q.kind === 'single') {
        currentSyllable = q.syllable
        currentTone = q.tone
        currentPair = null
      } else {
        currentPair = { syl1: q.syl1, tone1: q.tone1, syl2: q.syl2, tone2: q.tone2 }
      }
    } else {
      nextQuestionInfinite()
    }
    answered = false
  }

  // ── Mount ──
  function startSet() {
    setQueue = (tab === 'single') ? buildSingleSet() : buildPairSet()
    setIndex = 0
    setCorrect = 0
  }
  if (setMode) startSet()
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

      <!-- Tabs -->
      <div class="pr-tab-bar">
        <button class="pr-tab-btn ${tab === 'single' ? 'active' : ''}" id="pr-tab-single">Single Syllables</button>
        <button class="pr-tab-btn ${tab === 'pairs' ? 'active' : ''}" id="pr-tab-pairs">Disyllabic Words</button>
      </div>

      ${setMode ? `
      <!-- Set progress -->
      <div class="pr-stats card">
        <div class="pr-set-progress">
          <span class="pr-set-label">Question <span id="pr-set-num">1</span> of ${SET_SIZE}</span>
          <span class="pr-set-score">Correct: <span id="pr-set-correct">0</span></span>
        </div>
        <div class="pr-set-bar-track">
          <div class="pr-set-bar-fill" id="pr-set-bar" style="width:0%"></div>
        </div>
      </div>
      ` : `
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
      `}

      <!-- Main card -->
      <div class="card animate-in" id="pr-card">
        <div class="question-label" id="pr-qlabel">Listen and identify the tone</div>
        <div class="audio-area">
          <button class="play-btn" id="pr-play"><div class="play-icon"></div></button>
          <div class="play-hint" id="pr-hint">Tap to listen</div>
        </div>
        <div class="choices ${tab === 'pairs' ? 'pr-choices-col' : ''}" id="pr-choices"></div>
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
  $('pr-back').addEventListener('click', () => {
    stopAllAudio()
    clearSetMode()
    navigate(setMode ? returnRoute : '/')
  })
  $('pr-play').addEventListener('click', playCurrent)

  $('pr-tab-single').addEventListener('click', () => switchTab('single'))
  $('pr-tab-pairs').addEventListener('click', () => switchTab('pairs'))

  function switchTab(next) {
    if (next === tab) return
    tab = next
    document.getElementById('pr-tab-single').classList.toggle('active', tab === 'single')
    document.getElementById('pr-tab-pairs').classList.toggle('active', tab === 'pairs')
    // Update layout for choices
    $('pr-choices').classList.toggle('pr-choices-col', tab === 'pairs')
    if (setMode) startSet()
    // Reset streaks for clean infinite-mode UX too
    if (!setMode) { streak = 0; total = 0 }
    setCorrect = 0
    nextQuestion()
    renderChoices()
    updateStats()
    $('pr-hint').textContent = 'Tap to listen'
    $('pr-play').classList.remove('playing')
    $('pr-reveal').classList.add('hidden')
    $('pr-reveal').innerHTML = ''
  }

  function clearSetMode() {
    sessionStorage.removeItem('j4t_practice_set')
    sessionStorage.removeItem('j4t_practice_return')
  }

  // ── Render choices ──
  function renderChoices() {
    const el = $('pr-choices')
    el.innerHTML = ''
    const letters = ['A', 'B', 'C', 'D']

    if (tab === 'single') {
      $('pr-qlabel').textContent = 'Listen and identify the tone'
      const order = shuffle([1, 2, 3, 4])
      const toneNames = ['', '1st tone — high ─', '2nd tone — rising ／', '3rd tone — dip ∨', '4th tone — falling ＼']
      order.forEach((t, idx) => {
        const btn = document.createElement('button')
        btn.className = 'choice-btn'
        btn.dataset.tone = t
        btn.innerHTML = `
          <span class="choice-letter">${letters[idx]}</span>
          <span class="choice-pinyin">${applyTone(currentSyllable, t)}</span>
          <span class="choice-tone">${toneNames[t]}</span>
        `
        btn.addEventListener('click', () => pickSingle(t, btn))
        el.appendChild(btn)
      })
    } else {
      $('pr-qlabel').textContent = 'Listen and identify both tones'
      // Build 4 choices: correct pair + 3 distractor tone-pair combos
      const correct = { t1: currentPair.tone1, t2: currentPair.tone2 }
      const distractors = []
      const usedKeys = new Set([`${correct.t1}${correct.t2}`, '33'])
      while (distractors.length < 3) {
        const a = Math.floor(Math.random() * 4) + 1
        const b = Math.floor(Math.random() * 4) + 1
        const key = `${a}${b}`
        if (usedKeys.has(key)) continue
        usedKeys.add(key)
        distractors.push({ t1: a, t2: b })
      }
      const choices = shuffle([correct, ...distractors])
      choices.forEach((c, idx) => {
        const btn = document.createElement('button')
        btn.className = 'choice-btn'
        btn.dataset.t1 = c.t1
        btn.dataset.t2 = c.t2
        const pinyin = applyTone(currentPair.syl1, c.t1) + applyTone(currentPair.syl2, c.t2)
        btn.innerHTML = `
          <span class="choice-letter">${letters[idx]}</span>
          <span class="choice-pinyin">${pinyin}</span>
        `
        btn.addEventListener('click', () => pickPair(c, btn))
        el.appendChild(btn)
      })
    }
  }

  function updateStats() {
    if (setMode) {
      $('pr-set-num').textContent = setIndex + 1
      $('pr-set-correct').textContent = setCorrect
      $('pr-set-bar').style.width = `${(setIndex / SET_SIZE) * 100}%`
    } else {
      $('pr-streak').textContent = streak
      $('pr-best').textContent = bestStreak
      $('pr-total').textContent = total
    }
  }

  // ── Load a question (or end the set) ──
  function loadQuestion() {
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null }
    stopAllAudio()
    if (setMode && setIndex >= SET_SIZE) {
      showSetEnd()
      return
    }
    nextQuestion()
    renderChoices()
    updateStats()
    $('pr-hint').textContent = 'Tap to listen'
    $('pr-play').classList.remove('playing')
    $('pr-reveal').classList.add('hidden')
    $('pr-reveal').innerHTML = ''

    const card = $('pr-card')
    card.style.animation = 'none'
    card.offsetHeight
    card.style.animation = 'cardIn 0.4s ease-out'
  }

  function showSetEnd() {
    const card = $('pr-card')
    card.innerHTML = `
      <div class="pr-end">
        <div class="pr-end-icon">${setCorrect >= 9 ? '🎉' : setCorrect >= 6 ? '👍' : '💪'}</div>
        <h2 class="pr-end-title">Set complete!</h2>
        <div class="pr-end-score">${setCorrect}/${SET_SIZE}</div>
        <p class="pr-end-msg">${setCorrect >= 9
          ? 'Great work! Your ear is sharpening.'
          : setCorrect >= 6
            ? 'Solid effort — a bit more practice and you\'ll be ready.'
            : 'Keep going — every set helps your ear lock in the tones.'}</p>
        <div class="pr-end-actions">
          <button class="btn btn-secondary" id="pr-end-more">More Practice</button>
          <button class="btn btn-primary" id="pr-end-test">I'm ready for the test again</button>
        </div>
      </div>
    `
    $('pr-set-bar').style.width = '100%'
    $('pr-set-num').textContent = SET_SIZE
    $('pr-reveal').classList.add('hidden')
    document.getElementById('pr-end-more').addEventListener('click', () => {
      startSet()
      // Restore the original card markup
      card.innerHTML = `
        <div class="question-label" id="pr-qlabel">${tab === 'pairs' ? 'Listen and identify both tones' : 'Listen and identify the tone'}</div>
        <div class="audio-area">
          <button class="play-btn" id="pr-play"><div class="play-icon"></div></button>
          <div class="play-hint" id="pr-hint">Tap to listen</div>
        </div>
        <div class="choices ${tab === 'pairs' ? 'pr-choices-col' : ''}" id="pr-choices"></div>
      `
      $('pr-play').addEventListener('click', playCurrent)
      loadQuestion()
    })
    document.getElementById('pr-end-test').addEventListener('click', () => {
      stopAllAudio()
      clearSetMode()
      navigate(returnRoute)
    })
  }

  // ── Play current sound ──
  function playCurrent() {
    const btn = $('pr-play')
    btn.classList.add('playing')
    $('pr-hint').textContent = 'Listening...'
    const onDone = () => {
      btn.classList.remove('playing')
      $('pr-hint').textContent = 'Tap to replay'
    }
    if (tab === 'single') {
      playSyllable(currentSyllable, currentTone, onDone)
    } else if (currentPair) {
      playDisyllable(currentPair.syl1, currentPair.tone1, currentPair.syl2, currentPair.tone2, onDone)
    } else {
      onDone()
    }
  }

  // ── Handle answer (single syllable) ──
  function pickSingle(selected, btnEl) {
    if (answered) return
    answered = true
    total++

    const ok = selected === currentTone

    if (ok) {
      streak++
      if (streak > bestStreak) bestStreak = streak
      if (setMode) setCorrect++
    } else {
      streak = 0
    }
    if (setMode) setIndex++

    updateStats()

    document.querySelectorAll('#pr-choices .choice-btn').forEach(b => {
      const t = parseInt(b.dataset.tone)
      if (t === currentTone) b.classList.add('correct')
      else if (t === selected && !ok) b.classList.add('incorrect')
      b.classList.add('disabled')
    })

    showToast(ok)

    if (ok) {
      autoAdvanceTimer = setTimeout(loadQuestion, 1000)
    } else {
      const correctPinyin = applyTone(currentSyllable, currentTone)
      const toneNames = ['', '1st tone (high ─)', '2nd tone (rising ／)', '3rd tone (dip ∨)', '4th tone (falling ＼)']
      const revealEl = $('pr-reveal')
      revealEl.classList.remove('hidden')
      revealEl.innerHTML = `
        <div class="pr-reveal-inner">
          <span class="pr-reveal-label">Correct answer:</span>
          <span class="pr-reveal-pinyin">${correctPinyin}</span>
          <span class="pr-reveal-tone">${toneNames[currentTone]}</span>
        </div>
      `

      const syllable = currentSyllable
      const tone = currentTone
      autoAdvanceTimer = setTimeout(() => {
        playSyllable(syllable, tone, () => {
          autoAdvanceTimer = setTimeout(loadQuestion, 1200)
        })
      }, 2000)
    }
  }

  // ── Handle answer (disyllabic) ──
  function pickPair(selected, btnEl) {
    if (answered) return
    answered = true
    total++

    const ok = selected.t1 === currentPair.tone1 && selected.t2 === currentPair.tone2

    if (ok) {
      streak++
      if (streak > bestStreak) bestStreak = streak
      if (setMode) setCorrect++
    } else {
      streak = 0
    }
    if (setMode) setIndex++

    updateStats()

    document.querySelectorAll('#pr-choices .choice-btn').forEach(b => {
      const bt1 = parseInt(b.dataset.t1)
      const bt2 = parseInt(b.dataset.t2)
      const isCorrect = bt1 === currentPair.tone1 && bt2 === currentPair.tone2
      const isSelected = bt1 === selected.t1 && bt2 === selected.t2
      if (isCorrect) b.classList.add('correct')
      else if (isSelected && !ok) b.classList.add('incorrect')
      b.classList.add('disabled')
    })

    showToast(ok)

    if (ok) {
      autoAdvanceTimer = setTimeout(loadQuestion, 1000)
    } else {
      const correctPinyin = applyTone(currentPair.syl1, currentPair.tone1) + applyTone(currentPair.syl2, currentPair.tone2)
      const revealEl = $('pr-reveal')
      revealEl.classList.remove('hidden')
      revealEl.innerHTML = `
        <div class="pr-reveal-inner">
          <span class="pr-reveal-label">Correct answer:</span>
          <span class="pr-reveal-pinyin">${correctPinyin}</span>
          <span class="pr-reveal-tone">tones ${currentPair.tone1}-${currentPair.tone2}</span>
        </div>
      `

      const pair = currentPair
      autoAdvanceTimer = setTimeout(() => {
        playDisyllable(pair.syl1, pair.tone1, pair.syl2, pair.tone2, () => {
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
    stopAllAudio()
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

  /* Tabs */
  .pr-tab-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
  .pr-tab-btn {
    flex: 1;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--card-border);
    background: var(--surface);
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .pr-tab-btn.active {
    border-color: var(--accent);
    background: rgba(56,189,248,0.1);
    color: var(--accent);
  }

  /* Set-mode progress */
  .pr-set-progress {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .pr-set-score { font-weight: 600; color: var(--text-primary); }
  .pr-set-bar-track {
    height: 6px;
    background: var(--surface);
    border-radius: 3px;
    overflow: hidden;
  }
  .pr-set-bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.4s ease;
  }

  /* End-of-set screen */
  .pr-end { text-align: center; padding: 8px 4px; }
  .pr-end-icon { font-size: 3rem; margin-bottom: 12px; }
  .pr-end-title {
    font-size: 1.4rem;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .pr-end-score {
    font-size: 2.2rem;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 12px;
  }
  .pr-end-msg {
    color: var(--text-secondary);
    font-size: 0.92rem;
    line-height: 1.5;
    margin-bottom: 24px;
  }
  .pr-end-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .pr-end-actions .btn { flex: 1; min-width: 140px; }

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

  /* Question card */
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

  /* Choices — single mode: 2x2 grid; pairs mode: single column */
  .choices {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  }
  .choices.pr-choices-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
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
  .pr-choices-col .choice-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    text-align: left;
  }
  .choice-btn:focus-visible {
    box-shadow: 0 0 0 2px var(--accent);
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
  .pr-choices-col .choice-letter {
    display: inline-block;
    margin-bottom: 0;
    flex-shrink: 0;
    width: 24px;
  }
  .choice-pinyin { font-size: 1.35rem; font-weight: 600; }
  .pr-choices-col .choice-pinyin { font-size: 1.2rem; }
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

  /* Feedback toast */
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
