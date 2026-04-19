// ═══════════════════════════════════════
// Test A – Tone Listening Quiz (12 items)
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { SYLLABLE_POOL, applyTone, shuffle, hasCharacter } from '../utils/pinyin.js'
import { playSyllable } from '../utils/audio.js'
import { hasRecording } from '../utils/recordingsManifest.js'
import { saveResult } from '../services/progressService.js'

const TOTAL = 12
const PASS_SCORE = 10

export function testAView(container) {
  // ── State ──
  let questions = []
  let currentQ = 0
  let score = 0
  let answered = false
  let answers = []
  let qStart = 0
  let testStart = 0

  // ── Generate 12 questions (3 per tone, random syllables) ──
  // Only pick syllables that have a recorded m4a for the chosen tone,
  // so every question plays a real human voice.
  function generate() {
    const tones = shuffle([1,1,1, 2,2,2, 3,3,3, 4,4,4])
    const used = new Set()
    questions = tones.map((t) => {
      const candidates = SYLLABLE_POOL.filter(s => !used.has(s) && hasRecording(s, t) && hasCharacter(s, t))
      const pool = candidates.length ? candidates : SYLLABLE_POOL.filter(s => !used.has(s))
      const syllable = pool[Math.floor(Math.random() * pool.length)]
      used.add(syllable)
      return { syllable, tone: t }
    })
  }

  // ── Mount ──
  container.innerHTML = `
    <div class="app-shell">
      <div class="testa-header">
        <span class="badge">Diagnostic Step 1</span>
        <h1>Test A — Tone Listening</h1>
        <p>Can you identify the four tones by ear?</p>
      </div>

      <!-- Intro -->
      <div id="ta-intro" class="card animate-in text-center">
        <div style="font-size:3rem;margin-bottom:16px">🎧</div>
        <h2>Ready to test your ears?</h2>
        <p style="color:var(--text-secondary);margin:12px 0;line-height:1.6">
          You'll hear 12 syllables, each in one of the four tones.<br>
          Pick the pinyin with the correct tone mark.
        </p>
        <div class="intro-rules">
          <strong>How it works:</strong><br>
          — 12 questions, one at a time<br>
          — Each tone appears exactly 3 times<br>
          — Tap the speaker to hear the syllable<br>
          — Score ${PASS_SCORE}+ to pass ✓
        </div>
        <button class="btn btn-primary btn-lg" id="ta-start">Start Test</button>
      </div>

      <!-- Quiz -->
      <div id="ta-quiz" class="hidden">
        <div class="progress-wrap">
          <div class="progress-info">
            <span id="ta-prog-label">Question 1 of ${TOTAL}</span>
            <span class="progress-score" id="ta-prog-score">Score: 0</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="ta-prog-fill" style="width:0%"></div>
          </div>
        </div>
        <div class="card animate-in" id="ta-card">
          <div class="question-label">Listen and identify the tone</div>
          <div class="audio-area">
            <button class="play-btn" id="ta-play"><div class="play-icon"></div></button>
            <div class="play-hint" id="ta-hint">Tap to listen</div>
          </div>
          <div class="choices" id="ta-choices"></div>
        </div>
      </div>

      <!-- Report -->
      <div id="ta-report" class="hidden"></div>
    </div>
    <div class="feedback-toast" id="ta-toast"></div>
  `

  // inject scoped styles
  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)

  // ── Bind ──
  const $ = (id) => document.getElementById(id)
  $('ta-start').addEventListener('click', startTest)
  $('ta-play').addEventListener('click', playCurrent)

  // ── Actions ──
  function startTest() {
    generate()
    currentQ = 0; score = 0; answers = []; testStart = Date.now()
    $('ta-intro').classList.add('hidden')
    $('ta-quiz').classList.remove('hidden')
    $('ta-report').classList.add('hidden')
    loadQ()
  }

  function loadQ() {
    answered = false
    qStart = Date.now()
    const q = questions[currentQ]

    $('ta-prog-label').textContent = `Question ${currentQ + 1} of ${TOTAL}`
    $('ta-prog-score').textContent = `Score: ${score}`
    $('ta-prog-fill').style.width = `${(currentQ / TOTAL) * 100}%`
    $('ta-hint').textContent = 'Tap to listen'
    $('ta-play').classList.remove('playing')

    // Build 4 choices in shuffled order
    const order = shuffle([1, 2, 3, 4])
    const letters = ['A', 'B', 'C', 'D']
    const toneNames = ['', '1st tone', '2nd tone', '3rd tone', '4th tone']
    const el = $('ta-choices')
    el.innerHTML = ''

    order.forEach((t, idx) => {
      const btn = document.createElement('button')
      btn.className = 'choice-btn'
      btn.dataset.tone = t
      btn.innerHTML = `
        <span class="choice-letter">${letters[idx]}</span>
        <span class="choice-pinyin">${applyTone(q.syllable, t)}</span>
        <span class="choice-tone">${toneNames[t]}</span>
      `
      btn.addEventListener('click', () => pick(t, btn))
      el.appendChild(btn)
    })

    // re-animate
    const card = $('ta-card')
    card.style.animation = 'none'
    card.offsetHeight
    card.style.animation = 'cardIn 0.4s ease-out'
  }

  function playCurrent() {
    const q = questions[currentQ]
    if (!q) return
    const btn = $('ta-play')
    btn.classList.add('playing')
    $('ta-hint').textContent = 'Listening…'
    playSyllable(q.syllable, q.tone, () => {
      btn.classList.remove('playing')
      $('ta-hint').textContent = 'Tap to replay'
    })
  }

  function pick(selected, btnEl) {
    if (answered) return
    answered = true
    const q = questions[currentQ]
    const ok = selected === q.tone
    if (ok) score++

    answers.push({
      syllable: q.syllable,
      tone: q.tone,
      selected,
      correct: ok,
      time: Date.now() - qStart,
    })

    // Highlight
    document.querySelectorAll('#ta-choices .choice-btn').forEach(b => {
      const t = parseInt(b.dataset.tone)
      if (t === q.tone) b.classList.add('correct')
      else if (t === selected && !ok) b.classList.add('incorrect')
      b.classList.add('disabled')
    })

    $('ta-prog-score').textContent = `Score: ${score}`
    showToast(ok)

    setTimeout(() => {
      currentQ++
      if (currentQ >= TOTAL) showReport()
      else loadQ()
    }, 1600)
  }

  function showToast(ok) {
    const t = $('ta-toast')
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
    $('ta-quiz').classList.add('hidden')
    const el = $('ta-report')
    el.classList.remove('hidden')

    const pct = Math.round((score / TOTAL) * 100)
    const passed = score >= PASS_SCORE
    const totalTime = Date.now() - testStart

    // Save result
    saveResult('A', score, TOTAL, { answers, totalTime })

    // Tone stats
    const toneColors = { 1:'var(--tone1)', 2:'var(--tone2)', 3:'var(--tone3)', 4:'var(--tone4)' }
    const toneNames = { 1:'1st (High)', 2:'2nd (Rising)', 3:'3rd (Dip)', 4:'4th (Fall)' }
    let toneRows = ''
    for (let t = 1; t <= 4; t++) {
      const qs = answers.filter(a => a.tone === t)
      const c = qs.filter(a => a.correct).length
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
      const icon = a.correct ? '✅' : '❌'
      const ts = (a.time / 1000).toFixed(1) + 's'
      const cp = applyTone(a.syllable, a.tone)
      const sp = applyTone(a.syllable, a.selected)
      const display = a.correct ? cp : `${sp} → ${cp}`
      details += `
        <div class="detail-item">
          <span class="detail-icon">${icon}</span>
          <span class="detail-qn">${i+1}.</span>
          <span class="detail-pinyin">${display}</span>
          <span class="detail-time">${ts}</span>
        </div>`
    })

    const verdict = passed
      ? `🎉 Excellent! You scored <strong>${score}/${TOTAL}</strong>. You can identify and distinguish the four tones competently! Now let's see if you can pronounce them like a native!`
      : `You scored <strong>${score}/${TOTAL}</strong>. It seems you have some work to do with your ears! Let's practice tone recognition.`

    el.innerHTML = `
      <div class="app-shell animate-in">
        <div class="text-center" style="margin-bottom:28px">
          <h2 style="font-size:1.5rem;margin-bottom:4px">Test A — Results</h2>
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
          <button class="btn btn-secondary" id="ta-retry">🔄 Retake</button>
          <button class="btn btn-primary" id="ta-continue">
            ${passed ? '→ Continue to Test C' : '→ Practice Tones'}
          </button>
        </div>
      </div>
    `

    document.getElementById('ta-retry').addEventListener('click', startTest)
    document.getElementById('ta-continue').addEventListener('click', () => {
      if (passed) {
        navigate('/test-c')
      } else {
        navigate('/practice-recognition')
      }
    })
  }
}

// ═══════════════════════════════════════
// Scoped CSS for Test A
// ═══════════════════════════════════════
const scopedCSS = `
  .testa-header {
    text-align: center;
    margin-bottom: 28px;
  }
  .testa-header h1 {
    font-size: 1.65rem;
    font-weight: 700;
    margin: 10px 0 6px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .testa-header p {
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

  /* Progress */
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

  /* Question card inner */
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

  /* Choices */
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
    background: var(--accent-glow);
    transform: translateY(-2px);
  }
  .choice-letter {
    display: block; font-size: 0.72rem; font-weight: 600;
    color: var(--text-muted); margin-bottom: 4px;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .choice-pinyin { font-size: 1.35rem; font-weight: 600; }
  .choice-tone { font-size: 0.72rem; color: var(--text-muted); margin-top: 4px; display: block; }
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

  .tone-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .tone-row:last-child { margin-bottom: 0; }
  .tone-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .tone-row-label { flex: 0 0 110px; font-size: 0.85rem; color: var(--text-secondary); }
  .tone-bar-track { flex: 1; height: 8px; background: var(--surface); border-radius: 4px; overflow: hidden; }
  .tone-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }
  .tone-row-pct { flex: 0 0 36px; text-align: right; font-size: 0.82rem; font-weight: 600; }

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
    .choices { gap: 10px; }
    .choice-btn { padding: 14px 8px; }
    .choice-pinyin { font-size: 1.15rem; }
    .play-btn { width: 80px; height: 80px; }
    .report-actions { flex-direction: column; }
    .tone-row-label { flex: 0 0 90px; }
  }
`