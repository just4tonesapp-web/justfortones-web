// ═══════════════════════════════════════
// Audio helpers: tone synthesis & speech
// ═══════════════════════════════════════
import { hasRecording } from './recordingsManifest.js'

let audioCtx = null

export function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

/**
 * Play a synthesised pitch contour for a given tone number (1–4)
 * @returns {number} duration in seconds
 */
export function playToneSynth(toneNumber, duration = 0.8) {
  const ctx = ensureAudioCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.connect(gain)
  gain.connect(ctx.destination)

  const t = ctx.currentTime
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.12, t + 0.05)
  gain.gain.setValueAtTime(0.12, t + duration - 0.1)
  gain.gain.linearRampToValueAtTime(0, t + duration)

  switch (toneNumber) {
    case 1:
      osc.frequency.setValueAtTime(330, t)
      break
    case 2:
      osc.frequency.setValueAtTime(220, t)
      osc.frequency.linearRampToValueAtTime(350, t + duration)
      break
    case 3:
      osc.frequency.setValueAtTime(260, t)
      osc.frequency.linearRampToValueAtTime(196, t + duration * 0.45)
      osc.frequency.linearRampToValueAtTime(300, t + duration)
      break
    case 4:
      osc.frequency.setValueAtTime(350, t)
      osc.frequency.linearRampToValueAtTime(180, t + duration)
      break
  }

  osc.start(t)
  osc.stop(t + duration)
  return duration
}

/**
 * Try browser speech synthesis with Chinese voice, fall back to synth tone.
 * @param {string} text – pinyin with tone mark to speak
 * @param {number} tone – tone number 1-4 (fallback)
 * @param {Function} [onEnd] – callback when done
 */
/**
 * Speak a Chinese character/word using zh-CN TTS, falling back to tone synth.
 * @param {string} char - Chinese character(s) to speak (NOT pinyin)
 * @param {number} tone - tone number 1-4 (used only for synth fallback)
 * @param {Function} [onEnd]
 */
export function speakChinese(char, tone, onEnd) {
  if ('speechSynthesis' in window && char) {
    const u = new SpeechSynthesisUtterance(char)
    u.lang = 'zh-CN'
    u.rate = 0.8

    const voices = speechSynthesis.getVoices()
    const zh = voices.find(v => v.lang === 'zh-CN') || voices.find(v => v.lang.startsWith('zh'))
    if (zh) {
      u.voice = zh
      u.onend = () => onEnd?.()
      u.onerror = () => {
        const d = playToneSynth(tone)
        setTimeout(() => onEnd?.(), d * 1000 + 100)
      }
      speechSynthesis.speak(u)
      return
    }
  }
  const d = playToneSynth(tone)
  setTimeout(() => onEnd?.(), d * 1000 + 100)
}

// Preload voices
if ('speechSynthesis' in window) {
  speechSynthesis.getVoices()
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices()
}

/**
 * Play the human-recorded m4a for a given pinyin syllable + tone.
 * Falls back to synthesised tone if the file is missing or fails to load.
 *
 * @param {string} syllable  bare pinyin (e.g. 'ma', 'xiao')
 * @param {number} tone      1-4
 * @param {Function} [onEnd] callback fired when playback (or fallback) finishes
 */
export function playSyllable(syllable, tone, onEnd) {
  if (!hasRecording(syllable, tone)) {
    const d = playToneSynth(tone)
    setTimeout(() => onEnd?.(), d * 1000 + 100)
    return
  }
  const url = `${import.meta.env.BASE_URL}audio/syllables/${syllable}${tone}.m4a`
  const audio = new Audio(url)
  let done = false
  const finish = () => { if (done) return; done = true; onEnd?.() }
  audio.addEventListener('ended', finish)
  audio.addEventListener('error', () => {
    if (done) return
    done = true
    const d = playToneSynth(tone)
    setTimeout(() => onEnd?.(), d * 1000 + 100)
  })
  audio.play().catch(() => {
    if (done) return
    done = true
    const d = playToneSynth(tone)
    setTimeout(() => onEnd?.(), d * 1000 + 100)
  })
}
