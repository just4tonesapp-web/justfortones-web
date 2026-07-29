// ═══════════════════════════════════════
// OpenRouter model — tone detection via an audio-capable LLM
// (default: google/gemini-2.5-flash through openrouter.ai).
//
// Unlike the ASR models (which transcribe → look up the character's tone,
// and suffer real-word bias), the LLM is asked directly for the tone it
// HEARS. One OpenRouter key gives access to many audio models; switch with
// VITE_OPENROUTER_MODEL.
//
// ⚠️ The key ships inside the client bundle (like every VITE_* key here) —
// create it at openrouter.ai with a low credit limit.
// ═══════════════════════════════════════
import { resampleTo16k, encodeWAV } from './groqModel.js'

const API_URL = 'https://openrouter.ai/api/v1/chat/completions'

let apiKey = null
let model = 'google/gemini-2.5-flash'

export async function loadOpenRouter() {
  apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  model = import.meta.env.VITE_OPENROUTER_MODEL || model
  if (!apiKey) {
    throw new Error('VITE_OPENROUTER_API_KEY not configured')
  }
}

function toBase64(blob) {
  return blob.arrayBuffer().then(buf => {
    const bytes = new Uint8Array(buf)
    let bin = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return btoa(bin)
  })
}

/**
 * Detect the spoken Mandarin tone via an audio LLM.
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {string|null} targetBase - base syllable (no tone) as context
 * @returns {Promise<number|null>} tone 1-4
 */
export async function detectToneWithOpenRouter(samples, sampleRate, targetBase = null) {
  if (!apiKey) throw new Error('OpenRouter not loaded')

  const audio16k = sampleRate === 16000 ? samples : resampleTo16k(samples, sampleRate)
  const b64 = await toBase64(encodeWAV(audio16k, 16000))

  const prompt =
    'You will hear one Mandarin Chinese syllable spoken in isolation' +
    (targetBase ? ` (the syllable is "${targetBase}")` : '') +
    '. Identify the lexical tone the speaker ACTUALLY produced, based only on ' +
    'the pitch contour you hear — not the most common word: ' +
    '1 = high level, 2 = rising, 3 = low dipping, 4 = falling. ' +
    'Reply with ONLY the single digit 1, 2, 3, or 4.'

  let result
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'input_audio', input_audio: { data: b64, format: 'wav' } },
          ],
        }],
      }),
    })

    if (response.status === 401 || response.status === 403) {
      console.error('[OpenRouter] Invalid API key — disabling for session')
      apiKey = null
      return null
    }
    if (response.status === 402) {
      console.warn('[OpenRouter] Out of credits — disabling for session')
      apiKey = null
      return null
    }
    if (response.status === 429) {
      console.warn('[OpenRouter] Rate limited — skipping')
      return null
    }
    if (!response.ok) {
      console.warn(`[OpenRouter] HTTP ${response.status}`)
      return null
    }
    result = await response.json()
  } catch (e) {
    console.warn('[OpenRouter] Request failed:', e.message)
    return null
  }

  const text = result?.choices?.[0]?.message?.content?.trim()
  if (!text) return null
  console.log(`[OpenRouter] ${model}: "${text}"`)

  const m = text.match(/[1-4]/)
  return m ? parseInt(m[0]) : null
}
