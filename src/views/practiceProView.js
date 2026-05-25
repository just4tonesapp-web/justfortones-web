// ═══════════════════════════════════════
// Interface III – Tone Production Practice
// Two tabs: Single Syllables (after Test C) / Disyllabic Words (after Test D)
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { applyTone } from '../utils/pinyin.js'
import { playSyllable, playDisyllable, stopAllAudio } from '../utils/audio.js'
import { AudioEngine } from '../utils/audioEngine.js'
import { toneDetector } from '../utils/toneDetector.js'
import { splitDisyllableAudio } from '../utils/audioSplit.js'
import { pickPraise } from '../utils/testCFeedback.js'

const TONE_ARROWS = { 1: '─', 2: '／', 3: '∨', 4: '＼' }

const TONE_HINTS = {
  1: 'Keep your voice high and flat — like singing one steady note',
  2: 'Start mid and rise up — like asking "really?"',
  3: 'Dip low then rise — like a surprised "huh?"',
  4: 'Start high and fall sharply — like a stern "no!"',
}

// Single-character pool (Test C-style)
const CHAR_POOL = [
  { char: '妈', base: 'ma', tone: 1, meaning: 'mother' },
  { char: '书', base: 'shu', tone: 1, meaning: 'book' },
  { char: '天', base: 'tian', tone: 1, meaning: 'sky' },
  { char: '花', base: 'hua', tone: 1, meaning: 'flower' },
  { char: '人', base: 'ren', tone: 2, meaning: 'person' },
  { char: '来', base: 'lai', tone: 2, meaning: 'come' },
  { char: '茶', base: 'cha', tone: 2, meaning: 'tea' },
  { char: '鱼', base: 'yu', tone: 2, meaning: 'fish' },
  { char: '小', base: 'xiao', tone: 3, meaning: 'small' },
  { char: '马', base: 'ma', tone: 3, meaning: 'horse' },
  { char: '好', base: 'hao', tone: 3, meaning: 'good' },
  { char: '水', base: 'shui', tone: 3, meaning: 'water' },
  { char: '大', base: 'da', tone: 4, meaning: 'big' },
  { char: '去', base: 'qu', tone: 4, meaning: 'go' },
  { char: '饭', base: 'fan', tone: 4, meaning: 'rice' },
  { char: '看', base: 'kan', tone: 4, meaning: 'look' },
]

// Disyllabic word pool (Test D-style). All entries here are also present in
// public/audio/disyllables/ so playDisyllable() will use real recordings.
const DISYLLABLE_POOL = [
  { chars: '小学', bases: ['xiao','xue'], tones: [3,2], meaning: 'primary school' },
  { chars: '大家', bases: ['da','jia'],   tones: [4,1], meaning: 'everyone' },
  { chars: '中国', bases: ['zhong','guo'],tones: [1,2], meaning: 'China' },
  { chars: '学生', bases: ['xue','sheng'],tones: [2,1], meaning: 'student' },
  { chars: '老师', bases: ['lao','shi'],  tones: [3,1], meaning: 'teacher' },
  { chars: '再见', bases: ['zai','jian'], tones: [4,4], meaning: 'goodbye' },
  { chars: '明天', bases: ['ming','tian'],tones: [2,1], meaning: 'tomorrow' },
  { chars: '今天', bases: ['jin','tian'], tones: [1,1], meaning: 'today' },
  { chars: '说话', bases: ['shuo','hua'], tones: [1,4], meaning: 'speak' },
  { chars: '走路', bases: ['zou','lu'],   tones: [3,4], meaning: 'walk' },
  { chars: '电话', bases: ['dian','hua'], tones: [4,4], meaning: 'phone' },
  { chars: '飞机', bases: ['fei','ji'],   tones: [1,1], meaning: 'airplane' },
  { chars: '汉语', bases: ['han','yu'],   tones: [4,3], meaning: 'Chinese language' },
  { chars: '高兴', bases: ['gao','xing'], tones: [1,4], meaning: 'glad' },
]

const JUDGE_PERSONAS = {
  azure:      { emoji: '🎯', name: 'Azure' },
  classifier: { emoji: '🤖', name: 'ToneBot' },
  whisper:    { emoji: '🦉', name: 'Whisperer' },
  pitch:      { emoji: '🎵', name: 'Maestro' },
  tonenet:    { emoji: '🔬', name: 'Lab' },
  sensevoice: { emoji: '👂', name: 'Sensei' },
  groq:       { emoji: '☁️', name: 'Cloud' },
  groqTurbo:  { emoji: '⚡', name: 'Turbo' },
  google:     { emoji: '🔍', name: 'Google' },
  deepgram:   { emoji: '🔊', name: 'Deep' },
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const SET_SIZE = 12
const PER_TONE = 3

export function practiceProView(container) {
  // Set mode: invoked from a failed Test C/D — fixed 12-item set with end screen.
  // Infinite mode: home-page entry — endless drilling.
  const setMode = sessionStorage.getItem('j4t_practice_set') === '1'
  const returnRoute = sessionStorage.getItem('j4t_practice_return') || '/'

  // Tab: 'single' (Test C) or 'pairs' (Test D). In set mode we lock to the
  // tab matching where the user came from.
  let tab = 'single'
  if (setMode) {
    tab = returnRoute === '/test-d' ? 'pairs' : 'single'
  }

  function clearSetMode() {
    sessionStorage.removeItem('j4t_practice_set')
    sessionStorage.removeItem('j4t_practice_return')
  }

  const audioEngine = new AudioEngine()
  let current = null
  let pool = []
  let poolIndex = 0
  let isRecording = false
  let recordTimer = null
  let levelInterval = null
  let silenceTimer = null
  let hasSpeaking = false
  let correct = 0
  let attempts = 0

  // Set-mode state
  let setIndex = 0
  let setCorrect = 0
  let setQueue = []

  // Build a balanced 12-item set: 3 per tone (single) or 12 random pairs
  function buildSet() {
    if (tab === 'single') {
      const items = []
      for (let t = 1; t <= 4; t++) {
        const candidates = CHAR_POOL.filter(c => c.tone === t)
        const picks = shuffleArray(candidates).slice(0, PER_TONE)
        while (picks.length < PER_TONE && candidates.length) {
          picks.push(candidates[Math.floor(Math.random() * candidates.length)])
        }
        items.push(...picks)
      }
      return shuffleArray(items)
    }
    return shuffleArray([...DISYLLABLE_POOL]).slice(0, SET_SIZE)
  }

  // Start loading models immediately
  toneDetector.init((model, status, pct) => {
    updateModelStatus()
  })

  function pickNext() {
    if (setMode) {
      current = setQueue[setIndex]
      return
    }
    if (poolIndex >= pool.length) {
      pool = shuffleArray(tab === 'single' ? CHAR_POOL : DISYLLABLE_POOL)
      poolIndex = 0
    }
    current = pool[poolIndex++]
  }

  function updateModelStatus() {
    const judges = [
      { name: 'azure',      ...JUDGE_PERSONAS.azure },
      { name: 'pitch',      ...JUDGE_PERSONAS.pitch,      alwaysOn: true },
      { name: 'groq',       ...JUDGE_PERSONAS.groq },
      { name: 'groqTurbo',  ...JUDGE_PERSONAS.groqTurbo },
      { name: 'google',     ...JUDGE_PERSONAS.google },
      { name: 'deepgram',   ...JUDGE_PERSONAS.deepgram },
      { name: 'whisper',    ...JUDGE_PERSONAS.whisper },
      { name: 'classifier', ...JUDGE_PERSONAS.classifier },
    ]
    const parts = judges.map(j => {
      if (j.alwaysOn || toneDetector.loaded[j.name]) return `${j.emoji} ${j.name}`
      if (toneDetector.failed[j.name])               return `<span style="opacity:0.35">${j.emoji} ${j.name}</span>`
      if (toneDetector._loading[j.name])             return `${j.emoji} ⏳`
      return `<span style="opacity:0.35">${j.emoji} ${j.name}</span>`
    })
    document.querySelectorAll('.pp-model-status').forEach(el => {
      el.innerHTML = parts.join('  ·  ')
    })
  }

  // ── Mount ──
  container.innerHTML = `
    <div class="app-shell">
      <div class="pp-header">
        <button class="btn btn-secondary pp-back-btn" id="pp-back">← Back</button>
        <h1>Tone Production Practice</h1>
        <p>Record and get instant feedback — practice as much as you like</p>
      </div>

      <!-- Tabs -->
      <div class="pp-tab-bar">
        <button class="pp-tab-btn ${tab === 'single' ? 'active' : ''}" id="pp-tab-single">Single Syllables</button>
        <button class="pp-tab-btn ${tab === 'pairs' ? 'active' : ''}" id="pp-tab-pairs">Disyllabic Words</button>
      </div>

      <div class="pp-model-status" style="color:var(--text-muted);font-size:0.75rem;text-align:center;margin-bottom:16px">
        Loading AI models...
      </div>

      ${setMode ? `
      <div class="pp-set-progress">
        <div class="pp-set-row">
          <span>Question <strong id="pp-set-num">1</strong> of ${SET_SIZE}</span>
          <span>Correct: <strong id="pp-correct">0</strong></span>
        </div>
        <div class="pp-set-bar-track"><div class="pp-set-bar-fill" id="pp-set-bar" style="width:0%"></div></div>
      </div>
      <span id="pp-attempts" style="display:none">0</span>
      ` : `
      <div class="pp-stats-bar">
        <span>Correct: <strong id="pp-correct">0</strong></span>
        <span>Attempts: <strong id="pp-attempts">0</strong></span>
      </div>
      `}

      <div class="card animate-in" id="pp-card">
        <!-- Character display -->
        <div class="pp-char-display">
          <div class="pp-big-char" id="pp-char"></div>
          <div class="pp-pinyin" id="pp-pinyin"></div>
          <div class="pp-meaning" id="pp-meaning"></div>
          <div class="pp-tone-contour" id="pp-contour"></div>
        </div>

        <!-- Listen button -->
        <div class="pp-listen-row">
          <button class="pp-listen-btn" id="pp-listen">
            🔊 Listen to example
          </button>
        </div>

        <!-- Record section -->
        <div class="pp-record-section">
          <button class="pp-record-btn" id="pp-record">
            <span class="pp-record-icon" id="pp-rec-icon">🎤</span>
            <span id="pp-rec-label">Tap to Record</span>
          </button>
          <div class="pp-level-bar-wrap">
            <div class="pp-level-bar" id="pp-level-bar"></div>
          </div>
          <div class="pp-rec-status" id="pp-rec-status">Ready</div>
        </div>

        <!-- Result -->
        <div class="pp-result hidden" id="pp-result">
          <div class="pp-result-icon" id="pp-result-icon"></div>
          <div class="pp-result-msg" id="pp-result-msg"></div>
          <div class="pp-result-detail" id="pp-result-detail"></div>
          <div class="pp-hint hidden" id="pp-hint"></div>
          <div class="pp-result-actions">
            <button class="btn btn-secondary" id="pp-retry">Try Again</button>
            <button class="btn btn-primary" id="pp-next">Next →</button>
          </div>
        </div>
      </div>
    </div>
  `

  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)

  const $ = (id) => document.getElementById(id)

  // Initial model status
  updateModelStatus()

  // Pick first character
  if (setMode) {
    setQueue = buildSet()
    setIndex = 0
    setCorrect = 0
  } else {
    pool = shuffleArray(tab === 'single' ? CHAR_POOL : DISYLLABLE_POOL)
  }
  pickNext()
  loadChar()
  updateSetProgress()

  // ── Event listeners ──
  $('pp-back').addEventListener('click', () => {
    stopAllAudio()
    clearSetMode()
    navigate(setMode ? returnRoute : '/')
  })
  $('pp-listen').addEventListener('click', listenExample)
  $('pp-record').addEventListener('click', () => {
    if (!isRecording && !$('pp-record').disabled) startRecording()
  })
  $('pp-retry').addEventListener('click', () => {
    resetRecordUI()
    $('pp-result').classList.add('hidden')
  })
  $('pp-next').addEventListener('click', () => {
    if (setMode) {
      setIndex++
      if (setIndex >= SET_SIZE) {
        showSetEnd()
        return
      }
    }
    pickNext()
    loadChar()
    updateSetProgress()
  })

  $('pp-tab-single').addEventListener('click', () => switchTab('single'))
  $('pp-tab-pairs').addEventListener('click', () => switchTab('pairs'))

  function switchTab(next) {
    if (next === tab) return
    tab = next
    document.getElementById('pp-tab-single').classList.toggle('active', tab === 'single')
    document.getElementById('pp-tab-pairs').classList.toggle('active', tab === 'pairs')
    correct = 0
    attempts = 0
    setCorrect = 0
    setIndex = 0
    if (setMode) {
      setQueue = buildSet()
    } else {
      pool = shuffleArray(tab === 'single' ? CHAR_POOL : DISYLLABLE_POOL)
      poolIndex = 0
    }
    pickNext()
    loadChar()
    updateSetProgress()
    $('pp-correct').textContent = setMode ? setCorrect : correct
    $('pp-attempts').textContent = attempts
  }

  function updateSetProgress() {
    if (!setMode) return
    const numEl = document.getElementById('pp-set-num')
    const barEl = document.getElementById('pp-set-bar')
    if (numEl) numEl.textContent = Math.min(setIndex + 1, SET_SIZE)
    if (barEl) barEl.style.width = `${(setIndex / SET_SIZE) * 100}%`
  }

  function showSetEnd() {
    const card = $('pp-card')
    card.innerHTML = `
      <div class="pp-end">
        <div class="pp-end-icon">${setCorrect >= 9 ? '🎉' : setCorrect >= 6 ? '👍' : '💪'}</div>
        <h2 class="pp-end-title">Set complete!</h2>
        <div class="pp-end-score">${setCorrect}/${SET_SIZE}</div>
        <p class="pp-end-msg">${setCorrect >= 9
          ? 'Great work! Your tones are getting consistent.'
          : setCorrect >= 6
            ? 'Solid effort — a bit more practice and you\'ll be ready.'
            : 'Keep going — every set helps your tones lock in.'}</p>
        <div class="pp-end-actions">
          <button class="btn btn-secondary" id="pp-end-more">More Practice</button>
          <button class="btn btn-primary" id="pp-end-test">I'm ready for the test again</button>
        </div>
      </div>
    `
    document.getElementById('pp-end-more').addEventListener('click', () => {
      setQueue = buildSet()
      setIndex = 0
      setCorrect = 0
      const card2 = $('pp-card')
      card2.innerHTML = ORIGINAL_CARD_HTML
      $('pp-listen').addEventListener('click', listenExample)
      $('pp-record').addEventListener('click', () => {
        if (!isRecording && !$('pp-record').disabled) startRecording()
      })
      $('pp-retry').addEventListener('click', () => {
        resetRecordUI()
        $('pp-result').classList.add('hidden')
      })
      $('pp-next').addEventListener('click', () => {
        setIndex++
        if (setIndex >= SET_SIZE) { showSetEnd(); return }
        pickNext()
        loadChar()
        updateSetProgress()
      })
      pickNext()
      loadChar()
      updateSetProgress()
      document.getElementById('pp-correct').textContent = setCorrect
      const bar = document.getElementById('pp-set-bar')
      if (bar) bar.style.width = '0%'
    })
    document.getElementById('pp-end-test').addEventListener('click', () => {
      stopAllAudio()
      clearSetMode()
      navigate(returnRoute)
    })
  }

  // Snapshot of the original card HTML — used to restore after end screen
  const ORIGINAL_CARD_HTML = $('pp-card').innerHTML

  function loadChar() {
    stopAllAudio()
    resetRecordUI()
    $('pp-result').classList.add('hidden')

    if (tab === 'single') {
      $('pp-char').textContent = current.char
      $('pp-pinyin').textContent = applyTone(current.base, current.tone)
      $('pp-meaning').textContent = current.meaning
      $('pp-contour').textContent = `Tone ${current.tone}: ${TONE_ARROWS[current.tone]}`
      $('pp-contour').className = `pp-tone-contour pp-tone-${current.tone}`
    } else {
      $('pp-char').textContent = current.chars
      $('pp-pinyin').textContent = `${applyTone(current.bases[0], current.tones[0])} ${applyTone(current.bases[1], current.tones[1])}`
      $('pp-meaning').textContent = current.meaning
      $('pp-contour').textContent = `Tones ${current.tones[0]}-${current.tones[1]}: ${TONE_ARROWS[current.tones[0]]} ${TONE_ARROWS[current.tones[1]]}`
      $('pp-contour').className = `pp-tone-contour pp-tone-${current.tones[0]}`
    }
    $('pp-listen').disabled = false

    const card = $('pp-card')
    card.style.animation = 'none'
    card.offsetHeight
    card.style.animation = 'cardIn 0.4s ease-out'
  }

  function resetRecordUI() {
    isRecording = false
    $('pp-rec-label').textContent = 'Tap to Record'
    $('pp-rec-icon').textContent = '🎤'
    $('pp-rec-status').textContent = 'Ready'
    $('pp-record').classList.remove('recording')
    $('pp-record').disabled = false
    $('pp-level-bar').style.width = '0%'
  }

  function listenExample() {
    const btn = $('pp-listen')
    btn.textContent = '🔊 Playing...'
    btn.disabled = true
    const onDone = () => {
      btn.textContent = '🔊 Listen again'
      btn.disabled = false
    }
    if (tab === 'single') {
      playSyllable(current.base, current.tone, onDone)
    } else {
      playDisyllable(current.bases[0], current.tones[0], current.bases[1], current.tones[1], onDone)
    }
  }

  async function startRecording() {
    const ok = await audioEngine.start()
    if (!ok) {
      $('pp-rec-status').textContent = 'Microphone access denied'
      return
    }

    isRecording = true
    hasSpeaking = false
    silenceTimer = null

    $('pp-rec-label').textContent = 'Listening...'
    $('pp-rec-icon').textContent = '🎤'
    $('pp-rec-status').textContent = 'Speak now!'
    $('pp-record').classList.add('recording')
    $('pp-listen').disabled = true

    const isPair = tab === 'pairs'

    levelInterval = setInterval(() => {
      const rms = audioEngine.getRMS()
      const pct = Math.min(100, rms * 500)
      $('pp-level-bar').style.width = `${pct}%`

      const speaking = rms > 0.015
      if (speaking) {
        hasSpeaking = true
        if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null }
        $('pp-rec-status').textContent = 'Speaking...'
      } else if (hasSpeaking && !silenceTimer) {
        // Pairs need a longer silence-after grace so the gap between syllables
        // doesn't end the recording early.
        const stopAfter = isPair ? 700 : 400
        silenceTimer = setTimeout(() => { if (isRecording) stopRecording() }, stopAfter)
        $('pp-rec-status').textContent = 'Done? Stopping...'
      }
    }, 50)

    // Safety max: 4s for single, 6s for disyllabic
    recordTimer = setTimeout(() => { if (isRecording) stopRecording() }, isPair ? 6000 : 4000)
  }

  async function stopRecording() {
    clearTimeout(recordTimer)
    clearTimeout(silenceTimer)
    clearInterval(levelInterval)
    silenceTimer = null
    const recording = audioEngine.stop()
    isRecording = false

    $('pp-rec-label').textContent = 'Analyzing...'
    $('pp-rec-icon').textContent = '⏳'
    $('pp-rec-status').textContent = `Using ${toneDetector.activeModels.length} model(s)...`
    $('pp-record').classList.remove('recording')
    $('pp-record').disabled = true
    $('pp-level-bar').style.width = '0%'

    let passed, detectedTone, ensemble1, ensemble2
    let msg = ''
    let extra = ''

    if (tab === 'single') {
      ensemble1 = await toneDetector.detect(
        { samples: recording.samples, sampleRate: recording.sampleRate },
        current.base,
        { referenceChar: current.char }
      )
      detectedTone = ensemble1.tone
      passed = detectedTone === current.tone
      if (!detectedTone) {
        msg = 'Could not detect a clear tone — try speaking louder'
      } else if (passed) {
        msg = pickPraise(ensemble1.confidence)
      } else {
        msg = 'Almost — give it another try.'
      }
      extra = ''
    } else {
      // Disyllabic: split the recording into two halves and detect each.
      const { first, second } = splitDisyllableAudio(recording.samples, recording.sampleRate)
      ;[ensemble1, ensemble2] = await Promise.all([
        toneDetector.detect(
          { samples: first, sampleRate: recording.sampleRate },
          current.bases[0],
          { referenceChar: current.chars[0] }
        ),
        toneDetector.detect(
          { samples: second, sampleRate: recording.sampleRate },
          current.bases[1],
          { referenceChar: current.chars[1] }
        ),
      ])
      const t1 = ensemble1.tone
      const t2 = ensemble2.tone
      const ok1 = t1 === current.tones[0]
      const ok2 = t2 === current.tones[1]
      passed = ok1 && ok2
      detectedTone = t1
      const part1 = `1st syllable: ${ok1 ? 'correct ✓' : 'incorrect ✗'}`
      const part2 = `2nd syllable: ${ok2 ? 'correct ✓' : 'incorrect ✗'}`
      msg = `${part1}  ·  ${part2}`
      extra = ''
    }

    attempts++
    if (passed) {
      correct++
      if (setMode) setCorrect++
    }

    $('pp-correct').textContent = setMode ? setCorrect : correct
    $('pp-attempts').textContent = attempts

    $('pp-rec-icon').textContent = passed ? '✓' : '✗'
    $('pp-rec-label').textContent = 'Done'
    $('pp-rec-status').textContent = passed ? 'Correct!' : 'Not quite'

    $('pp-result-icon').textContent = passed ? '✓' : '✗'
    $('pp-result-icon').style.color = passed ? 'var(--correct)' : 'var(--incorrect)'
    $('pp-result-msg').textContent = msg
    $('pp-result-msg').style.color = passed ? 'var(--correct)' : 'var(--text-secondary)'
    $('pp-result-detail').textContent = extra

    // Show hint when wrong — describe how to pronounce it without naming the
    // target tone number.
    const hintEl = $('pp-hint')
    if (!passed) {
      if (tab === 'single' && detectedTone) {
        hintEl.innerHTML = `<strong>Hint:</strong> ${TONE_HINTS[current.tone]}`
        hintEl.classList.remove('hidden')
      } else if (tab === 'pairs') {
        const t1 = ensemble1?.tone, t2 = ensemble2?.tone
        const want1 = current.tones[0], want2 = current.tones[1]
        const lines = []
        if (t1 !== want1) lines.push(`1st syllable: ${TONE_HINTS[want1]}`)
        if (t2 !== want2) lines.push(`2nd syllable: ${TONE_HINTS[want2]}`)
        hintEl.innerHTML = `<strong>Hint:</strong> ${lines.join('<br>')}`
        hintEl.classList.remove('hidden')
      } else if (!detectedTone) {
        hintEl.innerHTML = `<strong>Tip:</strong> Speak clearly and a bit louder. Try holding the tone for about 1 second.`
        hintEl.classList.remove('hidden')
      } else {
        hintEl.classList.add('hidden')
      }
    } else {
      hintEl.classList.add('hidden')
    }

    $('pp-result').classList.remove('hidden')
  }

  // ── Cleanup ──
  return function cleanup() {
    clearTimeout(recordTimer)
    clearTimeout(silenceTimer)
    clearInterval(levelInterval)
    if (isRecording) {
      audioEngine.stop()
    }
    stopAllAudio()
  }
}

// ═══════════════════════════════════════
// Scoped CSS
// ═══════════════════════════════════════
const scopedCSS = `
  .pp-header {
    text-align: center;
    margin-bottom: 20px;
    position: relative;
  }
  .pp-header h1 {
    font-size: 1.65rem; font-weight: 700; margin: 10px 0 6px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .pp-header p { color: var(--text-secondary); font-size: 0.95rem; }
  .pp-back-btn {
    position: absolute; left: 0; top: 0;
    font-size: 0.85rem; padding: 6px 14px;
  }

  /* Tabs */
  .pp-tab-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
  .pp-tab-btn {
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
  .pp-tab-btn.active {
    border-color: var(--accent);
    background: rgba(56,189,248,0.1);
    color: var(--accent);
  }

  /* Stats bar */
  .pp-stats-bar {
    display: flex;
    justify-content: center;
    gap: 24px;
    margin-bottom: 20px;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  .pp-stats-bar strong {
    color: var(--accent);
    font-weight: 700;
  }

  /* Set-mode progress + end screen */
  .pp-set-progress {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    padding: 14px 16px;
    margin-bottom: 16px;
  }
  .pp-set-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 10px;
  }
  .pp-set-row strong { color: var(--text-primary); font-weight: 600; }
  .pp-set-bar-track {
    height: 6px;
    background: var(--surface);
    border-radius: 3px;
    overflow: hidden;
  }
  .pp-set-bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.4s ease;
  }
  .pp-end { text-align: center; padding: 8px 4px; }
  .pp-end-icon { font-size: 3rem; margin-bottom: 12px; }
  .pp-end-title { font-size: 1.4rem; font-weight: 700; margin-bottom: 8px; }
  .pp-end-score {
    font-size: 2.2rem; font-weight: 700;
    color: var(--accent);
    margin-bottom: 12px;
  }
  .pp-end-msg {
    color: var(--text-secondary);
    font-size: 0.92rem;
    line-height: 1.5;
    margin-bottom: 24px;
  }
  .pp-end-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .pp-end-actions .btn { flex: 1; min-width: 140px; }

  /* Character display */
  .pp-char-display {
    text-align: center;
    padding: 16px 0 20px;
  }
  .pp-big-char {
    font-size: 3.4rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.1;
    font-family: 'Noto Sans SC', sans-serif;
    letter-spacing: 0.04em;
  }
  .pp-pinyin {
    font-size: 1.4rem;
    color: var(--accent);
    font-weight: 600;
    margin-top: 8px;
  }
  .pp-meaning {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .pp-tone-contour {
    font-size: 1.1rem;
    font-weight: 600;
    margin-top: 12px;
    letter-spacing: 0.03em;
  }
  .pp-tone-1 { color: var(--tone1); }
  .pp-tone-2 { color: var(--tone2); }
  .pp-tone-3 { color: var(--tone3); }
  .pp-tone-4 { color: var(--tone4); }

  /* Listen button */
  .pp-listen-row {
    display: flex; justify-content: center; margin-bottom: 20px;
  }
  .pp-listen-btn {
    background: var(--surface);
    border: 1px solid var(--card-border);
    color: var(--text-primary);
    padding: 10px 20px;
    border-radius: 24px;
    font-family: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .pp-listen-btn:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accent-glow);
  }
  .pp-listen-btn:disabled { opacity: 0.5; cursor: default; }

  /* Record section */
  .pp-record-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }
  .pp-record-btn {
    width: 140px; height: 140px;
    border-radius: 50%;
    border: 3px solid var(--card-border);
    background: var(--surface);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.25s ease;
    font-family: inherit;
    color: var(--text-primary);
  }
  .pp-record-btn:hover:not(:disabled) {
    border-color: var(--tone1);
    transform: scale(1.04);
  }
  .pp-record-btn:disabled {
    opacity: 0.5; cursor: default; transform: none;
  }
  .pp-record-btn.recording {
    border-color: var(--tone1);
    background: var(--incorrect-bg);
    animation: pulse-ring 1.5s ease-out infinite;
  }
  .pp-record-icon { font-size: 2.2rem; }
  #pp-rec-label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }

  .pp-level-bar-wrap {
    width: 200px; height: 6px;
    background: var(--card-border);
    border-radius: 3px;
    overflow: hidden;
  }
  .pp-level-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--correct), var(--tone2));
    border-radius: 3px;
    transition: width 0.05s;
    width: 0%;
  }
  .pp-rec-status {
    font-size: 0.82rem; color: var(--text-muted); font-weight: 500;
  }

  /* Result section */
  .pp-result {
    text-align: center;
    padding: 16px 0 4px;
    border-top: 1px solid var(--card-border);
    margin-top: 16px;
  }
  .pp-result-icon {
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1;
  }
  .pp-result-msg {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 8px 0 4px;
  }
  .pp-result-detail {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 12px;
  }
  .pp-hint {
    background: var(--surface);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-sm);
    padding: 12px 16px;
    margin: 12px 0;
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.6;
    text-align: left;
  }
  .pp-hint strong {
    color: var(--accent);
  }
  .pp-result-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 16px;
  }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    70%  { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  }
`
