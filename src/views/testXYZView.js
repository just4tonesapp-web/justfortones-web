// ═══════════════════════════════════════
// Test XYZ – Character Tone Knowledge
// (3 rounds × 12 items from top 50 chars)
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { saveResult } from '../services/progressService.js'

const TOTAL = 12
const PASS_SCORE = 10
const ROUNDS = 3
const ROUND_LABELS = ['X', 'Y', 'Z']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const CHAR_POOL = [
  { char: '一', base: 'yi', tone: 1, meaning: 'one' },
  { char: '不', base: 'bu', tone: 4, meaning: 'not' },
  { char: '是', base: 'shi', tone: 4, meaning: 'is' },
  { char: '了', base: 'le', tone: 5, meaning: '(particle)' },
  { char: '在', base: 'zai', tone: 4, meaning: 'at/in' },
  { char: '有', base: 'you', tone: 3, meaning: 'have' },
  { char: '我', base: 'wo', tone: 3, meaning: 'I/me' },
  { char: '他', base: 'ta', tone: 1, meaning: 'he' },
  { char: '这', base: 'zhe', tone: 4, meaning: 'this' },
  { char: '中', base: 'zhong', tone: 1, meaning: 'middle' },
  { char: '上', base: 'shang', tone: 4, meaning: 'up/on' },
  { char: '们', base: 'men', tone: 5, meaning: '(plural)' },
  { char: '来', base: 'lai', tone: 2, meaning: 'come' },
  { char: '到', base: 'dao', tone: 4, meaning: 'arrive' },
  { char: '说', base: 'shuo', tone: 1, meaning: 'speak' },
  { char: '和', base: 'he', tone: 2, meaning: 'and' },
  { char: '地', base: 'di', tone: 4, meaning: 'earth' },
  { char: '出', base: 'chu', tone: 1, meaning: 'go out' },
  { char: '道', base: 'dao', tone: 4, meaning: 'way/road' },
  { char: '也', base: 'ye', tone: 3, meaning: 'also' },
  { char: '时', base: 'shi', tone: 2, meaning: 'time' },
  { char: '年', base: 'nian', tone: 2, meaning: 'year' },
  { char: '得', base: 'de', tone: 2, meaning: 'get' },
  { char: '就', base: 'jiu', tone: 4, meaning: 'then' },
  { char: '那', base: 'na', tone: 4, meaning: 'that' },
  { char: '要', base: 'yao', tone: 4, meaning: 'want' },
  { char: '下', base: 'xia', tone: 4, meaning: 'down' },
  { char: '以', base: 'yi', tone: 3, meaning: 'with/by' },
  { char: '生', base: 'sheng', tone: 1, meaning: 'life/born' },
  { char: '会', base: 'hui', tone: 4, meaning: 'can/will' },
  { char: '自', base: 'zi', tone: 4, meaning: 'self' },
  { char: '着', base: 'zhe', tone: 5, meaning: '(particle)' },
  { char: '去', base: 'qu', tone: 4, meaning: 'go' },
  { char: '之', base: 'zhi', tone: 1, meaning: 'of' },
  { char: '过', base: 'guo', tone: 4, meaning: 'pass' },
  { char: '后', base: 'hou', tone: 4, meaning: 'after' },
  { char: '从', base: 'cong', tone: 2, meaning: 'from' },
  { char: '里', base: 'li', tone: 3, meaning: 'inside' },
  { char: '人', base: 'ren', tone: 2, meaning: 'person' },
  { char: '能', base: 'neng', tone: 2, meaning: 'can' },
  { char: '大', base: 'da', tone: 4, meaning: 'big' },
  { char: '对', base: 'dui', tone: 4, meaning: 'correct' },
  { char: '多', base: 'duo', tone: 1, meaning: 'many' },
  { char: '国', base: 'guo', tone: 2, meaning: 'country' },
  { char: '经', base: 'jing', tone: 1, meaning: 'already' },
  { char: '家', base: 'jia', tone: 1, meaning: 'home' },
  { char: '两', base: 'liang', tone: 3, meaning: 'two' },
  { char: '没', base: 'mei', tone: 2, meaning: 'not have' },
  { char: '所', base: 'suo', tone: 3, meaning: 'place' },
  { char: '个', base: 'ge', tone: 4, meaning: 'measure word' },
]

const TONE_CHOICES = [
  { value: 5, label: 'Neutral (轻声)' },
  { value: 1, label: '1st tone (一声)' },
  { value: 2, label: '2nd tone (二声)' },
  { value: 3, label: '3rd tone (三声)' },
  { value: 4, label: '4th tone (四声)' },
]

const TONE_NAMES = {
  1: '1st (High)',
  2: '2nd (Rising)',
  3: '3rd (Dip)',
  4: '4th (Fall)',
  5: 'Neutral',
}

const TONE_COLORS = {
  1: 'var(--tone1)',
  2: 'var(--tone2)',
  3: 'var(--tone3)',
  4: 'var(--tone4)',
  5: 'var(--text-muted)',
}

function toneLabel(t) {
  const labels = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: 'Neutral' }
  return labels[t] || ''
}

export function testXYZView(container) {
  // ── State ──
  let round = 0
  let questions = []
  let currentQ = 0
  let score = 0
  let answered = false
  let answers = []
  let qStart = 0
  let testStart = 0
  let usedIndices = []  // track chars used across rounds
  let roundScores = []  // scores for each round
  let allAnswers = []   // answers across all rounds

  // ── Generate 12 questions for current round ──
  function generate() {
    const available = CHAR_POOL.map((c, i) => i).filter(i => !usedIndices.includes(i))
    const picked = shuffle(available).slice(0, TOTAL)
    usedIndices.push(...picked)
    questions = picked.map(i => ({ ...CHAR_POOL[i] }))
  }

  // ── Mount ──
  container.innerHTML = `
    <div class="app-shell">
      <div class="txyz-header">
        <span class="badge">Diagnostic Step 3</span>
        <h1>Tests X, Y, Z — Character Tones</h1>
        <p>Do you know the tones of the following characters?</p>
      </div>

      <!-- Intro -->
      <div id="txyz-intro" class="card animate-in text-center">
        <div style="font-size:3rem;margin-bottom:16px">📝</div>
        <h2>Character Tone Knowledge</h2>
        <p style="color:var(--text-secondary);margin:12px 0;line-height:1.6">
          You'll see 36 characters from the top 50 most frequently used<br>
          Chinese characters, split into 3 rounds of 12.
        </p>
        <div class="intro-rules">
          <strong>How it works:</strong><br>
          — 3 rounds (X, Y, Z), 12 questions each<br>
          — Each question shows a character and its pinyin base<br>
          — Pick the correct tone (neutral, 1st, 2nd, 3rd, or 4th)<br>
          — Score ${PASS_SCORE}+ on ALL three rounds to pass ✓
        </div>
        <button class="btn btn-primary btn-lg" id="txyz-start">Start Test</button>
      </div>

      <!-- Quiz -->
      <div id="txyz-quiz" class="hidden">
        <div class="progress-wrap">
          <div class="progress-info">
            <span id="txyz-prog-label">Round X — Question 1 of ${TOTAL}</span>
            <span class="progress-score" id="txyz-prog-score">Score: 0</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="txyz-prog-fill" style="width:0%"></div>
          </div>
        </div>
        <div class="card animate-in" id="txyz-card">
          <div class="question-label">What tone is this character?</div>
          <div class="char-area">
            <div class="char-display" id="txyz-char"></div>
            <div class="char-base" id="txyz-base"></div>
          </div>
          <div class="tone-choices" id="txyz-choices"></div>
        </div>
      </div>

      <!-- Round Report -->
      <div id="txyz-round-report" class="hidden"></div>

      <!-- Final Report -->
      <div id="txyz-report" class="hidden"></div>
    </div>
    <div class="feedback-toast" id="txyz-toast"></div>
  `

  // inject scoped styles
  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)

  // ── Bind ──
  const $ = (id) => document.getElementById(id)
  $('txyz-start').addEventListener('click', startTest)

  // ── Actions ──
  function startTest() {
    round = 0
    usedIndices = []
    roundScores = []
    allAnswers = []
    $('txyz-intro').classList.add('hidden')
    $('txyz-report').classList.add('hidden')
    $('txyz-round-report').classList.add('hidden')
    startRound()
  }

  function startRound() {
    generate()
    currentQ = 0
    score = 0
    answers = []
    testStart = Date.now()
    $('txyz-quiz').classList.remove('hidden')
    $('txyz-round-report').classList.add('hidden')
    $('txyz-report').classList.add('hidden')
    loadQ()
  }

  function loadQ() {
    answered = false
    qStart = Date.now()
    const q = questions[currentQ]
    const label = ROUND_LABELS[round]

    $('txyz-prog-label').textContent = `Round ${label} — Question ${currentQ + 1} of ${TOTAL}`
    $('txyz-prog-score').textContent = `Score: ${score}`
    $('txyz-prog-fill').style.width = `${(currentQ / TOTAL) * 100}%`

    $('txyz-char').textContent = q.char
    $('txyz-base').textContent = q.base

    // Build 5 tone choices
    const el = $('txyz-choices')
    el.innerHTML = ''

    TONE_CHOICES.forEach((tc) => {
      const btn = document.createElement('button')
      btn.className = 'tone-choice-btn'
      btn.dataset.tone = tc.value
      btn.textContent = tc.label
      btn.addEventListener('click', () => pick(tc.value, btn))
      el.appendChild(btn)
    })

    // re-animate
    const card = $('txyz-card')
    card.style.animation = 'none'
    card.offsetHeight
    card.style.animation = 'cardIn 0.4s ease-out'
  }

  function pick(selected, btnEl) {
    if (answered) return
    answered = true
    const q = questions[currentQ]
    const ok = selected === q.tone
    if (ok) score++

    answers.push({
      char: q.char,
      base: q.base,
      meaning: q.meaning,
      tone: q.tone,
      selected,
      correct: ok,
      time: Date.now() - qStart,
    })

    // Highlight
    document.querySelectorAll('#txyz-choices .tone-choice-btn').forEach(b => {
      const t = parseInt(b.dataset.tone)
      if (t === q.tone) b.classList.add('correct')
      else if (t === selected && !ok) b.classList.add('incorrect')
      b.classList.add('disabled')
    })

    $('txyz-prog-score').textContent = `Score: ${score}`
    showToast(ok)

    setTimeout(() => {
      currentQ++
      if (currentQ >= TOTAL) finishRound()
      else loadQ()
    }, 1600)
  }

  function showToast(ok) {
    const t = $('txyz-toast')
    t.className = 'feedback-toast'
    const msgs = ok
      ? ['Correct! ✓', 'Nice! ✓', 'Spot on! ✓', 'Perfect! ✓']
      : ['Not quite ✗', 'Try next time ✗', 'Almost! ✗']
    t.textContent = msgs[Math.floor(Math.random() * msgs.length)]
    t.classList.add(ok ? 'correct' : 'incorrect')
    requestAnimationFrame(() => t.classList.add('show'))
    setTimeout(() => t.classList.remove('show'), 1200)
  }

  function finishRound() {
    const label = ROUND_LABELS[round]
    saveResult(label, score, TOTAL)
    roundScores.push(score)
    allAnswers.push([...answers])
    round++

    $('txyz-quiz').classList.add('hidden')

    if (round < ROUNDS) {
      showRoundReport()
    } else {
      showFinalReport()
    }
  }

  // ── Round Report (between rounds) ──
  function showRoundReport() {
    const el = $('txyz-round-report')
    el.classList.remove('hidden')

    const prevLabel = ROUND_LABELS[round - 1]
    const nextLabel = ROUND_LABELS[round]
    const prevScore = roundScores[round - 1]
    const pct = Math.round((prevScore / TOTAL) * 100)
    const prevAnswers = allAnswers[round - 1]
    const passed = prevScore >= PASS_SCORE

    const toneRows = buildToneRows(prevAnswers)
    const details = buildDetails(prevAnswers)

    el.innerHTML = `
      <div class="app-shell animate-in">
        <div class="text-center" style="margin-bottom:28px">
          <h2 style="font-size:1.5rem;margin-bottom:4px">Round ${prevLabel} — Results</h2>
          <div class="score-ring" style="--pct:${pct}">
            <span class="score-num">${prevScore}/${TOTAL}</span>
            <span class="score-label">${pct}%</span>
          </div>
          <div style="color:var(--text-secondary);line-height:1.5;padding:0 12px">
            ${passed
              ? `Great job on Round ${prevLabel}! You scored <strong>${prevScore}/${TOTAL}</strong>.`
              : `You scored <strong>${prevScore}/${TOTAL}</strong> on Round ${prevLabel}. Keep going!`
            }
          </div>
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
          <button class="btn btn-primary btn-lg" id="txyz-next-round" style="width:100%">
            → Continue to Round ${nextLabel}
          </button>
        </div>
      </div>
    `

    document.getElementById('txyz-next-round').addEventListener('click', () => {
      el.classList.add('hidden')
      startRound()
    })
  }

  // ── Final Report ──
  function showFinalReport() {
    const el = $('txyz-report')
    el.classList.remove('hidden')

    const totalScore = roundScores.reduce((a, b) => a + b, 0)
    const totalQuestions = TOTAL * ROUNDS
    const pct = Math.round((totalScore / totalQuestions) * 100)
    const passedAll = roundScores.every(s => s >= PASS_SCORE)

    // Combined answers for tone breakdown
    const combined = allAnswers.flat()
    const toneRows = buildToneRows(combined)

    // Round summary cards
    let roundCards = ''
    ROUND_LABELS.forEach((label, i) => {
      const s = roundScores[i]
      const p = Math.round((s / TOTAL) * 100)
      const pass = s >= PASS_SCORE
      const details = buildDetails(allAnswers[i])
      roundCards += `
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 class="section-head" style="margin-bottom:0">Round ${label}</h3>
            <span class="round-badge ${pass ? 'pass' : 'fail'}">${s}/${TOTAL} ${pass ? '✓' : '✗'}</span>
          </div>
          ${details}
        </div>`
    })

    const verdict = passedAll
      ? `🎉 Wow you know the tones of the most frequently used Chinese characters well! Let's see if you can pronounce them in sentences!`
      : `You scored <strong>${totalScore}/${totalQuestions}</strong> overall. Let's work on the tones of the most frequently used Chinese characters. Do you know the top 50 frequently used Chinese characters cover 60% of all texts that are written in Chinese?`

    el.innerHTML = `
      <div class="app-shell animate-in">
        <div class="text-center" style="margin-bottom:28px">
          <h2 style="font-size:1.5rem;margin-bottom:4px">Tests X, Y, Z — Final Results</h2>
          <div class="score-ring" style="--pct:${pct}">
            <span class="score-num">${totalScore}/${totalQuestions}</span>
            <span class="score-label">${pct}%</span>
          </div>
          <div style="color:var(--text-secondary);line-height:1.5;padding:0 12px">${verdict}</div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <h3 class="section-head">Overall Tone Breakdown</h3>
          ${toneRows}
        </div>

        ${roundCards}

        <div class="report-actions">
          <button class="btn btn-secondary" id="txyz-retry">🔄 Retake</button>
          <button class="btn btn-primary" id="txyz-continue">
            ${passedAll ? '→ Practice Sentences' : '→ Practice Characters'}
          </button>
        </div>
      </div>
    `

    document.getElementById('txyz-retry').addEventListener('click', startTest)
    document.getElementById('txyz-continue').addEventListener('click', () => {
      navigate('/practice-characters')
    })
  }

  // ── Helpers ──
  function buildToneRows(answerList) {
    let rows = ''
    const tones = [1, 2, 3, 4, 5]
    tones.forEach(t => {
      const qs = answerList.filter(a => a.tone === t)
      if (qs.length === 0) return
      const c = qs.filter(a => a.correct).length
      const p = Math.round(c / qs.length * 100)
      const color = TONE_COLORS[t]
      rows += `
        <div class="tone-row">
          <div class="tone-dot" style="background:${color}"></div>
          <div class="tone-row-label">${TONE_NAMES[t]}</div>
          <div class="tone-bar-track"><div class="tone-bar-fill" style="width:${p}%;background:${color}"></div></div>
          <div class="tone-row-pct" style="color:${color}">${p}%</div>
        </div>`
    })
    return rows
  }

  function buildDetails(answerList) {
    let details = ''
    answerList.forEach((a, i) => {
      const icon = a.correct ? '✅' : '❌'
      const ts = (a.time / 1000).toFixed(1) + 's'
      const correctLabel = toneLabel(a.tone)
      const selectedLabel = toneLabel(a.selected)
      const display = a.correct
        ? `${a.char} (${correctLabel})`
        : `${a.char} ${selectedLabel} → ${correctLabel}`
      details += `
        <div class="detail-item">
          <span class="detail-icon">${icon}</span>
          <span class="detail-qn">${i + 1}.</span>
          <span class="detail-pinyin">${display}</span>
          <span class="detail-time">${ts}</span>
        </div>`
    })
    return details
  }
}

// ═══════════════════════════════════════
// Scoped CSS for Test XYZ
// ═══════════════════════════════════════
const scopedCSS = `
  .txyz-header {
    text-align: center;
    margin-bottom: 28px;
  }
  .txyz-header h1 {
    font-size: 1.65rem;
    font-weight: 700;
    margin: 10px 0 6px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .txyz-header p {
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

  /* Character display */
  .char-area {
    display: flex; flex-direction: column;
    align-items: center; margin-bottom: 28px;
  }
  .char-display {
    font-size: 4rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--text-primary);
  }
  .char-base {
    font-size: 1.1rem;
    color: var(--text-secondary);
    margin-top: 8px;
    font-style: italic;
  }

  /* Question card inner */
  .question-label {
    text-align: center; font-size: 0.85rem;
    color: var(--text-muted); margin-bottom: 20px;
  }

  /* Tone choices (5 in a column) */
  .tone-choices {
    display: flex; flex-direction: column; gap: 10px;
  }
  .tone-choice-btn {
    background: var(--surface);
    border: 2px solid var(--card-border);
    border-radius: var(--radius-sm);
    padding: 14px 20px;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s ease;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-primary);
  }
  .tone-choice-btn:hover:not(.disabled) {
    border-color: var(--accent);
    background: var(--accent-glow);
    transform: translateY(-2px);
  }
  .tone-choice-btn.correct {
    border-color: var(--correct);
    background: var(--correct-bg);
    color: var(--correct);
  }
  .tone-choice-btn.incorrect {
    border-color: var(--incorrect);
    background: var(--incorrect-bg);
    color: var(--incorrect);
  }
  .tone-choice-btn.disabled { cursor: default; opacity: 0.55; }
  .tone-choice-btn.correct.disabled,
  .tone-choice-btn.incorrect.disabled { opacity: 1; }

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

  .round-badge {
    font-size: 0.82rem; font-weight: 600; padding: 4px 12px;
    border-radius: var(--radius-sm);
  }
  .round-badge.pass { background: var(--correct-bg); color: var(--correct); }
  .round-badge.fail { background: var(--incorrect-bg); color: var(--incorrect); }

  .report-actions { display: flex; gap: 12px; }

  @media (max-width: 480px) {
    .tone-choice-btn { padding: 12px 16px; font-size: 0.92rem; }
    .char-display { font-size: 3.2rem; }
    .report-actions { flex-direction: column; }
    .tone-row-label { flex: 0 0 90px; }
  }
`
