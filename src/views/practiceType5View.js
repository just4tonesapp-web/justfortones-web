// ═══════════════════════════════════════════════════════════════════
// Practice Type V — Character tone recognition 认字 (meeting spec Jun 3:
// "tones of the most frequent characters / 2-syllable words"; built for
// the fall 2026 heritage cohort whose focus is reading, not listening).
//   READING task — no audio before answering. See the hanzi, pick the
//   pinyin with the right tone(s). Audio plays only AFTER answering,
//   as confirmation (recordings when available).
//   Two 12-question sets: single characters · 2-syllable words.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { applyTone, shuffle } from '../utils/pinyin.js'
import { playSyllable, playDisyllable, stopAllAudio } from '../utils/audio.js'
import { CHAR_TONE_MAP } from '../utils/models/whisperModel.js'
import { DISYLLABLE_BY_PAIR } from '../utils/disyllableManifest.js'
import { findHskWord } from '../utils/hskDisyllabicWords.js'
import { POLYPHONES } from '../utils/polyphoneWords.js'
import { saveResult } from '../services/progressService.js'

const TOTAL = 12
const POLY_CHARS = new Set(POLYPHONES.map(p => p.char))

// Single characters: every unambiguous entry in the tone map.
const SINGLE_POOL = Object.entries(CHAR_TONE_MAP)
  .filter(([char, e]) => e.tone >= 1 && e.tone <= 4 && !POLY_CHARS.has(char))
  .map(([char, e]) => ({ char, base: e.base, tone: e.tone }))

// Words: manifest entries (they have audio) that map to a known HSK word.
const WORD_POOL = []
for (const [pair, items] of Object.entries(DISYLLABLE_BY_PAIR)) {
  const t1 = +pair[0], t2 = +pair[1]
  for (const it of items) {
    const w = findHskWord(it.syl1, t1, it.syl2, t2)
    if (w) WORD_POOL.push({ chars: w.chars, syl1: it.syl1, syl2: it.syl2, t1, t2 })
  }
}

const PATTERNS = []
for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) PATTERNS.push([a, b])

export function practiceType5View(container) {
  let mode = null, items = [], idx = 0, score = 0, answered = false, answers = []
  const completed = { single: false, word: false }

  renderChooser()

  function buildItems(m) {
    if (m === 'single') {
      // one char per base so a round spans 12 different syllables
      const byBase = new Map()
      for (const c of shuffle([...SINGLE_POOL])) if (!byBase.has(c.base)) byBase.set(c.base, c)
      return shuffle([...byBase.values()]).slice(0, TOTAL)
    }
    const byWord = new Map()
    for (const w of shuffle([...WORD_POOL])) if (!byWord.has(w.chars)) byWord.set(w.chars, w)
    return shuffle([...byWord.values()]).slice(0, TOTAL)
  }

  function start(m) {
    mode = m
    items = buildItems(m)
    idx = 0; score = 0; answered = false; answers = []
    render()
  }

  function renderChooser() {
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p5-home">Just4Tones</button></div>
        <div class="p5-head">
          <h1 class="p5-title">Character Tones 认字</h1>
          <p class="p5-sub">Read the characters — do you know their tones?</p>
        </div>
        <div class="p5-modes">
          <button class="p5-mode" id="p5-mode-single">
            <span class="p5-mode-emoji">🈶</span>
            <span class="p5-mode-text">
              <span class="p5-mode-title">Single characters${completed.single ? ' ✓' : ''}</span>
              <span class="p5-mode-sub">Pick the right tone · ${TOTAL} questions</span>
            </span>
          </button>
          <button class="p5-mode" id="p5-mode-word">
            <span class="p5-mode-emoji">📖</span>
            <span class="p5-mode-text">
              <span class="p5-mode-title">2-character words${completed.word ? ' ✓' : ''}</span>
              <span class="p5-mode-sub">Pick the tone pattern · ${TOTAL} questions</span>
            </span>
          </button>
        </div>
      </div>
    `
    inject()
    document.getElementById('p5-home').addEventListener('click', () => { stopAllAudio(); navigate('/') })
    document.getElementById('p5-mode-single').addEventListener('click', () => start('single'))
    document.getElementById('p5-mode-word').addEventListener('click', () => start('word'))
  }

  function render() {
    if (idx >= items.length) return renderDone()
    answered = false
    const q = items[idx]
    const isWord = mode === 'word'
    const display = isWord ? q.chars : q.char

    let options
    if (isWord) {
      const correct = [q.t1, q.t2]
      const distractors = shuffle(PATTERNS.filter(p => !(p[0] === q.t1 && p[1] === q.t2))).slice(0, 3)
      options = shuffle([correct, ...distractors]).map(p => ({
        label: `${applyTone(q.syl1, p[0])} ${applyTone(q.syl2, p[1])}`,
        ok: p[0] === q.t1 && p[1] === q.t2,
      }))
    } else {
      options = shuffle([1, 2, 3, 4].map(t => ({ label: applyTone(q.base, t), ok: t === q.tone })))
    }

    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p5-home">Just4Tones</button></div>
        <div class="p5-head">
          <div class="p5-progress">Question ${idx + 1} of ${items.length} · ${isWord ? '2-character words' : 'single characters'}</div>
          <div class="p5-char">${display}</div>
          <p class="p5-q">How is it pronounced?</p>
        </div>
        <div class="p5-options">
          ${options.map((o, i) => `<button class="p5-opt" data-i="${i}">${o.label}</button>`).join('')}
        </div>
        <div class="p5-feedback hidden" id="p5-feedback"></div>
        <button class="btn btn-primary btn-lg p5-next hidden" id="p5-next">Next →</button>
      </div>
    `
    inject()
    document.getElementById('p5-home').addEventListener('click', () => { stopAllAudio(); navigate('/') })

    const optEls = [...container.querySelectorAll('.p5-opt')]
    optEls.forEach(el => el.addEventListener('click', () => {
      if (answered) return
      answered = true
      const i = +el.dataset.i
      const ok = options[i].ok
      if (ok) score++
      answers.push(isWord
        ? { chars: q.chars, tones: [q.t1, q.t2], correct: ok }
        : { char: q.char, tone: q.tone, correct: ok })
      optEls.forEach(o => {
        const j = +o.dataset.i
        o.classList.add('revealed')
        if (options[j].ok) o.classList.add('correct')
        else if (j === i) o.classList.add('wrong')
      })
      const right = options.find(o => o.ok).label
      const fb = document.getElementById('p5-feedback')
      fb.className = `p5-feedback ${ok ? 'good' : 'bad'}`
      fb.innerHTML = `${ok ? '✓ Correct!' : `✗ It's <strong>${right}</strong>.`}
        <button class="p5-hear" id="p5-hear">🔊 Hear it</button>`
      document.getElementById('p5-hear').addEventListener('click', () => {
        stopAllAudio()
        if (isWord) playDisyllable(q.syl1, q.t1, q.syl2, q.t2)
        else playSyllable(q.base, q.tone)
      })
      const next = document.getElementById('p5-next')
      next.classList.remove('hidden')
      next.textContent = idx + 1 >= items.length ? 'See results →' : 'Next →'
    }))

    document.getElementById('p5-next').addEventListener('click', () => { stopAllAudio(); idx++; render() })
  }

  function renderDone() {
    completed[mode] = true
    const total = items.length
    const pct = Math.round((score / total) * 100)
    const other = mode === 'single' ? 'word' : 'single'
    const otherLabel = other === 'single' ? 'Single characters' : '2-character words'
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p5-home">Just4Tones</button></div>
        <div class="p5-done card animate-in text-center">
          <div class="p5-done-emoji">${pct >= 80 ? '🎉' : '📚'}</div>
          <h1>Character practice complete</h1>
          <p class="p5-done-score">${score} / ${total}</p>
          <p class="p5-done-msg">${pct >= 80 ? 'Your character-tone knowledge is solid!' : 'Reading tones takes reps — run another round.'}</p>
          ${completed[other] ? '' : `<button class="btn btn-primary btn-lg" id="p5-other">Try ${otherLabel} →</button>`}
          <button class="btn-link p5-done-home" id="p5-again">Practice this set again</button>
          <button class="btn-link p5-done-home" id="p5-back">Back to home</button>
        </div>
      </div>
    `
    inject()
    document.getElementById('p5-home').addEventListener('click', () => navigate('/'))
    document.getElementById('p5-back').addEventListener('click', () => navigate('/'))
    document.getElementById('p5-again').addEventListener('click', () => start(mode))
    document.getElementById('p5-other')?.addEventListener('click', () => start(other))

    // Persist AFTER the UI is on screen — a save error must never eat the page.
    // `answers` is in the same { tone, correct } / { tones, correct } shape
    // analyzeSingleSyllable/analyzeDisyllabic (toneReport.js) already expect,
    // so the teacher dashboard reuses those with zero new analysis code.
    saveResult('P5', score, total, { set: mode, answers })
  }

  function inject() {
    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)
  }

  return () => stopAllAudio()
}

const scopedCSS = `
  .p5-head { text-align: center; margin-bottom: 16px; }
  .p5-title {
    font-size: 1.55rem; font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .p5-sub { color: var(--text-secondary); font-size: 0.9rem; margin-top: 6px; }

  .p5-modes { display: flex; flex-direction: column; gap: 12px; }
  .p5-mode {
    display: flex; align-items: center; gap: 14px; width: 100%; padding: 18px 16px;
    background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--radius);
    cursor: pointer; font-family: inherit; color: var(--text-primary); text-align: left; transition: all 0.2s;
  }
  .p5-mode:hover { border-color: var(--accent); background: var(--accent-glow); }
  .p5-mode-emoji { font-size: 1.6rem; }
  .p5-mode-title { display: block; font-size: 1rem; font-weight: 700; }
  .p5-mode-sub { display: block; font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px; }

  .p5-progress { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 14px; }
  .p5-char { font-size: 4.2rem; font-weight: 700; line-height: 1.2; font-family: 'Noto Sans SC', sans-serif; }
  .p5-q { color: var(--text-secondary); font-size: 0.95rem; margin-top: 10px; }

  .p5-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 16px 0 14px; }
  .p5-opt {
    padding: 14px 10px; background: var(--surface); border: 2px solid var(--card-border);
    border-radius: var(--radius-sm); font-family: inherit; font-size: 1.1rem; font-weight: 600;
    color: var(--text-primary); cursor: pointer; transition: all 0.18s;
  }
  .p5-opt:hover:not(.revealed) { border-color: var(--accent); transform: translateY(-2px); }
  .p5-opt.correct { border-color: var(--correct); background: var(--correct-bg); color: var(--correct); }
  .p5-opt.wrong { border-color: var(--incorrect); background: var(--incorrect-bg); color: var(--incorrect); }
  .p5-opt.revealed { cursor: default; }

  .p5-feedback { border-radius: var(--radius-sm); padding: 12px 14px; font-size: 0.95rem; margin-bottom: 12px; }
  .p5-feedback.good { background: var(--correct-bg); color: var(--text-primary); }
  .p5-feedback.bad { background: var(--incorrect-bg); color: var(--text-primary); }
  .p5-hear {
    display: inline-block; margin-left: 8px; background: var(--surface);
    border: 1px solid var(--card-border); border-radius: 16px; padding: 4px 12px;
    font-family: inherit; font-size: 0.82rem; color: var(--text-primary); cursor: pointer;
  }
  .p5-hear:hover { border-color: var(--accent); color: var(--accent); }
  .p5-next { width: 100%; }

  .p5-done { padding: 32px 24px; }
  .p5-done-emoji { font-size: 3rem; margin-bottom: 8px; }
  .p5-done h1 { font-size: 1.4rem; margin-bottom: 8px; }
  .p5-done-score { font-size: 2.2rem; font-weight: 700; color: var(--accent); margin-bottom: 8px; }
  .p5-done-msg { color: var(--text-secondary); line-height: 1.55; margin-bottom: 20px; }
  .p5-done .btn-primary { width: 100%; }
  .p5-done-home { margin-top: 12px; margin-right: 10px; display: inline-block; }
`
