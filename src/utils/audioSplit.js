// ═══════════════════════════════════════
// Disyllabic recording splitter
//
// Splits a single recording (e.g. "dàniǎo") into two halves so the tone
// detector can be run on each syllable independently. Strategy:
//   1. Trim leading/trailing silence with a simple energy threshold.
//   2. Look for the lowest-energy frame in the middle 30%–70% of the
//      voiced region — that's likely the inter-syllable boundary.
//   3. Return two Float32Array slices.
// ═══════════════════════════════════════

const FRAME_MS = 20

/**
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @returns {{ first: Float32Array, second: Float32Array }}
 */
export function splitDisyllableAudio(samples, sampleRate) {
  const frame = Math.max(1, Math.floor(sampleRate * (FRAME_MS / 1000)))
  const energy = new Float32Array(Math.ceil(samples.length / frame))
  for (let i = 0, k = 0; i < samples.length; i += frame, k++) {
    let sum = 0
    const end = Math.min(i + frame, samples.length)
    for (let j = i; j < end; j++) sum += samples[j] * samples[j]
    energy[k] = Math.sqrt(sum / (end - i))
  }

  let maxE = 0
  for (let i = 0; i < energy.length; i++) if (energy[i] > maxE) maxE = energy[i]
  if (maxE === 0) {
    return { first: samples, second: samples }
  }

  // 15% of peak is a reasonable voicing threshold
  const voiceTh = maxE * 0.15
  let voiceStart = 0
  let voiceEnd = energy.length - 1
  while (voiceStart < energy.length && energy[voiceStart] < voiceTh) voiceStart++
  while (voiceEnd > voiceStart && energy[voiceEnd] < voiceTh) voiceEnd--

  if (voiceEnd - voiceStart < 4) {
    // too short to split sensibly — return halves
    const mid = Math.floor(samples.length / 2)
    return { first: samples.slice(0, mid), second: samples.slice(mid) }
  }

  // Find the energy valley inside the middle 30–70% of the voiced span
  const lo = voiceStart + Math.floor((voiceEnd - voiceStart) * 0.30)
  const hi = voiceStart + Math.floor((voiceEnd - voiceStart) * 0.70)
  let valleyIdx = Math.floor((lo + hi) / 2)
  let valleyE = energy[valleyIdx]
  for (let i = lo; i <= hi; i++) {
    if (energy[i] < valleyE) {
      valleyE = energy[i]
      valleyIdx = i
    }
  }

  const splitSample = Math.min(samples.length, valleyIdx * frame)
  const startSample = voiceStart * frame
  const endSample = Math.min(samples.length, (voiceEnd + 1) * frame)

  // Each half should at least contain its voiced portion plus a small pad
  const first = samples.slice(startSample, splitSample)
  const second = samples.slice(splitSample, endSample)

  return { first, second }
}
