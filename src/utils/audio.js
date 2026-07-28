// ═══════════════════════════════════════
// Audio helpers: tone synthesis & speech
// ═══════════════════════════════════════
import { hasRecording } from './recordingsManifest.js'
import { findDisyllableRecording } from './disyllableManifest.js'

let audioCtx = null

export function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// ── Active-audio tracking — lets us cancel any in-flight playback ──
const _activeAudios = new Set()

/**
 * Stop every audio element currently playing AND any browser speechSynthesis
 * utterance. Call this when advancing to a new question so that lingering
 * audio from the previous question doesn't keep playing.
 */
export function stopAllAudio() {
  if ('speechSynthesis' in window) {
    try { speechSynthesis.cancel() } catch (e) { /* ignore */ }
  }
  for (const a of _activeAudios) {
    try {
      a.pause()
      a.currentTime = 0
    } catch (e) { /* ignore */ }
  }
  _activeAudios.clear()
}

function trackAudio(a) {
  _activeAudios.add(a)
  const cleanup = () => _activeAudios.delete(a)
  a.addEventListener('ended', cleanup)
  a.addEventListener('error', cleanup)
  a.addEventListener('pause', cleanup)
}

/**
 * Play an arbitrary clip under /audio (e.g. a tone-change recording).
 * @param {string} relPath e.g. 'tone-change/33/ni3hao3.m4a'
 */
export function playClip(relPath, onEnd) {
  stopAllAudio()
  const audio = new Audio(`${import.meta.env.BASE_URL}audio/${relPath}`)
  trackAudio(audio)
  if (onEnd) audio.addEventListener('ended', onEnd)
  audio.play().catch(() => {})
  return audio
}

/**
 * Play raw PCM samples through an HTMLAudioElement (WAV-encoded).
 * Media elements use the same playback route as the demo recordings, which is
 * far more reliable on iOS / in-app browsers than a WebAudio context that may
 * sit in a 'suspended'/'interrupted' state after mic capture.
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {Function} [onEnd]
 */
export function playPcm(samples, sampleRate, onEnd) {
  stopAllAudio()
  const url = URL.createObjectURL(encodeWavPcm16(samples, sampleRate))
  const audio = new Audio(url)
  trackAudio(audio)
  let done = false
  const finish = () => {
    if (done) return
    done = true
    URL.revokeObjectURL(url)
    onEnd?.()
  }
  audio.addEventListener('ended', finish)
  audio.addEventListener('error', finish)
  audio.play().catch(finish)
  return audio
}

function encodeWavPcm16(samples, sampleRate) {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)             // PCM
  v.setUint16(22, 1, true)             // mono
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  writeStr(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buf], { type: 'audio/wav' })
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
  stopAllAudio()
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
  stopAllAudio()
  if (!hasRecording(syllable, tone)) {
    const d = playToneSynth(tone)
    setTimeout(() => onEnd?.(), d * 1000 + 100)
    return
  }
  const url = `${import.meta.env.BASE_URL}audio/syllables/${syllable}${tone}.m4a`
  const audio = new Audio(url)
  trackAudio(audio)
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

/**
 * Play the human-recorded m4a for a disyllabic combo (Test B / D).
 * Falls back to playing both syllables sequentially via playSyllable, then synth.
 */
export function playDisyllable(syl1, tone1, syl2, tone2, onEnd) {
  stopAllAudio()
  const rel = findDisyllableRecording(syl1, tone1, syl2, tone2)
  if (!rel) {
    playSyllable(syl1, tone1, () => {
      setTimeout(() => playSyllable(syl2, tone2, onEnd), 120)
    })
    return
  }
  const url = `${import.meta.env.BASE_URL}${rel}`
  const audio = new Audio(url)
  trackAudio(audio)
  let done = false
  const finish = () => { if (done) return; done = true; onEnd?.() }
  audio.addEventListener('ended', finish)
  audio.addEventListener('error', () => {
    if (done) return
    done = true
    playSyllable(syl1, tone1, () => {
      setTimeout(() => playSyllable(syl2, tone2, onEnd), 120)
    })
  })
  audio.play().catch(() => {
    if (done) return
    done = true
    playSyllable(syl1, tone1, () => {
      setTimeout(() => playSyllable(syl2, tone2, onEnd), 120)
    })
  })
}
