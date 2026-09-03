// ═══════════════════════════════════════
// Azure Speech — Mandarin recognition via OUR server-side proxy.
//
// The key lives in a Supabase Edge Function secret (azure-stt), never in
// the bundle: GitHub push-protection blocks Azure keys in public repos,
// and a leaked key bills our subscription. The function returns the
// recognized zh-CN text; char→tone mapping stays here.
// (Replaced the microsoft-cognitiveservices-speech-sdk WebSocket path —
// also saves ~1MB of bundle.)
// ═══════════════════════════════════════

import { CHAR_TONE_MAP } from './whisperModel.js'
import { resampleTo16k, encodeWAV } from './groqModel.js'

let endpoint = null
let apikey = null

export async function loadAzure() {
  const base = import.meta.env.VITE_SUPABASE_URL
  apikey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!base || !apikey) {
    throw new Error('Supabase not configured — azure-stt proxy unavailable')
  }
  endpoint = `${base}/functions/v1/azure-stt`
}

function toneFromText(text, targetBase) {
  const chars = [...text]
  if (targetBase) {
    for (const char of chars) {
      const entry = CHAR_TONE_MAP[char]
      if (entry && entry.base === targetBase && entry.tone !== 5) {
        console.log(`[Azure] Matched base "${targetBase}": "${char}" → T${entry.tone}`)
        return entry.tone
      }
    }
  }
  for (const char of chars) {
    const entry = CHAR_TONE_MAP[char]
    if (entry && entry.tone !== 5) {
      console.log(`[Azure] Fallback match: "${char}" → T${entry.tone}`)
      return entry.tone
    }
  }
  console.log(`[Azure] No mapped character found in text: "${text}"`)
  return null
}

async function recognizeOnce(wavBlob) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'apikey': apikey, 'Authorization': `Bearer ${apikey}`, 'Content-Type': 'audio/wav' },
    body: wavBlob,
  })
  if (!response.ok) {
    console.warn(`[Azure] proxy HTTP ${response.status}`)
    return null
  }
  const data = await response.json()
  return data?.text?.trim() || null
}

/**
 * Detect tone via Azure recognition (through the azure-stt proxy).
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {string|null} targetBase - base syllable (e.g. 'ma')
 * @returns {Promise<number|null>} tone 1-4
 */
export async function detectToneWithAzure(samples, sampleRate, targetBase = null) {
  if (!endpoint) throw new Error('Azure proxy not loaded')

  const audio16k = sampleRate === 16000 ? samples : resampleTo16k(samples, sampleRate)
  const wavBlob = encodeWAV(audio16k, 16000)

  try {
    // Azure sometimes returns empty on valid audio — one retry, like before.
    let text = await recognizeOnce(wavBlob)
    if (!text) {
      console.log('[Azure] Retrying recognition...')
      text = await recognizeOnce(wavBlob)
    }
    if (!text) return null
    console.log(`[Azure] Recognized text: "${text}"`)
    return toneFromText(text, targetBase)
  } catch (e) {
    console.warn('[Azure] Request failed:', e.message)
    return null
  }
}
