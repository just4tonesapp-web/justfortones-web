// ═══════════════════════════════════════
// Pitch Model — improved pitch-based tone detection
// Replaces the basic YIN approach with:
//   - ACF2PLUS + YIN dual-detector (takes more confident result)
//   - Percentile-based normalization (robust to outliers)
//   - Pearson correlation against 10-point contour templates
//   - RMS gating to ignore silence frames
// Accuracy estimate: ~55-65% (vs ~10% for original YIN approach)
// ═══════════════════════════════════════
import { ACF2PLUS, YIN } from 'pitchfinder'
import { splitDisyllableAudio } from '../audioSplit.js'

/**
 * Peak-normalize samples so quiet recordings aren't killed by the absolute
 * RMS gates below (a soft voice used to lose most frames → null detection and
 * an empty canvas contour). Silence stays silent: below `floor` we don't
 * amplify (that would just boost the noise floor into fake pitches).
 */
export function normalizePeak(samples, target = 0.9, floor = 0.01) {
  if (!samples.length) return samples
  // 99.5th-percentile "peak" — a single click/pop shouldn't steal the gain
  // from an otherwise quiet take.
  const mags = Float32Array.from(samples, Math.abs).sort()
  const peak = mags[Math.min(mags.length - 1, Math.floor(mags.length * 0.995))]
  if (peak < floor || peak >= target) return samples
  const gain = target / peak
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = Math.max(-1, Math.min(1, samples[i] * gain))
  return out
}

// 10-point Chao tone contours (1–5 pitch level scale)
const TONE_CONTOURS = {
  1: [5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0], // flat high (55)
  2: [3.0, 3.2, 3.5, 3.8, 4.0, 4.2, 4.5, 4.8, 5.0, 5.0], // mid-rising (35)
  3: [2.0, 1.8, 1.5, 1.2, 1.0, 1.0, 1.2, 2.0, 3.5, 4.0], // low-dipping (214)
  4: [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 1.0], // high-falling (51)
}

/**
 * Detect Mandarin tone from raw PCM samples using improved pitch analysis.
 * @param {Float32Array} samples - raw audio samples
 * @param {number} sampleRate
 * @returns {number|null} detected tone (1-4) or null if insufficient signal
 */
/** Framewise pitch extraction shared by all detectors.
 *  The silence gate is RELATIVE to the take's own loudest frame: after peak
 *  normalization an absolute gate lets amplified background noise through,
 *  which the pitch trackers turn into 70/600Hz garbage (seen on a real noisy
 *  recording 2026-09-03). */
function collectPitches(samples, sampleRate) {
  const acf = ACF2PLUS({ sampleRate })
  const yin = YIN({ sampleRate })
  const frameSize = 2048
  const hopSize = Math.floor(frameSize / 2)
  const frames = []
  let maxRms = 0
  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const frame = samples.slice(start, start + frameSize)
    let rms = 0
    for (let i = 0; i < frame.length; i++) rms += frame[i] * frame[i]
    rms = Math.sqrt(rms / frame.length)
    if (rms > maxRms) maxRms = rms
    frames.push({ frame, rms })
  }
  const gate = Math.max(0.008, maxRms * 0.2)
  const pitches = []
  for (const { frame, rms } of frames) {
    if (rms < gate) continue
    let pitch = acf(frame)
    if (!pitch || pitch < 70 || pitch > 600) pitch = yin(frame)
    // 70/600 are the trackers' clamp values — on real voice they're octave
    // errors or noise, not data.
    if (pitch && pitch > 72 && pitch < 580) pitches.push(pitch)
  }
  return pitches
}

/** Isolate the dominant utterance: a long take (auto-stop misfire, repeated
 *  attempts, room noise) can contain several sound bursts — keep the most
 *  energetic contiguous voiced stretch, bridging pauses under 250ms. */
export function trimToUtterance(samples, sampleRate) {
  const frame = Math.max(1, Math.floor(sampleRate * 0.03))
  const rms = []
  for (let i = 0; i + frame <= samples.length; i += frame) {
    let s = 0
    for (let j = i; j < i + frame; j++) s += samples[j] * samples[j]
    rms.push(Math.sqrt(s / frame))
  }
  const maxR = Math.max(...rms, 0)
  if (maxR === 0) return samples
  const th = maxR * 0.22
  const bridge = Math.round(250 / 30) // frames of allowed gap
  const segs = []
  let start = -1, quiet = 0
  for (let i = 0; i < rms.length; i++) {
    if (rms[i] >= th) {
      if (start < 0) start = i
      quiet = 0
    } else if (start >= 0 && ++quiet > bridge) {
      segs.push([start, i - quiet])
      start = -1; quiet = 0
    }
  }
  if (start >= 0) segs.push([start, rms.length - 1])
  if (!segs.length) return samples
  let best = segs[0], bestE = -1
  for (const [a, b] of segs) {
    let e = 0
    for (let i = a; i <= b; i++) e += rms[i] * rms[i]
    if (e > bestE) { bestE = e; best = [a, b] }
  }
  const pad = Math.floor(sampleRate * 0.1)
  const from = Math.max(0, best[0] * frame - pad)
  const to = Math.min(samples.length, (best[1] + 1) * frame + pad)
  return samples.slice(from, to)
}

export function detectToneWithPitch(samples, sampleRate) {
  samples = trimToUtterance(normalizePeak(samples), sampleRate)
  const pitches = collectPitches(samples, sampleRate)

  if (pitches.length < 4) return null

  // Percentile-based normalization — trim the 10th/90th to reduce outlier distortion
  const sorted = [...pitches].sort((a, b) => a - b)
  const p10 = sorted[Math.floor(sorted.length * 0.1)]
  const p90 = sorted[Math.floor(sorted.length * 0.9)]
  const rawRange = p90 - p10
  const rawMean  = pitches.reduce((s, v) => s + v, 0) / pitches.length

  // Flatness check in raw Hz — before normalization amplifies noise.
  // If pitch barely moves (< 8% of mean Hz), it's a flat high tone → tone 1.
  // Tone 4 falls ~30-40% of mean, so 8% threshold gives clean separation.
  if (rawRange / rawMean < 0.08) return 1

  const range = rawRange || 1

  const normalized = pitches.map(p => {
    const v = 1 + ((p - p10) / range) * 4
    return Math.max(1, Math.min(5, v))
  })

  // Resample to 10 points for contour comparison
  const contour = resample(normalized, 10)

  // Score each tone using hybrid features (Pearson fails for tone 1's flat template)
  let bestTone = null
  let bestScore = -Infinity

  for (let t = 1; t <= 4; t++) {
    const score = scoreTone(contour, t)
    if (score > bestScore) {
      bestScore = score
      bestTone = t
    }
  }

  return bestScore > 0.05 ? bestTone : null
}

/**
 * Disyllable detection with a SHARED pitch scale (Practice II).
 *
 * Normalizing each syllable independently erases the register relationship
 * between them — a correctly-low 3rd tone next to a rising 2nd tone came out
 * looking identical (both "low, rising at the end") and got misjudged. Split
 * at the energy valley, but normalize both halves against the WHOLE word's
 * p10/p90 so "low" stays low.
 *
 * Returns { t1, t2, scores1, scores2 } — scores let callers apply practice-
 * mode leniency (accept the target when it's within a margin of the winner).
 */
export function detectTonePairWithPitch(samples, sampleRate) {
  samples = trimToUtterance(normalizePeak(samples), sampleRate)
  const { first, second } = splitDisyllableAudio(samples, sampleRate)
  const p1 = collectPitches(first, sampleRate)
  const p2 = collectPitches(second, sampleRate)
  if (p1.length < 3 || p2.length < 3) return { t1: null, t2: null, scores1: null, scores2: null }

  const pool = [...p1, ...p2].sort((a, b) => a - b)
  const p10 = pool[Math.floor(pool.length * 0.1)]
  const p90 = pool[Math.floor(pool.length * 0.9)]
  // Whole-word flatness guard (mirrors the single-syllable check): if pitch
  // barely moves across BOTH syllables, stretching that sliver to a 1-5 scale
  // just amplifies noise — it's a flat-high + flat-high word (T1+T1).
  const poolMean = pool.reduce((s, v) => s + v, 0) / pool.length
  if ((p90 - p10) / poolMean < 0.06) {
    const flat = { 1: 1, 2: 0, 3: 0, 4: 0 }
    return { t1: 1, t2: 1, scores1: flat, scores2: { ...flat } }
  }
  const range = (p90 - p10) || 1
  const norm = (ps) => ps.map(p => Math.max(1, Math.min(5, 1 + ((p - p10) / range) * 4)))

  const judge = (ps) => {
    const contour = resample(norm(ps), 10)
    const scores = {}
    let best = null, bestScore = -Infinity
    for (let t = 1; t <= 4; t++) {
      scores[t] = scoreTone(contour, t)
      if (scores[t] > bestScore) { bestScore = scores[t]; best = t }
    }
    return { tone: bestScore > 0.05 ? best : null, scores }
  }
  const j1 = judge(p1), j2 = judge(p2)
  return { t1: j1.tone, t2: j2.tone, scores1: j1.scores, scores2: j2.scores }
}

/**
 * Also returns the normalized contour for canvas drawing.
 */
export function getPitchContour(samples, sampleRate) {
  samples = normalizePeak(samples)
  const acf = ACF2PLUS({ sampleRate })
  const yin = YIN({ sampleRate })

  const frameSize = 2048
  const hopSize = Math.floor(frameSize / 2)
  const pitches = []

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const frame = samples.slice(start, start + frameSize)
    let rms = 0
    for (let i = 0; i < frame.length; i++) rms += frame[i] * frame[i]
    if (Math.sqrt(rms / frame.length) < 0.008) continue

    let pitch = acf(frame)
    if (!pitch || pitch < 70 || pitch > 600) pitch = yin(frame)
    if (pitch && pitch >= 70 && pitch <= 600) pitches.push(pitch)
  }

  if (pitches.length < 2) return []

  const sorted = [...pitches].sort((a, b) => a - b)
  const p10 = sorted[Math.floor(sorted.length * 0.1)]
  const p90 = sorted[Math.floor(sorted.length * 0.9)]
  const range = p90 - p10 || 1

  return resample(
    pitches.map(p => Math.max(1, Math.min(5, 1 + ((p - p10) / range) * 4))),
    5
  )
}

// Hybrid tone scorer — Pearson + explicit acoustic features.
// Pearson alone fails for tone 1 (template is all-5s → zero variance → always 0).
function scoreTone(contour, toneNum) {
  const n = contour.length
  const mean = contour.reduce((s, v) => s + v, 0) / n
  const startMean = contour.slice(0, 3).reduce((s, v) => s + v, 0) / 3
  const endMean = contour.slice(-3).reduce((s, v) => s + v, 0) / 3
  const range = Math.max(...contour) - Math.min(...contour)

  // Find valley position and depth
  let minVal = Infinity, minPos = 0
  for (let i = 0; i < n; i++) {
    if (contour[i] < minVal) { minVal = contour[i]; minPos = i / (n - 1) }
  }

  const pearson = pearsonCorrelation(contour, TONE_CONTOURS[toneNum])

  switch (toneNum) {
    case 1: {
      // Flat + high: high mean, low pitch range
      const highness = Math.max(0, (mean - 2.5) / 2.5)  // rewards high mean
      const flatness = Math.max(0, 1 - range / 3)        // rewards narrow range
      return 0.5 * highness + 0.5 * flatness
    }
    case 2: {
      // Rising (35): end higher than start, with MONOTONIC rise — no significant dip.
      // Key distinction from T3: T2 rises steadily, T3 dips first then rises.
      const riseScore = Math.max(0, (endMean - startMean) / 4)
      // Penalize if there's a mid-contour dip (that's T3 territory)
      const hasDip = minPos >= 0.2 && minPos <= 0.7 && (startMean - minVal) > 0.5
      const dipPenalty = hasDip ? 0.3 : 0
      // Bonus: T2 minimum should be near the start (first 30%)
      const minAtStart = minPos <= 0.3 ? 0.15 : 0
      // A rise confined to the tail after a long LOW stretch is the 3rd tone's
      // final rise, not a 2nd-tone climb — T2 should rise through the middle.
      const midRise = contour[6] - contour[0]              // rise achieved by 70%
      const lateOnlyRise = riseScore > 0.2 && midRise < 0.5 && mean < 2.6 ? 0.3 : 0
      return 0.5 * Math.max(0, pearson) + 0.5 * riseScore - dipPenalty + minAtStart - lateOnlyRise
    }
    case 3: {
      // Low-dipping (214): valley in middle, then rises back up.
      // Key distinction from T2: must dip BELOW start level before rising.
      // Key distinction from T4: the contour rises back up after the dip.
      const hasMidDip = minPos >= 0.2 && minPos <= 0.75
      const recovers  = endMean > minVal + 0.5           // must rise after the dip
      const dipsBelow = (startMean - minVal) > 0.3        // must dip below where it started
      const dipScore  = (hasMidDip && recovers && dipsBelow) ? Math.max(0, (endMean - minVal) / 4) : 0
      // Bonus for classic 214 shape: starts mid, goes low, comes back high
      const classicShape = (startMean < 3.5 && minVal < 2.5 && endMean > 2.5) ? 0.1 : 0
      // Real connected-speech T3 often STARTS low (no dip below an already-low
      // start) and just stays low, with an optional final rise. That's correct
      // 3rd tone — score it on low register instead of requiring the dip.
      const lowRegister = mean < 2.4 && startMean < 2.2 && minVal < 1.8
      const lowScore = lowRegister ? 0.45 + Math.min(0.25, Math.max(0, (endMean - minVal) / 8)) : 0
      return Math.max(0.5 * Math.max(0, pearson) + 0.5 * dipScore + classicShape, lowScore)
    }
    case 4: {
      // High-falling: start clearly higher than end
      const fallScore = Math.max(0, (startMean - endMean) / 4)
      return 0.5 * Math.max(0, pearson) + 0.5 * fallScore
    }
    default: return 0
  }
}

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

function pearsonCorrelation(a, b) {
  const n = a.length
  const meanA = a.reduce((s, v) => s + v, 0) / n
  const meanB = b.reduce((s, v) => s + v, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    num += (a[i] - meanA) * (b[i] - meanB)
    da += (a[i] - meanA) ** 2
    db += (b[i] - meanB) ** 2
  }
  const denom = Math.sqrt(da * db)
  return denom === 0 ? 0 : num / denom
}
