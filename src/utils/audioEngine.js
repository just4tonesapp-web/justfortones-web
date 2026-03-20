// ═══════════════════════════════════════
// AudioEngine – Mic recording + raw PCM capture
// Now collects both pitch history (legacy) AND raw samples (for ensemble models)
// ═══════════════════════════════════════
import { YIN } from 'pitchfinder'

export class AudioEngine {
  constructor() {
    this.audioContext = null
    this.detectPitch = null
    this.isRecording = false
    this.stream = null
    this.analyser = null
    this.source = null
    this.pitchHistory = []   // { time, pitch, rms } — kept for legacy/canvas use
    this.rawChunks = []      // Float32Array chunks — for ensemble models
    this.startTime = 0
    this._raf = null
  }

  async start() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (this.audioContext.state === 'suspended') await this.audioContext.resume()

    const sampleRate = this.audioContext.sampleRate
    this.detectPitch = YIN({ sampleRate })

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.source.connect(this.analyser)

      // ScriptProcessorNode gives non-overlapping PCM chunks (unlike getFloatTimeDomainData)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      this.pitchHistory = []
      this.rawChunks = []
      this.isRecording = true
      this.startTime = performance.now()

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return
        this.rawChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      }

      this._loop()
      return true
    } catch (err) {
      console.error('Mic access error:', err)
      return false
    }
  }

  _loop() {
    if (!this.isRecording) return
    const buffer = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(buffer)

    // RMS volume level
    let sum = 0
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
    const rms = Math.sqrt(sum / buffer.length)

    // Pitch detection (only when there's audible signal)
    let pitch = null
    if (rms > 0.01) {
      pitch = this.detectPitch(buffer)
      // Filter out implausible values (human voice ~80-500 Hz)
      if (pitch && (pitch < 60 || pitch > 600)) pitch = null
    }

    const time = performance.now() - this.startTime
    this.pitchHistory.push({ time, pitch, rms })

    this._raf = requestAnimationFrame(() => this._loop())
  }

  /** Get current instantaneous pitch (Hz) or null */
  getPitch() {
    if (!this.isRecording || !this.analyser) return null
    const buffer = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(buffer)
    const pitch = this.detectPitch(buffer)
    return (pitch && pitch > 60 && pitch < 600) ? pitch : null
  }

  /** Get current RMS level (0-1 range, useful for visual feedback) */
  getRMS() {
    if (!this.analyser) return 0
    const buffer = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(buffer)
    let sum = 0
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
    return Math.sqrt(sum / buffer.length)
  }

  stop() {
    this.isRecording = false
    if (this._raf) cancelAnimationFrame(this._raf)
    if (this.processor) { this.processor.disconnect(); this.processor = null }
    if (this.stream) this.stream.getTracks().forEach(t => t.stop())

    // Concatenate raw chunks into a single Float32Array for ensemble models
    const totalLen = this.rawChunks.reduce((s, c) => s + c.length, 0)
    const samples = new Float32Array(totalLen)
    let offset = 0
    for (const chunk of this.rawChunks) { samples.set(chunk, offset); offset += chunk.length }

    return {
      pitchHistory: this.pitchHistory,
      samples,
      sampleRate: this.audioContext.sampleRate,
    }
  }

  /** Get only the valid pitch values as an array of Hz */
  getValidPitches() {
    return this.pitchHistory
      .filter(p => p.pitch !== null)
      .map(p => p.pitch)
  }
}

// ═══════════════════════════════════════
// Tone Analysis
// ═══════════════════════════════════════

/**
 * Ideal tone contour shapes (normalized 0-1 over time → pitch level 1-5)
 * Based on Chao's five-level system:
 *   Tone 1: 55 (high flat)
 *   Tone 2: 35 (mid-rising)
 *   Tone 3: 214 (low-dipping)
 *   Tone 4: 51 (high-falling)
 */
const TONE_CONTOURS = {
  1: [5, 5, 5, 5, 5],           // flat high
  2: [3, 3.5, 4, 4.5, 5],       // rising
  3: [2, 1.5, 1, 1.5, 4],       // dipping
  4: [5, 4, 3, 2, 1],           // falling
}

/**
 * Normalize an array of Hz values to a 1-5 scale relative to the speaker's range.
 * Uses the min/max of the recording as the speaker's range.
 */
function normalizePitches(pitches) {
  if (pitches.length === 0) return []
  const min = Math.min(...pitches)
  const max = Math.max(...pitches)
  const range = max - min || 1  // avoid div by zero
  return pitches.map(p => 1 + ((p - min) / range) * 4) // scale to 1-5
}

/**
 * Resample an array to exactly `n` points using linear interpolation.
 */
function resample(arr, n) {
  if (arr.length === 0) return new Array(n).fill(3)
  if (arr.length === 1) return new Array(n).fill(arr[0])
  const result = []
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (arr.length - 1)
    const lo = Math.floor(t)
    const hi = Math.min(lo + 1, arr.length - 1)
    const frac = t - lo
    result.push(arr[lo] * (1 - frac) + arr[hi] * frac)
  }
  return result
}

/**
 * Score how well a recorded pitch contour matches a target tone (1-4).
 * Returns { score: 0-100, detectedTone: 1-4, contour: number[] }
 */
export function analyzeTone(pitchHistory, targetTone) {
  const validPitches = pitchHistory
    .filter(p => p.pitch !== null)
    .map(p => p.pitch)

  // Not enough data
  if (validPitches.length < 5) {
    return { score: 0, detectedTone: null, userContour: [], targetContour: TONE_CONTOURS[targetTone] }
  }

  // Normalize and resample to 5 points
  const normalized = normalizePitches(validPitches)
  const userContour = resample(normalized, 5)
  const targetContour = TONE_CONTOURS[targetTone]

  // Compute correlation/similarity with each tone
  const scores = {}
  for (let t = 1; t <= 4; t++) {
    const ref = TONE_CONTOURS[t]
    let diffSum = 0
    for (let i = 0; i < 5; i++) {
      diffSum += Math.abs(userContour[i] - ref[i])
    }
    // Max possible diff is 4*5=20, convert to 0-100
    const similarity = Math.max(0, 100 - (diffSum / 20) * 100)
    scores[t] = similarity
  }

  // Find best matching tone
  const detectedTone = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]
  const score = Math.round(scores[targetTone])

  return {
    score,
    detectedTone: parseInt(detectedTone),
    userContour,
    targetContour,
    allScores: scores,
  }
}