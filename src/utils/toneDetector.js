// ═══════════════════════════════════════
// ToneDetector — Ensemble tone classifier
//
// Runs all available models in parallel, combines results
// via weighted vote based on known model accuracy.
//
// Model weights (from published accuracy):
//   ToneNet     0.99  (Interspeech 2019 CNN, ~99%)
//   SenseVoice  0.92  (Alibaba ASR, ~90-95%)
//   Whisper     0.75  (OpenAI ASR, ~70-80% on single syllables)
//   Pitch       0.55  (Improved YIN/ACF2PLUS, ~55-65%)
// ═══════════════════════════════════════
import { detectToneWithPitch, getPitchContour } from './models/pitchModel.js'
import { loadWhisper, detectToneWithWhisper } from './models/whisperModel.js'
import { loadToneNet, detectToneWithToneNet } from './models/tonetModel.js'
import { loadSenseVoice, detectToneWithSenseVoice } from './models/sensevoiceModel.js'
import { loadToneClassifier, detectToneWithClassifier } from './models/toneClassifierModel.js'
import { loadWebSpeech, detectToneFromText } from './models/webSpeechModel.js'
import { loadGroq, detectToneWithGroq } from './models/groqModel.js'
import { loadDeepgram, detectToneWithDeepgram } from './models/deepgramModel.js'

const MODEL_WEIGHTS = {
  groq:       1.50,   // Tier 1: cloud ASR (highest accuracy)
  deepgram:   1.20,   // Tier 1: cloud ASR
  sensevoice: 1.00,   // Tier 2: in-browser ASR (stub, not yet active)
  whisper:    0.50,   // Tier 2: in-browser ASR
  pitch:      0.35,   // Tier 3: signal-based
  classifier: 0.20,   // Tier 3: signal-based (low accuracy)
}

export class ToneDetector {
  constructor() {
    this.loaded = {}   // model name → true if ready
    this.failed = {}   // model name → true if load failed
    this._loading = {} // model name → promise
  }

  /**
   * Load all models in the background.
   * Safe to call multiple times — each model loads only once.
   * @param {Function} onStatus - (modelName, status, progress) callback for UI
   */
  async init(onStatus) {
    const load = (name, fn) => {
      if (this.loaded[name] || this._loading[name]) return this._loading[name]
      onStatus?.(name, 'loading', 0)
      this._loading[name] = fn()
        .then(() => {
          this.loaded[name] = true
          onStatus?.(name, 'ready', 100)
        })
        .catch(e => {
          this.failed[name] = true
          console.warn(`[ToneDetector] ${name} failed:`, e.message || e)
          onStatus?.(name, 'unavailable', 0)
        })
      return this._loading[name]
    }

    // All load in parallel — stubs fail instantly, real models load async
    // ToneNet disabled: always outputs T4 (domain shift)
    // WebSpeech disabled: coi-serviceworker's COOP header blocks Web Speech API
    // Whisper: requires SharedArrayBuffer via coi-serviceworker
    await Promise.allSettled([
      // load('webSpeech', loadWebSpeech),
      load('groq', loadGroq),
      load('deepgram', loadDeepgram),
      load('classifier', loadToneClassifier),
      load('whisper', () => loadWhisper((status, pct) => onStatus?.('whisper', status, pct))),
      // load('tonenet', loadToneNet),
      load('sensevoice', loadSenseVoice),
    ])
  }

  /** Which models are currently active */
  get activeModels() {
    return ['pitch', ...Object.keys(this.loaded).filter(k => this.loaded[k])]
  }

  /**
   * Detect tone — runs all active models in parallel, returns ensemble result.
   *
   * @param {{ samples: Float32Array, sampleRate: number }} audio
   * @param {string|null} targetBase - base syllable hint (e.g. 'ma') for ASR models
   * @param {number|null} targetTone - correct tone (for scoring), not used in detection
   * @returns {Promise<{
   *   tone: number|null,
   *   confidence: number,   // 0-100, weighted agreement
   *   agreement: number,    // 0-100, % of models that agree
   *   scores: object,       // { 1: weight, 2: weight, 3: weight, 4: weight }
   *   results: Array,       // per-model results
   *   userContour: number[] // pitch contour for canvas (5 points, 1-5 scale)
   * }>}
   */
  async detect({ samples, sampleRate }, targetBase = null, { webSpeechText = null } = {}) {
    // Trim leading/trailing silence so models see only the voiced syllable
    samples = trimSilence(samples, sampleRate)
    const jobs = []

    // ── Pitch model (always available, sync) ──
    jobs.push(
      Promise.resolve()
        .then(() => detectToneWithPitch(samples, sampleRate))
        .then(tone => tone !== null ? { model: 'pitch', tone, weight: MODEL_WEIGHTS.pitch } : null)
        .catch(() => null)
    )

    // ── Web Speech API (result passed in from testCView) ──
    if (this.loaded.webSpeech && webSpeechText) {
      const tone = detectToneFromText(webSpeechText, targetBase)
      if (tone) {
        jobs.push(Promise.resolve({ model: 'webSpeech', tone, weight: MODEL_WEIGHTS.webSpeech }))
      }
    }

    // ── Groq Whisper API ──
    if (this.loaded.groq) {
      jobs.push(
        detectToneWithGroq(samples, sampleRate, targetBase)
          .then(tone => tone !== null ? { model: 'groq', tone, weight: MODEL_WEIGHTS.groq } : null)
          .catch(() => null)
      )
    }

    // ── Deepgram Nova-2 ──
    if (this.loaded.deepgram) {
      jobs.push(
        detectToneWithDeepgram(samples, sampleRate, targetBase)
          .then(tone => tone !== null ? { model: 'deepgram', tone, weight: MODEL_WEIGHTS.deepgram } : null)
          .catch(() => null)
      )
    }

    // ── ToneClassifier (DistilHuBERT fine-tuned) ──
    if (this.loaded.classifier) {
      jobs.push(
        detectToneWithClassifier(samples, sampleRate)
          .then(tone => tone !== null ? { model: 'classifier', tone, weight: MODEL_WEIGHTS.classifier } : null)
          .catch(() => null)
      )
    }

    // ── Whisper ──
    if (this.loaded.whisper) {
      jobs.push(
        detectToneWithWhisper(samples, sampleRate, targetBase)
          .then(tone => tone !== null ? { model: 'whisper', tone, weight: MODEL_WEIGHTS.whisper } : null)
          .catch(() => null)
      )
    }

    // ── ToneNet ──
    if (this.loaded.tonenet) {
      jobs.push(
        detectToneWithToneNet(samples, sampleRate)
          .then(tone => tone !== null ? { model: 'tonenet', tone, weight: MODEL_WEIGHTS.tonenet } : null)
          .catch(() => null)
      )
    }

    // ── SenseVoice ──
    if (this.loaded.sensevoice) {
      jobs.push(
        detectToneWithSenseVoice(samples, sampleRate, targetBase)
          .then(tone => tone !== null ? { model: 'sensevoice', tone, weight: MODEL_WEIGHTS.sensevoice } : null)
          .catch(() => null)
      )
    }

    // Run all in parallel
    const results = (await Promise.all(jobs)).filter(Boolean)

    // Debug: log each model's vote
    const voteStr = results.map(r => `${r.model}→T${r.tone}(w=${r.weight})`).join('  ')
    const combined = this._combine(results)
    console.log(`[ensemble] ${voteStr}  ▶ T${combined.tone} (conf=${combined.confidence}%)`)

    // Pitch contour for canvas drawing (visual only, independent of ensemble)
    const userContour = getPitchContour(samples, sampleRate)

    return { ...combined, userContour, results }
  }

  _combine(results) {
    if (results.length === 0) {
      return { tone: null, confidence: 0, agreement: 0, scores: { 1: 0, 2: 0, 3: 0, 4: 0 } }
    }

    const scores = { 1: 0, 2: 0, 3: 0, 4: 0 }
    let totalWeight = 0

    for (const r of results) {
      scores[r.tone] = (scores[r.tone] || 0) + r.weight
      totalWeight += r.weight
    }

    // Groq override: if Groq's weight exceeds 40% of total voting weight, trust it
    const groqResult = results.find(r => r.model === 'groq')
    if (groqResult && (groqResult.weight / totalWeight) > 0.40) {
      const agreeing = results.filter(r => r.tone === groqResult.tone).length
      return {
        tone: groqResult.tone,
        confidence: Math.round((groqResult.weight / totalWeight) * 100),
        agreement: Math.round((agreeing / results.length) * 100),
        scores,
      }
    }

    // Normal weighted vote: highest weighted score wins
    const tone = parseInt(Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0])
    const confidence = Math.round((scores[tone] / totalWeight) * 100)

    const agreeing = results.filter(r => r.tone === tone).length
    const agreement = Math.round((agreeing / results.length) * 100)

    return { tone, confidence, agreement, scores }
  }
}

// Singleton — one instance shared across views
export const toneDetector = new ToneDetector()

// ── Silence trimmer ──────────────────────────────────────────────────────────
function trimSilence(samples, sampleRate, rmsThreshold = 0.008) {
  const frameSize = Math.floor(sampleRate * 0.02) // 20ms frames
  let start = 0
  let end = samples.length

  for (let i = 0; i + frameSize <= samples.length; i += frameSize) {
    let sum = 0
    for (let j = i; j < i + frameSize; j++) sum += samples[j] * samples[j]
    if (Math.sqrt(sum / frameSize) > rmsThreshold) {
      start = Math.max(0, i - frameSize) // keep one frame of pre-roll
      break
    }
  }

  for (let i = samples.length - frameSize; i >= 0; i -= frameSize) {
    let sum = 0
    for (let j = i; j < i + frameSize; j++) sum += samples[j] * samples[j]
    if (Math.sqrt(sum / frameSize) > rmsThreshold) {
      end = Math.min(samples.length, i + 2 * frameSize)
      break
    }
  }

  return start < end ? samples.slice(start, end) : samples
}
