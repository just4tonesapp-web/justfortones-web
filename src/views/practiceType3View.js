// ═══════════════════════════════════════════════════════════════════
// Practice Type III — Tone Change Rules / 变调  (pptx slide 27)
//   Goal (目标): help learners remember the tone-sandhi rules.
//   1. Explain the rules.  2. Quiz: pick the ACTUAL pronunciation.
//   Feedback: right/wrong + the correct pinyin (and best-effort audio).
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { applyTone } from '../utils/pinyin.js'
import { playSyllable, stopAllAudio } from '../utils/audio.js'

// Play two syllables (at their sandhi tones) in sequence — best effort.
function say(pairs) {
  stopAllAudio()
  if (!pairs.length) return
  playSyllable(pairs[0][0], pairs[0][1])
  if (pairs[1]) setTimeout(() => playSyllable(pairs[1][0], pairs[1][1]), 520)
}

const RULES = [
  { tag: '3 + 3', title: 'Two 3rd tones', text: 'When a 3rd tone is followed by another 3rd tone, the <b>first</b> one becomes a <b>2nd</b> tone.', eg: '你好 nǐ + hǎo → <b>ní hǎo</b>' },
  { tag: '一 yī', title: 'The number 一', text: '一 becomes a <b>2nd</b> tone before a 4th tone, and a <b>4th</b> tone before a 1st / 2nd / 3rd tone.', eg: '一个 → <b>yí</b> gè · 一天 → <b>yì</b> tiān' },
  { tag: '不 bù', title: 'The negative 不', text: '不 becomes a <b>2nd</b> tone before a 4th tone; otherwise it stays a <b>4th</b> tone.', eg: '不是 → <b>bú</b> shì · 不好 → <b>bù</b> hǎo' },
]

// q: question; options: choices; correct: index; sandhi: [[syl,tone],...] actual pronunciation; why.
const QUESTIONS = [
  { word: '你好', q: 'How is 你好 (nǐ + hǎo) actually said?', options: ['nǐ hǎo (3 + 3)', 'ní hǎo (2 + 3)'], correct: 1, sandhi: [['ni', 2], ['hao', 3]], why: 'Two 3rd tones → the first becomes a 2nd tone.' },
  { word: '很好', q: 'How is 很好 (hěn + hǎo) actually said?', options: ['hén hǎo (2 + 3)', 'hěn hǎo (3 + 3)'], correct: 0, sandhi: [['hen', 2], ['hao', 3]], why: 'Two 3rd tones → the first becomes a 2nd tone.' },
  { word: '老虎', q: 'How is 老虎 (lǎo + hǔ) actually said?', options: ['lǎo hǔ (3 + 3)', 'láo hǔ (2 + 3)'], correct: 1, sandhi: [['lao', 2], ['hu', 3]], why: 'Two 3rd tones → the first becomes a 2nd tone.' },
  { word: '一个', q: '一 in 一个 (one + 个, 4th tone) becomes…', options: ['1st tone (yī)', '2nd tone (yí)', '4th tone (yì)'], correct: 1, sandhi: [['yi', 2], ['ge', 4]], why: '一 before a 4th tone → 2nd tone (yí gè).' },
  { word: '一天', q: '一 in 一天 (one + 天, 1st tone) becomes…', options: ['2nd tone (yí)', '4th tone (yì)'], correct: 1, sandhi: [['yi', 4], ['tian', 1]], why: '一 before a 1st/2nd/3rd tone → 4th tone (yì tiān).' },
  { word: '一起', q: '一 in 一起 (one + 起, 3rd tone) becomes…', options: ['2nd tone (yí)', '4th tone (yì)'], correct: 1, sandhi: [['yi', 4], ['qi', 3]], why: '一 before a 1st/2nd/3rd tone → 4th tone (yì qǐ).' },
  { word: '不是', q: '不 in 不是 (not + 是, 4th tone) becomes…', options: ['2nd tone (bú)', '4th tone (bù)'], correct: 0, sandhi: [['bu', 2], ['shi', 4]], why: '不 before a 4th tone → 2nd tone (bú shì).' },
  { word: '不要', q: '不 in 不要 (not + 要, 4th tone) becomes…', options: ['4th tone (bù)', '2nd tone (bú)'], correct: 1, sandhi: [['bu', 2], ['yao', 4]], why: '不 before a 4th tone → 2nd tone (bú yào).' },
  { word: '不好', q: '不 in 不好 (not + 好, 3rd tone) stays…', options: ['2nd tone (bú)', '4th tone (bù)'], correct: 1, sandhi: [['bu', 4], ['hao', 3]], why: '不 keeps its 4th tone before a non-4th tone (bù hǎo).' },
]

export function practiceType3View(container) {
  let idx = 0, score = 0, answered = false, selected = null

  render()

  function render() {
    if (idx >= QUESTIONS.length) return renderDone()
    const q = QUESTIONS[idx]

    container.innerHTML = `
      <div class="app-shell shell-top-center">
        <div class="back-row"><button class="app-logo" id="p3-home">Just4Tones</button></div>

        ${idx === 0 ? `
        <div class="p3-rules card animate-in">
          <div class="p3-rules-head">Tone changes (变调)</div>
          ${RULES.map(r => `
            <div class="p3-rule">
              <span class="p3-rule-tag">${r.tag}</span>
              <div class="p3-rule-body"><div class="p3-rule-title">${r.title}</div><p>${r.text}</p><p class="p3-rule-eg">${r.eg}</p></div>
            </div>`).join('')}
        </div>` : ''}

        <div class="p3-head">
          <div class="p3-progress">Question ${idx + 1} of ${QUESTIONS.length}</div>
          <div class="p3-word">${q.word}</div>
          <p class="p3-q">${q.q}</p>
        </div>

        <div class="p3-options">
          ${q.options.map((o, i) => `<button class="p3-opt" data-i="${i}">${o}</button>`).join('')}
        </div>

        <div class="p3-feedback hidden" id="p3-feedback"></div>
        <button class="btn btn-primary btn-lg p3-next hidden" id="p3-next">Next →</button>
      </div>
    `
    inject()

    document.getElementById('p3-home').addEventListener('click', () => { stopAllAudio(); navigate('/') })

    const optEls = [...container.querySelectorAll('.p3-opt')]
    optEls.forEach(el => el.addEventListener('click', () => {
      if (answered) return
      answered = true
      selected = +el.dataset.i
      const ok = selected === q.correct
      if (ok) score++
      optEls.forEach(o => {
        const i = +o.dataset.i
        o.classList.add('revealed')
        if (i === q.correct) o.classList.add('correct')
        else if (i === selected) o.classList.add('wrong')
      })
      const fb = document.getElementById('p3-feedback')
      fb.className = `p3-feedback ${ok ? 'good' : 'bad'}`
      const correctPy = q.sandhi.map(([s, t]) => applyTone(s, t)).join(' ')
      fb.innerHTML = `${ok ? '✓ Correct!' : '✗ Not quite.'} It's <strong>${correctPy}</strong>. ${q.why}
        <button class="p3-hear" id="p3-hear">🔊 Hear it</button>`
      document.getElementById('p3-hear').addEventListener('click', () => say(q.sandhi))
      say(q.sandhi)
      const next = document.getElementById('p3-next')
      next.classList.remove('hidden')
      next.textContent = idx + 1 >= QUESTIONS.length ? 'See results →' : 'Next →'
    }))

    document.getElementById('p3-next').addEventListener('click', () => {
      idx++; answered = false; selected = null; render()
    })
  }

  function renderDone() {
    const pct = Math.round((score / QUESTIONS.length) * 100)
    container.innerHTML = `
      <div class="app-shell shell-top-center">
        <div class="back-row"><button class="app-logo" id="p3-home">Just4Tones</button></div>
        <div class="p3-done card animate-in text-center">
          <div class="p3-done-emoji">${pct >= 80 ? '🎉' : '📚'}</div>
          <h1>Tone-change practice complete</h1>
          <p class="p3-done-score">${score} / ${QUESTIONS.length}</p>
          <p class="p3-done-msg">${pct >= 80 ? 'You\'ve got the sandhi rules down!' : 'Review the rules at the top and try again — they\'ll stick.'}</p>
          <button class="btn btn-primary btn-lg" id="p3-again">Practice again</button>
          <button class="btn-link p3-done-home" id="p3-back">Back to home</button>
        </div>
      </div>
    `
    inject()
    document.getElementById('p3-home').addEventListener('click', () => navigate('/'))
    document.getElementById('p3-back').addEventListener('click', () => navigate('/'))
    document.getElementById('p3-again').addEventListener('click', () => { idx = 0; score = 0; answered = false; selected = null; render() })
  }

  function inject() {
    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)
  }

  return () => stopAllAudio()
}

const scopedCSS = `
  .p3-rules { padding: 18px 20px; margin-bottom: 20px; }
  .p3-rules-head { font-size: 1.05rem; font-weight: 700; margin-bottom: 14px; }
  .p3-rule { display: flex; gap: 12px; margin-bottom: 14px; }
  .p3-rule:last-child { margin-bottom: 0; }
  .p3-rule-tag {
    flex-shrink: 0; align-self: flex-start;
    background: var(--accent-glow); border: 1px solid rgba(56,189,248,0.3); color: var(--accent);
    font-weight: 700; font-size: 0.8rem; padding: 4px 10px; border-radius: 10px; min-width: 44px; text-align: center;
  }
  .p3-rule-title { font-weight: 600; margin-bottom: 2px; }
  .p3-rule-body p { font-size: 0.88rem; line-height: 1.5; color: var(--text-secondary); margin: 2px 0; }
  .p3-rule-body b { color: var(--text-primary); }
  .p3-rule-eg { color: var(--accent) !important; font-size: 0.85rem !important; }

  .p3-head { text-align: center; margin-bottom: 18px; }
  .p3-progress { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 10px; }
  .p3-word { font-size: 3rem; font-weight: 700; line-height: 1; margin-bottom: 10px; }
  .p3-q { font-size: 1rem; color: var(--text-secondary); }

  .p3-options { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
  .p3-opt {
    padding: 16px 20px; background: var(--card-bg); border: 1.5px solid var(--card-border);
    border-radius: var(--radius); color: var(--text-primary); font-family: inherit;
    font-size: 1rem; font-weight: 600; cursor: pointer; transition: border-color 0.18s, background 0.18s;
    -webkit-tap-highlight-color: transparent;
  }
  .p3-opt:hover:not(.revealed) { border-color: var(--accent); }
  .p3-opt.correct { border-color: var(--correct); background: var(--correct-bg); }
  .p3-opt.wrong { border-color: var(--incorrect); background: var(--incorrect-bg); }

  .p3-feedback { padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.92rem; line-height: 1.55; margin-bottom: 16px; }
  .p3-feedback.good { background: var(--correct-bg); color: var(--correct); }
  .p3-feedback.bad { background: var(--incorrect-bg); color: var(--incorrect); }
  .p3-feedback strong { font-weight: 700; }
  .p3-hear {
    display: inline-block; margin-left: 8px; background: transparent; border: 1px solid currentColor;
    color: inherit; border-radius: 14px; padding: 3px 10px; font-size: 0.8rem; cursor: pointer; font-family: inherit;
  }
  .p3-next { width: 100%; }

  .p3-done { padding: 32px 24px; }
  .p3-done-emoji { font-size: 3rem; margin-bottom: 8px; }
  .p3-done h1 { font-size: 1.4rem; margin-bottom: 10px; }
  .p3-done-score { font-size: 2.2rem; font-weight: 700; color: var(--accent); margin-bottom: 8px; }
  .p3-done-msg { color: var(--text-secondary); line-height: 1.55; margin-bottom: 22px; }
  .p3-done .btn-primary { width: 100%; }
  .p3-done-home { margin-top: 14px; display: inline-block; }
`
