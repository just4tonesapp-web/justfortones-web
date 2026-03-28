// ═══════════════════════════════════════
// Test C – Tone Pronunciation Test (12 items)
// User sees character + pinyin, records voice,
// pitch contour is analyzed against target tone.
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { applyTone, shuffle } from '../utils/pinyin.js'
import { speakChinese } from '../utils/audio.js'
import { AudioEngine } from '../utils/audioEngine.js'
import { toneDetector } from '../utils/toneDetector.js'
import { supabase } from '../supabaseClient.js'
import { getMelSpectrogramImage } from '../utils/models/tonetModel.js'
// WebSpeech disabled: coi-serviceworker's COOP header blocks Web Speech API
// import { isWebSpeechAvailable, startWebSpeech, stopWebSpeech } from '../utils/models/webSpeechModel.js'

const TOTAL = 12
const PASS_SCORE = 10

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

const TONE_ARROWS = { 1: '‾', 2: '↗', 3: '↘↗', 4: '↘' }

// Characters with known tones for Test C (single characters with pinyin)
const CHAR_POOL = [
  { char: '妈', base: 'ma', tone: 1, meaning: 'mother' },
  { char: '书', base: 'shu', tone: 1, meaning: 'book' },
  { char: '他', base: 'ta', tone: 1, meaning: 'he' },
  { char: '天', base: 'tian', tone: 1, meaning: 'sky' },
  { char: '花', base: 'hua', tone: 1, meaning: 'flower' },
  { char: '猫', base: 'mao', tone: 1, meaning: 'cat' },
  { char: '人', base: 'ren', tone: 2, meaning: 'person' },
  { char: '来', base: 'lai', tone: 2, meaning: 'come' },
  { char: '茶', base: 'cha', tone: 2, meaning: 'tea' },
  { char: '学', base: 'xue', tone: 2, meaning: 'study' },
  { char: '鱼', base: 'yu', tone: 2, meaning: 'fish' },
  { char: '红', base: 'hong', tone: 2, meaning: 'red' },
  { char: '小', base: 'xiao', tone: 3, meaning: 'small' },
  { char: '马', base: 'ma', tone: 3, meaning: 'horse' },
  { char: '好', base: 'hao', tone: 3, meaning: 'good' },
  { char: '水', base: 'shui', tone: 3, meaning: 'water' },
  { char: '你', base: 'ni', tone: 3, meaning: 'you' },
  { char: '狗', base: 'gou', tone: 3, meaning: 'dog' },
  { char: '大', base: 'da', tone: 4, meaning: 'big' },
  { char: '去', base: 'qu', tone: 4, meaning: 'go' },
  { char: '四', base: 'si', tone: 4, meaning: 'four' },
  { char: '饭', base: 'fan', tone: 4, meaning: 'rice' },
  { char: '看', base: 'kan', tone: 4, meaning: 'look' },
  { char: '月', base: 'yue', tone: 4, meaning: 'moon' },
]

export function testCView(container) {
  const engine = new AudioEngine()
  let questions = []
  let currentQ = 0
  let score = 0
  let answers = []
  let testStart = 0
  let isRecording = false
  let recordTimer = null
  let levelInterval = null
  let silenceTimer = null
  let hasSpeaking = false

  // Start loading models in the background immediately
  toneDetector.init((model, status, pct) => {
    updateModelStatus()
  })

  function updateModelStatus() {
    const judges = [
      { name: 'azure',      ...JUDGE_PERSONAS.azure },
      { name: 'pitch',      ...JUDGE_PERSONAS.pitch,      alwaysOn: true },
      { name: 'groq',       ...JUDGE_PERSONAS.groq },
      { name: 'groqTurbo',  ...JUDGE_PERSONAS.groqTurbo },
      { name: 'google',     ...JUDGE_PERSONAS.google },
      { name: 'deepgram',  ...JUDGE_PERSONAS.deepgram },
      { name: 'whisper',    ...JUDGE_PERSONAS.whisper },
      { name: 'classifier', ...JUDGE_PERSONAS.classifier },
    ]
    const parts = judges.map(j => {
      if (j.alwaysOn || toneDetector.loaded[j.name]) return `${j.emoji} ${j.name}`
      if (toneDetector.failed[j.name])               return `<span style="opacity:0.35">${j.emoji} ${j.name}</span>`
      if (toneDetector._loading[j.name])             return `${j.emoji} ⏳`
      return `<span style="opacity:0.35">${j.emoji} ${j.name}</span>`
    })
    document.querySelectorAll('#tc-model-status').forEach(el => {
      el.innerHTML = parts.join('  ·  ')
    })
  }

  // Show initial state immediately
  updateModelStatus()

  function generate() {
    // Pick 3 per tone, total 12
    const byTone = { 1: [], 2: [], 3: [], 4: [] }
    CHAR_POOL.forEach(c => byTone[c.tone].push(c))
    const picked = []
    for (let t = 1; t <= 4; t++) {
      const s = shuffle(byTone[t]).slice(0, 3)
      picked.push(...s)
    }
    questions = shuffle(picked)
  }

  // ── Mount ──
  container.innerHTML = `
    <div class="app-shell">
      <div class="tc-header">
        <span class="badge">Diagnostic Step 2</span>
        <h1>Test C — Pronunciation</h1>
        <p>Can you pronounce the four tones?</p>
      </div>

      <!-- Intro -->
      <div id="tc-intro" class="card animate-in text-center">
        <div style="font-size:3rem;margin-bottom:16px">🎤</div>
        <h2>Speak the tones!</h2>
        <p style="color:var(--text-secondary);margin:12px 0;line-height:1.6">
          You'll see 12 characters with their pinyin.<br>
          Listen to the example, then record yourself saying it.<br>
          We'll analyze your pitch contour to see if your tone matches.
        </p>
        <div class="intro-rules">
          <strong>How it works:</strong><br>
          — Tap 🔊 to hear the correct pronunciation<br>
          — Tap 🎤 to record yourself (3 seconds max)<br>
          — Your pitch contour is compared to the target tone<br>
          — Score ${PASS_SCORE}+ out of 12 to pass ✓
        </div>
        <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:8px">
          ⚠️ Allow microphone access when prompted
        </p>
        <p id="tc-model-status" style="color:var(--text-muted);font-size:0.75rem;margin-bottom:16px">
          Loading AI models…
        </p>
        <button class="btn btn-primary btn-lg" id="tc-start">Start Test C</button>
      </div>

      <!-- Quiz -->
      <div id="tc-quiz" class="hidden">
        <p id="tc-model-status" style="color:var(--text-muted);font-size:0.72rem;text-align:center;margin-bottom:8px"></p>
        <div class="progress-wrap">
          <div class="progress-info">
            <span id="tc-prog-label">Question 1 of ${TOTAL}</span>
            <span class="progress-score" id="tc-prog-score">Score: 0</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="tc-prog-fill" style="width:0%"></div>
          </div>
        </div>

        <div class="card animate-in" id="tc-card">
          <!-- Character display -->
          <div class="tc-char-display">
            <div class="tc-big-char" id="tc-char">小</div>
            <div class="tc-pinyin" id="tc-pinyin">xiǎo</div>
            <div class="tc-meaning" id="tc-meaning">small</div>
          </div>

          <!-- Listen button -->
          <div class="tc-listen-row">
            <button class="tc-listen-btn" id="tc-listen">
              🔊 Listen to example
            </button>
          </div>

          <!-- Record section -->
          <div class="tc-record-section">
            <button class="tc-record-btn" id="tc-record">
              <span class="tc-record-icon" id="tc-rec-icon">🎤</span>
              <span id="tc-rec-label">Tap to Record</span>
            </button>
            <div class="tc-level-bar-wrap">
              <div class="tc-level-bar" id="tc-level-bar"></div>
            </div>
            <div class="tc-rec-status" id="tc-rec-status">Ready</div>
          </div>

          <!-- Pitch contour canvas -->
          <div class="tc-contour-wrap hidden" id="tc-contour-wrap">
            <canvas id="tc-canvas" width="360" height="140"></canvas>
            <div class="tc-legend">
              <span class="tc-legend-item"><span class="tc-leg-dot" style="background:var(--accent)"></span> Target</span>
              <span class="tc-legend-item"><span class="tc-leg-dot" style="background:var(--tone1)"></span> Your voice</span>
            </div>
          </div>

          <!-- Mel-spectrogram debug view (compare with Python/librosa output) -->
          <div class="hidden" id="tc-mel-wrap" style="text-align:center;margin:8px 0">
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">
              Mel-spectrogram fed to ToneNet (compare with Python/librosa to verify pipeline)
            </div>
            <canvas id="tc-mel-canvas" width="225" height="225"
              style="border:1px solid var(--card-border);border-radius:4px;max-width:100%;image-rendering:pixelated"></canvas>
          </div>

          <!-- Result for this question -->
          <div class="tc-q-result hidden" id="tc-q-result">
            <div class="tc-q-score" id="tc-q-score">85%</div>
            <div class="tc-q-msg" id="tc-q-msg">Great match!</div>
            <div id="tc-judges-wrap" class="hidden"></div>
            <div id="tc-confirm-wrap" class="tc-confirm-wrap hidden">
              <span style="font-size:0.8rem;color:var(--text-secondary)">Did you say the right tone?</span>
              <button class="btn btn-sm tc-confirm-btn" id="tc-confirm-yes" style="background:var(--correct);color:#fff">Yes</button>
              <button class="btn btn-sm tc-confirm-btn" id="tc-confirm-no" style="background:var(--incorrect);color:#fff">No</button>
            </div>
            <button class="btn btn-primary" id="tc-next">Next →</button>
          </div>
        </div>
      </div>

      <!-- Report -->
      <div id="tc-report" class="hidden"></div>
    </div>
    <div class="feedback-toast" id="tc-toast"></div>
  `

  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)

  const $ = (id) => document.getElementById(id)
  $('tc-start').addEventListener('click', startTest)
  $('tc-listen').addEventListener('click', listenExample)
  $('tc-next').addEventListener('click', nextQuestion)

  // Accuracy logger — user confirms if ensemble was right or wrong
  let pendingLogEntry = null

  // Stable session ID for grouping questions in one test run
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

  async function logAccuracy(userSaysCorrect) {
    if (!pendingLogEntry) return
    pendingLogEntry.userCorrect = userSaysCorrect

    // Console one-liner
    const m = pendingLogEntry.models
    const modelStr = ['azure', 'pitch', 'groq', 'groqTurbo', 'google', 'deepgram', 'whisper', 'classifier']
      .map(name => `${name}→${m[name] !== null ? 'T' + m[name] : '—'}`)
      .join(' ')
    const mark = userSaysCorrect ? '✓' : '✗'
    console.log(`[accuracy] Q${pendingLogEntry.questionNum}: target=T${pendingLogEntry.targetTone} ensemble=T${pendingLogEntry.ensembleTone || '—'} ${mark} | ${modelStr}`)

    // Persist to localStorage (backup)
    const log = JSON.parse(localStorage.getItem('j4t_accuracy_log') || '[]')
    log.push(pendingLogEntry)
    localStorage.setItem('j4t_accuracy_log', JSON.stringify(log))

    // Persist to Supabase
    const { data: { session } } = await supabase.auth.getSession()
    const row = {
      user_id: session?.user?.id || null,
      session_id: sessionId,
      question_num: pendingLogEntry.questionNum,
      char: pendingLogEntry.char,
      base: pendingLogEntry.base,
      target_tone: pendingLogEntry.targetTone,
      ensemble_tone: pendingLogEntry.ensembleTone,
      confidence: pendingLogEntry.confidence,
      agreement: pendingLogEntry.agreement,
      azure_vote: m.azure,
      pitch_vote: m.pitch,
      groq_vote: m.groq,
      groq_turbo_vote: m.groqTurbo,
      google_vote: m.google,
      deepgram_vote: m.deepgram,
      whisper_vote: m.whisper,
      classifier_vote: m.classifier,
      auto_correct: pendingLogEntry.autoCorrect,
      user_correct: userSaysCorrect,
    }
    const { error } = await supabase.from('accuracy_log').insert(row)
    if (error) console.warn('[accuracy] Supabase insert failed:', error.message)

    // Hide confirm buttons
    $('tc-confirm-wrap').classList.add('hidden')
    pendingLogEntry = null
  }

  $('tc-confirm-yes').addEventListener('click', () => logAccuracy(true))
  $('tc-confirm-no').addEventListener('click', () => logAccuracy(false))

  $('tc-record').addEventListener('click', () => {
    if (!isRecording && !$('tc-record').disabled) startRecording()
  })

  function startTest() {
    generate()
    currentQ = 0; score = 0; answers = []; testStart = Date.now()
    $('tc-intro').classList.add('hidden')
    $('tc-quiz').classList.remove('hidden')
    $('tc-report').classList.add('hidden')
    loadQ()
  }

  function loadQ() {
    isRecording = false
    const q = questions[currentQ]

    $('tc-prog-label').textContent = `Question ${currentQ + 1} of ${TOTAL}`
    $('tc-prog-score').textContent = `Score: ${score}`
    $('tc-prog-fill').style.width = `${(currentQ / TOTAL) * 100}%`

    $('tc-char').textContent = q.char
    $('tc-pinyin').textContent = applyTone(q.base, q.tone)
    $('tc-meaning').textContent = q.meaning

    // Reset UI
    $('tc-rec-label').textContent = 'Tap to Record'
    $('tc-rec-icon').textContent = '🎤'
    $('tc-rec-status').textContent = 'Ready'
    $('tc-record').classList.remove('recording')
    $('tc-record').disabled = false
    $('tc-level-bar').style.width = '0%'
    $('tc-contour-wrap').classList.add('hidden')
    $('tc-mel-wrap').classList.add('hidden')
    $('tc-q-result').classList.add('hidden')
    $('tc-judges-wrap').classList.add('hidden')
    $('tc-confirm-wrap').classList.add('hidden')
    pendingLogEntry = null
    $('tc-listen').disabled = false

    // Re-animate
    const card = $('tc-card')
    card.style.animation = 'none'
    card.offsetHeight
    card.style.animation = 'cardIn 0.4s ease-out'
  }

  function listenExample() {
    const q = questions[currentQ]
    const btn = $('tc-listen')
    btn.textContent = '🔊 Playing…'
    btn.disabled = true
    speakChinese(q.char, q.tone, () => {
      btn.textContent = '🔊 Listen again'
      btn.disabled = false
    })
  }

  async function startRecording() {
    const ok = await engine.start()
    if (!ok) {
      $('tc-rec-status').textContent = 'Microphone access denied'
      return
    }

    isRecording = true
    hasSpeaking = false
    silenceTimer = null

    $('tc-rec-label').textContent = 'Listening…'
    $('tc-rec-icon').textContent = '🎤'
    $('tc-rec-status').textContent = 'Speak now!'
    $('tc-record').classList.add('recording')
    $('tc-listen').disabled = true

    // Level meter + silence detection
    levelInterval = setInterval(() => {
      const rms = engine.getRMS()
      const pct = Math.min(100, rms * 500)
      $('tc-level-bar').style.width = `${pct}%`

      const speaking = rms > 0.015
      if (speaking) {
        hasSpeaking = true
        if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null }
        $('tc-rec-status').textContent = 'Speaking…'
      } else if (hasSpeaking && !silenceTimer) {
        // Speech detected, now silence — stop after 400ms
        silenceTimer = setTimeout(() => { if (isRecording) stopRecording() }, 400)
        $('tc-rec-status').textContent = 'Done? Stopping…'
      }
    }, 50)

    // Safety max 6 seconds
    recordTimer = setTimeout(() => { if (isRecording) stopRecording() }, 6000)
  }

  async function stopRecording() {
    clearTimeout(recordTimer)
    clearTimeout(silenceTimer)
    clearInterval(levelInterval)
    silenceTimer = null
    const recording = engine.stop()
    isRecording = false

    $('tc-rec-label').textContent = 'Analyzing…'
    $('tc-rec-icon').textContent = '⏳'
    $('tc-rec-status').textContent = `Using ${toneDetector.activeModels.length} model(s)…`
    $('tc-record').classList.remove('recording')
    $('tc-record').disabled = true
    $('tc-level-bar').style.width = '0%'

    const q = questions[currentQ]

    // ── Run ensemble detection ──
    const ensemble = await toneDetector.detect(
      { samples: recording.samples, sampleRate: recording.sampleRate },
      q.base,
      { referenceChar: q.char }
    )

    // Target contour for canvas
    const TARGET_CONTOURS = {
      1: [5, 5, 5, 5, 5],
      2: [3, 3.5, 4, 4.5, 5],
      3: [2, 1.5, 1, 1.5, 4],
      4: [5, 4, 3, 2, 1],
    }

    drawContour(ensemble.userContour, TARGET_CONTOURS[q.tone])
    $('tc-contour-wrap').classList.remove('hidden')

    // Debug: render mel-spectrogram so we can visually verify the JS pipeline
    drawMelSpectrogram(getMelSpectrogramImage(recording.samples, recording.sampleRate))
    $('tc-mel-wrap').classList.remove('hidden')

    // Pass if detected tone matches target
    const detectedTone = ensemble.tone
    const passed = detectedTone === q.tone
    if (passed) score++

    answers.push({
      char: q.char,
      base: q.base,
      tone: q.tone,
      meaning: q.meaning,
      detectedTone,
      confidence: ensemble.confidence,
      agreement: ensemble.agreement,
      modelResults: ensemble.results,
      passed,
    })

    // Score display — show confidence instead of arbitrary %
    const confText = ensemble.tone ? `${ensemble.confidence}% confident` : '—'
    $('tc-q-score').textContent = passed ? '✓' : '✗'
    $('tc-q-score').style.color = passed ? 'var(--correct)' : 'var(--incorrect)'

    const toneNames = { 1: '1st (High ‾)', 2: '2nd (Rising ↗)', 3: '3rd (Dip ↘↗)', 4: '4th (Falling ↘)' }
    let msg = ''
    if (!detectedTone) {
      msg = 'Could not detect a clear tone — try speaking louder'
    } else if (passed) {
      msg = `Detected: ${toneNames[detectedTone]} · ${confText}`
    } else {
      msg = `Detected ${toneNames[detectedTone]}, expected ${toneNames[q.tone]} · ${confText}`
    }

    // Show per-model breakdown
    const modelBreakdown = ensemble.results.map(r => {
      const icon = r.tone === q.tone ? '✓' : '✗'
      return `${r.model}:T${r.tone}${icon}`
    }).join('  ')

    $('tc-q-msg').textContent = msg
    $('tc-q-msg').title = modelBreakdown // tooltip with model details

    // Show model breakdown below message
    let breakdownEl = document.getElementById('tc-model-breakdown')
    if (!breakdownEl) {
      breakdownEl = document.createElement('div')
      breakdownEl.id = 'tc-model-breakdown'
      breakdownEl.style.cssText = 'font-size:0.72rem;color:var(--text-muted);margin-top:4px;letter-spacing:0.03em'
      $('tc-q-result').insertBefore(breakdownEl, $('tc-next'))
    }
    breakdownEl.textContent = modelBreakdown || 'pitch only'

    renderJudges(ensemble.results, q.tone)
    $('tc-q-result').classList.remove('hidden')
    $('tc-prog-score').textContent = `Score: ${score}`
    showToast(passed)

    // Prepare accuracy log entry and show confirm buttons
    const modelVotes = {}
    for (const name of ['azure', 'pitch', 'groq', 'groqTurbo', 'google', 'deepgram', 'whisper', 'classifier']) {
      const r = ensemble.results.find(r => r.model === name)
      modelVotes[name] = r ? r.tone : null
    }
    pendingLogEntry = {
      questionNum: currentQ + 1,
      char: q.char,
      base: q.base,
      targetTone: q.tone,
      ensembleTone: detectedTone,
      confidence: ensemble.confidence,
      agreement: ensemble.agreement,
      models: modelVotes,
      autoCorrect: passed,
      timestamp: new Date().toISOString(),
    }
    $('tc-confirm-wrap').classList.remove('hidden')

    $('tc-rec-label').textContent = 'Done'
    $('tc-rec-icon').textContent = passed ? '✓' : '✗'
    $('tc-rec-status').textContent = passed ? 'Correct!' : 'Not quite'
  }

  function nextQuestion() {
    currentQ++
    if (currentQ >= TOTAL) showReport()
    else loadQ()
  }

  // ── Draw pitch contour on canvas ──
  function drawContour(userContour, targetContour) {
    const canvas = $('tc-canvas')
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const pad = 20

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)'
    ctx.fillRect(0, 0, W, H)

    // Grid lines (pitch levels 1-5)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)'
    ctx.lineWidth = 1
    for (let lv = 1; lv <= 5; lv++) {
      const y = H - pad - ((lv - 1) / 4) * (H - 2 * pad)
      ctx.beginPath()
      ctx.moveTo(pad, y)
      ctx.lineTo(W - pad, y)
      ctx.stroke()
    }

    // Draw a contour line
    function drawLine(points, color, lineWidth) {
      if (!points || points.length < 2) return
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (let i = 0; i < points.length; i++) {
        const x = pad + (i / (points.length - 1)) * (W - 2 * pad)
        const y = H - pad - ((points[i] - 1) / 4) * (H - 2 * pad)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // Target (dashed)
    ctx.setLineDash([6, 4])
    drawLine(targetContour, 'rgba(56, 189, 248, 0.7)', 3)
    ctx.setLineDash([])

    // User (solid)
    drawLine(userContour, '#f87171', 3)
  }

  // ── Draw mel-spectrogram debug view ──
  function drawMelSpectrogram(floatRgb) {
    const canvas = $('tc-mel-canvas')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = 225, H = 225
    const imageData = ctx.createImageData(W, H)
    for (let i = 0; i < W * H; i++) {
      imageData.data[i * 4]     = Math.round(floatRgb[i * 3]     * 255)
      imageData.data[i * 4 + 1] = Math.round(floatRgb[i * 3 + 1] * 255)
      imageData.data[i * 4 + 2] = Math.round(floatRgb[i * 3 + 2] * 255)
      imageData.data[i * 4 + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)
  }

  function renderJudges(results, targetTone) {
    const wrap = document.getElementById('tc-judges-wrap')
    if (!wrap) return

    const resultMap = {}
    for (const r of results) resultMap[r.model] = r

    // Show pitch + classifier (whisper disabled — GitHub Pages lacks COOP/COEP headers for SharedArrayBuffer)
    const shown = ['azure', 'pitch', 'groq', 'groqTurbo', 'google', 'deepgram', 'whisper', 'classifier']

    const cards = shown.map(modelName => {
      const persona = JUDGE_PERSONAS[modelName]
      if (!persona) return ''
      const r = resultMap[modelName]
      const participated = !!r
      const correct = participated && r.tone === targetTone
      const stateClass = !participated ? 'judge-idle' : correct ? 'judge-correct' : 'judge-incorrect'
      const voteText = participated ? `T${r.tone} ${TONE_ARROWS[r.tone]}` : 'No vote'
      const verdict = !participated ? '—' : correct ? '✓' : '✗'
      return `
        <div class="tc-judge-card ${stateClass}">
          <div class="tc-judge-avatar">${persona.emoji}</div>
          <div class="tc-judge-name">${persona.name}</div>
          <div class="tc-judge-vote">${voteText}</div>
          <div class="tc-judge-verdict">${verdict}</div>
        </div>`
    }).join('')

    wrap.innerHTML = `
      <div class="tc-judges-label">What the judges heard</div>
      <div class="tc-judges-row">${cards}</div>
    `
    wrap.classList.remove('hidden')
  }

  function showToast(ok) {
    const t = $('tc-toast')
    t.className = 'feedback-toast'
    const msgs = ok
      ? ['Good tone! ✓', 'Nice job! ✓', 'Well said! ✓']
      : ['Keep trying ✗', 'Almost! ✗', 'Try again ✗']
    t.textContent = msgs[Math.floor(Math.random() * msgs.length)]
    t.classList.add(ok ? 'correct' : 'incorrect')
    requestAnimationFrame(() => t.classList.add('show'))
    setTimeout(() => t.classList.remove('show'), 1200)
  }

  // ── Report ──
  function showReport() {
    $('tc-quiz').classList.add('hidden')
    const el = $('tc-report')
    el.classList.remove('hidden')

    const pct = Math.round((score / TOTAL) * 100)
    const passed = score >= PASS_SCORE

    // Tone breakdown
    const toneColors = { 1: 'var(--tone1)', 2: 'var(--tone2)', 3: 'var(--tone3)', 4: 'var(--tone4)' }
    const toneNames = { 1: '1st (High)', 2: '2nd (Rising)', 3: '3rd (Dip)', 4: '4th (Fall)' }
    let toneRows = ''
    for (let t = 1; t <= 4; t++) {
      const qs = answers.filter(a => a.tone === t)
      const c = qs.filter(a => a.passed).length
      const p = qs.length ? Math.round(c / qs.length * 100) : 0
      toneRows += `
        <div class="tone-row">
          <div class="tone-dot" style="background:${toneColors[t]}"></div>
          <div class="tone-row-label">${toneNames[t]}</div>
          <div class="tone-bar-track"><div class="tone-bar-fill" style="width:${p}%;background:${toneColors[t]}"></div></div>
          <div class="tone-row-pct" style="color:${toneColors[t]}">${p}%</div>
        </div>`
    }

    // Detail rows
    let details = ''
    answers.forEach((a, i) => {
      const icon = a.passed ? '✅' : '❌'
      const pinyin = applyTone(a.base, a.tone)
      const detected = a.detectedTone ? `(detected: ${a.detectedTone})` : '(no signal)'
      details += `
        <div class="detail-item">
          <span class="detail-icon">${icon}</span>
          <span class="detail-qn">${i + 1}.</span>
          <span class="detail-char">${a.char}</span>
          <span class="detail-pinyin">${pinyin}</span>
          <span class="detail-score-val">${a.score}%</span>
        </div>`
    })

    const verdict = passed
      ? `🎉 Excellent! You scored <strong>${score}/${TOTAL}</strong>. You can pronounce the four tones well! Let's see if you know the tones of the most frequently used characters.`
      : `You scored <strong>${score}/${TOTAL}</strong>. Although you can hear the difference of the four tones, you might need to work on how to pronounce them accurately!`

    el.innerHTML = `
      <div class="app-shell animate-in">
        <div class="text-center" style="margin-bottom:28px">
          <h2 style="font-size:1.5rem;margin-bottom:4px">Test C — Results</h2>
          <div class="score-ring" style="--pct:${pct}">
            <span class="score-num">${score}/${TOTAL}</span>
            <span class="score-label">${pct}%</span>
          </div>
          <div style="color:var(--text-secondary);line-height:1.5;padding:0 12px">${verdict}</div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <h3 class="section-head">Performance by Tone</h3>
          ${toneRows}
        </div>

        <div class="card" style="margin-bottom:28px">
          <h3 class="section-head">Question Details</h3>
          ${details}
        </div>

        <div class="report-actions">
          <button class="btn btn-secondary" id="tc-retry">🔄 Retake</button>
          <button class="btn btn-primary" id="tc-continue">
            ${passed ? '→ Continue to Step 3' : '→ Practice Pronunciation'}
          </button>
        </div>
      </div>
    `

    document.getElementById('tc-retry').addEventListener('click', startTest)
    document.getElementById('tc-continue').addEventListener('click', () => {
      if (passed) {
        // TODO: navigate('/test-x') — Step 3
        alert('Next: Step 3 — Character Tone Knowledge (Tests X/Y/Z) — coming soon!')
      } else {
        // TODO: navigate('/practice-pronunciation') — Interface III
        alert('Next: Tone Pronunciation Exercises (Interface III) — coming soon!')
      }
    })
  }

  // Cleanup on unmount
  return () => {
    if (isRecording) engine.stop()
    clearTimeout(recordTimer)
    clearTimeout(silenceTimer)
    clearInterval(levelInterval)
  }
}

// ═══════════════════════════════════════
// Scoped CSS for Test C
// ═══════════════════════════════════════
const scopedCSS = `
  .tc-header {
    text-align: center;
    margin-bottom: 28px;
  }
  .tc-header h1 {
    font-size: 1.65rem; font-weight: 700; margin: 10px 0 6px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .tc-header p { color: var(--text-secondary); font-size: 0.95rem; }

  .intro-rules {
    text-align: left; background: var(--surface); border-radius: var(--radius-sm);
    padding: 16px 20px; margin: 20px 0; font-size: 0.85rem;
    color: var(--text-secondary); line-height: 1.7;
  }
  .intro-rules strong { color: var(--text-primary); }

  .progress-wrap { margin-bottom: 24px; }
  .progress-info { display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 8px; }
  .progress-score { font-weight: 600; color: var(--accent); }
  .progress-track { height: 6px; background: var(--card-border); border-radius: 3px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #818cf8); border-radius: 3px; transition: width 0.5s cubic-bezier(0.22,1,0.36,1); }

  /* Character display */
  .tc-char-display {
    text-align: center;
    padding: 16px 0 20px;
  }
  .tc-big-char {
    font-size: 4rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.1;
    font-family: 'Noto Sans SC', sans-serif;
  }
  .tc-pinyin {
    font-size: 1.4rem;
    color: var(--accent);
    font-weight: 600;
    margin-top: 8px;
  }
  .tc-meaning {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* Listen button */
  .tc-listen-row {
    display: flex; justify-content: center; margin-bottom: 20px;
  }
  .tc-listen-btn {
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
  .tc-listen-btn:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accent-glow);
  }
  .tc-listen-btn:disabled { opacity: 0.5; cursor: default; }

  /* Record section */
  .tc-record-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }
  .tc-record-btn {
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
  .tc-record-btn:hover:not(:disabled) {
    border-color: var(--tone1);
    transform: scale(1.04);
  }
  .tc-record-btn:disabled {
    opacity: 0.5; cursor: default; transform: none;
  }
  .tc-record-btn.recording {
    border-color: var(--tone1);
    background: var(--incorrect-bg);
    animation: pulse-ring 1.5s ease-out infinite;
  }
  .tc-record-icon { font-size: 2.2rem; }
  #tc-rec-label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }

  .tc-level-bar-wrap {
    width: 200px; height: 6px;
    background: var(--card-border);
    border-radius: 3px;
    overflow: hidden;
  }
  .tc-level-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--correct), var(--tone2));
    border-radius: 3px;
    transition: width 0.05s;
    width: 0%;
  }
  .tc-rec-status {
    font-size: 0.82rem; color: var(--text-muted); font-weight: 500;
  }

  /* Contour display */
  .tc-contour-wrap {
    margin: 16px 0;
    text-align: center;
  }
  #tc-canvas {
    display: block;
    margin: 0 auto;
    border: 1px solid var(--card-border);
    border-radius: var(--radius-sm);
    max-width: 100%;
  }
  .tc-legend {
    display: flex; justify-content: center; gap: 16px;
    margin-top: 8px; font-size: 0.78rem; color: var(--text-muted);
  }
  .tc-legend-item { display: flex; align-items: center; gap: 6px; }
  .tc-leg-dot { width: 16px; height: 3px; border-radius: 2px; }

  /* Per-question result */
  .tc-q-result {
    text-align: center;
    padding: 16px 0 4px;
    border-top: 1px solid var(--card-border);
    margin-top: 16px;
  }
  .tc-q-score {
    font-size: 2rem; font-weight: 700; line-height: 1;
  }
  .tc-q-msg {
    font-size: 0.9rem; color: var(--text-secondary);
    margin: 8px 0 16px;
  }
  .tc-confirm-wrap {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    margin-bottom: 12px;
  }
  .tc-confirm-btn {
    padding: 6px 16px; border-radius: 16px; font-size: 0.8rem; font-weight: 600;
    border: none; cursor: pointer; font-family: inherit;
  }

  /* Report reused styles */
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
  .section-head { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 16px; }

  .tone-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .tone-row:last-child { margin-bottom: 0; }
  .tone-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .tone-row-label { flex: 0 0 110px; font-size: 0.85rem; color: var(--text-secondary); }
  .tone-bar-track { flex: 1; height: 8px; background: var(--surface); border-radius: 4px; overflow: hidden; }
  .tone-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }
  .tone-row-pct { flex: 0 0 36px; text-align: right; font-size: 0.82rem; font-weight: 600; }

  .detail-item {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 0; border-bottom: 1px solid var(--card-border); font-size: 0.88rem;
  }
  .detail-item:last-child { border-bottom: none; }
  .detail-icon { flex-shrink: 0; font-size: 1rem; }
  .detail-qn { flex: 0 0 24px; color: var(--text-muted); font-size: 0.78rem; }
  .detail-char { font-size: 1.1rem; font-weight: 700; flex: 0 0 28px; font-family: 'Noto Sans SC', sans-serif; }
  .detail-pinyin { flex: 1; font-weight: 600; }
  .detail-score-val { flex: 0 0 40px; text-align: right; font-weight: 600; color: var(--accent); }

  .report-actions { display: flex; gap: 12px; }

  /* Judge panel */
  .tc-judges-label {
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--text-muted); text-align: center; margin: 14px 0 10px;
  }
  .tc-judges-row {
    display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .tc-judge-card {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 10px 12px; border-radius: var(--radius-sm);
    border: 1px solid var(--card-border);
    background: var(--surface);
    min-width: 72px;
    transition: all 0.3s ease;
  }
  .tc-judge-card.judge-correct {
    border-color: var(--correct);
    background: var(--correct-bg, rgba(34,197,94,0.08));
  }
  .tc-judge-card.judge-incorrect {
    border-color: var(--incorrect);
    background: var(--incorrect-bg);
  }
  .tc-judge-card.judge-idle { opacity: 0.4; }
  .tc-judge-avatar { font-size: 1.6rem; line-height: 1; }
  .tc-judge-name { font-size: 0.68rem; color: var(--text-muted); font-weight: 600; }
  .tc-judge-vote { font-size: 0.8rem; font-weight: 700; color: var(--text-primary); }
  .tc-judge-verdict { font-size: 1rem; font-weight: 700; }
  .judge-correct .tc-judge-verdict { color: var(--correct); }
  .judge-incorrect .tc-judge-verdict { color: var(--incorrect); }

  @media (max-width: 480px) {
    .tc-record-btn { width: 120px; height: 120px; }
    .tc-big-char { font-size: 3rem; }
    .report-actions { flex-direction: column; }
    .tone-row-label { flex: 0 0 90px; }
    .tc-judge-card { min-width: 62px; padding: 8px 8px; }
  }
`