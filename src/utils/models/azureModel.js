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

  // Configure pronunciation assessment
  // Use referenceChar if available for more accurate scoring
  const refText = referenceChar || '他' // fallback to a common character
  const pronConfig = new sdk.PronunciationAssessmentConfig(
    refText,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Phoneme,
    false
  )
  pronConfig.phonemeAlphabet = 'SAPI'
  pronConfig.enableProsodyAssessment = true

  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)
  pronConfig.applyTo(recognizer)

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

          // Parse detailed JSON for phoneme-level tone data
          const jsonStr = result.properties.getProperty(
            sdk.PropertyId.SpeechServiceResponse_JsonResult
          )
          if (!jsonStr) {
            recognizer.close()
            resolve(null)
            return
          }

          const detail = JSON.parse(jsonStr)
          const nbest = detail?.NBest?.[0]
          if (!nbest?.Words?.length) {
            recognizer.close()
            resolve(null)
            return
          }

          // Look through all words/phonemes for tone phonemes (1-5)
          for (const word of nbest.Words) {
            if (!word.Phonemes) continue
            for (const phoneme of word.Phonemes) {
              if (/^[1-4]$/.test(phoneme.Phoneme)) {
                const detectedTone = parseInt(phoneme.Phoneme)
                const accuracy = phoneme.PronunciationAssessment?.AccuracyScore || 0

                // Also check NBestPhonemes for the actual distribution
                const nbestPhonemes = phoneme.PronunciationAssessment?.NBestPhonemes
                if (nbestPhonemes) {
                  const topTone = nbestPhonemes.find(p => /^[1-4]$/.test(p.Phoneme))
                  if (topTone) {
                    console.log(`[Azure] Tone: T${topTone.Phoneme} (score=${topTone.Score}), dist: ${nbestPhonemes.filter(p => /^[1-5]$/.test(p.Phoneme)).map(p => `T${p.Phoneme}:${p.Score}`).join(' ')}`)
                    recognizer.close()
                    resolve(parseInt(topTone.Phoneme))
                    return
                  }
                }

                console.log(`[Azure] Tone: T${detectedTone} (accuracy=${accuracy})`)
                recognizer.close()
                resolve(detectedTone)
                return
              }
            }
          }

          // Fallback: if no tone phoneme found, try to get tone from recognized text
          const text = result.text?.trim()
          if (text) {
            console.log(`[Azure] No tone phoneme found, text: "${text}"`)
          }
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
