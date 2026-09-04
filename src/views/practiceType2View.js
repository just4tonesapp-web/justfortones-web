// ═══════════════════════════════════════════════════════════════════
// Practice Type II — Listen, then Speak  (pptx slide 26)
//   Goal (目标): help learners produce the tone. Hear a demo (示范 — NOT
//   available in the test), say it, then replay your own recording and the
//   demo to compare. Repeat freely; only the last take is replayable.
//   Basic right/wrong feedback uses the FREE on-device pitch model (no paid
//   API calls — per the cost note on the slide).
//   1-syllable and 2-syllable words mixed, 6 exercises.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { applyTone, shuffle } from '../utils/pinyin.js'
import { playSyllable, playDisyllable, playPcm, stopAllAudio } from '../utils/audio.js'
import { AudioEngine } from '../utils/audioEngine.js'
import { detectToneWithPitch, detectTonePairWithPitch, normalizePeak } from '../utils/models/pitchModel.js'
import { recognizeMandarin } from '../utils/models/azureModel.js'
import { recognizeWithGoogle } from '../utils/models/googleSpeechModel.js'
import { recognizeWithDeepgram } from '../utils/models/deepgramModel.js'
import { CHAR_TONE_MAP } from '../utils/models/whisperModel.js'
import { findHskWord, findHskHomographs } from '../utils/hskDisyllabicWords.js'
import { DISYLLABLE_BY_PAIR } from '../utils/disyllableManifest.js'
import { saveResult } from '../services/progressService.js'

const SINGLES = [
  { char: '妈', base: 'ma', tone: 1, meaning: 'mother' },
  { char: '茶', base: 'cha', tone: 2, meaning: 'tea' },
  { char: '马', base: 'ma', tone: 3, meaning: 'horse' },
  { char: '大', base: 'da', tone: 4, meaning: 'big' },
  { char: '书', base: 'shu', tone: 1, meaning: 'book' },
  { char: '鱼', base: 'yu', tone: 2, meaning: 'fish' },
  { char: '好', base: 'hao', tone: 3, meaning: 'good' },
  { char: '四', base: 'si', tone: 4, meaning: 'four' },
]
const PRAISE = ['Perfect! 🎉', 'Beautiful!', 'Good job!', 'Nicely done!']
const NUDGE  = ['Almost there — listen to the demo again.', 'It\'s close! Give it another go.', 'Try it again — match the demo\'s pitch.']
const pick = (a) => a[Math.floor(Math.random() * a.length)]

export function practiceType2View(container, { debug = false } = {}) {
  const engine = new AudioEngine()
  // Adaptive (feedback-based): lean the word set toward the diagnostic's weakest
  // tone, defaulting to the 3rd if no diagnostic has been taken yet.
  const focus = +sessionStorage.getItem('j4t_focus_tone')
  const adaptive = [1, 2, 3, 4].includes(focus)
  const FOCUS = adaptive ? focus : 3
  const ORD = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' }
  const FOCUS_BADGE = adaptive ? `<div class="prac-focus">🎯 Targeting your <strong>${ORD[FOCUS]} tone</strong></div>` : ''
  let items = buildItems()
  let idx = 0, phase = 'ready', lastRec = null, feedback = null, isRecording = false, recTimer = null
  let autoStopTimer = null
  let goodCount = 0 // items whose final take was judged good
  let lastDiag = null // debug route: what each judge saw for the last take

  function buildItems() {
    const list = []
    // Both single-syllable words in the focus tone, then fill to 4 with contrasts.
    SINGLES.filter(s => s.tone === FOCUS).forEach(s => list.push({ type: 'single', ...s }))
    shuffle([1, 2, 3, 4].filter(t => t !== FOCUS)).slice(0, Math.max(0, 4 - list.length)).forEach(t => {
      const pool = SINGLES.filter(s => s.tone === t)
      if (pool.length) list.push({ type: 'single', ...shuffle(pool)[0] })
    })
    // 2 two-syllable words, preferring ones that contain the focus tone.
    const keys = Object.keys(DISYLLABLE_BY_PAIR).filter(k => (DISYLLABLE_BY_PAIR[k] || []).length)
    const focusKeys = keys.filter(k => +k[0] === FOCUS || +k[1] === FOCUS)
    shuffle(focusKeys.length ? focusKeys : keys).slice(0, 2).forEach(k => {
      const e = shuffle(DISYLLABLE_BY_PAIR[k])[0]
      list.push({ type: 'pair', syl1: e.syl1, syl2: e.syl2, t1: +k[0], t2: +k[1] })
    })
    return shuffle(list)
  }

  function playDemo(item) {
    stopAllAudio()
    if (item.type === 'single') playSyllable(item.base, item.tone)
    else playDisyllable(item.syl1, item.t1, item.syl2, item.t2)
  }

  function playOwn() {
    if (!lastRec || !lastRec.samples || !lastRec.samples.length) return
    // WAV + <audio> element = the exact same playback path as the demo clips.
    // (A WebAudio context can silently sit 'suspended'/'interrupted' on iOS
    // after mic capture — that's why this button used to work only sometimes.)
    // Boost quiet takes so learners can actually hear themselves.
    playPcm(normalizePeak(lastRec.samples, 0.9, 0.005), lastRec.sampleRate)
  }

  async function startRec(item) {
    const ok = await engine.start()
    if (!ok) { feedback = { good: false, text: 'Couldn\'t access the microphone — allow mic access and try again.' }; phase = 'done'; render(); return }
    isRecording = true; phase = 'recording'; render()
    recTimer = setTimeout(() => stopRec(item), 20000) // safety cap
    // Hybrid stop (survey + team feedback: pure tap-to-stop is fiddly): once
    // speech is heard, 900ms of silence auto-stops; the ⏺ button still works.
    // Adaptive thresholds: an absolute 0.012 never went quiet in a noisy room
    // (AGC-boosted noise floor) and the auto-stop never fired. Speech must
    // stand clear of the take's own peak; "quiet" is relative to it too.
    let spoke = false, quietMs = 0, peakRms = 0, started = Date.now()
    autoStopTimer = setInterval(() => {
      if (!isRecording) { clearInterval(autoStopTimer); return }
      const rms = engine.getRMS()
      if (rms > peakRms) peakRms = rms
      if (rms > Math.max(0.015, peakRms * 0.3)) { spoke = true; quietMs = 0 }
      else if (spoke && rms < Math.max(0.01, peakRms * 0.18)) {
        quietMs += 100
        if (quietMs >= 900 && Date.now() - started > 700) { clearInterval(autoStopTimer); stopRec(item) }
      }
    }, 100)
  }

  async function stopRec(item) {
    if (!isRecording) return
    clearTimeout(recTimer)
    clearInterval(autoStopTimer)
    lastRec = engine.stop()
    isRecording = false
    phase = 'judging'; render()

    // ── Hybrid judge (team decision 2026-09-04): Azure recognition first
    // (94% on calibration, via our server-side proxy — free tier covers
    // thousands of takes/month), on-device pitch as fallback/offline path.
    // Debug route additionally asks Google/Deepgram what THEY heard.
    let azureText = null, googleText = null, deepgramText = null
    try {
      const jobs = [recognizeMandarin(lastRec.samples, lastRec.sampleRate).catch(() => null)]
      if (debug) {
        jobs.push(recognizeWithGoogle(lastRec.samples, lastRec.sampleRate).catch(() => null))
        jobs.push(recognizeWithDeepgram(lastRec.samples, lastRec.sampleRate).catch(() => null))
      }
      ;[azureText, googleText, deepgramText] = await Promise.all(jobs)
    } catch { /* offline → pitch */ }

    if (item.type === 'single') {
      const judgeText = (text) => {
        if (!text) return null
        for (const ch of [...text]) {
          if (ch === item.char) return true
          const e = CHAR_TONE_MAP[ch]
          if (e && e.base === item.base && e.tone !== 5) return e.tone === item.tone
        }
        return null
      }
      let verdict = judgeText(azureText)
      const pitchTone = detectToneWithPitch(lastRec.samples, lastRec.sampleRate)
      if (verdict === null) verdict = pitchTone === null ? null : pitchTone === item.tone
      lastDiag = {
        label: `target ${item.char} (${applyTone(item.base, item.tone)})`,
        judges: [
          { icon: '🎯', name: 'Azure', heard: azureText, v: judgeText(azureText) },
          { icon: '🔍', name: 'Google', heard: googleText, v: judgeText(googleText) },
          { icon: '🔊', name: 'Deepgram', heard: deepgramText, v: judgeText(deepgramText) },
          { icon: '🎵', name: 'Pitch', heard: pitchTone !== null ? `T${pitchTone}` : null, v: pitchTone === null ? null : pitchTone === item.tone },
        ],
      }
      feedback = verdict === null
        ? { good: false, text: 'We couldn\'t hear that clearly — try again a little closer to the mic.' }
        : { good: verdict, text: verdict ? pick(PRAISE) : pick(NUDGE) }
    } else {
      // Disyllable: Azure first — compare the recognized hanzi with the
      // expected HSK word (and its same-syllable different-tone homographs).
      const expected = findHskWord(item.syl1, item.t1, item.syl2, item.t2)
      const judgeText = (text) => {
        if (!text || !expected) return null
        if (text.includes(expected.chars)) return { ok1: true, ok2: true }
        const other = findHskHomographs(item.syl1, item.syl2)
          .find(w => w.pattern !== expected.pattern && text.includes(w.chars))
        if (other) return { ok1: other.pattern[0] === String(item.t1), ok2: other.pattern[1] === String(item.t2) }
        return null
      }
      const azureVerdict = judgeText(azureText)
      // Pitch path (fallback + the sole path when offline/unrecognized).
      const { t1: d1, t2: d2, scores1, scores2 } = detectTonePairWithPitch(lastRec.samples, lastRec.sampleRate)
      lastDiag = {
        label: `expected ${expected?.chars || '?'} (${applyTone(item.syl1, item.t1)} ${applyTone(item.syl2, item.t2)})`,
        judges: [
          { icon: '🎯', name: 'Azure', heard: azureText, v: azureVerdict },
          { icon: '🔍', name: 'Google', heard: googleText, v: judgeText(googleText) },
          { icon: '🔊', name: 'Deepgram', heard: deepgramText, v: judgeText(deepgramText) },
          { icon: '🎵', name: 'Pitch', heard: d1 || d2 ? `T${d1}+T${d2}` : null, v: d1 === null && d2 === null ? null : { ok1: d1 === item.t1, ok2: d2 === item.t2 } },
        ],
      }
      if (azureVerdict) {
        const { ok1, ok2 } = azureVerdict
        const p1 = applyTone(item.syl1, item.t1)
        const p2 = applyTone(item.syl2, item.t2)
        if (ok1 && ok2) feedback = { good: true, text: `${pick(PRAISE)} Both syllables sounded right — replay yours and the demo to double-check.` }
        else if (ok1 || ok2) feedback = { good: false, text: `Close! “${ok1 ? p2 : p1}” sounded off — listen to the demo again and watch that syllable.` }
        else feedback = { good: false, text: `Not quite — listen to the demo and try to match “${p1} ${p2}” one syllable at a time.` }
      } else if (d1 === null && d2 === null) {
        feedback = { good: false, text: 'We couldn\'t hear that clearly — try again a little closer to the mic.' }
      } else {
        // Practice-mode leniency: exact match, OR the target tone scores within
        // 80% of the winner (contours are ambiguous in connected speech), OR
        // the half-third rule (first-syllable T3 realized as a low fall).
        const near = (scores, target) => {
          if (!scores) return false
          const best = Math.max(...Object.values(scores))
          return best > 0.05 && scores[target] >= best * 0.8
        }
        const ok1 = d1 === item.t1 || near(scores1, item.t1) || (item.t1 === 3 && d1 === 4)
        const ok2 = d2 === item.t2 || near(scores2, item.t2)
        const p1 = applyTone(item.syl1, item.t1)
        const p2 = applyTone(item.syl2, item.t2)
        if (ok1 && ok2) {
          feedback = { good: true, text: `${pick(PRAISE)} Both syllables sounded right — replay yours and the demo to double-check.` }
        } else if (ok1 || ok2) {
          const off = ok1 ? p2 : p1
          feedback = { good: false, text: `Close! “${off}” sounded off — listen to the demo again and watch that syllable.` }
        } else {
          feedback = { good: false, text: `Not quite — listen to the demo and try to match “${p1} ${p2}” one syllable at a time.` }
        }
      }
    }
    phase = 'done'; render()
  }

  render()

  function render() {
    if (idx >= items.length) return renderDone()
    const item = items[idx]
    const display = item.type === 'single'
      ? `<div class="p2-char">${item.char}</div>
         <div class="p2-pinyin">${applyTone(item.base, item.tone)}</div>
         <div class="p2-meaning">${item.meaning}</div>`
      : `<div class="p2-pinyin p2-pinyin-lg">${applyTone(item.syl1, item.t1)} ${applyTone(item.syl2, item.t2)}</div>
         <div class="p2-meaning">2-syllable word</div>`

    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p2-home">Just4Tones</button></div>
        ${FOCUS_BADGE}

        <div class="p2-progress">Exercise ${idx + 1} of ${items.length} · Say it out loud</div>

        <div class="p2-card card">
          ${display}
          <button class="p2-demo" id="p2-demo">🔊 Listen to demo</button>

          <div class="p2-rec-zone">
            ${phase === 'recording' ? `
              <button class="p2-mic recording" id="p2-stop"><span class="p2-mic-icon">⏺</span></button>
              <div class="p2-rec-label">Recording… <span class="p2-rec-tap">stops by itself when you finish (or tap ⏺)</span></div>
            ` : phase === 'judging' ? `
              <button class="p2-mic" disabled><span class="p2-mic-icon">⏳</span></button>
              <div class="p2-rec-label">Checking your pronunciation…</div>
            ` : `
              <button class="p2-mic" id="p2-record"><span class="p2-mic-icon">🎤</span></button>
              <div class="p2-rec-label">${lastRec ? 'Tap to record again' : 'Tap and say the word'}</div>
            `}
          </div>

          ${phase === 'done' && feedback ? `
            <div class="p2-feedback ${feedback.good ? 'good' : 'bad'}">${feedback.text}</div>
            ${debug && lastDiag ? `
              <div class="p2-judges-label">What the judges heard · ${lastDiag.label}</div>
              <div class="p2-judges">${lastDiag.judges.map(j => {
                const ok = j.v === null ? null : typeof j.v === 'object' ? (j.v.ok1 && j.v.ok2) : j.v
                const verdict = j.v === null ? '—' : typeof j.v === 'object' ? `${j.v.ok1 ? '✓' : '✗'}${j.v.ok2 ? '✓' : '✗'}` : (j.v ? '✓' : '✗')
                return `<div class="p2-judge ${ok === null ? 'idle' : ok ? 'good' : 'bad'}">
                  <div class="p2-judge-icon">${j.icon}</div>
                  <div class="p2-judge-name">${j.name}</div>
                  <div class="p2-judge-heard">${j.heard || 'No vote'}</div>
                  <div class="p2-judge-verdict">${verdict}</div>
                </div>`
              }).join('')}</div>` : ''}
            <div class="p2-compare">
              <button class="p2-cmp" id="p2-play-own">▶ Your recording</button>
              <button class="p2-cmp" id="p2-play-demo">🔊 Demo</button>
            </div>
          ` : ''}
        </div>

        ${phase === 'done' ? `<button class="btn btn-primary btn-lg p2-next" id="p2-next">${idx + 1 >= items.length ? 'Finish →' : 'Next word →'}</button>` : ''}
      </div>
    `
    inject()

    document.getElementById('p2-home').addEventListener('click', () => { cleanup(); navigate('/') })
    document.getElementById('p2-demo').addEventListener('click', () => playDemo(item))

    document.getElementById('p2-record')?.addEventListener('click', () => startRec(item))
    document.getElementById('p2-stop')?.addEventListener('click', () => stopRec(item))
    document.getElementById('p2-play-own')?.addEventListener('click', playOwn)
    document.getElementById('p2-play-demo')?.addEventListener('click', () => playDemo(item))
    document.getElementById('p2-next')?.addEventListener('click', () => {
      if (feedback?.good) goodCount++
      idx++; phase = 'ready'; lastRec = null; feedback = null; render()
    })
  }

  function renderDone() {
    container.innerHTML = `
      <div class="app-shell shell-top-center practice-shell">
        <div class="back-row"><button class="app-logo" id="p2-home">Just4Tones</button></div>
        <div class="p2-done card animate-in text-center">
          <div class="p2-done-emoji">🗣️</div>
          <h1>Speaking practice complete</h1>
          <p class="p2-done-msg">Great work producing those tones. The more you record-and-compare, the more natural it gets.</p>
          <button class="btn btn-primary btn-lg" id="p2-next">Next: Tone-change rules →</button>
          <button class="btn-link p2-done-home" id="p2-again">Practice again</button>
          <button class="btn-link p2-done-home" id="p2-back">Back to home</button>
        </div>
      </div>
    `
    inject()
    document.getElementById('p2-home').addEventListener('click', () => navigate('/'))
    document.getElementById('p2-next').addEventListener('click', () => navigate('/practice-3'))
    document.getElementById('p2-back').addEventListener('click', () => navigate('/'))
    document.getElementById('p2-again').addEventListener('click', () => {
      items = buildItems(); idx = 0; goodCount = 0; phase = 'ready'; lastRec = null; feedback = null; render()
    })

    // Persist AFTER the UI is on screen — a save error must never eat the page.
    saveResult('P2', goodCount, items.length, { focus: FOCUS })
  }

  function inject() {
    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)
  }

  function cleanup() { if (isRecording) { clearTimeout(recTimer); clearInterval(autoStopTimer); engine.stop() } stopAllAudio() }
  return cleanup
}

const scopedCSS = `
  .p2-progress { text-align: center; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 16px; }
  .p2-card { text-align: center; padding: 24px 20px; }
  .p2-char { font-size: 4rem; font-weight: 700; line-height: 1; margin-bottom: 6px; }
  .p2-pinyin { font-size: 1.6rem; color: var(--accent); font-weight: 600; margin-bottom: 4px; }
  .p2-pinyin-lg { font-size: 2rem; margin-top: 12px; }
  .p2-meaning { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 18px; }

  .p2-demo {
    background: var(--surface); border: 1px solid var(--card-border); color: var(--text-primary);
    border-radius: 24px; padding: 9px 18px; font-family: inherit; font-size: 0.9rem; cursor: pointer;
    transition: all 0.2s; margin-bottom: 22px;
  }
  .p2-demo:hover { border-color: var(--accent); color: var(--accent); }

  .p2-rec-zone { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .p2-mic {
    width: 96px; height: 96px; border-radius: 50%; border: 3px solid var(--card-border);
    background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
  }
  .p2-mic:hover { border-color: var(--accent); transform: scale(1.04); }
  .p2-mic.recording { border-color: var(--tone1); background: var(--incorrect-bg); animation: p2pulse 1.4s ease-out infinite; }
  .p2-mic-icon { font-size: 2rem; }
  @keyframes p2pulse { 0% { box-shadow: 0 0 0 0 rgba(217,154,154,0.5);} 100% { box-shadow: 0 0 0 18px rgba(217,154,154,0);} }
  .p2-rec-label { font-size: 0.82rem; color: var(--text-secondary); }
  .p2-rec-tap { color: var(--text-muted); }

  .p2-feedback { margin: 18px 0 12px; padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.95rem; font-weight: 600; }
  .p2-judges-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin: 4px 0 8px; }
  .p2-judges { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .p2-judge { border: 1.5px solid var(--card-border); border-radius: var(--radius-sm); padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .p2-judge.good { border-color: var(--correct); }
  .p2-judge.bad { border-color: var(--incorrect); }
  .p2-judge.idle { opacity: 0.5; }
  .p2-judge-icon { font-size: 1.2rem; }
  .p2-judge-name { font-size: 0.68rem; color: var(--text-secondary); font-weight: 600; }
  .p2-judge-heard { font-size: 0.85rem; font-weight: 700; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .p2-judge-verdict { font-size: 0.8rem; }
  .p2-feedback.good { background: var(--correct-bg); color: var(--correct); }
  .p2-feedback.bad { background: var(--incorrect-bg); color: var(--incorrect); }
  .p2-compare { display: flex; gap: 10px; }
  .p2-cmp {
    flex: 1; background: var(--surface); border: 1px solid var(--card-border); color: var(--text-primary);
    border-radius: var(--radius-sm); padding: 11px; font-family: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: all 0.18s;
  }
  .p2-cmp:hover { border-color: var(--accent); color: var(--accent); }

  .p2-next { width: 100%; margin-top: 18px; }

  .p2-done { padding: 32px 24px; }
  .p2-done-emoji { font-size: 3rem; margin-bottom: 8px; }
  .p2-done h1 { font-size: 1.4rem; margin-bottom: 10px; }
  .p2-done-msg { color: var(--text-secondary); line-height: 1.55; margin-bottom: 22px; }
  .p2-done .btn-primary { width: 100%; }
  .p2-done-home { margin-top: 14px; display: inline-block; }
`
