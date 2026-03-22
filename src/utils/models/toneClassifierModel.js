// ═══════════════════════════════════════
// ToneClassifier — DistilHuBERT fine-tuned for Mandarin tone classification
//
// Fine-tuned on 60 syllables × 4 tones × 7 edge-tts voices + 2× augmentation.
// Input:  Float32Array [1, 48000] — 3s at 16kHz, zero-mean unit-variance
// Output: logits [1, 4] → argmax → tone (1-indexed)
// ═══════════════════════════════════════

import { InferenceSession, Tensor, env } from 'onnxruntime-web'

env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/'

const MAX_LENGTH = 48000  // 3s at 16kHz

let session = null

export async function loadToneClassifier() {
  session = await InferenceSession.create('/justfortones-web/models/tone_classifier.onnx', {
    executionProviders: ['wasm'],
  })
  return session
}

/**
 * @param {Float32Array} samples - raw audio at any sample rate
 * @param {number} sampleRate
 * @returns {Promise<number|null>} tone 1-4
 */
export async function detectToneWithClassifier(samples, sampleRate) {
  if (!session) throw new Error('ToneClassifier not loaded')

  // 1. Resample to 16kHz
  const audio = sampleRate === 16000 ? samples : resampleTo16k(samples, sampleRate)

  // 2. Pad or truncate to MAX_LENGTH
  let input = new Float32Array(MAX_LENGTH)
  input.set(audio.slice(0, MAX_LENGTH))

  // 3. Normalize: zero mean, unit variance (matches HuggingFace feature extractor)
  let mean = 0
  for (let i = 0; i < input.length; i++) mean += input[i]
  mean /= input.length
  let variance = 0
  for (let i = 0; i < input.length; i++) variance += (input[i] - mean) ** 2
  variance /= input.length
  const std = Math.sqrt(variance) + 1e-8
  for (let i = 0; i < input.length; i++) input[i] = (input[i] - mean) / std

  // 4. Run inference
  const tensor = new Tensor('float32', input, [1, MAX_LENGTH])
  const results = await session.run({ input_values: tensor })
  const logits = results.logits.data  // Float32Array of 4 values

  // 5. Argmax → tone (1-indexed)
  let best = 0
  for (let i = 1; i < 4; i++) if (logits[i] > logits[best]) best = i
  return best + 1
}

// ── Resample to 16kHz (linear interpolation) ──────────────────────────────────
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
