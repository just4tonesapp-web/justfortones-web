// ═══════════════════════════════════════════════════════════════════
// Practice Type III — Tone Change Rules / 变调  (pptx slide 27/28)
//   Page 1: the three rules on one page (Rule 1 / 2 / 3) + a "ready?" prompt.
//   Page 2: the test — 12 items (each rule tested 4×). For 一 and 不, exactly
//     two questions become a 2nd tone and two become a 4th tone.
//   Driven by 60 real recordings; audio plays ONLY via the "Hear it" button,
//   after the learner has answered.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { applyTone, shuffle } from '../utils/pinyin.js'
import { playClip, stopAllAudio } from '../utils/audio.js'
import { TONE_CHANGE } from '../utils/toneChangeWords.js'

const RULES = [
  { tag: 'Rule 1', title: 'Two 3rd tones', text: 'When a 3rd tone is followed by another 3rd tone, the <b>first</b> becomes a <b>2nd</b> tone.', eg: '你好 nǐ + hǎo → <b>ní hǎo</b>' },
  { tag: 'Rule 2', title: 'The number 一 (yī)', text: '一 becomes a <b>2nd</b> tone before a 4th tone, and a <b>4th</b> tone before a 1st / 2nd / 3rd tone.', eg: '一个 → <b>yí</b> gè · 一天 → <b>yì</b> tiān' },
  { tag: 'Rule 3', title: 'The negative 不 (bù)', text: '不 becomes a <b>2nd</b> tone before a 4th tone; otherwise it stays a <b>4th</b> tone.', eg: '不是 → <b>bú</b> shì · 不好 → <b>bù</b> hǎo' },
]

function parse(f) {
  const m = f.match(/^([a-z]+)(\d)([a-z]+)(\d)$/)
  return { s1: m[1], t1: +m[2], s2: m[3], t2: +m[4] }
}

const ORD = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' }

function makeQ(type, item) {
  const { s1, t1, s2, t2 } = parse(item.f)
  const file = `tone-change/${type}/${item.f}.m4a`
  const c2 = item.c.slice(-1) // second character, e.g. 个 / 好
  if (type === '33') {
    const written = `${applyTone(s1, 3)} ${applyTone(s2, 3)}`
    const said = `${applyTone(s1, 2)} ${applyTone(s2, 3)}`
    return { chars: item.c, file, q: `How is ${item.c} (${written}) actually said?`,
      options: [`${written}  (3 + 3)`, `${said}  (2 + 3)`], correct: 1, said,
      why: 'Two 3rd tones in a row → the first becomes a 2nd tone.' }
  }
  if (type === 'yi') {
    const said = `${applyTone('yi', t1)} ${applyTone(s2, t2)}`
    return { chars: item.c, file, q: `一 in ${item.c} (一 + ${c2}, ${ORD[t2]} tone) becomes…`,
      options: ['1st tone (yī)', '2nd tone (yí)', '4th tone (yì)'], correct: t1 === 2 ? 1 : 2, said,
      why: t1 === 2 ? `一 before a 4th tone → 2nd tone (${said}).` : `一 before a ${ORD[t2]} tone → 4th tone (${said}).` }
  }
  const said = `${applyTone('bu', t1)} ${applyTone(s2, t2)}`
  return { chars: item.c, file, q: `不 in ${item.c} (不 + ${c2}, ${ORD[t2]} tone) becomes…`,
    options: ['2nd tone (bú)', '4th tone (bù)'], correct: t1 === 2 ? 0 : 1, said,
    why: t1 === 2 ? `不 before a 4th tone → 2nd tone (${said}).` : `不 keeps its 4th tone before a ${ORD[t2]} tone (${said}).` }
}

// 一 / 不: pick exactly 2 that turn into a 2nd tone and 2 that turn into a 4th tone.
function pickBalanced(type, out) {
  const items = TONE_CHANGE[type]
  const becomes2nd = items.filter(it => parse(it.f).t1 === 2)
  const becomes4th = items.filter(it => parse(it.f).t1 === 4)
  shuffle(becomes2nd).slice(0, 2).forEach(it => out.push(makeQ(type, it)))
  shuffle(becomes4th).slice(0, 2).forEach(it => out.push(makeQ(type, it)))
}

function buildSession() {
  const out = []
  shuffle(TONE_CHANGE['33']).slice(0, 4).forEach(item => out.push(makeQ('33', item))) // Rule 1 ×4
  pickBalanced('yi', out) // Rule 2 ×4 (2 二声 + 2 四声)
  pickBalanced('bu', out) // Rule 3 ×4 (2 二声 + 2 四声)
  return shuffle(out) // 12 items
}

export function practiceType3View(container) {
  let stage = 'intro' // 'intro' (rules) → 'test'
  let qs = buildSession()
  let idx = 0, score = 0, answered = false, selected = null

  renderIntro()

  // ── Page 1: the three rules + a "ready?" prompt ──
  function renderIntro() {
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p3-home">Just4Tones</button></div>
        <div class="p3-rules card animate-in">
          <div class="p3-rules-head">Tone changes (变调)</div>
          ${RULES.map(r => `
            <div class="p3-rule">
              <span class="p3-rule-tag">${r.tag}</span>
              <div class="p3-rule-body"><div class="p3-rule-title">${r.title}</div><p>${r.text}</p><p class="p3-rule-eg">${r.eg}</p></div>
            </div>`).join('')}
        </div>
        <p class="p3-ready-q">Are you ready to test your tone change knowledge?</p>
        <button class="btn btn-primary btn-lg" id="p3-start">Start the test →</button>
      </div>
    `
    inject()
    document.getElementById('p3-home').addEventListener('click', () => { stopAllAudio(); navigate('/') })
    document.getElementById('p3-start').addEventListener('click', () => {
      stage = 'test'; idx = 0; score = 0; answered = false; selected = null; render()
    })
  }

  // ── Page 2: the 12-item test ──
  function render() {
    if (idx >= qs.length) return renderDone()
    const q = qs[idx]
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p3-home">Just4Tones</button></div>

        <div class="p3-head">
          <div class="p3-progress">Question ${idx + 1} of ${qs.length}</div>
          <div class="p3-word">${q.chars}</div>
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
      fb.innerHTML = `${ok ? '✓ Correct!' : '✗ Not quite.'} It's <strong>${q.said}</strong>. ${q.why}
        <button class="p3-hear" id="p3-hear">🔊 Hear it</button>`
      document.getElementById('p3-hear').addEventListener('click', () => playClip(q.file))
      const next = document.getElementById('p3-next')
      next.classList.remove('hidden')
      next.textContent = idx + 1 >= qs.length ? 'See results →' : 'Next →'
    }))

    document.getElementById('p3-next').addEventListener('click', () => { idx++; answered = false; selected = null; render() })
  }

  function renderDone() {
    const pct = Math.round((score / qs.length) * 100)
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p3-home">Just4Tones</button></div>
        <div class="p3-done card animate-in text-center">
          <div class="p3-done-emoji">${pct >= 80 ? '🎉' : '📚'}</div>
          <h1>Tone-change test complete</h1>
          <p class="p3-done-score">${score} / ${qs.length}</p>
          <p class="p3-done-msg">${pct >= 80 ? 'You\'ve got the tone-change rules down!' : 'Review the rules and try again — they\'ll stick.'}</p>
          <button class="btn btn-primary btn-lg" id="p3-again">Take the test again</button>
          <button class="btn-link p3-done-home" id="p3-rules">Review the rules</button>
          <button class="btn-link p3-done-home" id="p3-back">Back to home</button>
        </div>
      </div>
    `
    inject()
    document.getElementById('p3-home').addEventListener('click', () => navigate('/'))
    document.getElementById('p3-back').addEventListener('click', () => navigate('/'))
    document.getElementById('p3-rules').addEventListener('click', () => { stage = 'intro'; qs = buildSession(); renderIntro() })
    document.getElementById('p3-again').addEventListener('click', () => { qs = buildSession(); idx = 0; score = 0; answered = false; selected = null; render() })
  }

  function inject() {
    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)
  }

  return () => stopAllAudio()
}

const scopedCSS = `
  .p3-rules { padding: 18px 20px; margin-bottom: 18px; }
  .p3-rules-head { font-size: 1.05rem; font-weight: 700; margin-bottom: 14px; }
  .p3-rule { display: flex; gap: 12px; margin-bottom: 14px; }
  .p3-rule:last-child { margin-bottom: 0; }
  .p3-rule-tag {
    flex-shrink: 0; align-self: flex-start;
    background: var(--accent-glow); border: 1px solid rgba(56,189,248,0.3); color: var(--accent);
    font-weight: 700; font-size: 0.8rem; padding: 4px 10px; border-radius: 10px; min-width: 48px; text-align: center;
  }
  .p3-rule-title { font-weight: 600; margin-bottom: 2px; }
  .p3-rule-body p { font-size: 0.88rem; line-height: 1.5; color: var(--text-secondary); margin: 2px 0; }
  .p3-rule-body b { color: var(--text-primary); }
  .p3-rule-eg { color: var(--accent) !important; font-size: 0.85rem !important; }

  .p3-ready-q { text-align: center; font-size: 1.05rem; font-weight: 600; color: var(--text-primary); margin: 6px 0 16px; }
  #p3-start { width: 100%; }

  .p3-head { text-align: center; margin-bottom: 18px; }
  .p3-progress { font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 10px; }
  .p3-word { font-size: 3.2rem; font-weight: 700; line-height: 1; margin-bottom: 6px; }
  .p3-q { font-size: 1rem; color: var(--text-secondary); margin-top: 16px; }

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
