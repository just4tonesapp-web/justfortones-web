# Ensemble Accuracy v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Test C tone detection accuracy from ~50-60% to ~90% by adding Groq prompt hints, Deepgram as second cloud ASR, tiered ensemble voting, and reducing classifier weight.

**Architecture:** Four targeted changes to the existing ensemble system in `toneDetector.js` and its model files. Groq gets prompt biasing from CHAR_TONE_MAP. Deepgram is added as a new cloud ASR model following the same pattern as Groq. Ensemble voting is restructured with tiered weights and a Groq override rule. SenseVoice is deferred (no browser WASM bundle available — model is 228MB, requires Emscripten build from source).

**Tech Stack:** Groq Whisper API (existing), Deepgram Nova-2 API (new), Vite env vars, existing ensemble framework.

**Spec:** `docs/superpowers/specs/2026-03-23-ensemble-accuracy-v2-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/utils/models/groqModel.js` | Modify | Add prompt hint from CHAR_TONE_MAP |
| `src/utils/models/deepgramModel.js` | Create | New Deepgram cloud ASR model |
| `src/utils/toneDetector.js` | Modify | New weights, Deepgram wiring, Groq override in _combine() |
| `src/views/testCView.js` | Modify | Add deepgram persona to judges UI |

---

### Task 1: Add Groq Prompt Hints

**Files:**
- Modify: `src/utils/models/groqModel.js:33-48`

The Groq Whisper API supports a `prompt` parameter that biases transcription toward expected tokens. When we know the target syllable (e.g. `"ma"`), we build a string of all matching Chinese characters from CHAR_TONE_MAP (e.g. `"妈麻马骂"`) and pass it as the prompt. This dramatically improves accuracy for known syllable sets.

- [ ] **Step 1: Add prompt hint builder and append to FormData**

In `src/utils/models/groqModel.js`, add a helper function before `detectToneWithGroq` and modify the FormData construction:

```javascript
// Add this function before detectToneWithGroq:

/**
 * Build a prompt hint string from CHAR_TONE_MAP for a given base syllable.
 * e.g. buildPromptHint('ma') → '妈麻马骂'
 */
function buildPromptHint(targetBase) {
  if (!targetBase) return null
  const chars = Object.entries(CHAR_TONE_MAP)
    .filter(([, entry]) => entry.base === targetBase && entry.tone !== 5)
    .map(([char]) => char)
  return chars.length > 0 ? chars.join('') : null
}
```

Then in `detectToneWithGroq`, after `formData.append('response_format', 'json')` (line 47), add:

```javascript
  // Bias Whisper toward expected characters for this syllable
  const hint = buildPromptHint(targetBase)
  if (hint) {
    formData.append('prompt', hint)
    console.log(`[Groq] Prompt hint: "${hint}"`)
  }
```

- [ ] **Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds with no new errors.

- [ ] **Step 3: Test locally**

Run: `npm run dev`
Open Test C, speak a syllable. Check console for `[Groq] Prompt hint: "..."` log followed by `[Groq] Transcription: "..."`. The transcription should match one of the hint characters more reliably.

- [ ] **Step 4: Commit**

```bash
git add src/utils/models/groqModel.js
git commit -m "feat: add prompt hint to Groq API for better syllable recognition"
```

---

### Task 2: Create Deepgram Cloud ASR Model

**Files:**
- Create: `src/utils/models/deepgramModel.js`

New cloud ASR model following the same pattern as `groqModel.js`. Deepgram Nova-2 supports Mandarin via `language=zh-CN`. Auth uses `Token` prefix (not `Bearer`). Response transcript at `results.channels[0].alternatives[0].transcript`. Supports `keywords` parameter for boosting (similar to Whisper's prompt). Requires `VITE_DEEPGRAM_API_KEY` env var.

- [ ] **Step 1: Create the Deepgram model file**

Create `src/utils/models/deepgramModel.js` with the following complete content:

```javascript
// ═══════════════════════════════════════
// Deepgram Nova-2 — cloud-based tone detection
//
// Sends recorded audio as WAV to Deepgram's Nova-2 endpoint,
// gets Chinese text back, looks up tone via CHAR_TONE_MAP.
//
// Requires VITE_DEEPGRAM_API_KEY in .env.local
// Free tier: $200 credit, no credit card required
// ═══════════════════════════════════════

import { CHAR_TONE_MAP } from './whisperModel.js'

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen'
let apiKey = null

/**
 * "Load" = validate API key exists. Throws if not configured.
 */
export async function loadDeepgram() {
  apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY
  if (!apiKey) {
    throw new Error('VITE_DEEPGRAM_API_KEY not configured in .env.local')
  }
}

/**
 * Detect tone by sending audio to Deepgram Nova-2 API.
 * @param {Float32Array} samples - raw audio at any sample rate
 * @param {number} sampleRate
 * @param {string|null} targetBase - base syllable hint
 * @returns {Promise<number|null>} tone 1-4
 */
export async function detectToneWithDeepgram(samples, sampleRate, targetBase = null) {
  if (!apiKey) throw new Error('Deepgram not loaded')

  // Resample to 16kHz for smaller upload
  const audio16k = sampleRate === 16000 ? samples : resampleTo16k(samples, sampleRate)

  // Encode as WAV
  const wavBlob = encodeWAV(audio16k, 16000)

  // Build URL with query params
  let url = `${DEEPGRAM_API_URL}?model=nova-2&language=zh-CN`

  // Add keyword boosting for expected characters (similar to Groq's prompt)
  if (targetBase) {
    const chars = Object.entries(CHAR_TONE_MAP)
      .filter(([, entry]) => entry.base === targetBase && entry.tone !== 5)
      .map(([char]) => char)
    for (const char of chars) {
      url += `&keywords=${encodeURIComponent(char)}:2`
    }
  }

  let data
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'audio/wav',
      },
      body: wavBlob,
    })

    if (response.status === 401) {
      console.error('[Deepgram] Invalid API key — disabling for session')
      apiKey = null
      return null
    }
    if (response.status === 429) {
      console.warn('[Deepgram] Rate limited — skipping')
      return null
    }
    if (!response.ok) {
      console.warn(`[Deepgram] HTTP ${response.status}`)
      return null
    }

    data = await response.json()
  } catch (e) {
    console.warn('[Deepgram] Request failed:', e.message)
    return null
  }

  const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim()
  if (!text) return null

  console.log(`[Deepgram] Transcription: "${text}"`)

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

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

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

- [ ] **Step 2: Add VITE_DEEPGRAM_API_KEY to .env.local**

Add to `.env.local`:
```
VITE_DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

The user needs to sign up at https://deepgram.com (free, no credit card) and create an API key.

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds. The new file is tree-shaken if not imported yet, but should compile cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/utils/models/deepgramModel.js
git commit -m "feat: add Deepgram Nova-2 cloud ASR model for Mandarin tone detection"
```

---

### Task 3: Wire Deepgram + Update Weights + Groq Override

**Files:**
- Modify: `src/utils/toneDetector.js:1-30` (imports, weights)
- Modify: `src/utils/toneDetector.js:60-72` (init)
- Modify: `src/utils/toneDetector.js:114-158` (detect jobs)
- Modify: `src/utils/toneDetector.js:174-196` (_combine)

This task wires Deepgram into the ensemble, updates all model weights to the tiered system, and adds the Groq override rule in `_combine()`.

- [ ] **Step 1: Add Deepgram import**

At the top of `src/utils/toneDetector.js`, after the groqModel import (line 19), add:

```javascript
import { loadDeepgram, detectToneWithDeepgram } from './models/deepgramModel.js'
```

- [ ] **Step 2: Update MODEL_WEIGHTS to tiered system**

Replace the existing `MODEL_WEIGHTS` object (lines 21-29) with:

```javascript
const MODEL_WEIGHTS = {
  groq:       1.50,   // Tier 1: cloud ASR (highest accuracy)
  deepgram:   1.20,   // Tier 1: cloud ASR
  sensevoice: 1.00,   // Tier 2: in-browser ASR (stub, not yet active)
  whisper:    0.50,   // Tier 2: in-browser ASR
  pitch:      0.35,   // Tier 3: signal-based
  classifier: 0.20,   // Tier 3: signal-based (low accuracy)
}
```

- [ ] **Step 3: Add Deepgram to init()**

In the `init()` method, add `load('deepgram', loadDeepgram)` to the `Promise.allSettled` array. The array should become:

```javascript
    await Promise.allSettled([
      load('groq', loadGroq),
      load('deepgram', loadDeepgram),
      load('classifier', loadToneClassifier),
      load('whisper', () => loadWhisper((status, pct) => onStatus?.('whisper', status, pct))),
      load('sensevoice', loadSenseVoice),
    ])
```

- [ ] **Step 4: Add Deepgram job in detect()**

After the Groq job block (after `// ── Groq Whisper API ──` section, around line 122), add:

```javascript
    // ── Deepgram Nova-2 ──
    if (this.loaded.deepgram) {
      jobs.push(
        detectToneWithDeepgram(samples, sampleRate, targetBase)
          .then(tone => tone !== null ? { model: 'deepgram', tone, weight: MODEL_WEIGHTS.deepgram } : null)
          .catch(() => null)
      )
    }
```

- [ ] **Step 5: Add Groq override rule in _combine()**

Replace the entire `_combine(results)` method (lines 174-196) with:

```javascript
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
```

- [ ] **Step 6: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/toneDetector.js
git commit -m "feat: wire Deepgram, tiered weights, Groq override rule in ensemble"
```

---

### Task 4: Update testCView.js for Deepgram Judge

**Files:**
- Modify: `src/views/testCView.js:18-25` (JUDGE_PERSONAS)
- Modify: `src/views/testCView.js:75-81` (judges array)
- Modify: `src/views/testCView.js:501` (shown array)

Add deepgram to the UI so users can see its vote alongside the other models.

- [ ] **Step 1: Add deepgram persona**

In `JUDGE_PERSONAS` object (around line 18), add after the groq line:

```javascript
  deepgram:   { emoji: '🔊', name: 'Deep' },
```

- [ ] **Step 2: Add deepgram to judges array**

In the `updateModelStatus()` function's `judges` array (around line 76), add after the groq entry:

```javascript
      { name: 'deepgram',  ...JUDGE_PERSONAS.deepgram },
```

- [ ] **Step 3: Add deepgram to shown array**

In the `renderJudges()` function's `shown` array (around line 501), add `'deepgram'`:

```javascript
    const shown = ['pitch', 'groq', 'deepgram', 'whisper', 'classifier']
```

- [ ] **Step 4: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/views/testCView.js
git commit -m "feat: add Deepgram judge persona to Test C UI"
```

---

### Task 5: Deploy and Test on Production

**Files:** None (deploy + manual verification)

- [ ] **Step 1: Add VITE_DEEPGRAM_API_KEY to GitHub repo secrets**

The user must:
1. Go to GitHub repo Settings → Secrets and variables → Actions
2. Add `VITE_DEEPGRAM_API_KEY` with the Deepgram API key

Or if deploying locally with `gh-pages`:
1. Add `VITE_DEEPGRAM_API_KEY=<key>` to `.env.local`
2. The key will be baked into the build (same pattern as Groq)

- [ ] **Step 2: Build and deploy**

```bash
npm run build && npx gh-pages -d dist
```

- [ ] **Step 3: Verify on production**

Open https://just4tones.github.io/justfortones-web/#/test-c in Chrome.

Wait for models to load (check the judge status bar — should show Maestro, Cloud, Deep, Whisperer, ToneBot).

Open DevTools console and look for:
- `[Groq] Prompt hint: "..."` — confirms prompt hints are working
- `[Deepgram] Transcription: "..."` — confirms Deepgram is active
- `[ensemble] ... ▶ T# (conf=##%)` — confirms all models voting

- [ ] **Step 4: Run accuracy test**

Test each tone 3 times (12 total attempts):
- Tone 1 (e.g. mā) × 3
- Tone 2 (e.g. má) × 3
- Tone 3 (e.g. mǎ) × 3
- Tone 4 (e.g. mà) × 3

Record results: target tone vs detected tone. Target: 10/12 correct (83%+) minimum, ideally 11/12 (92%+).

- [ ] **Step 5: Commit any final adjustments**

If testing reveals issues, fix and re-deploy. Otherwise:

```bash
git add -A
git commit -m "chore: ensemble accuracy v2 complete — deploy verified"
```

---

## Deferred: SenseVoice Activation

SenseVoice via sherpa-onnx WASM is **not feasible for browser deployment** at this time:
- No pre-built WASM bundle exists for SenseVoice (only Zipformer/Paraformer/Whisper)
- The model is 228MB (too large for browser download)
- Would require building from Emscripten source (major effort)

If sherpa-onnx releases a pre-built SenseVoice WASM bundle in the future, activation would involve:
1. Download WASM + model files to `public/models/sensevoice/`
2. Replace the stub in `sensevoiceModel.js` with real initialization
3. The ensemble wiring already exists (weight 1.00, load/detect calls in toneDetector.js)
