// ═══════════════════════════════════════
// Groq Whisper API — cloud-based tone detection
//
// Sends recorded audio as WAV to Groq's Whisper-large-v3 endpoint,
// gets Chinese text back, looks up tone via CHAR_TONE_MAP.
//
// API key stored in localStorage (never baked into build bundle).
// Set via browser console: localStorage.setItem('j4t_groq_key', 'gsk_...')
// Free tier: generous limits. Cost after: ~$0.006/min
// ═══════════════════════════════════════

import { CHAR_TONE_MAP } from './whisperModel.js'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
let apiKey = null

/**
 * "Load" = check for API key in localStorage. Throws if not configured.
 */
export async function loadGroq() {
  apiKey = localStorage.getItem('j4t_groq_key')
  if (!apiKey) {
    throw new Error('Groq API key not set — run: localStorage.setItem("j4t_groq_key", "gsk_...")')
  }
}

/**
 * Detect tone by sending audio to Groq Whisper API.
 * @param {Float32Array} samples - raw audio at any sample rate
 * @param {number} sampleRate
 * @param {string|null} targetBase - base syllable hint
 * @returns {Promise<number|null>} tone 1-4
 */
export async function detectToneWithGroq(samples, sampleRate, targetBase = null) {
  if (!apiKey) throw new Error('Groq not loaded')

  // Resample to 16kHz for smaller upload + better Whisper accuracy
  const audio16k = sampleRate === 16000 ? samples : resampleTo16k(samples, sampleRate)

  // Encode as WAV
  const wavBlob = encodeWAV(audio16k, 16000)

  // POST to Groq
  const formData = new FormData()
  formData.append('file', wavBlob, 'audio.wav')
  formData.append('model', 'whisper-large-v3')
  formData.append('language', 'zh')
  formData.append('response_format', 'json')

  let result
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    })

    if (response.status === 401) {
      console.error('[Groq] Invalid API key — disabling for session')
      apiKey = null
      return null
    }
    if (response.status === 429) {
      console.warn('[Groq] Rate limited — skipping')
      return null
    }
    if (!response.ok) {
      console.warn(`[Groq] HTTP ${response.status}`)
      return null
    }

    result = await response.json()
  } catch (e) {
    console.warn('[Groq] Request failed:', e.message)
    return null
  }

  const text = result?.text?.trim()
  if (!text) return null

  console.log(`[Groq] Transcription: "${text}"`)

  // Look up tone from characters
  const chars = [...text]

  if (targetBase) {
    for (const char of chars) {
      const entry = CHAR_TONE_MAP[char]
      if (entry && entry.base === targetBase && entry.tone !== 5) return entry.tone
    }
  }

  for (const char of chars) {
    const entry = CHAR_TONE_MAP[char]
    if (entry && entry.tone !== 5) return entry.tone
  }

  return null
}

// ── Resample to 16kHz (linear interpolation) ──
function resampleTo16k(samples, fromRate) {
  const ratio = fromRate / 16000
  const out = new Float32Array(Math.floor(samples.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const src = i * ratio
    const lo = Math.floor(src), hi = Math.min(lo + 1, samples.length - 1)
    out[i] = samples[lo] * (1 - (src - lo)) + samples[hi] * (src - lo)
  }
  return out
}

// ── Encode Float32Array as 16-bit PCM WAV blob ──
function encodeWAV(samples, sampleRate) {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = samples.length * (bitsPerSample / 8)
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM samples (clamp float32 → int16)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
