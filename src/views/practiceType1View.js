// ═══════════════════════════════════════════════════════════════════
// Practice Type I — Tone Recognition  (pptx slide 25)
//   "以下哪个是第三声?" / "Which one is the 3rd tone?" — minimal-pair ear training.
//   Goal (目标): train the ear to hear/distinguish tones, especially the 3rd (dip).
//   Round 1: minimal pairs   — tone 3 vs 1 / 2 / 4   (6 exercises)
//   Round 2: advanced triples — tone 3 among three    (6 exercises)
//   Listening only: the user hears the SAME syllable in different tones and
//   picks the one that is the 3rd tone (pinyin is hidden until they answer).
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { SYLLABLE_POOL, applyTone, shuffle, hasCharacter } from '../utils/pinyin.js'
import { playSyllable, stopAllAudio } from '../utils/audio.js'
import { hasRecording } from '../utils/recordingsManifest.js'

const TARGET = 3                 // the dip tone — the focus of Practice Type I
const TARGET_HINT = '∨ dip'

const PAIRS = [1, 2, 4, 1, 2, 4]                              // 3v1, 3v2, 3v4 ×2
const TRIPLES = [[1, 2], [1, 4], [2, 4], [1, 2], [1, 4], [2, 4]] // 3 always present

export function practiceType1View(container) {
  // Pick a syllable that actually has recordings for every tone we'll need.
  function pickSyllable(tones) {
    const strict = SYLLABLE_POOL.filter(s => tones.every(t => hasRecording(s, t) && hasCharacter(s, t)))
    const loose  = SYLLABLE_POOL.filter(s => tones.every(t => hasRecording(s, t)))
    return shuffle(strict.length ? strict : (loose.length ? loose : ['ma']))[0]
  }

  let items = []
  function build() {
    items = []
    PAIRS.forEach(d => {
      const tones = [TARGET, d]
      items.push({ syl: pickSyllable(tones), tones: shuffle(tones), round: 'Minimal pairs' })
    })
    TRIPLES.forEach(ds => {
      const tones = [TARGET, ...ds]
      items.push({ syl: pickSyllable(tones), tones: shuffle(tones), round: 'Advanced — three sounds' })
    })
  }
  build()
  const TOTAL = items.length

  let idx = 0, score = 0, selected = null, answered = false

  render()

  function render() {
    if (idx >= TOTAL) return renderDone()
    const q = items[idx]
    const correctIdx = q.tones.indexOf(TARGET)

    container.innerHTML = `
      <div class="app-shell shell-top-center">
        <div class="back-row"><button class="app-logo" id="p1-home">Just4Tones</button></div>

        <div class="p1-head">
          <div class="p1-progress">Exercise ${idx + 1} of ${TOTAL} · ${q.round}</div>
          <h1 class="p1-q">Which one is the <span class="p1-target">3rd tone</span>?</h1>
          <p class="p1-sub">Tap each sound to listen, then choose the <strong>3rd tone (${TARGET_HINT})</strong>.</p>
        </div>

        <div class="p1-options">
          ${q.tones.map((t, i) => `
            <button class="p1-opt" data-i="${i}">
              <span class="p1-opt-icon">🔊</span>
              <span class="p1-opt-label">Sound ${i + 1}</span>
            </button>`).join('')}
        </div>

        <div class="p1-feedback hidden" id="p1-feedback"></div>

        <button class="btn btn-primary btn-lg p1-action" id="p1-check" disabled>Check answer</button>
      </div>
    `
    inject()

    document.getElementById('p1-home').addEventListener('click', () => { stopAllAudio(); navigate('/') })

    const optEls = [...container.querySelectorAll('.p1-opt')]
    optEls.forEach(el => {
      el.addEventListener('click', () => {
        const i = +el.dataset.i
        stopAllAudio()
        playSyllable(q.syl, q.tones[i])
        if (answered) return // after answering, taps just replay
        selected = i
        optEls.forEach(o => o.classList.toggle('selected', +o.dataset.i === i))
        document.getElementById('p1-check').disabled = false
      })
    })

    const action = document.getElementById('p1-check')
    action.addEventListener('click', () => {
      if (!answered) {
        if (selected == null) return
        answered = true
        const ok = selected === correctIdx
        if (ok) score++

        optEls.forEach(o => {
          const i = +o.dataset.i
          o.classList.add('revealed')
          o.classList.remove('selected')
          const lbl = o.querySelector('.p1-opt-label')
          const py = applyTone(q.syl, q.tones[i])
          if (i === correctIdx) { o.classList.add('correct'); lbl.textContent = `${py} · 3rd tone ✓` }
          else if (i === selected) { o.classList.add('wrong'); lbl.textContent = `${py} ✗` }
          else { lbl.textContent = py }
        })

        const fb = document.getElementById('p1-feedback')
        fb.className = `p1-feedback ${ok ? 'good' : 'bad'}`
        fb.textContent = ok
          ? '✓ Correct — that was the 3rd tone.'
          : 'Not quite. Tap the green one — the 3rd tone dips low then rises.'
        action.textContent = idx + 1 >= TOTAL ? 'See results →' : 'Next →'
      } else {
        idx++; selected = null; answered = false
        render()
      }
    })
  }

  function renderDone() {
    const pct = Math.round((score / TOTAL) * 100)
    container.innerHTML = `
      <div class="app-shell shell-top-center">
        <div class="back-row"><button class="app-logo" id="p1-home">Just4Tones</button></div>
        <div class="p1-done card animate-in text-center">
          <div class="p1-done-emoji">${pct >= 80 ? '🎉' : pct >= 50 ? '👂' : '💪'}</div>
          <h1>Practice complete</h1>
          <p class="p1-done-score">${score} / ${TOTAL}</p>
          <p class="p1-done-msg">${pct >= 80
            ? 'Your ear is sharp — lovely tone discrimination!'
            : 'Great training. Keep drilling minimal pairs and the 3rd tone will start to pop out.'}</p>
          <button class="btn btn-primary btn-lg" id="p1-next">Next: Speaking practice →</button>
          <button class="btn-link p1-done-home" id="p1-again">Practice again</button>
          <button class="btn-link p1-done-home" id="p1-back">Back to home</button>
        </div>
      </div>
    `
    inject()
    document.getElementById('p1-home').addEventListener('click', () => navigate('/'))
    document.getElementById('p1-next').addEventListener('click', () => navigate('/practice-2'))
    document.getElementById('p1-back').addEventListener('click', () => navigate('/'))
    document.getElementById('p1-again').addEventListener('click', () => {
      idx = 0; score = 0; selected = null; answered = false; build(); render()
    })
  }

  function inject() {
    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)
  }

  // Cleanup on unmount — stop any playing audio.
  return () => stopAllAudio()
}

const scopedCSS = `
  .p1-head { text-align: center; margin-bottom: 26px; }
  .p1-progress {
    font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--text-muted); margin-bottom: 12px;
  }
  .p1-q { font-size: 1.6rem; font-weight: 700; margin-bottom: 8px; }
  .p1-target { color: var(--accent); }
  .p1-sub { color: var(--text-secondary); font-size: 0.92rem; line-height: 1.5; margin: 0 8px; }
  .p1-sub strong { color: var(--text-primary); }

  .p1-options { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; }
  .p1-opt {
    display: flex; align-items: center; gap: 14px;
    padding: 18px 20px;
    background: var(--card-bg);
    border: 1.5px solid var(--card-border);
    border-radius: var(--radius);
    color: var(--text-primary);
    font-family: inherit; font-size: 1rem; font-weight: 600;
    cursor: pointer; transition: border-color 0.18s, background 0.18s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }
  .p1-opt:active:not(.revealed) { transform: scale(0.99); }
  .p1-opt:hover:not(.revealed) { border-color: var(--accent); }
  .p1-opt.selected:not(.revealed) { border-color: var(--accent); background: var(--accent-glow); }
  .p1-opt-icon { font-size: 1.5rem; flex-shrink: 0; }
  .p1-opt.revealed { cursor: pointer; }
  .p1-opt.correct { border-color: var(--correct); background: var(--correct-bg); }
  .p1-opt.wrong { border-color: var(--incorrect); background: var(--incorrect-bg); }

  .p1-feedback {
    padding: 12px 16px; border-radius: var(--radius-sm);
    font-size: 0.92rem; line-height: 1.5; margin-bottom: 16px;
  }
  .p1-feedback.good { background: var(--correct-bg); color: var(--correct); }
  .p1-feedback.bad { background: var(--incorrect-bg); color: var(--incorrect); }

  .p1-action { width: 100%; }
  .p1-action:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

  .p1-done { padding: 32px 24px; }
  .p1-done-emoji { font-size: 3rem; margin-bottom: 8px; }
  .p1-done h1 { font-size: 1.5rem; margin-bottom: 10px; }
  .p1-done-score { font-size: 2.2rem; font-weight: 700; color: var(--accent); margin-bottom: 8px; }
  .p1-done-msg { color: var(--text-secondary); line-height: 1.55; margin-bottom: 22px; }
  .p1-done .btn-primary { width: 100%; }
  .p1-done-home { margin-top: 14px; display: inline-block; }
`
