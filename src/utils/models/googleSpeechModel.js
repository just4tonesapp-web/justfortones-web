// ═══════════════════════════════════════
// Google Cloud Speech-to-Text — cloud-based tone detection
//
// Sends audio as base64 to Google's Speech API,
// gets Chinese text back, looks up tone via CHAR_TONE_MAP.
//
// Requires VITE_GOOGLE_SPEECH_API_KEY in .env.local
// Free tier: 60 minutes/month
// ═══════════════════════════════════════

import { CHAR_TONE_MAP } from './whisperModel.js'

const GOOGLE_API_URL = 'https://speech.googleapis.com/v1/speech:recognize'
let apiKey = null

export async function loadGoogleSpeech() {
  apiKey = import.meta.env.VITE_GOOGLE_SPEECH_API_KEY
  if (!apiKey) {
    throw new Error('VITE_GOOGLE_SPEECH_API_KEY not configured')
  }
}

/**
 * Detect tone via Google Cloud Speech-to-Text.
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {string|null} targetBase
 * @returns {Promise<number|null>} tone 1-4
 */
export async function detectToneWithGoogle(samples, sampleRate, targetBase = null) {
  if (!apiKey) throw new Error('Google Speech not loaded')

  const audio16k = sampleRate === 16000 ? samples : resampleTo16k(samples, sampleRate)

  // Convert Float32 to 16-bit PCM then base64
  const pcm = new Int16Array(audio16k.length)
  for (let i = 0; i < audio16k.length; i++) {
    const s = Math.max(-1, Math.min(1, audio16k[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  const bytes = new Uint8Array(pcm.buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const audioContent = btoa(binary)

  // Build speech context hints from CHAR_TONE_MAP
  const phrases = []
  if (targetBase) {
    const chars = Object.entries(CHAR_TONE_MAP)
      .filter(([, e]) => e.base === targetBase && e.tone !== 5)
      .map(([c]) => c)
    phrases.push(...chars)
  }

  const body = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'zh',
      maxAlternatives: 3,
      speechContexts: phrases.length > 0 ? [{ phrases }] : [],
    },
    audio: { content: audioContent },
  }

  let data
  try {
    const response = await fetch(`${GOOGLE_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (response.status === 403 || response.status === 401) {
      console.error('[Google] Invalid API key — disabling for session')
      apiKey = null
      return null
    }
    if (response.status === 429) {
      console.warn('[Google] Rate limited — skipping')
      return null
    }
    if (!response.ok) {
      console.warn(`[Google] HTTP ${response.status}`)
      return null
    }

    data = await response.json()
  } catch (e) {
    console.warn('[Google] Request failed:', e.message)
    return null
  }

  // Google returns results[].alternatives[].transcript
  const text = data?.results?.[0]?.alternatives?.[0]?.transcript?.trim()
  if (!text) return null

  console.log(`[Google] Transcription: "${text}"`)

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

// ── Resample to 16kHz ──
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
