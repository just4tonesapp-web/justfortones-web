// ═══════════════════════════════════════
// Azure Speech — Pronunciation Assessment for Mandarin tones
//
// Uses Microsoft's SAPI phoneme system which returns explicit
// tone numbers (1-5) with accuracy scores and probability
// distribution across all tones.
//
// Requires VITE_AZURE_SPEECH_KEY and VITE_AZURE_SPEECH_REGION in .env.local
// Free tier: 5 audio hours/month (~6,000 single-syllable assessments)
// ═══════════════════════════════════════

import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import { CHAR_TONE_MAP } from './whisperModel.js'

let speechKey = null
let speechRegion = null

export async function loadAzure() {
  speechKey = import.meta.env.VITE_AZURE_SPEECH_KEY
  speechRegion = import.meta.env.VITE_AZURE_SPEECH_REGION || 'eastus'
  if (!speechKey) {
    throw new Error('VITE_AZURE_SPEECH_KEY not configured')
  }
}

/**
 * Detect tone via Azure Pronunciation Assessment.
 * Returns the tone the speaker actually produced (1-4), not just
 * whether they matched the target.
 *
 * @param {Float32Array} samples - raw audio
 * @param {number} sampleRate
 * @param {string|null} targetBase - base syllable (e.g. 'ma')
 * @param {string|null} referenceChar - the character the user should say (e.g. '妈')
 * @returns {Promise<number|null>} tone 1-4
 */
export async function detectToneWithAzure(samples, sampleRate, targetBase = null, referenceChar = null) {
  if (!speechKey) throw new Error('Azure Speech not loaded')

  // Resample to 16kHz if needed
  const audio16k = sampleRate === 16000 ? samples : resampleTo16k(samples, sampleRate)

  // Convert Float32 to Int16 PCM
  const int16 = new Int16Array(audio16k.length)
  for (let i = 0; i < audio16k.length; i++) {
    const s = Math.max(-1, Math.min(1, audio16k[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  // Create push stream with 16kHz mono 16-bit format
  const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
  const pushStream = sdk.AudioInputStream.createPushStream(format)
  pushStream.write(int16.buffer)
  pushStream.close()

  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream)
  const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion)
  speechConfig.speechRecognitionLanguage = 'zh-CN'

  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)
  // Pronunciation Assessment disabled because it forces alignment to referenceChar
  // which biases the model to always return the target tone even when user says it wrong.

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      recognizer.close()
      resolve(null)
    }, 10000)

    recognizer.recognizeOnceAsync(
      (result) => {
        clearTimeout(timeout)
        try {
          if (result.reason !== sdk.ResultReason.RecognizedSpeech) {
            console.warn(`[Azure] Recognition failed: ${sdk.ResultReason[result.reason]}`)
            recognizer.close()
            resolve(null)
            return
          }

          const text = result.text?.trim()
          if (!text) {
            recognizer.close()
            resolve(null)
            return
          }

          console.log(`[Azure] Recognized text: "${text}"`)
          const chars = [...text]
          
          // First try to match the base syllable
          if (targetBase) {
            for (const char of chars) {
              const entry = CHAR_TONE_MAP[char]
              if (entry && entry.base === targetBase && entry.tone !== 5) {
                console.log(`[Azure] Matched base "${targetBase}": "${char}" → T${entry.tone}`)
                recognizer.close()
                resolve(entry.tone)
                return
              }
            }
          }
          
          // Fallback to any recognized character with a valid tone
          for (const char of chars) {
            const entry = CHAR_TONE_MAP[char]
            if (entry && entry.tone !== 5) {
              console.log(`[Azure] Fallback match: "${char}" → T${entry.tone}`)
              recognizer.close()
              resolve(entry.tone)
              return
            }
          }

          console.log(`[Azure] No mapped character found in text: "${text}"`)
          recognizer.close()
          resolve(null)
        } catch (e) {
          console.warn('[Azure] Parse error:', e.message)
          recognizer.close()
          resolve(null)
        }
      },
      (error) => {
        clearTimeout(timeout)
        console.warn('[Azure] Recognition error:', error)
        recognizer.close()
        resolve(null)
      }
    )
  })
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
