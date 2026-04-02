// ═══════════════════════════════════════
// Interface III – Tone Production Practice
// Infinite record-and-feedback practice.
// Users see a character, record voice,
// get immediate AI feedback (not graded).
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { applyTone } from '../utils/pinyin.js'
import { speakChinese } from '../utils/audio.js'
import { AudioEngine } from '../utils/audioEngine.js'
import { toneDetector } from '../utils/toneDetector.js'

const TONE_ARROWS = { 1: '‾', 2: '↗', 3: '↘↗', 4: '↘' }

const TONE_HINTS = {
  1: 'Keep your voice high and flat — like singing one steady note',
  2: 'Start mid and rise up — like asking "really?"',
  3: 'Dip low then rise — like a surprised "huh?"',
  4: 'Start high and fall sharply — like a stern "no!"',
}

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

export function practiceProView(container) {
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

  // Start loading models immediately
  toneDetector.init((model, status, pct) => {
    updateModelStatus()
  })

  function pickNext() {
    if (poolIndex >= pool.length) {
      pool = shuffleArray(CHAR_POOL)
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

      <div class="pp-model-status" style="color:var(--text-muted);font-size:0.75rem;text-align:center;margin-bottom:16px">
        Loading AI models...
      </div>

      <div class="pp-stats-bar">
        <span>Correct: <strong id="pp-correct">0</strong></span>
        <span>Attempts: <strong id="pp-attempts">0</strong></span>
      </div>

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
  pool = shuffleArray(CHAR_POOL)
  pickNext()
  loadChar()

  // ── Event listeners ──
  $('pp-back').addEventListener('click', () => navigate('/'))
  $('pp-listen').addEventListener('click', listenExample)
  $('pp-record').addEventListener('click', () => {
    if (!isRecording && !$('pp-record').disabled) startRecording()
  })
  $('pp-retry').addEventListener('click', () => {
    // Same character, reset recording state
    resetRecordUI()
    $('pp-result').classList.add('hidden')
  })
  $('pp-next').addEventListener('click', () => {
    pickNext()
    loadChar()
  })

  function loadChar() {
    resetRecordUI()
    $('pp-result').classList.add('hidden')

    $('pp-char').textContent = current.char
    $('pp-pinyin').textContent = applyTone(current.base, current.tone)
    $('pp-meaning').textContent = current.meaning
    $('pp-contour').textContent = `Tone ${current.tone}: ${TONE_ARROWS[current.tone]}`
    $('pp-contour').className = `pp-tone-contour pp-tone-${current.tone}`
    $('pp-listen').disabled = false

    // Re-animate card
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
    speakChinese(current.char, current.tone, () => {
      btn.textContent = '🔊 Listen again'
      btn.disabled = false
    })
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

    // Level meter + silence detection
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
        silenceTimer = setTimeout(() => { if (isRecording) stopRecording() }, 400)
        $('pp-rec-status').textContent = 'Done? Stopping...'
      }
    }, 50)

    // Safety max 3 seconds
    recordTimer = setTimeout(() => { if (isRecording) stopRecording() }, 3000)
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

    // Run ensemble detection
    const ensemble = await toneDetector.detect(
      { samples: recording.samples, sampleRate: recording.sampleRate },
      current.base,
      { referenceChar: current.char }
    )

    const detectedTone = ensemble.tone
    const passed = detectedTone === current.tone
    attempts++
    if (passed) correct++

    $('pp-correct').textContent = correct
    $('pp-attempts').textContent = attempts

    // Update record button state
    $('pp-rec-icon').textContent = passed ? '✓' : '✗'
    $('pp-rec-label').textContent = 'Done'
    $('pp-rec-status').textContent = passed ? 'Correct!' : 'Not quite'

    // Build result display
    const toneNames = { 1: '1st (High ‾)', 2: '2nd (Rising ↗)', 3: '3rd (Dip ↘↗)', 4: '4th (Falling ↘)' }

    $('pp-result-icon').textContent = passed ? '✓' : '✗'
    $('pp-result-icon').style.color = passed ? 'var(--correct)' : 'var(--incorrect)'

    if (!detectedTone) {
      $('pp-result-msg').textContent = 'Could not detect a clear tone — try speaking louder'
      $('pp-result-msg').style.color = 'var(--text-secondary)'
    } else if (passed) {
      $('pp-result-msg').textContent = `Detected: ${toneNames[detectedTone]}`
      $('pp-result-msg').style.color = 'var(--correct)'
    } else {
      $('pp-result-msg').textContent = `Detected Tone ${detectedTone}, expected Tone ${current.tone}`
      $('pp-result-msg').style.color = 'var(--incorrect)'
    }

    const confText = ensemble.tone ? `Confidence: ${ensemble.confidence}%` : ''
    const agreeText = ensemble.agreement ? `Agreement: ${ensemble.agreement}%` : ''
    $('pp-result-detail').textContent = [confText, agreeText].filter(Boolean).join('  ·  ')

    // Show hint if wrong
    const hintEl = $('pp-hint')
    if (!passed && detectedTone) {
      const wrongDesc = { 1: 'stayed flat/high', 2: 'went up', 3: 'dipped low', 4: 'fell sharply' }
      hintEl.innerHTML = `
        <strong>Hint:</strong> You said Tone ${detectedTone} (voice ${wrongDesc[detectedTone]}).<br>
        For Tone ${current.tone}: ${TONE_HINTS[current.tone]}
      `
      hintEl.classList.remove('hidden')
    } else if (!detectedTone) {
      hintEl.innerHTML = `<strong>Tip:</strong> Speak clearly and a bit louder. Try holding the tone for about 1 second.`
      hintEl.classList.remove('hidden')
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

  /* Character display */
  .pp-char-display {
    text-align: center;
    padding: 16px 0 20px;
  }
  .pp-big-char {
    font-size: 4rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.1;
    font-family: 'Noto Sans SC', sans-serif;
  }
  .pp-pinyin {
    font-size: 1.5rem;
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
