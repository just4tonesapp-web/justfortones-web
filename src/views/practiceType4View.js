// ═══════════════════════════════════════════════════════════════════
// Practice Type IV — Polyphones (多音字)  · team feature spec 2026-09-02
//   Same two-page shape as Practice III (tone changes): an intro page
//   explaining the concept, then a 12-item multiple-choice test — which
//   reading does the highlighted character take in this phrase?
//   Audio demo via browser zh-CN TTS (reading the whole phrase naturally
//   produces the correct pronunciation), AFTER answering, like Practice III.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { shuffle } from '../utils/pinyin.js'
import { speakChinese, stopAllAudio } from '../utils/audio.js'
import { POLYPHONES } from '../utils/polyphoneWords.js'
import { saveResult } from '../services/progressService.js'

const TOTAL = 12

export function practiceType4View(container) {
  let stage = 'intro'
  let qs = buildSession()
  let idx = 0, score = 0, answered = false

  // 12 questions, at most one per character, so a session covers 12 different
  // polyphones and repeat runs see different phrases.
  function buildSession() {
    const byChar = new Map()
    for (const q of shuffle([...POLYPHONES])) {
      if (!byChar.has(q.char)) byChar.set(q.char, q)
    }
    return shuffle([...byChar.values()]).slice(0, TOTAL)
  }

  renderIntro()

  function renderIntro() {
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p4-home">Just4Tones</button></div>
        <div class="p4-head">
          <h1 class="p4-title">Polyphones 多音字</h1>
          <p class="p4-sub">Some characters change their reading with their meaning.</p>
        </div>
        <div class="card p4-rules">
          <div class="p4-rule">
            <div class="p4-rule-title">One character, several readings</div>
            <p>The same character can be pronounced differently depending on what it means in the phrase. Take <strong>得</strong>:</p>
            <p class="p4-eg">我<strong>得</strong>去 → <em>děi</em> (must) &nbsp;·&nbsp; <strong>得</strong>到 → <em>dé</em> (obtain) &nbsp;·&nbsp; 跑<strong>得</strong>快 → <em>de</em> (particle)</p>
            <p>Read the phrase, decide the meaning, and the reading follows.</p>
          </div>
          <p class="p4-ready">Ready to test your polyphone knowledge?</p>
          <button class="btn btn-primary btn-lg p4-start" id="p4-start">Start the test →</button>
        </div>
      </div>
    `
    inject()
    document.getElementById('p4-home').addEventListener('click', () => { stopAllAudio(); navigate('/') })
    document.getElementById('p4-start').addEventListener('click', () => {
      stage = 'test'; idx = 0; score = 0; answered = false; render()
    })
  }

  function render() {
    if (idx >= qs.length) return renderDone()
    const q = qs[idx]
    const marked = q.phrase.replace(q.char, `<span class="p4-target">${q.char}</span>`)
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p4-home">Just4Tones</button></div>
        <div class="p4-head">
          <div class="p4-progress">Question ${idx + 1} of ${qs.length}</div>
          <div class="p4-word">${marked}</div>
          <p class="p4-gloss">${q.gloss}</p>
          <p class="p4-q">How is <strong>${q.char}</strong> pronounced here?</p>
        </div>
        <div class="p4-options">
          ${q.options.map((o, i) => `<button class="p4-opt" data-i="${i}">${o}</button>`).join('')}
        </div>
        <div class="p4-feedback hidden" id="p4-feedback"></div>
        <button class="btn btn-primary btn-lg p4-next hidden" id="p4-next">Next →</button>
      </div>
    `
    inject()
    document.getElementById('p4-home').addEventListener('click', () => { stopAllAudio(); navigate('/') })

    const optEls = [...container.querySelectorAll('.p4-opt')]
    optEls.forEach(el => el.addEventListener('click', () => {
      if (answered) return
      answered = true
      const sel = +el.dataset.i
      const ok = sel === q.correct
      if (ok) score++
      optEls.forEach(o => {
        const i = +o.dataset.i
        o.classList.add('revealed')
        if (i === q.correct) o.classList.add('correct')
        else if (i === sel) o.classList.add('wrong')
      })
      const fb = document.getElementById('p4-feedback')
      fb.className = `p4-feedback ${ok ? 'good' : 'bad'}`
      fb.innerHTML = `${ok ? '✓ Correct!' : '✗ Not quite.'} It's <strong>${q.options[q.correct]}</strong>. ${q.why}
        <button class="p4-hear" id="p4-hear">🔊 Hear it</button>`
      document.getElementById('p4-hear').addEventListener('click', () => speakChinese(q.phrase, 1))
      const next = document.getElementById('p4-next')
      next.classList.remove('hidden')
      next.textContent = idx + 1 >= qs.length ? 'See results →' : 'Next →'
    }))

    document.getElementById('p4-next').addEventListener('click', () => { stopAllAudio(); idx++; answered = false; render() })
  }

  function renderDone() {
    const pct = Math.round((score / qs.length) * 100)
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p4-home">Just4Tones</button></div>
        <div class="p4-done card animate-in text-center">
          <div class="p4-done-emoji">${pct >= 80 ? '🎉' : '📖'}</div>
          <h1>Polyphone test complete</h1>
          <p class="p4-done-score">${score} / ${qs.length}</p>
          <p class="p4-done-msg">${pct >= 80 ? 'You read meanings, not just characters — well done!' : 'Meaning decides the reading — review and try another round.'}</p>
          <button class="btn btn-primary btn-lg" id="p4-again">Take it again (new phrases)</button>
          <button class="btn-link p4-done-home" id="p4-rules">Review the idea</button>
          <button class="btn-link p4-done-home" id="p4-back">Back to home</button>
        </div>
      </div>
    `
    inject()
    document.getElementById('p4-home').addEventListener('click', () => navigate('/'))
    document.getElementById('p4-back').addEventListener('click', () => navigate('/'))
    document.getElementById('p4-rules').addEventListener('click', () => { stage = 'intro'; qs = buildSession(); renderIntro() })
    document.getElementById('p4-again').addEventListener('click', () => { qs = buildSession(); idx = 0; score = 0; answered = false; render() })

    // Persist AFTER the UI is on screen — a save error must never eat the page.
    saveResult('P4', score, qs.length, {})
  }

  function inject() {
    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)
  }

  return () => stopAllAudio()
}

const scopedCSS = `
  .p4-head { text-align: center; margin-bottom: 18px; }
  .p4-title {
    font-size: 1.55rem; font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .p4-sub { color: var(--text-secondary); font-size: 0.9rem; margin-top: 6px; }

  .p4-rules { padding: 22px 20px; }
  .p4-rule-title { font-weight: 700; margin-bottom: 8px; color: var(--accent); }
  .p4-rule p { font-size: 0.92rem; line-height: 1.6; color: var(--text-primary); margin-bottom: 8px; }
  .p4-eg { background: var(--surface); border-radius: var(--radius-sm); padding: 10px 12px; }
  .p4-ready { text-align: center; font-weight: 600; margin: 18px 0 12px; }
  .p4-start { width: 100%; }

  .p4-progress { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 12px; }
  .p4-word { font-size: 2.4rem; font-weight: 700; line-height: 1.3; font-family: 'Noto Sans SC', sans-serif; }
  .p4-target { color: var(--accent); }
  .p4-gloss { color: var(--text-muted); font-size: 0.85rem; margin-top: 4px; }
  .p4-q { color: var(--text-secondary); font-size: 0.95rem; margin-top: 12px; }

  .p4-options { display: flex; gap: 10px; justify-content: center; margin-bottom: 14px; }
  .p4-opt {
    min-width: 90px; padding: 14px 18px;
    background: var(--surface); border: 2px solid var(--card-border); border-radius: var(--radius-sm);
    font-family: inherit; font-size: 1.15rem; font-weight: 600; color: var(--text-primary);
    cursor: pointer; transition: all 0.18s;
  }
  .p4-opt:hover:not(.revealed) { border-color: var(--accent); transform: translateY(-2px); }
  .p4-opt.correct { border-color: var(--correct); background: var(--correct-bg); color: var(--correct); }
  .p4-opt.wrong { border-color: var(--incorrect); background: var(--incorrect-bg); color: var(--incorrect); }
  .p4-opt.revealed { cursor: default; }

  .p4-feedback { border-radius: var(--radius-sm); padding: 12px 14px; font-size: 0.92rem; line-height: 1.55; margin-bottom: 12px; }
  .p4-feedback.good { background: var(--correct-bg); color: var(--text-primary); }
  .p4-feedback.bad { background: var(--incorrect-bg); color: var(--text-primary); }
  .p4-hear {
    display: inline-block; margin-left: 8px;
    background: var(--surface); border: 1px solid var(--card-border); border-radius: 16px;
    padding: 4px 12px; font-family: inherit; font-size: 0.82rem; color: var(--text-primary); cursor: pointer;
  }
  .p4-hear:hover { border-color: var(--accent); color: var(--accent); }
  .p4-next { width: 100%; }

  .p4-done { padding: 32px 24px; }
  .p4-done-emoji { font-size: 3rem; margin-bottom: 8px; }
  .p4-done h1 { font-size: 1.4rem; margin-bottom: 8px; }
  .p4-done-score { font-size: 2.2rem; font-weight: 700; color: var(--accent); margin-bottom: 8px; }
  .p4-done-msg { color: var(--text-secondary); line-height: 1.55; margin-bottom: 20px; }
  .p4-done .btn-primary { width: 100%; }
  .p4-done-home { margin-top: 12px; margin-right: 10px; display: inline-block; }
`
