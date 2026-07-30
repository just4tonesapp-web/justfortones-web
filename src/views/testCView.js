// ═══════════════════════════════════════
// Test C – Tone Pronunciation Test (8 items, 2 per tone)
// Pure production: user sees character + pinyin and reads it aloud — no audio
// example to mimic. The recorded pitch contour is analyzed against the target.
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { applyTone, shuffle } from '../utils/pinyin.js'
import { AudioEngine } from '../utils/audioEngine.js'
import { toneDetector } from '../utils/toneDetector.js'
import { supabase } from '../supabaseClient.js'
import { saveResult, attemptsToday, DAILY_TEST_LIMIT } from '../services/progressService.js'
import { getMelSpectrogramImage } from '../utils/models/tonetModel.js'
import { pickPraise, buildWrongFeedback } from '../utils/testCFeedback.js'
import {
  analyzeSingleSyllable, buildReportHTML, TONE_REPORT_CSS, bindAccordion,
} from '../utils/toneReport.js'
// WebSpeech disabled: coi-serviceworker's COOP header blocks Web Speech API
// import { isWebSpeechAvailable, startWebSpeech, stopWebSpeech } from '../utils/models/webSpeechModel.js'

const TOTAL = 8
const PASS_SCORE = 5

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
  openrouter: { emoji: '🧭', name: 'Router' },
}

const TONE_ARROWS = { 1: '─', 2: '／', 3: '∨', 4: '＼' }

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

  // ── Extra pool so questions don't repeat (15 per tone) ──
  { char: '三', base: 'san', tone: 1, meaning: 'three' },
  { char: '七', base: 'qi', tone: 1, meaning: 'seven' },
  { char: '八', base: 'ba', tone: 1, meaning: 'eight' },
  { char: '鸡', base: 'ji', tone: 1, meaning: 'chicken' },
  { char: '高', base: 'gao', tone: 1, meaning: 'tall' },
  { char: '飞', base: 'fei', tone: 1, meaning: 'fly' },
  { char: '开', base: 'kai', tone: 1, meaning: 'open' },
  { char: '说', base: 'shuo', tone: 1, meaning: 'speak' },
  { char: '听', base: 'ting', tone: 1, meaning: 'listen' },

  { char: '十', base: 'shi', tone: 2, meaning: 'ten' },
  { char: '钱', base: 'qian', tone: 2, meaning: 'money' },
  { char: '牛', base: 'niu', tone: 2, meaning: 'cow' },
  { char: '门', base: 'men', tone: 2, meaning: 'door' },
  { char: '国', base: 'guo', tone: 2, meaning: 'country' },
  { char: '白', base: 'bai', tone: 2, meaning: 'white' },
  { char: '头', base: 'tou', tone: 2, meaning: 'head' },
  { char: '龙', base: 'long', tone: 2, meaning: 'dragon' },
  { char: '王', base: 'wang', tone: 2, meaning: 'king' },

  { char: '五', base: 'wu', tone: 3, meaning: 'five' },
  { char: '九', base: 'jiu', tone: 3, meaning: 'nine' },
  { char: '我', base: 'wo', tone: 3, meaning: 'I' },
  { char: '手', base: 'shou', tone: 3, meaning: 'hand' },
  { char: '米', base: 'mi', tone: 3, meaning: 'rice (grain)' },
  { char: '老', base: 'lao', tone: 3, meaning: 'old' },
  { char: '雨', base: 'yu', tone: 3, meaning: 'rain' },
  { char: '火', base: 'huo', tone: 3, meaning: 'fire' },
  { char: '草', base: 'cao', tone: 3, meaning: 'grass' },

  { char: '二', base: 'er', tone: 4, meaning: 'two' },
  { char: '六', base: 'liu', tone: 4, meaning: 'six' },
  { char: '树', base: 'shu', tone: 4, meaning: 'tree' },
  { char: '笑', base: 'xiao', tone: 4, meaning: 'laugh' },
  { char: '电', base: 'dian', tone: 4, meaning: 'electric' },
  { char: '爱', base: 'ai', tone: 4, meaning: 'love' },
  { char: '路', base: 'lu', tone: 4, meaning: 'road' },
  { char: '菜', base: 'cai', tone: 4, meaning: 'vegetable' },
  { char: '快', base: 'kuai', tone: 4, meaning: 'fast' },
]

export function testCView(container, { debug = false } = {}) {
  const engine = new AudioEngine()
  let questions = []
  let currentQ = 0
  let score = 0
  let answers = []
  let testStart = 0
  let isRecording = false
  let recordTimer = null
  let levelInterval = null

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
      { name: 'openrouter', ...JUDGE_PERSONAS.openrouter },
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

  // Items used in the previous attempt — excluded on retake.
  let previousChars = new Set()

  function generate() {
    // Pick 2 per tone, total 8 — preferring chars not used in the previous attempt.
    const byTone = { 1: [], 2: [], 3: [], 4: [] }
    CHAR_POOL.forEach(c => byTone[c.tone].push(c))
    const picked = []
    for (let t = 1; t <= 4; t++) {
      const fresh = byTone[t].filter(c => !previousChars.has(c.char))
      const pool = fresh.length >= 2 ? fresh : byTone[t]
      picked.push(...shuffle(pool).slice(0, 2))
    }
    questions = shuffle(picked)
    previousChars = new Set(questions.map(q => q.char))
  }

  // ── Mount ──
  container.innerHTML = `
    <div class="app-shell shell-top-center">
      <div class="back-row">
        <button class="app-logo" id="tc-home">Just4Tones</button>
      </div>
      <div class="tc-header">
        <h1><span class="title-badge">3</span>Speaking — 1-Syllable Words</h1>
      </div>

      <!-- Intro (slide 17) -->
      <div id="tc-intro" class="card animate-in text-center">
        <p class="intro-copy">
          You'll see 8 single-syllable words. Read each one aloud and we'll
          check your tone — there's no example to copy, just your own pronunciation.
        </p>
        <p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:8px">
          ⚠️ Allow microphone access when prompted
        </p>
        <p id="tc-model-status" style="color:var(--text-muted);font-size:0.72rem;margin-bottom:16px;${debug ? '' : 'display:none'}">
          Loading AI models…
        </p>
        <button class="btn btn-primary btn-lg" id="tc-start">START NOW</button>
      </div>

      <!-- Quiz -->
      <div id="tc-quiz" class="hidden">
        <p id="tc-model-status" style="color:var(--text-muted);font-size:0.72rem;text-align:center;margin-bottom:8px;${debug ? '' : 'display:none'}"></p>
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
            <div class="tc-result-actions" id="tc-result-actions">
              <button class="btn btn-secondary hidden" id="tc-retry-q">🎤 Practice Again</button>
              <button class="btn btn-primary" id="tc-next">Next →</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Report -->
      <div id="tc-report" class="hidden"></div>
    </div>
    <div class="feedback-toast" id="tc-toast"></div>
  `

  const style = document.createElement('style')
  style.textContent = scopedCSS + TONE_REPORT_CSS + tcExtraCSS
  container.appendChild(style)

  const $ = (id) => document.getElementById(id)
  $('tc-home').addEventListener('click', () => navigate('/'))
  $('tc-start').addEventListener('click', startTest)
  $('tc-next').addEventListener('click', nextQuestion)
  $('tc-retry-q').addEventListener('click', retryQuestion)

  // Accuracy logger — user confirms if ensemble was right or wrong
  let pendingLogEntry = null

  // Stable session ID for grouping questions in one test run
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

  async function logAccuracy(userSaysCorrect) {
    if (!pendingLogEntry) return
    pendingLogEntry.userCorrect = userSaysCorrect

    // Console one-liner
    const m = pendingLogEntry.models
    const modelStr = ['azure', 'pitch', 'groq', 'groqTurbo', 'google', 'deepgram', 'openrouter', 'whisper', 'classifier']
      .map(name => `${name}→${m[name] !== null ? 'T' + m[name] : '—'}`)
      .join(' ')
    const mark = userSaysCorrect ? '✓' : '✗'
    console.log(`[accuracy] Q${pendingLogEntry.questionNum}: target=T${pendingLogEntry.targetTone} ensemble=T${pendingLogEntry.ensembleTone || '—'} ${mark} | ${modelStr}`)

    // Persist to localStorage (backup)
    const log = JSON.parse(localStorage.getItem('j4t_accuracy_log') || '[]')
    log.push(pendingLogEntry)
    localStorage.setItem('j4t_accuracy_log', JSON.stringify(log))

    // Persist to Supabase — bind to OUR account session (app_users id from
    // j4t_user), not supabase.auth (never used by this app, always null).
    let appUser = null
    try { appUser = JSON.parse(localStorage.getItem('j4t_user') || 'null') } catch { /* ignore */ }
    const row = {
      user_id: appUser?.id || null,
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

  // Tap once to record, tap again to stop (same interaction as the practice —
  // the old auto-stop-on-silence made people wait and cut off soft speakers).
  $('tc-record').addEventListener('click', () => {
    if ($('tc-record').disabled) return
    if (isRecording) stopRecording()
    else startRecording()
  })

  async function startTest() {
    // 2 completed attempts per test per day (client-side; counts saved results)
    if (await attemptsToday('C') >= DAILY_TEST_LIMIT) {
      const t = $('tc-toast')
      t.className = 'feedback-toast incorrect'
      t.textContent = `Daily limit reached — ${DAILY_TEST_LIMIT} tries per test per day. Come back tomorrow! 🌙`
      requestAnimationFrame(() => t.classList.add('show'))
      setTimeout(() => t.classList.remove('show'), 2600)
      return
    }
    generate()
    currentQ = 0; score = 0; answers = []; testStart = Date.now()
    container.querySelector('.back-row')?.classList.remove('hidden')
    container.querySelector('.tc-header')?.classList.remove('hidden')
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
    $('tc-retry-q').classList.add('hidden')
    const coachEl = document.getElementById('tc-coach-msg')
    if (coachEl) coachEl.style.display = 'none'
    pendingLogEntry = null

    // Re-animate
    const card = $('tc-card')
    card.style.animation = 'none'
    card.offsetHeight
    card.style.animation = 'cardIn 0.4s ease-out'
  }

  async function startRecording() {
    const ok = await engine.start()
    if (!ok) {
      $('tc-rec-status').textContent = 'Microphone access denied'
      return
    }

    isRecording = true

    $('tc-rec-label').textContent = 'Tap to Stop'
    $('tc-rec-icon').textContent = '⏺'
    $('tc-rec-status').textContent = 'Say the word, then tap to stop'
    $('tc-record').classList.add('recording')

    // Level meter (visual feedback only — the user decides when to stop)
    levelInterval = setInterval(() => {
      const rms = engine.getRMS()
      const pct = Math.min(100, rms * 500)
      $('tc-level-bar').style.width = `${pct}%`
    }, 50)

    // Safety cap only — recording is user-controlled
    recordTimer = setTimeout(() => { if (isRecording) stopRecording() }, 12000)
  }

  async function stopRecording() {
    clearTimeout(recordTimer)
    clearInterval(levelInterval)
    const recording = engine.stop()
    isRecording = false

    // Detection runs several models (and cloud judges) — it can take a moment,
    // so show an animated spinner rather than a frozen-looking hourglass.
    $('tc-rec-icon').innerHTML = '<span class="tc-mini-spinner"></span>'
    $('tc-rec-label').textContent = 'Detecting your tone…'
    $('tc-rec-status').textContent = 'Just a moment…'
    $('tc-record').classList.remove('recording')
    $('tc-record').classList.add('analyzing')
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

    // Pitch contour: always visible (pedagogical — shows user vs target curve).
    // Mel-spectrogram stays debug-only.
    drawContour(ensemble.userContour, TARGET_CONTOURS[q.tone])
    $('tc-contour-wrap').classList.remove('hidden')

    if (debug) {
      drawMelSpectrogram(getMelSpectrogramImage(recording.samples, recording.sampleRate))
      $('tc-mel-wrap').classList.remove('hidden')
    }

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

    $('tc-q-score').textContent = passed ? '✓' : '✗'
    $('tc-q-score').style.color = passed ? 'var(--correct)' : 'var(--incorrect)'

    let msg = ''
    let coachMsg = ''
    if (!detectedTone) {
      msg = 'Could not detect a clear tone — try speaking louder'
    } else if (passed) {
      // No "Detected: X · Y% confident" — just praise (model output stays hidden).
      msg = pickPraise(ensemble.confidence)
    } else {
      // Don't reveal which tone the answer is — show generic "almost" + the
      // pronunciation variation (action description without naming the tone).
      const pitchVote = ensemble.results.find(r => r.model === 'pitch')
      const pitchAgreed = pitchVote && pitchVote.tone === q.tone
      const fb = buildWrongFeedback(q.tone, pitchAgreed)
      msg = 'Almost — give it another try.'
      coachMsg = fb.variation
    }

    // Show per-model breakdown
    const modelBreakdown = ensemble.results.map(r => {
      const icon = r.tone === q.tone ? '✓' : '✗'
      return `${r.model}:T${r.tone}${icon}`
    }).join('  ')

    $('tc-q-msg').textContent = msg
    $('tc-q-msg').title = modelBreakdown // tooltip with model details

    // Coach line (tone-specific retry guidance) shown only on wrong answers
    let coachEl = document.getElementById('tc-coach-msg')
    if (!coachEl) {
      coachEl = document.createElement('div')
      coachEl.id = 'tc-coach-msg'
      coachEl.style.cssText = 'font-size:1rem;color:var(--text-primary);margin-top:10px;line-height:1.55;text-align:left;padding:14px 16px;background:var(--surface);border-radius:var(--radius-sm)'
      $('tc-q-result').insertBefore(coachEl, $('tc-q-msg').nextSibling)
    }
    if (coachMsg) {
      coachEl.textContent = coachMsg
      coachEl.style.display = ''
    } else {
      coachEl.style.display = 'none'
    }

    // Show model breakdown below message (debug only)
    if (debug) {
      let breakdownEl = document.getElementById('tc-model-breakdown')
      if (!breakdownEl) {
        breakdownEl = document.createElement('div')
        breakdownEl.id = 'tc-model-breakdown'
        breakdownEl.style.cssText = 'font-size:0.72rem;color:var(--text-muted);margin-top:4px;letter-spacing:0.03em'
        $('tc-q-result').insertBefore(breakdownEl, $('tc-next'))
      }
      breakdownEl.textContent = modelBreakdown || 'pitch only'
    }

    if (debug) renderJudges(ensemble.results, q.tone)
    $('tc-q-result').classList.remove('hidden')
    $('tc-prog-score').textContent = `Score: ${score}`
    showToast(passed, ensemble.confidence)

    // Prepare accuracy log entry and show confirm buttons (debug only)
    const modelVotes = {}
    for (const name of ['azure', 'pitch', 'groq', 'groqTurbo', 'google', 'deepgram', 'openrouter', 'whisper', 'classifier']) {
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
    if (debug) $('tc-confirm-wrap').classList.remove('hidden')

    // Show appropriate action buttons
    if (passed) {
      $('tc-retry-q').classList.add('hidden')
    } else {
      $('tc-retry-q').classList.remove('hidden')
    }

    $('tc-record').classList.remove('analyzing')
    $('tc-rec-label').textContent = 'Done'
    $('tc-rec-icon').textContent = passed ? '✓' : '✗'
    $('tc-rec-status').textContent = passed ? 'Correct!' : 'Not quite'
  }

  function retryQuestion() {
    // Reset UI for retry without advancing question
    $('tc-q-result').classList.add('hidden')
    $('tc-contour-wrap').classList.add('hidden')
    $('tc-mel-wrap').classList.add('hidden')
    $('tc-judges-wrap').classList.add('hidden')
    $('tc-confirm-wrap').classList.add('hidden')
    const coachEl = document.getElementById('tc-coach-msg')
    if (coachEl) coachEl.style.display = 'none'
    $('tc-record').classList.remove('analyzing')
    $('tc-rec-label').textContent = 'Tap to Record'
    $('tc-rec-icon').textContent = '🎤'
    $('tc-rec-status').textContent = 'Try again!'
    $('tc-record').disabled = false
    pendingLogEntry = null
    // Revert score if the wrong answer was already counted
    const lastAnswer = answers[answers.length - 1]
    if (lastAnswer && !lastAnswer.passed) {
      answers.pop()
    }
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
    const shown = ['azure', 'pitch', 'groq', 'groqTurbo', 'google', 'deepgram', 'openrouter', 'whisper', 'classifier']

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

  function showToast(ok, confidence = 0) {
    const t = $('tc-toast')
    t.className = 'feedback-toast'
    t.textContent = ok
      ? `${pickPraise(confidence)} ✓`
      : 'Try again ✗'
    t.classList.add(ok ? 'correct' : 'incorrect')
    requestAnimationFrame(() => t.classList.add('show'))
    setTimeout(() => t.classList.remove('show'), 1400)
  }

  // ── Report (accordion-style score screen, slide 18) ──
  function showReport() {
    $('tc-quiz').classList.add('hidden')
    container.querySelector('.back-row')?.classList.add('hidden')
    container.querySelector('.tc-header')?.classList.add('hidden')
    const el = $('tc-report')
    el.classList.remove('hidden')

    saveResult('C', score, TOTAL, { answers })

    // Map this test's per-q field (`passed`) to the shared analyzer's `correct`.
    const adapted = answers.map(a => ({ tone: a.tone, correct: !!a.passed }))
    const analysis = analyzeSingleSyllable(adapted)
    const reportInner = buildReportHTML({
      analysis, score, total: TOTAL,
      testLabel: 'Test 3 · Speaking 1-syllable',
      shape: 'single',
      skill: 'speaking',
      showSummary: false, // score already shown in the headline above
    })

    el.innerHTML = `
      <div class="result-shell animate-in">
        <button class="app-logo" id="tc-logo">Just4Tones</button>

        <div class="result-scorecard">
          <div class="rs-score">
            <span class="rs-score-label">You scored</span>
            <span class="rs-score-value">${score}/${TOTAL}</span>
          </div>
          <div class="rs-divider"></div>
          <div class="tr-report-head">Your REPORT</div>
          ${reportInner.html}
        </div>

        <button class="result-next result-next-final" id="tc-finish">
          <div class="result-next-head">REPORT</div>
          <div class="result-next-title">Get your full report</div>
        </button>

        <p class="result-retake">
          Want another go? Scores go up and down when you're learning new sounds — that's totally normal.
          <button class="result-retake-link" id="tc-retry">Test Again</button>
        </p>
      </div>
    `

    bindAccordion(el)
    document.getElementById('tc-logo').addEventListener('click', () => navigate('/'))
    document.getElementById('tc-retry').addEventListener('click', startTest)
    document.getElementById('tc-finish').addEventListener('click', () => navigate('/report'))
  }

  // Cleanup on unmount
  return () => {
    if (isRecording) engine.stop()
    clearTimeout(recordTimer)
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
    font-size: 1.55rem; font-weight: 700; margin: 0;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .intro-copy {
    color: var(--text-primary);
    font-size: 1rem;
    line-height: 1.65;
    margin: 0 0 16px;
  }

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
  /* Detection in progress — accent ring + spinner (see .tc-mini-spinner). */
  .tc-record-btn.analyzing {
    border-color: var(--accent);
    background: var(--accent-glow);
    opacity: 1;
  }
  .tc-mini-spinner {
    display: inline-block;
    width: 30px; height: 30px;
    border-radius: 50%;
    border: 3px solid var(--card-border);
    border-top-color: var(--accent);
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
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
    font-size: 2.4rem; font-weight: 700; line-height: 1;
  }
  .tc-q-msg {
    font-size: 1.05rem; color: var(--text-primary);
    font-weight: 600;
    margin: 10px 0 16px;
    line-height: 1.45;
  }
  .tc-result-actions {
    display: flex; gap: 10px; justify-content: center; margin-top: 4px;
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
// ── Result screen styles (slide 18) ──
const tcExtraCSS = `
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

  /* Final test → composite report: green "you finished" accent. */
  .result-next-final {
    background: linear-gradient(135deg, rgba(74,222,128,0.18), rgba(56,189,248,0.18));
    border-color: var(--correct);
  }
  .result-next-final:hover {
    background: linear-gradient(135deg, rgba(74,222,128,0.28), rgba(56,189,248,0.28));
  }
  .result-next-final .result-next-head { color: var(--correct); }

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
    .rs-score-value { font-size: 2.6rem; }
  }
`
