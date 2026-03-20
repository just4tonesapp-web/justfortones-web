// ═══════════════════════════════════════
// ToneNet Model — ONNX CNN tone classifier
// Paper: Gao et al., Interspeech 2019 (~99% accuracy on isolated syllables)
// Source: https://github.com/saber5433/ToneNet
//
// Input:  225×225×3 RGB image of mel-spectrogram
//         (64 mel bins, fft=2048, hop=16, sr=16kHz, fmin=50, fmax=350)
// Output: 4 softmax probabilities → argmax = tone (1-indexed)
// ═══════════════════════════════════════

import { InferenceSession, Tensor, env } from 'onnxruntime-web'

// Load WASM runtime files from CDN — avoids needing to copy .wasm files into public/
env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/'

let session = null

export async function loadToneNet() {
  session = await InferenceSession.create('/justfortones-web/models/tonenet.onnx', {
    executionProviders: ['wasm'],
  })
  return session
}

/**
 * Returns the 225×225×3 Float32Array that would be fed to ToneNet.
 * Use this to visually inspect the mel-spectrogram in a debug canvas.
 */
export function getMelSpectrogramImage(samples, sampleRate) {
  const audio = sampleRate === 16000 ? samples : resampleTo16k(samples, sampleRate)
  return melSpectrogramToImage(audio, 16000)
}

/**
 * @param {Float32Array} samples - raw audio at any sample rate
 * @param {number} sampleRate
 * @returns {number|null} tone 1-4
 */
export async function detectToneWithToneNet(samples, sampleRate) {
  if (!session) throw new Error('ToneNet not loaded')

  // 1. Resample to 16kHz
  const audio = sampleRate === 16000 ? samples : resampleTo16k(samples, sampleRate)

  // 2. Compute mel-spectrogram → render as 225×225 RGB image
  const imageData = melSpectrogramToImage(audio, 16000)

  // 3. Flatten to Float32Array [1, 225, 225, 3] (NHWC format, values 0-1)
  const input = new Tensor('float32', imageData, [1, 225, 225, 3])

  // 4. Run inference
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  const results = await session.run({ [inputName]: input })
  const probs = results[outputName].data // Float32Array of 4 softmax values

  // 5. Argmax → tone (1-indexed)
  let best = 0
  for (let i = 1; i < 4; i++) if (probs[i] > probs[best]) best = i
  return best + 1
}

// ── Mel-spectrogram → 225×225 RGB image ───────────────────────────────────────
// Mirrors the Python training pipeline:
//   librosa.feature.melspectrogram(y, sr=16000, n_mels=64, n_fft=2048,
//                                   hop_length=16, fmin=50, fmax=350)
//   librosa.power_to_db(S, ref=np.max)
//   saved as 2.25×2.25in matplotlib figure at 100dpi → 225×225 RGB JPEG

function melSpectrogramToImage(samples, sr) {
  const N_FFT    = 2048
  const HOP      = 16
  const N_MELS   = 64
  const FMIN     = 50
  const FMAX     = 350
  const IMG_SIZE = 225

  // ── STFT magnitude ──
  const frames = []
  for (let start = 0; start + N_FFT <= samples.length; start += HOP) {
    const frame = applyHann(samples.slice(start, start + N_FFT))
    frames.push(fftMagnitude(frame, N_FFT))
  }
  if (frames.length === 0) return new Float32Array(IMG_SIZE * IMG_SIZE * 3)

  // ── Mel filter bank ──
  const melFilters = buildMelFilterBank(N_MELS, N_FFT, sr, FMIN, FMAX)

  // ── Power spectrogram → mel → dB ──
  const melFrames = frames.map(mag => {
    const mel = new Float32Array(N_MELS)
    for (let m = 0; m < N_MELS; m++) {
      let sum = 0
      for (let k = 0; k < melFilters[m].length; k++) sum += melFilters[m][k] * mag[k] * mag[k]
      mel[m] = sum
    }
    return mel
  })

  // power_to_db: 10 * log10(S / ref_max), clamp to -80
  let refMax = 0
  for (const f of melFrames) for (const v of f) if (v > refMax) refMax = v
  refMax = refMax || 1e-10

  const db = melFrames.map(f =>
    Array.from(f).map(v => Math.max(10 * Math.log10(v / refMax), -80))
  )

  // ── Render to 225×225 using viridis colormap ──
  // Normalize dB to 0-1 range, apply viridis, bilinear-scale to IMG_SIZE
  const nFrames = db.length
  const out = new Float32Array(IMG_SIZE * IMG_SIZE * 3)

  for (let py = 0; py < IMG_SIZE; py++) {
    // mel bins run bottom→top in matplotlib
    const melIdx = (1 - py / (IMG_SIZE - 1)) * (N_MELS - 1)
    const m0 = Math.floor(melIdx), m1 = Math.min(m0 + 1, N_MELS - 1)
    const mf = melIdx - m0

    for (let px = 0; px < IMG_SIZE; px++) {
      const frameIdx = (px / (IMG_SIZE - 1)) * (nFrames - 1)
      const f0 = Math.floor(frameIdx), f1 = Math.min(f0 + 1, nFrames - 1)
      const ff = frameIdx - f0

      // Bilinear interpolation in dB space
      const v = db[f0][m0] * (1 - ff) * (1 - mf)
              + db[f1][m0] * ff        * (1 - mf)
              + db[f0][m1] * (1 - ff) * mf
              + db[f1][m1] * ff        * mf

      // Normalize -80..0 → 0..1
      const norm = Math.max(0, Math.min(1, (v + 80) / 80))

      // Viridis colormap (approximated with key stops)
      const [r, g, b] = viridis(norm)
      const idx = (py * IMG_SIZE + px) * 3
      out[idx]     = r
      out[idx + 1] = g
      out[idx + 2] = b
    }
  }

  return out
}

// ── Viridis colormap (5 key stops, linear interpolation) ──────────────────────
const VIRIDIS = [
  [0.267, 0.005, 0.329], // 0.0 — dark purple
  [0.230, 0.322, 0.546], // 0.25 — blue
  [0.128, 0.566, 0.551], // 0.5 — teal
  [0.370, 0.789, 0.383], // 0.75 — green
  [0.993, 0.906, 0.144], // 1.0 — yellow
]

function viridis(t) {
  const n = VIRIDIS.length - 1
  const i = Math.min(Math.floor(t * n), n - 1)
  const f = t * n - i
  const c0 = VIRIDIS[i], c1 = VIRIDIS[i + 1]
  return [c0[0] + f * (c1[0] - c0[0]), c0[1] + f * (c1[1] - c0[1]), c0[2] + f * (c1[2] - c0[2])]
}

// ── Hann window ───────────────────────────────────────────────────────────────
function applyHann(frame) {
  const out = new Float32Array(frame.length)
  for (let i = 0; i < frame.length; i++)
    out[i] = frame[i] * 0.5 * (1 - Math.cos(2 * Math.PI * i / (frame.length - 1)))
  return out
}

// ── FFT magnitude (real input, returns first N/2+1 bins) ──────────────────────
function fftMagnitude(frame, nFft) {
  const n = nFft
  // Cooley-Tukey radix-2 iterative FFT
  const re = new Float32Array(n)
  const im = new Float32Array(n)
  for (let i = 0; i < Math.min(frame.length, n); i++) re[i] = frame[i]

  // Bit-reversal permutation
  let j = 0
  for (let i = 1; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] }
  }

  // FFT butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len
    const wRe = Math.cos(ang), wIm = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k], uIm = im[i + k]
        const vRe = re[i + k + len/2] * curRe - im[i + k + len/2] * curIm
        const vIm = re[i + k + len/2] * curIm + im[i + k + len/2] * curRe
        re[i + k]         = uRe + vRe; im[i + k]         = uIm + vIm
        re[i + k + len/2] = uRe - vRe; im[i + k + len/2] = uIm - vIm
        const newRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe; curRe = newRe
      }
    }
  }

  const nBins = n / 2 + 1
  const mag = new Float32Array(nBins)
  for (let i = 0; i < nBins; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i])
  return mag
}

// ── Mel filter bank ───────────────────────────────────────────────────────────
function buildMelFilterBank(nMels, nFft, sr, fmin, fmax) {
  const hzToMel = hz => 2595 * Math.log10(1 + hz / 700)
  const melToHz = mel => 700 * (10 ** (mel / 2595) - 1)

  const melMin = hzToMel(fmin)
  const melMax = hzToMel(fmax)
  const melPoints = Array.from({ length: nMels + 2 }, (_, i) => melMin + (i / (nMels + 1)) * (melMax - melMin))
  const hzPoints = melPoints.map(melToHz)
  const binPoints = hzPoints.map(hz => Math.floor((nFft / 2 + 1) * hz / (sr / 2)))

  const nBins = nFft / 2 + 1
  return Array.from({ length: nMels }, (_, m) => {
    const filter = new Float32Array(nBins)
    const start = binPoints[m], center = binPoints[m + 1], end = binPoints[m + 2]
    for (let k = start; k < center; k++) filter[k] = (k - start) / (center - start)
    for (let k = center; k < end; k++) filter[k] = (end - k) / (end - center)
    return filter
  })
}

// ── Resample to 16kHz ─────────────────────────────────────────────────────────
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
