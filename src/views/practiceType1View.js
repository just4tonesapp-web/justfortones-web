// ═══════════════════════════════════════════════════════════════════
// Practice Type I — Tone Recognition  (pptx slide 25)
//   Goal (目标): train the ear to hear/distinguish tones.
//   Two SEPARATE 6-question practices the learner picks via buttons:
//     • 1-syllable words — minimal pairs, "which sound is the Nth tone?"
//     • 2-syllable words — hear the word, pick the tone pattern.
//   Each is its own group of 6 (shown as "1 of 6", not a combined 1 of 12),
//   and adapts to the diagnostic's weakest tone.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { SYLLABLE_POOL, applyTone, shuffle, hasCharacter } from '../utils/pinyin.js'
import { playSyllable, playDisyllable, stopAllAudio } from '../utils/audio.js'
import { hasRecording } from '../utils/recordingsManifest.js'
import { DISYLLABLE_BY_PAIR } from '../utils/disyllableManifest.js'

const ORD = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' }
const TONE_HINT = { 1: '─ high & flat', 2: '／ rising', 3: '∨ dip', 4: '＼ falling' }
const ROUND = 6 // each practice is a group of 6

export function practiceType1View(container) {
  // Adaptive (feedback-based): drill the tone the diagnostic flagged as weakest.
  const focus = +sessionStorage.getItem('j4t_focus_tone')
  const adaptive = [1, 2, 3, 4].includes(focus)
  const TARGET = adaptive ? focus : 3
  const TARGET_HINT = TONE_HINT[TARGET]
  const FOCUS_BADGE = adaptive ? `<div class="prac-focus">🎯 Targeting your <strong>${ORD[TARGET]} tone</strong></div>` : ''

  function pickSyllable(tones) {
    // ALWAYS require a real character — never fall back to combos like bei2 / "_x"
    // that have a recording but aren't real Chinese syllables.
    const cand = SYLLABLE_POOL.filter(s => tones.every(t => hasRecording(s, t) && hasCharacter(s, t)))
    return shuffle(cand.length ? cand : ['ma'])[0]
  }
  // 4 tone-pattern choices for a 2-syllable word (correct + 3 distractors; skip 3+3).
  function pairChoices(t1, t2) {
    const all = []
    for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) {
      if (a === 3 && b === 3) continue
      if (a !== t1 || b !== t2) all.push({ t1: a, t2: b })
    }
    return shuffle([{ t1, t2 }, ...shuffle(all).slice(0, 3)])
  }

  // ── 1-syllable set: 6 minimal pairs (target tone vs the other three, ×2) ──
  function buildSingle() {
    const others = [1, 2, 3, 4].filter(t => t !== TARGET)
    return shuffle([...others, ...others]).slice(0, ROUND).map(d => {
      const tones = [TARGET, d]
      return { type: 'single', syl: pickSyllable(tones), tones: shuffle(tones) }
    })
  }
  // ── 2-syllable set: 6 words, preferring ones that contain the focus tone ──
  function buildPair() {
    const keys = Object.keys(DISYLLABLE_BY_PAIR).filter(k => (DISYLLABLE_BY_PAIR[k] || []).length)
    const focusKeys = keys.filter(k => +k[0] === TARGET || +k[1] === TARGET)
    return shuffle(focusKeys.length >= ROUND ? focusKeys : keys).slice(0, ROUND).map(k => {
      const e = shuffle(DISYLLABLE_BY_PAIR[k])[0]
      const t1 = +k[0], t2 = +k[1]
      return { type: 'pair', syl1: e.syl1, syl2: e.syl2, t1, t2, choices: pairChoices(t1, t2) }
    })
  }

  let mode = null // null = chooser · 'single' · 'pair'
  let items = []
  let idx = 0, score = 0, selected = null, answered = false
  const completed = { single: false, pair: false }

  renderChooser()

  function start(m) {
    mode = m
    items = m === 'single' ? buildSingle() : buildPair()
    idx = 0; score = 0; selected = null; answered = false
    render()
  }

  function render() {
    if (idx >= items.length) return renderDone()
    selected = null; answered = false
    const q = items[idx]
    if (q.type === 'single') renderSingle(q)
    else renderPair(q)
  }

  // ── Chooser: pick the 1-syllable or 2-syllable practice ──
  function renderChooser() {
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p1-home">Just4Tones</button></div>
        ${FOCUS_BADGE}
        <div class="p1-head">
          <h1 class="p1-q">Tone Recognition</h1>
          <p class="p1-sub">Train your ear. Pick a set — each is 6 quick listening exercises.</p>
        </div>
        <div class="p1-modes">
          <button class="p1-mode" id="p1-mode-single">
            <span class="p1-mode-emoji">🔊</span>
            <span class="p1-mode-text">
              <span class="p1-mode-title">1-syllable words${completed.single ? ' ✓' : ''}</span>
              <span class="p1-mode-sub">Which sound is the ${ORD[TARGET]} tone? · 6 exercises</span>
            </span>
          </button>
          <button class="p1-mode" id="p1-mode-pair">
            <span class="p1-mode-emoji">🎵</span>
            <span class="p1-mode-text">
              <span class="p1-mode-title">2-syllable words${completed.pair ? ' ✓' : ''}</span>
              <span class="p1-mode-sub">Hear the word, pick the tone pattern · 6 exercises</span>
            </span>
          </button>
        </div>
        <button class="btn-link p1-done-home" id="p1-skip">Skip to speaking practice →</button>
      </div>
    `
    inject()
    document.getElementById('p1-home').addEventListener('click', () => { stopAllAudio(); navigate('/') })
    document.getElementById('p1-mode-single').addEventListener('click', () => start('single'))
    document.getElementById('p1-mode-pair').addEventListener('click', () => start('pair'))
    document.getElementById('p1-skip').addEventListener('click', () => navigate('/practice-2'))
  }

  // ── 1-syllable: "which is the Nth tone?" ──
  function renderSingle(q) {
    const TOTAL = items.length
    const correctIdx = q.tones.indexOf(TARGET)
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p1-home">Just4Tones</button></div>
        ${FOCUS_BADGE}
        <div class="p1-head">
          <div class="p1-progress">Exercise ${idx + 1} of ${TOTAL} · 1-syllable words</div>
          <h1 class="p1-q">Which one is the <span class="p1-target">${ORD[TARGET]} tone</span>?</h1>
          <p class="p1-sub">Tap each sound to listen, then choose the <strong>${ORD[TARGET]} tone (${TARGET_HINT})</strong>.</p>
        </div>
        <div class="p1-options">
          ${q.tones.map((t, i) => `
            <button class="p1-opt" data-i="${i}"><span class="p1-opt-icon">🔊</span><span class="p1-opt-label">Sound ${i + 1}</span></button>`).join('')}
        </div>
        <div class="p1-feedback hidden" id="p1-feedback"></div>
        <button class="btn btn-primary btn-lg p1-action" id="p1-check" disabled>Check answer</button>
      </div>
    `
    inject()
    document.getElementById('p1-home').addEventListener('click', () => { stopAllAudio(); navigate('/') })

    const optEls = [...container.querySelectorAll('.p1-opt')]
    optEls.forEach(el => el.addEventListener('click', () => {
      const i = +el.dataset.i
      stopAllAudio(); playSyllable(q.syl, q.tones[i])
      if (answered) return
      selected = i
      optEls.forEach(o => o.classList.toggle('selected', +o.dataset.i === i))
      document.getElementById('p1-check').disabled = false
    }))

    const action = document.getElementById('p1-check')
    action.addEventListener('click', () => {
      if (!answered) {
        if (selected == null) return
        answered = true
        const ok = selected === correctIdx
        if (ok) score++
        optEls.forEach(o => {
          const i = +o.dataset.i
          o.classList.add('revealed'); o.classList.remove('selected')
          const lbl = o.querySelector('.p1-opt-label')
          const py = applyTone(q.syl, q.tones[i])
          if (i === correctIdx) { o.classList.add('correct'); lbl.textContent = `${py} · ${ORD[TARGET]} tone ✓` }
          else if (i === selected) { o.classList.add('wrong'); lbl.textContent = `${py} ✗` }
          else { lbl.textContent = py }
        })
        const fb = document.getElementById('p1-feedback')
        fb.className = `p1-feedback ${ok ? 'good' : 'bad'}`
        fb.textContent = ok ? `✓ Correct — that was the ${ORD[TARGET]} tone.` : `Not quite. Tap the green one — the ${ORD[TARGET]} tone goes ${TARGET_HINT}.`
        action.textContent = idx + 1 >= TOTAL ? 'See results →' : 'Next →'
      } else { idx++; render() }
    })
  }

  // ── 2-syllable: identify the tone pattern ──
  function renderPair(q) {
    const TOTAL = items.length
    const correctIdx = q.choices.findIndex(c => c.t1 === q.t1 && c.t2 === q.t2)
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p1-home">Just4Tones</button></div>
        ${FOCUS_BADGE}
        <div class="p1-head">
          <div class="p1-progress">Exercise ${idx + 1} of ${TOTAL} · 2-syllable words</div>
          <h1 class="p1-q">What tones did you hear?</h1>
          <p class="p1-sub">Listen to the word, then pick the matching pinyin.</p>
          <button class="p1-listen" id="p1-listen">🔊 Play again</button>
        </div>
        <div class="p1-options">
          ${q.choices.map((c, i) => `<button class="p1-opt p1-opt-pair" data-i="${i}">${applyTone(q.syl1, c.t1)} ${applyTone(q.syl2, c.t2)}</button>`).join('')}
        </div>
        <div class="p1-feedback hidden" id="p1-feedback"></div>
        <button class="btn btn-primary btn-lg p1-action hidden" id="p1-next">Next →</button>
      </div>
    `
    inject()
    document.getElementById('p1-home').addEventListener('click', () => { stopAllAudio(); navigate('/') })
    const play = () => playDisyllable(q.syl1, q.t1, q.syl2, q.t2)
    document.getElementById('p1-listen').addEventListener('click', play)
    play()

    const optEls = [...container.querySelectorAll('.p1-opt')]
    optEls.forEach(el => el.addEventListener('click', () => {
      if (answered) return
      answered = true
      const i = +el.dataset.i
      const ok = i === correctIdx
      if (ok) score++
      optEls.forEach(o => {
        const j = +o.dataset.i
        o.classList.add('revealed')
        if (j === correctIdx) o.classList.add('correct')
        else if (j === i) o.classList.add('wrong')
      })
      const fb = document.getElementById('p1-feedback')
      fb.className = `p1-feedback ${ok ? 'good' : 'bad'}`
      fb.textContent = ok ? '✓ Correct!' : `Not quite — it was ${applyTone(q.syl1, q.t1)} ${applyTone(q.syl2, q.t2)}.`
      const next = document.getElementById('p1-next')
      next.classList.remove('hidden')
      next.textContent = idx + 1 >= TOTAL ? 'See results →' : 'Next →'
      next.addEventListener('click', () => { idx++; render() })
    }))
  }

  function renderDone() {
    completed[mode] = true
    const total = items.length
    const pct = Math.round((score / total) * 100)
    const other = mode === 'single' ? 'pair' : 'single'
    const otherLabel = other === 'single' ? '1-syllable words' : '2-syllable words'
    const otherDone = completed[other]
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p1-home">Just4Tones</button></div>
        <div class="p1-done card animate-in text-center">
          <div class="p1-done-emoji">${pct >= 80 ? '🎉' : pct >= 50 ? '👂' : '💪'}</div>
          <h1>Practice complete</h1>
          <p class="p1-done-score">${score} / ${total}</p>
          <p class="p1-done-msg">${pct >= 80 ? 'Your ear is sharp — you can really tell the tones apart!' : 'Great training. Keep drilling and the tones will start to pop out.'}</p>
          ${otherDone
            ? `<button class="btn btn-primary btn-lg" id="p1-speak">Next: Speaking practice →</button>`
            : `<button class="btn btn-primary btn-lg" id="p1-other">Try ${otherLabel} →</button>`}
          <button class="btn-link p1-done-home" id="p1-again">Practice this set again</button>
          ${otherDone ? '' : `<button class="btn-link p1-done-home" id="p1-speak2">Next: Speaking practice →</button>`}
          <button class="btn-link p1-done-home" id="p1-back">Back to home</button>
        </div>
      </div>
    `
    inject()
    document.getElementById('p1-home').addEventListener('click', () => navigate('/'))
    document.getElementById('p1-back').addEventListener('click', () => navigate('/'))
    document.getElementById('p1-again').addEventListener('click', () => start(mode))
    document.getElementById('p1-other')?.addEventListener('click', () => start(other))
    document.getElementById('p1-speak')?.addEventListener('click', () => navigate('/practice-2'))
    document.getElementById('p1-speak2')?.addEventListener('click', () => navigate('/practice-2'))
  }

  function inject() {
    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)
  }

  return () => stopAllAudio()
}

const scopedCSS = `
  .p1-head { text-align: center; margin-bottom: 26px; }
  .p1-progress { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 12px; }
  .p1-q { font-size: 1.6rem; font-weight: 700; margin-bottom: 8px; }
  .p1-target { color: var(--accent); }
  .p1-sub { color: var(--text-secondary); font-size: 0.92rem; line-height: 1.5; margin: 0 8px; }
  .p1-sub strong { color: var(--text-primary); }
  .p1-listen {
    margin-top: 14px; background: var(--surface); border: 1px solid var(--card-border); color: var(--text-primary);
    border-radius: 24px; padding: 8px 18px; font-family: inherit; font-size: 0.9rem; cursor: pointer; transition: all 0.2s;
  }
  .p1-listen:hover { border-color: var(--accent); color: var(--accent); }

  /* ── Mode chooser ── */
  .p1-modes { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; }
  .p1-mode {
    display: flex; align-items: center; gap: 16px; padding: 18px 20px; text-align: left;
    background: var(--card-bg); border: 1.5px solid var(--card-border); border-radius: var(--radius);
    color: var(--text-primary); font-family: inherit; cursor: pointer;
    transition: border-color 0.18s, background 0.18s, transform 0.1s; -webkit-tap-highlight-color: transparent;
  }
  .p1-mode:hover { border-color: var(--accent); background: var(--accent-glow); }
  .p1-mode:active { transform: scale(0.99); }
  .p1-mode-emoji { font-size: 1.8rem; flex-shrink: 0; }
  .p1-mode-text { display: flex; flex-direction: column; gap: 3px; }
  .p1-mode-title { font-size: 1.05rem; font-weight: 700; }
  .p1-mode-sub { font-size: 0.82rem; color: var(--text-secondary); }

  .p1-options { display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; }
  .p1-opt {
    display: flex; align-items: center; gap: 14px; padding: 18px 20px;
    background: var(--card-bg); border: 1.5px solid var(--card-border); border-radius: var(--radius);
    color: var(--text-primary); font-family: inherit; font-size: 1rem; font-weight: 600; cursor: pointer;
    transition: border-color 0.18s, background 0.18s, transform 0.1s; -webkit-tap-highlight-color: transparent;
  }
  .p1-opt-pair { justify-content: center; font-size: 1.25rem; letter-spacing: 0.02em; }
  .p1-opt:active:not(.revealed) { transform: scale(0.99); }
  .p1-opt:hover:not(.revealed) { border-color: var(--accent); }
  .p1-opt.selected:not(.revealed) { border-color: var(--accent); background: var(--accent-glow); }
  .p1-opt-icon { font-size: 1.5rem; flex-shrink: 0; }
  .p1-opt.correct { border-color: var(--correct); background: var(--correct-bg); }
  .p1-opt.wrong { border-color: var(--incorrect); background: var(--incorrect-bg); }

  .p1-feedback { padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.92rem; line-height: 1.5; margin-bottom: 16px; }
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
