# Ensemble Accuracy Improvement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise Test C tone detection accuracy from ~40-50% to 80%+ by adding Web Speech API and Groq Whisper API models to the ensemble.

**Architecture:** Two new models feed into the existing weighted-vote ensemble in `toneDetector.js`. Web Speech API runs a live recognition session in parallel with the mic recording. Groq sends recorded audio as WAV to the Whisper-large-v3 API. Both return Chinese characters that are mapped to tones via the shared `CHAR_TONE_MAP`.

**Tech Stack:** Vanilla JS, Web Speech API (browser-native), Groq REST API, ONNX Runtime (existing), Vite

**Spec:** `docs/superpowers/specs/2026-03-23-ensemble-accuracy-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| EDIT | `src/utils/models/whisperModel.js` | Export `CHAR_TONE_MAP`, fix tone-5 filtering, remove duplicate key |
| CREATE | `src/utils/models/webSpeechModel.js` | Web Speech API wrapper — start/stop/detect |
| CREATE | `src/utils/models/groqModel.js` | Groq Whisper API caller + WAV encoder |
| EDIT | `src/utils/toneDetector.js` | Add both models to init/detect/weights, accept `webSpeechText` param |
| EDIT | `src/views/testCView.js` | Start/stop webSpeech alongside recording, pass text to detect(), add judge personas |

---

### Task 1: Fix CHAR_TONE_MAP export and tone-5 filtering in whisperModel.js

**Files:**
- Modify: `src/utils/models/whisperModel.js`

- [ ] **Step 1: Export CHAR_TONE_MAP**

In `src/utils/models/whisperModel.js`, line 103, change:
```js
const CHAR_TONE_MAP = {
```
to:
```js
export const CHAR_TONE_MAP = {
```

- [ ] **Step 2: Remove duplicate '天' key**

Remove the duplicate `'天': { base: 'tian', tone: 1 }` entry at line 117 (keep the one at line 115).

- [ ] **Step 3: Add tone-5 filtering to detectToneWithWhisper**

In the `detectToneWithWhisper` function, update both lookup passes to skip tone 5. Change the first pass (lines 70-74):
```js
  if (targetBase) {
    for (const char of chars) {
      const entry = CHAR_TONE_MAP[char]
      if (entry && entry.base === targetBase && entry.tone !== 5) return entry.tone
    }
  }
```

Change the second pass (lines 77-81):
```js
  for (const char of chars) {
    const entry = CHAR_TONE_MAP[char]
    if (entry && entry.tone !== 5) return entry.tone
  }
```

- [ ] **Step 4: Verify dev server still runs**

Run: `cd "C:/Users/Homer/OneDrive/Documents/GitHub/justfortones-web" && npm run dev`
Expected: Vite starts without errors.

- [ ] **Step 5: Commit**

```bash
git add src/utils/models/whisperModel.js
git commit -m "fix: export CHAR_TONE_MAP, filter tone-5, remove duplicate key"
```

---

### Task 2: Create Web Speech API model

**Files:**
- Create: `src/utils/models/webSpeechModel.js`

- [ ] **Step 1: Create webSpeechModel.js**

```js
// ═══════════════════════════════════════
// Web Speech API — browser-native speech recognition for tone detection
//
// Uses webkitSpeechRecognition (Chrome/Edge/Safari) with lang:'zh-CN'
// to transcribe spoken Chinese, then looks up tone via CHAR_TONE_MAP.
//
// Must run in parallel with AudioEngine (separate mic stream).
// Call startWebSpeech() when recording starts, stopWebSpeech() when done.
// ═══════════════════════════════════════

import { CHAR_TONE_MAP } from './whisperModel.js'

let recognition = null
let lastResult = null
let resultPromiseResolve = null

/**
 * Feature detection — is Web Speech API available in this browser?
 */
export function isWebSpeechAvailable() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

/**
 * Dummy "load" for consistency with other models.
 * Throws if browser doesn't support Web Speech API.
 */
export async function loadWebSpeech() {
  if (!isWebSpeechAvailable()) {
    throw new Error('Web Speech API not supported in this browser')
  }
}

/**
 * Start a recognition session. Call this when mic recording begins.
 * Returns a Promise<string|null> that resolves when stopWebSpeech() is called
 * or after a 2-second timeout after stop.
 */
export function startWebSpeech() {
  lastResult = null

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 3

  recognition.onresult = (event) => {
    // Grab the best final result, or latest interim
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim()
      if (transcript) lastResult = transcript
    }
  }

  recognition.onerror = (event) => {
    console.warn('[WebSpeech] error:', event.error)
    // 'no-speech' and 'aborted' are normal — don't treat as failures
  }

  recognition.onend = () => {
    // Recognition ended (possibly auto-stopped by browser)
    // If we have a pending promise, resolve it
    if (resultPromiseResolve) {
      resultPromiseResolve(lastResult)
      resultPromiseResolve = null
    }
  }

  recognition.start()
}

/**
 * Stop recognition and return the result.
 * Resolves within 2 seconds (returns null on timeout).
 * @returns {Promise<string|null>} recognized Chinese text
 */
export function stopWebSpeech() {
  return new Promise((resolve) => {
    // If we already have a result, return immediately
    if (lastResult) {
      try { recognition?.stop() } catch (e) { /* ignore */ }
      resolve(lastResult)
      return
    }

    // Set up promise resolution for onend callback
    resultPromiseResolve = resolve

    // Stop recognition (triggers onend after processing)
    try { recognition?.stop() } catch (e) { /* ignore */ }

    // 2-second timeout safety net
    setTimeout(() => {
      if (resultPromiseResolve) {
        resultPromiseResolve(lastResult) // may be null
        resultPromiseResolve = null
      }
    }, 2000)
  })
}

/**
 * Given recognized text, look up tone via CHAR_TONE_MAP.
 * @param {string|null} text — recognized Chinese text
 * @param {string|null} targetBase — known base syllable hint (e.g. 'ma')
 * @returns {number|null} tone 1-4 or null
 */
export function detectToneFromText(text, targetBase = null) {
  if (!text) return null
  const chars = [...text]

  // First pass: prefer chars matching targetBase
  if (targetBase) {
    for (const char of chars) {
      const entry = CHAR_TONE_MAP[char]
      if (entry && entry.base === targetBase && entry.tone !== 5) return entry.tone
    }
  }

  // Second pass: any recognized char
  for (const char of chars) {
    const entry = CHAR_TONE_MAP[char]
    if (entry && entry.tone !== 5) return entry.tone
  }

  return null
}
```

- [ ] **Step 2: Verify import works**

Run: `cd "C:/Users/Homer/OneDrive/Documents/GitHub/justfortones-web" && npm run dev`
Expected: No import errors in console.

- [ ] **Step 3: Commit**

```bash
git add src/utils/models/webSpeechModel.js
git commit -m "feat: add Web Speech API model for tone detection"
```

---

### Task 3: Create Groq Whisper API model

**Files:**
- Create: `src/utils/models/groqModel.js`

- [ ] **Step 1: Create groqModel.js**

```js
// ═══════════════════════════════════════
// Groq Whisper API — cloud-based tone detection
//
// Sends recorded audio as WAV to Groq's Whisper-large-v3 endpoint,
// gets Chinese text back, looks up tone via CHAR_TONE_MAP.
//
// Requires VITE_GROQ_API_KEY in .env.local
// Free tier: generous limits. Cost after: ~$0.006/min
// ═══════════════════════════════════════

import { CHAR_TONE_MAP } from './whisperModel.js'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
let apiKey = null

/**
 * "Load" = validate API key exists. Throws if not configured.
 */
export async function loadGroq() {
  apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    throw new Error('VITE_GROQ_API_KEY not configured in .env.local')
  }
}

/**
 * Detect tone by sending audio to Groq Whisper API.
 * @param {Float32Array} samples - raw audio at any sample rate
 * @param {number} sampleRate
 * @param {string|null} targetBase - base syllable hint
 * @returns {Promise<number|null>} tone 1-4
 */
export async function detectToneWithGroq(samples, sampleRate, targetBase = null) {
  if (!apiKey) throw new Error('Groq not loaded')

  // Resample to 16kHz for smaller upload + better Whisper accuracy
  const audio16k = sampleRate === 16000 ? samples : resampleTo16k(samples, sampleRate)

  // Encode as WAV
  const wavBlob = encodeWAV(audio16k, 16000)

  // POST to Groq
  const formData = new FormData()
  formData.append('file', wavBlob, 'audio.wav')
  formData.append('model', 'whisper-large-v3')
  formData.append('language', 'zh')
  formData.append('response_format', 'json')

  let result
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    })

    if (response.status === 401) {
      console.error('[Groq] Invalid API key — disabling for session')
      apiKey = null
      return null
    }
    if (response.status === 429) {
      console.warn('[Groq] Rate limited — skipping')
      return null
    }
    if (!response.ok) {
      console.warn(`[Groq] HTTP ${response.status}`)
      return null
    }

    result = await response.json()
  } catch (e) {
    console.warn('[Groq] Request failed:', e.message)
    return null
  }

  const text = result?.text?.trim()
  if (!text) return null

  console.log(`[Groq] Transcription: "${text}"`)

  // Look up tone from characters
  const chars = [...text]

  if (targetBase) {
    for (const char of chars) {
      const entry = CHAR_TONE_MAP[char]
      if (entry && entry.base === targetBase && entry.tone !== 5) return entry.tone
    }
  }

  for (const char of chars) {
    const entry = CHAR_TONE_MAP[char]
    if (entry && entry.tone !== 5) return entry.tone
  }

  return null
}

// ── Resample to 16kHz (linear interpolation) ──
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

// ── Encode Float32Array as 16-bit PCM WAV blob ──
function encodeWAV(samples, sampleRate) {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = samples.length * (bitsPerSample / 8)
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)           // chunk size
  view.setUint16(20, 1, true)            // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM samples (clamp float32 → int16)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
```

- [ ] **Step 2: Verify import works**

Run: `npm run dev` — no import errors in console.

- [ ] **Step 3: Commit**

```bash
git add src/utils/models/groqModel.js
git commit -m "feat: add Groq Whisper API model for tone detection"
```

---

### Task 4: Wire both models into toneDetector.js

**Files:**
- Modify: `src/utils/toneDetector.js`

- [ ] **Step 1: Add imports**

At the top of `toneDetector.js`, add after existing imports:
```js
import { loadWebSpeech, detectToneFromText } from './models/webSpeechModel.js'
import { loadGroq, detectToneWithGroq } from './models/groqModel.js'
```

- [ ] **Step 2: Add weights**

Update `MODEL_WEIGHTS` to:
```js
const MODEL_WEIGHTS = {
  groq:       0.90,
  webSpeech:  0.85,
  classifier: 0.40,
  tonenet:    0.99,
  sensevoice: 0.92,
  whisper:    0.60,
  pitch:      0.55,
}
```

- [ ] **Step 3: Add models to init()**

In the `init()` method, add to the `Promise.allSettled` array:
```js
    await Promise.allSettled([
      load('webSpeech', loadWebSpeech),
      load('groq', loadGroq),
      load('classifier', loadToneClassifier),
      // load('whisper', () => loadWhisper(...)),
      // load('tonenet', loadToneNet),
      load('sensevoice', loadSenseVoice),
    ])
```

- [ ] **Step 4: Update detect() signature and add model jobs**

Change the `detect` method signature to:
```js
  async detect({ samples, sampleRate }, targetBase = null, { webSpeechText = null } = {})
```

After the existing pitch job, add the webSpeech job (before the whisper job):
```js
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
```

- [ ] **Step 5: Verify dev server runs clean**

Run: `npm run dev` — no errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/toneDetector.js
git commit -m "feat: wire Web Speech + Groq models into tone ensemble"
```

---

### Task 5: Update testCView.js to run webSpeech in parallel

**Files:**
- Modify: `src/views/testCView.js`

- [ ] **Step 1: Add imports**

At the top of `testCView.js`, add:
```js
import { isWebSpeechAvailable, startWebSpeech, stopWebSpeech } from '../utils/models/webSpeechModel.js'
```

- [ ] **Step 2: Add judge personas for new models**

In the `JUDGE_PERSONAS` object, add:
```js
  webSpeech:  { emoji: '🗣️', name: 'Voice' },
  groq:       { emoji: '☁️', name: 'Cloud' },
```

- [ ] **Step 3: Update model status display**

In the `updateModelStatus()` function, add the new models to the `judges` array:
```js
    const judges = [
      { name: 'pitch',      ...JUDGE_PERSONAS.pitch,      alwaysOn: true },
      { name: 'webSpeech',  ...JUDGE_PERSONAS.webSpeech },
      { name: 'groq',       ...JUDGE_PERSONAS.groq },
      { name: 'classifier', ...JUDGE_PERSONAS.classifier },
    ]
```

- [ ] **Step 4: Update renderJudges shown array**

In the `renderJudges()` function (~line 494), update the `shown` array to include the new models:
```js
    const shown = ['pitch', 'webSpeech', 'groq', 'classifier']
```

- [ ] **Step 5: Start webSpeech when recording starts**

In the `startRecording()` function, add after `engine.start()` succeeds (after `isRecording = true`):
```js
    // Start Web Speech API in parallel (separate mic stream)
    if (isWebSpeechAvailable() && toneDetector.loaded.webSpeech) {
      startWebSpeech()
    }
```

- [ ] **Step 6: Stop webSpeech and pass text to detect()**

In the `stopRecording()` function, after `const recording = engine.stop()`, add:
```js
    // Collect Web Speech result (2s timeout)
    let webSpeechText = null
    if (isWebSpeechAvailable() && toneDetector.loaded.webSpeech) {
      webSpeechText = await stopWebSpeech()
      if (webSpeechText) console.log(`[WebSpeech] Recognized: "${webSpeechText}"`)
    }
```

Then update the `toneDetector.detect()` call to pass the text:
```js
    const ensemble = await toneDetector.detect(
      { samples: recording.samples, sampleRate: recording.sampleRate },
      q.base,
      { webSpeechText }
    )
```

- [ ] **Step 7: Test manually in browser**

Run: `npm run dev` → open http://localhost:5173/justfortones-web/ → Test C → speak a character
Expected: Console shows `[ensemble]` log with webSpeech and/or groq votes alongside pitch/classifier.

- [ ] **Step 8: Commit**

```bash
git add src/views/testCView.js
git commit -m "feat: integrate webSpeech + groq into Test C UI"
```

---

### Task 6: Manual accuracy test

- [ ] **Step 1: Run through 12 Test C items**

Open dev server → Test C → complete all 12 questions.
Log each result: character, target tone, detected tone, which models voted what.

- [ ] **Step 2: Compare accuracy**

Count correct / 12. Compare to previous ~40-50% baseline.
Expected: 70-90% with cloud models active.

- [ ] **Step 3: Check edge cases**

- If Groq key is missing: should see groq as "unavailable" in status, ensemble still works with remaining models
- If on Firefox: webSpeech should be unavailable, groq + pitch + classifier still vote
- If mic permission denied: graceful error message

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test: verify ensemble accuracy with cloud models"
```
