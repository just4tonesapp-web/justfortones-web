// ═══════════════════════════════════════
// Test D – Two-Character Pronunciation (12 items)
// User sees two characters + pinyin, records voice,
// ensemble tone detection runs on first character.
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { applyTone, shuffle } from '../utils/pinyin.js'
import { speakChinese } from '../utils/audio.js'
import { AudioEngine } from '../utils/audioEngine.js'
import { toneDetector } from '../utils/toneDetector.js'
import { supabase } from '../supabaseClient.js'
import { saveResult } from '../services/progressService.js'
import { getMelSpectrogramImage } from '../utils/models/tonetModel.js'

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

// Two-character combinations pool
const COMBO_POOL = [
  { chars: '小学', bases: ['xiao','xue'], tones: [3,2], meaning: 'primary school' },
  { chars: '大家', bases: ['da','jia'], tones: [4,1], meaning: 'everyone' },
  { chars: '中国', bases: ['zhong','guo'], tones: [1,2], meaning: 'China' },
  { chars: '学生', bases: ['xue','sheng'], tones: [2,1], meaning: 'student' },
  { chars: '老师', bases: ['lao','shi'], tones: [3,1], meaning: 'teacher' },
  { chars: '你好', bases: ['ni','hao'], tones: [3,3], meaning: 'hello' },
  { chars: '谢谢', bases: ['xie','xie'], tones: [4,4], meaning: 'thank you' },
  { chars: '再见', bases: ['zai','jian'], tones: [4,4], meaning: 'goodbye' },
  { chars: '明天', bases: ['ming','tian'], tones: [2,1], meaning: 'tomorrow' },
  { chars: '今天', bases: ['jin','tian'], tones: [1,1], meaning: 'today' },
  { chars: '朋友', bases: ['peng','you'], tones: [2,3], meaning: 'friend' },
  { chars: '吃饭', bases: ['chi','fan'], tones: [1,4], meaning: 'eat meal' },
  { chars: '喝水', bases: ['he','shui'], tones: [1,3], meaning: 'drink water' },
  { chars: '说话', bases: ['shuo','hua'], tones: [1,4], meaning: 'speak' },
  { chars: '走路', bases: ['zou','lu'], tones: [3,4], meaning: 'walk' },
  { chars: '看书', bases: ['kan','shu'], tones: [4,1], meaning: 'read book' },
  { chars: '回家', bases: ['hui','jia'], tones: [2,1], meaning: 'go home' },
  { chars: '上课', bases: ['shang','ke'], tones: [4,4], meaning: 'attend class' },
  { chars: '下课', bases: ['xia','ke'], tones: [4,4], meaning: 'dismiss class' },
  { chars: '开心', bases: ['kai','xin'], tones: [1,1], meaning: 'happy' },
  { chars: '高兴', bases: ['gao','xing'], tones: [1,4], meaning: 'glad' },
  { chars: '漂亮', bases: ['piao','liang'], tones: [4,4], meaning: 'beautiful' },
  { chars: '可以', bases: ['ke','yi'], tones: [3,3], meaning: 'can/may' },
  { chars: '知道', bases: ['zhi','dao'], tones: [1,4], meaning: 'know' },
]

export function testDView(container) {
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
    document.querySelectorAll('#td-model-status').forEach(el => {
      el.innerHTML = parts.join('  ·  ')
    })
  }

  // Show initial state immediately
  updateModelStatus()

  function generate() {
    // Pick 12 random combos from the pool
    questions = shuffle([...COMBO_POOL]).slice(0, TOTAL)
  }

  // ── Mount ──
  container.innerHTML = `
    <div class="app-shell">
      <div class="td-header">
        <span class="badge">Diagnostic Step 2</span>
        <h1>Test D — Two-Character Pronunciation</h1>
        <p>Can you pronounce two-character words?</p>
      </div>

      <!-- Intro -->
      <div id="td-intro" class="card animate-in text-center">
        <div style="font-size:3rem;margin-bottom:16px">🎤</div>
        <h2>Speak the words!</h2>
        <p style="color:var(--text-secondary);margin:12px 0;line-height:1.6">
          You'll see 12 two-character words with their pinyin.<br>
          Listen to the example, then record yourself saying the word.<br>
          We'll analyze the tone of the <strong>first character</strong>.
        </p>
        <div class="intro-rules">
          <strong>How it works:</strong><br>
          — Tap 🔊 to hear the correct pronunciation<br>
          — Tap 🎤 to record yourself (3 seconds max)<br>
          — The first character's tone is analyzed<br>
          — Score ${PASS_SCORE}+ out of 12 to pass
        </div>
        <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:8px">
          Allow microphone access when prompted
        </p>
        <p id="td-model-status" style="color:var(--text-muted);font-size:0.75rem;margin-bottom:16px">
          Loading AI models...
        </p>
        <button class="btn btn-primary btn-lg" id="td-start">Start Test D</button>
      </div>

      <!-- Quiz -->
      <div id="td-quiz" class="hidden">
        <p id="td-model-status" style="color:var(--text-muted);font-size:0.72rem;text-align:center;margin-bottom:8px"></p>
        <div class="progress-wrap">
          <div class="progress-info">
            <span id="td-prog-label">Question 1 of ${TOTAL}</span>
            <span class="progress-score" id="td-prog-score">Score: 0</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="td-prog-fill" style="width:0%"></div>
          </div>
        </div>

        <div class="card animate-in" id="td-card">
          <!-- Character display -->
          <div class="td-char-display">
            <div class="td-big-char" id="td-char">小学</div>
            <div class="td-pinyin" id="td-pinyin">xiǎo xué</div>
            <div class="td-meaning" id="td-meaning">primary school</div>
          </div>

          <!-- Listen button -->
          <div class="td-listen-row">
            <button class="td-listen-btn" id="td-listen">
              🔊 Listen to example
            </button>
          </div>

          <!-- Record section -->
          <div class="td-record-section">
            <button class="td-record-btn" id="td-record">
              <span class="td-record-icon" id="td-rec-icon">🎤</span>
              <span id="td-rec-label">Tap to Record</span>
            </button>
            <div class="td-level-bar-wrap">
              <div class="td-level-bar" id="td-level-bar"></div>
            </div>
            <div class="td-rec-status" id="td-rec-status">Ready</div>
          </div>

          <!-- Pitch contour canvas -->
          <div class="td-contour-wrap hidden" id="td-contour-wrap">
            <canvas id="td-canvas" width="360" height="140"></canvas>
            <div class="td-legend">
              <span class="td-legend-item"><span class="td-leg-dot" style="background:var(--accent)"></span> Target</span>
              <span class="td-legend-item"><span class="td-leg-dot" style="background:var(--tone1)"></span> Your voice</span>
            </div>
          </div>

          <!-- Mel-spectrogram debug view -->
          <div class="hidden" id="td-mel-wrap" style="text-align:center;margin:8px 0">
            <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px">
              Mel-spectrogram fed to ToneNet (first character)
            </div>
            <canvas id="td-mel-canvas" width="225" height="225"
              style="border:1px solid var(--card-border);border-radius:4px;max-width:100%;image-rendering:pixelated"></canvas>
          </div>

          <!-- Result for this question -->
          <div class="td-q-result hidden" id="td-q-result">
            <div class="td-q-score" id="td-q-score">85%</div>
            <div class="td-q-msg" id="td-q-msg">Great match!</div>
            <div id="td-judges-wrap" class="hidden"></div>
            <div id="td-confirm-wrap" class="td-confirm-wrap hidden">
              <span style="font-size:0.8rem;color:var(--text-secondary)">Did you say the right tone?</span>
              <button class="btn btn-sm td-confirm-btn" id="td-confirm-yes" style="background:var(--correct);color:#fff">Yes</button>
              <button class="btn btn-sm td-confirm-btn" id="td-confirm-no" style="background:var(--incorrect);color:#fff">No</button>
            </div>
            <button class="btn btn-primary" id="td-next">Next →</button>
          </div>
        </div>
      </div>

      <!-- Report -->
      <div id="td-report" class="hidden"></div>
    </div>
    <div class="feedback-toast" id="td-toast"></div>
  `

  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)

  const $ = (id) => document.getElementById(id)
  $('td-start').addEventListener('click', startTest)
  $('td-listen').addEventListener('click', listenExample)
  $('td-next').addEventListener('click', nextQuestion)

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
    $('td-confirm-wrap').classList.add('hidden')
    pendingLogEntry = null
  }

  $('td-confirm-yes').addEventListener('click', () => logAccuracy(true))
  $('td-confirm-no').addEventListener('click', () => logAccuracy(false))

  $('td-record').addEventListener('click', () => {
    if (!isRecording && !$('td-record').disabled) startRecording()
  })

  function startTest() {
    generate()
    currentQ = 0; score = 0; answers = []; testStart = Date.now()
    $('td-intro').classList.add('hidden')
    $('td-quiz').classList.remove('hidden')
    $('td-report').classList.add('hidden')
    loadQ()
  }

  function loadQ() {
    isRecording = false
    const q = questions[currentQ]

    $('td-prog-label').textContent = `Question ${currentQ + 1} of ${TOTAL}`
    $('td-prog-score').textContent = `Score: ${score}`
    $('td-prog-fill').style.width = `${(currentQ / TOTAL) * 100}%`

    // Display both characters
    $('td-char').textContent = q.chars
    // Show both pinyin with tone marks
    $('td-pinyin').textContent = `${applyTone(q.bases[0], q.tones[0])} ${applyTone(q.bases[1], q.tones[1])}`
    $('td-meaning').textContent = q.meaning

    // Reset UI
    $('td-rec-label').textContent = 'Tap to Record'
    $('td-rec-icon').textContent = '🎤'
    $('td-rec-status').textContent = 'Ready'
    $('td-record').classList.remove('recording')
    $('td-record').disabled = false
    $('td-level-bar').style.width = '0%'
    $('td-contour-wrap').classList.add('hidden')
    $('td-mel-wrap').classList.add('hidden')
    $('td-q-result').classList.add('hidden')
    $('td-judges-wrap').classList.add('hidden')
    $('td-confirm-wrap').classList.add('hidden')
    pendingLogEntry = null
    $('td-listen').disabled = false

    // Re-animate
    const card = $('td-card')
    card.style.animation = 'none'
    card.offsetHeight
    card.style.animation = 'cardIn 0.4s ease-out'
  }

  function listenExample() {
    const q = questions[currentQ]
    const btn = $('td-listen')
    btn.textContent = '🔊 Playing...'
    btn.disabled = true
    // Speak the full two-character word
    speakChinese(q.chars, q.tones[0], () => {
      btn.textContent = '🔊 Listen again'
      btn.disabled = false
    })
  }

  async function startRecording() {
    const ok = await engine.start()
    if (!ok) {
      $('td-rec-status').textContent = 'Microphone access denied'
      return
    }

    isRecording = true
    hasSpeaking = false
    silenceTimer = null

    $('td-rec-label').textContent = 'Listening...'
    $('td-rec-icon').textContent = '🎤'
    $('td-rec-status').textContent = 'Speak now!'
    $('td-record').classList.add('recording')
    $('td-listen').disabled = true

    // Level meter + silence detection
    levelInterval = setInterval(() => {
      const rms = engine.getRMS()
      const pct = Math.min(100, rms * 500)
      $('td-level-bar').style.width = `${pct}%`

      const speaking = rms > 0.015
      if (speaking) {
        hasSpeaking = true
        if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null }
        $('td-rec-status').textContent = 'Speaking...'
      } else if (hasSpeaking && !silenceTimer) {
        // Speech detected, now silence — stop after 400ms
        silenceTimer = setTimeout(() => { if (isRecording) stopRecording() }, 400)
        $('td-rec-status').textContent = 'Done? Stopping...'
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

    $('td-rec-label').textContent = 'Analyzing...'
    $('td-rec-icon').textContent = '⏳'
    $('td-rec-status').textContent = `Using ${toneDetector.activeModels.length} model(s)...`
    $('td-record').classList.remove('recording')
    $('td-record').disabled = true
    $('td-level-bar').style.width = '0%'

    const q = questions[currentQ]

    // ── Run ensemble detection on first character's base ──
    const ensemble = await toneDetector.detect(
      { samples: recording.samples, sampleRate: recording.sampleRate },
      q.bases[0],
      { referenceChar: q.chars[0] }
    )

    // Target contour for canvas (first character's tone)
    const TARGET_CONTOURS = {
      1: [5, 5, 5, 5, 5],
      2: [3, 3.5, 4, 4.5, 5],
      3: [2, 1.5, 1, 1.5, 4],
      4: [5, 4, 3, 2, 1],
    }

    drawContour(ensemble.userContour, TARGET_CONTOURS[q.tones[0]])
    $('td-contour-wrap').classList.remove('hidden')

    // Debug: render mel-spectrogram
    drawMelSpectrogram(getMelSpectrogramImage(recording.samples, recording.sampleRate))
    $('td-mel-wrap').classList.remove('hidden')

    // Pass if detected tone matches first character's target tone
    const detectedTone = ensemble.tone
    const targetTone = q.tones[0]
    const passed = detectedTone === targetTone
    if (passed) score++

    answers.push({
      chars: q.chars,
      bases: q.bases,
      tones: q.tones,
      meaning: q.meaning,
      targetTone,
      detectedTone,
      confidence: ensemble.confidence,
      agreement: ensemble.agreement,
      modelResults: ensemble.results,
      passed,
    })

    // Score display
    const confText = ensemble.tone ? `${ensemble.confidence}% confident` : '—'
    $('td-q-score').textContent = passed ? '✓' : '✗'
    $('td-q-score').style.color = passed ? 'var(--correct)' : 'var(--incorrect)'

    const toneNames = { 1: '1st (High ‾)', 2: '2nd (Rising ↗)', 3: '3rd (Dip ↘↗)', 4: '4th (Falling ↘)' }
    let msg = ''
    if (!detectedTone) {
      msg = 'Could not detect a clear tone — try speaking louder'
    } else if (passed) {
      msg = `First char: ${toneNames[detectedTone]} · ${confText}`
    } else {
      msg = `Detected ${toneNames[detectedTone]}, expected ${toneNames[targetTone]} · ${confText}`
    }

    // Show per-model breakdown
    const modelBreakdown = ensemble.results.map(r => {
      const icon = r.tone === targetTone ? '✓' : '✗'
      return `${r.model}:T${r.tone}${icon}`
    }).join('  ')

    $('td-q-msg').textContent = msg
    $('td-q-msg').title = modelBreakdown

    // Show model breakdown below message
    let breakdownEl = document.getElementById('td-model-breakdown')
    if (!breakdownEl) {
      breakdownEl = document.createElement('div')
      breakdownEl.id = 'td-model-breakdown'
      breakdownEl.style.cssText = 'font-size:0.72rem;color:var(--text-muted);margin-top:4px;letter-spacing:0.03em'
      $('td-q-result').insertBefore(breakdownEl, $('td-next'))
    }
    breakdownEl.textContent = modelBreakdown || 'pitch only'

    renderJudges(ensemble.results, targetTone)
    $('td-q-result').classList.remove('hidden')
    $('td-prog-score').textContent = `Score: ${score}`
    showToast(passed)

    // Prepare accuracy log entry and show confirm buttons
    const modelVotes = {}
    for (const name of ['azure', 'pitch', 'groq', 'groqTurbo', 'google', 'deepgram', 'whisper', 'classifier']) {
      const r = ensemble.results.find(r => r.model === name)
      modelVotes[name] = r ? r.tone : null
    }
    pendingLogEntry = {
      questionNum: currentQ + 1,
      char: q.chars,
      base: q.bases[0],
      targetTone,
      ensembleTone: detectedTone,
      confidence: ensemble.confidence,
      agreement: ensemble.agreement,
      models: modelVotes,
      autoCorrect: passed,
      timestamp: new Date().toISOString(),
    }
    $('td-confirm-wrap').classList.remove('hidden')

    $('td-rec-label').textContent = 'Done'
    $('td-rec-icon').textContent = passed ? '✓' : '✗'
    $('td-rec-status').textContent = passed ? 'Correct!' : 'Not quite'
  }

  function nextQuestion() {
    currentQ++
    if (currentQ >= TOTAL) showReport()
    else loadQ()
  }

  // ── Draw pitch contour on canvas ──
  function drawContour(userContour, targetContour) {
    const canvas = $('td-canvas')
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
    const canvas = $('td-mel-canvas')
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
    const wrap = document.getElementById('td-judges-wrap')
    if (!wrap) return

    const resultMap = {}
    for (const r of results) resultMap[r.model] = r

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
        <div class="td-judge-card ${stateClass}">
          <div class="td-judge-avatar">${persona.emoji}</div>
          <div class="td-judge-name">${persona.name}</div>
          <div class="td-judge-vote">${voteText}</div>
          <div class="td-judge-verdict">${verdict}</div>
        </div>`
    }).join('')

    wrap.innerHTML = `
      <div class="td-judges-label">What the judges heard</div>
      <div class="td-judges-row">${cards}</div>
    `
    wrap.classList.remove('hidden')
  }

  function showToast(ok) {
    const t = $('td-toast')
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
  async function showReport() {
    $('td-quiz').classList.add('hidden')
    const el = $('td-report')
    el.classList.remove('hidden')

    const pct = Math.round((score / TOTAL) * 100)
    const passed = score >= PASS_SCORE

    // Save result
    const elapsed = Math.round((Date.now() - testStart) / 1000)
    await saveResult('D', score, TOTAL, { elapsed, answers })

    // Tone breakdown (based on first character's tone)
    const toneColors = { 1: 'var(--tone1)', 2: 'var(--tone2)', 3: 'var(--tone3)', 4: 'var(--tone4)' }
    const toneNames = { 1: '1st (High)', 2: '2nd (Rising)', 3: '3rd (Dip)', 4: '4th (Fall)' }
    let toneRows = ''
    for (let t = 1; t <= 4; t++) {
      const qs = answers.filter(a => a.targetTone === t)
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
      const pinyin1 = applyTone(a.bases[0], a.tones[0])
      const pinyin2 = applyTone(a.bases[1], a.tones[1])
      const detected = a.detectedTone ? `(detected: T${a.detectedTone})` : '(no signal)'
      details += `
        <div class="detail-item">
          <span class="detail-icon">${icon}</span>
          <span class="detail-qn">${i + 1}.</span>
          <span class="detail-char">${a.chars}</span>
          <span class="detail-pinyin">${pinyin1} ${pinyin2}</span>
          <span class="detail-detected">${detected}</span>
        </div>`
    })

    const verdict = passed
      ? `🎉 Excellent! You scored <strong>${score}/${TOTAL}</strong>. You can pronounce two-character words well! Your tones stay accurate even in combination.`
      : `You scored <strong>${score}/${TOTAL}</strong>. Pronouncing tones in two-character words can be tricky. Keep practicing to maintain correct tones in context!`

    el.innerHTML = `
      <div class="app-shell animate-in">
        <div class="text-center" style="margin-bottom:28px">
          <h2 style="font-size:1.5rem;margin-bottom:4px">Test D — Results</h2>
          <div class="score-ring" style="--pct:${pct}">
            <span class="score-num">${score}/${TOTAL}</span>
            <span class="score-label">${pct}%</span>
          </div>
          <div style="color:var(--text-secondary);line-height:1.5;padding:0 12px">${verdict}</div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <h3 class="section-head">Performance by Tone (1st character)</h3>
          ${toneRows}
        </div>

        <div class="card" style="margin-bottom:28px">
          <h3 class="section-head">Question Details</h3>
          ${details}
        </div>

        <div class="report-actions">
          <button class="btn btn-secondary" id="td-retry">🔄 Retake</button>
          <button class="btn btn-primary" id="td-continue">
            ${passed ? '→ Continue' : '→ Practice Pronunciation'}
          </button>
        </div>
      </div>
    `

    document.getElementById('td-retry').addEventListener('click', startTest)
    document.getElementById('td-continue').addEventListener('click', () => {
      if (passed) {
        navigate('/')
      } else {
        navigate('/')
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
// Scoped CSS for Test D
// ═══════════════════════════════════════
const scopedCSS = `
  .td-header {
    text-align: center;
    margin-bottom: 28px;
  }
  .td-header h1 {
    font-size: 1.65rem; font-weight: 700; margin: 10px 0 6px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .td-header p { color: var(--text-secondary); font-size: 0.95rem; }

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

  /* Character display — two chars side by side */
  .td-char-display {
    text-align: center;
    padding: 16px 0 20px;
  }
  .td-big-char {
    font-size: 3rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.1;
    letter-spacing: 0.05em;
    font-family: 'Noto Sans SC', sans-serif;
  }
  .td-pinyin {
    font-size: 1.3rem;
    color: var(--accent);
    font-weight: 600;
    margin-top: 8px;
  }
  .td-meaning {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 4px;
  }

  /* Listen button */
  .td-listen-row {
    display: flex; justify-content: center; margin-bottom: 20px;
  }
  .td-listen-btn {
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
  .td-listen-btn:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accent-glow);
  }
  .td-listen-btn:disabled { opacity: 0.5; cursor: default; }

  /* Record section */
  .td-record-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }
  .td-record-btn {
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
  .td-record-btn:hover:not(:disabled) {
    border-color: var(--tone1);
    transform: scale(1.04);
  }
  .td-record-btn:disabled {
    opacity: 0.5; cursor: default; transform: none;
  }
  .td-record-btn.recording {
    border-color: var(--tone1);
    background: var(--incorrect-bg);
    animation: pulse-ring 1.5s ease-out infinite;
  }
  .td-record-icon { font-size: 2.2rem; }
  #td-rec-label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }

  .td-level-bar-wrap {
    width: 200px; height: 6px;
    background: var(--card-border);
    border-radius: 3px;
    overflow: hidden;
  }
  .td-level-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--correct), var(--tone2));
    border-radius: 3px;
    transition: width 0.05s;
    width: 0%;
  }
  .td-rec-status {
    font-size: 0.82rem; color: var(--text-muted); font-weight: 500;
  }

  /* Contour display */
  .td-contour-wrap {
    margin: 16px 0;
    text-align: center;
  }
  #td-canvas {
    display: block;
    margin: 0 auto;
    border: 1px solid var(--card-border);
    border-radius: var(--radius-sm);
    max-width: 100%;
  }
  .td-legend {
    display: flex; justify-content: center; gap: 16px;
    margin-top: 8px; font-size: 0.78rem; color: var(--text-muted);
  }
  .td-legend-item { display: flex; align-items: center; gap: 6px; }
  .td-leg-dot { width: 16px; height: 3px; border-radius: 2px; }

  /* Per-question result */
  .td-q-result {
    text-align: center;
    padding: 16px 0 4px;
    border-top: 1px solid var(--card-border);
    margin-top: 16px;
  }
  .td-q-score {
    font-size: 2rem; font-weight: 700; line-height: 1;
  }
  .td-q-msg {
    font-size: 0.9rem; color: var(--text-secondary);
    margin: 8px 0 16px;
  }
  .td-confirm-wrap {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    margin-bottom: 12px;
  }
  .td-confirm-btn {
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
  .detail-char { font-size: 1.1rem; font-weight: 700; flex: 0 0 48px; font-family: 'Noto Sans SC', sans-serif; }
  .detail-pinyin { flex: 1; font-weight: 600; }
  .detail-detected { flex: 0 0 auto; font-size: 0.75rem; color: var(--text-muted); }

  .report-actions { display: flex; gap: 12px; }

  /* Judge panel */
  .td-judges-label {
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--text-muted); text-align: center; margin: 14px 0 10px;
  }
  .td-judges-row {
    display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .td-judge-card {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 10px 12px; border-radius: var(--radius-sm);
    border: 1px solid var(--card-border);
    background: var(--surface);
    min-width: 72px;
    transition: all 0.3s ease;
  }
  .td-judge-card.judge-correct {
    border-color: var(--correct);
    background: var(--correct-bg, rgba(34,197,94,0.08));
  }
  .td-judge-card.judge-incorrect {
    border-color: var(--incorrect);
    background: var(--incorrect-bg);
  }
  .td-judge-card.judge-idle { opacity: 0.4; }
  .td-judge-avatar { font-size: 1.6rem; line-height: 1; }
  .td-judge-name { font-size: 0.68rem; color: var(--text-muted); font-weight: 600; }
  .td-judge-vote { font-size: 0.8rem; font-weight: 700; color: var(--text-primary); }
  .td-judge-verdict { font-size: 1rem; font-weight: 700; }
  .judge-correct .td-judge-verdict { color: var(--correct); }
  .judge-incorrect .td-judge-verdict { color: var(--incorrect); }

  @media (max-width: 480px) {
    .td-record-btn { width: 120px; height: 120px; }
    .td-big-char { font-size: 2.5rem; }
    .report-actions { flex-direction: column; }
    .tone-row-label { flex: 0 0 90px; }
    .td-judge-card { min-width: 62px; padding: 8px 8px; }
    .detail-char { flex: 0 0 40px; }
  }
`
