// ═══════════════════════════════════════
// SenseVoice Model — Alibaba ASR tone detection
// Source: https://github.com/FunAudioLLM/SenseVoice
// Browser runtime: sherpa-onnx WebAssembly (https://github.com/k2-fsa/sherpa-onnx)
// Accuracy estimate: ~90-95% (ASR-based, indirect tone inference)
//
// STATUS: STUB — waiting for sherpa-onnx integration
//
// To activate:
//   1. npm install sherpa-onnx
//   2. Download SenseVoiceSmall int8 ONNX model from:
//      https://github.com/k2-fsa/sherpa-onnx/releases (search "sense-voice")
//   3. Place model files in /public/models/sensevoice/
//   4. Remove the early return in loadSenseVoice() below
// ═══════════════════════════════════════

let recognizer = null

export async function loadSenseVoice() {
  // STUB: remove this line once sherpa-onnx is configured
  throw new Error('SenseVoice not yet available — sherpa-onnx not configured')

  /* eslint-disable no-unreachable */
  // sherpa-onnx WASM initialization
  // See: https://k2-fsa.github.io/sherpa/onnx/sense-voice/index.html
  // dynamic string prevents Rollup from resolving at build time
  const pkg = 'sherpa-onnx'
  const sherpa = await import(/* @vite-ignore */ pkg)
  recognizer = await sherpa.createOfflineRecognizer({
    modelType: 'sense_voice_ctc',
    model: '/justfortones-web/models/sensevoice/model.int8.onnx',
    tokens: '/justfortones-web/models/sensevoice/tokens.txt',
    language: 'zh',
    useItn: false,
  })
  return recognizer
}

/**
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {string|null} targetBase
 * @returns {number|null} tone 1-4
 */
export async function detectToneWithSenseVoice(samples, sampleRate, targetBase = null) {
  if (!recognizer) throw new Error('SenseVoice not loaded')

  // Feed audio, get Chinese character transcript, look up tone
  // (Same character→tone strategy as Whisper model)
  const stream = recognizer.createStream()
  stream.acceptWaveform(sampleRate, samples)
  recognizer.decode(stream)
  const result = recognizer.getResult(stream)
  stream.free()

  const text = result?.text?.trim()
  if (!text) return null

  // Reuse Whisper's CHAR_TONE_MAP via dynamic import
  const { CHAR_TONE_MAP } = await import('./whisperModel.js')
  for (const char of [...text]) {
    const entry = CHAR_TONE_MAP?.[char]
    if (entry && entry.tone !== 5) {
      if (!targetBase || entry.base === targetBase) return entry.tone
    }
  }
  return null
}
