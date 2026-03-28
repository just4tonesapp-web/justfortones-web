# Test C Ensemble Accuracy Improvement — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Goal:** Raise Test C tone detection accuracy from ~40-50% to 80%+ by adding two cloud-backed models to the ensemble.

---

## Problem

Only 2 of 5 ensemble models are active (pitch at 0.55 weight, DistilHuBERT classifier at 0.40 weight). Both have fundamental accuracy ceilings: pitch is heuristic-based (~55-65%), classifier was trained on synthetic TTS audio and has domain shift on real mic input. Whisper, ToneNet, and SenseVoice are all disabled.

## Solution

Add two new ensemble models that leverage cloud speech recognition to transcribe spoken Chinese, then look up the tone from the existing `CHAR_TONE_MAP`.

---

## Model 1: Web Speech API (`webSpeech`)

**File:** `src/utils/models/webSpeechModel.js`

**Flow:** Live mic → `webkitSpeechRecognition(lang:'zh-CN')` → Chinese characters → `CHAR_TONE_MAP` lookup → tone 1-4

**Weight:** 0.85

**Key design decisions:**
- Web Speech API requires its own live mic stream (cannot accept Float32Array)
- Runs **in parallel** with AudioEngine — both access mic simultaneously via separate streams
- `startWebSpeech()` called when recording starts, returns a Promise that resolves with recognized text
- `stopWebSpeech()` called when recording stops, triggers final result
- Graceful fallback: if browser doesn't support `webkitSpeechRecognition`, model stays unloaded
- Reuses `CHAR_TONE_MAP` from `whisperModel.js` for character→tone lookup

**API surface:**
```js
export function isWebSpeechAvailable()  // feature detection
export function startWebSpeech()        // begin recognition, returns Promise<string|null>
export function stopWebSpeech()         // stop recognition, triggers result
export function detectToneWithWebSpeech(targetBase) // parse result → tone
```

**Load:** Instant (browser-native, no download)
**Cost:** Free
**Browser support:** Chrome, Edge, Safari (not Firefox)

---

## Model 2: Groq Whisper API (`groq`)

**File:** `src/utils/models/groqModel.js`

**Flow:** Float32Array → encode as WAV blob → POST `api.groq.com/openai/v1/audio/transcriptions` (model: `whisper-large-v3`, language: `zh`) → Chinese text → `CHAR_TONE_MAP` lookup → tone 1-4

**Weight:** 0.90

**Key design decisions:**
- Accepts Float32Array + sampleRate (same interface as other models)
- Encodes audio to WAV in-browser (simple PCM16 WAV header + samples)
- Sends as multipart/form-data to Groq's OpenAI-compatible endpoint
- API key from `import.meta.env.VITE_GROQ_API_KEY`
- If no API key configured, model fails to load gracefully (same as Supabase pattern)
- Reuses `CHAR_TONE_MAP` from `whisperModel.js`

**API surface:**
```js
export async function loadGroq()                           // validate API key exists
export async function detectToneWithGroq(samples, sampleRate, targetBase)
```

**Load:** Instant (API call, no model download)
**Cost:** Free tier (generous limits), then ~$0.006/min
**Requires:** `VITE_GROQ_API_KEY` in `.env.local`

---

## Updated Ensemble

### Weights

| Model | Weight | Type | Status |
|-------|--------|------|--------|
| groq | 0.90 | Cloud API | NEW |
| webSpeech | 0.85 | Browser-native | NEW |
| pitch | 0.55 | Local heuristic | Existing |
| classifier | 0.40 | Local ONNX | Existing |

**Total active weight:** 2.70
**Cloud models combined:** 1.75 (always outvotes local if they agree)

### Voting behavior

- If groq + webSpeech agree → that tone wins (1.75 > 0.95)
- If they disagree → pitch + classifier break the tie
- If only one cloud model is available → it still outweighs pitch alone

---

## Files Changed

1. **NEW** `src/utils/models/webSpeechModel.js` — Web Speech API wrapper
2. **NEW** `src/utils/models/groqModel.js` — Groq Whisper API + WAV encoder
3. **EDIT** `src/utils/models/whisperModel.js` — export `CHAR_TONE_MAP`
4. **EDIT** `src/utils/toneDetector.js` — add both models to init/detect/weights
5. **EDIT** `src/views/testCView.js` — integrate webSpeech parallel mic, add judge personas
6. **EDIT** `.env.local` — add `VITE_GROQ_API_KEY` (not committed)

---

## Integration with testCView

### Web Speech API integration
- `startRecording()` calls `startWebSpeech()` alongside `engine.start()`
- `stopRecording()` calls `stopWebSpeech()`, waits for result
- Result passed to `toneDetector.detect()` or handled as a separate ensemble vote

### Alternative (simpler): toneDetector manages webSpeech
- `toneDetector.detect()` receives a flag or the webSpeech result text
- The webSpeech model vote is added to the ensemble like any other model
- testCView just starts/stops webSpeech and passes the text through

**Going with the simpler approach** — testCView starts/stops webSpeech recognition, passes the recognized text to `toneDetector.detect()` which includes it in the ensemble.

---

## Synchronization Contract

### Web Speech API timing
- `startWebSpeech()` is called at the same time as `engine.start()`
- `stopWebSpeech()` returns a `Promise<string|null>` that resolves within **2 seconds** (timeout)
- If Web Speech fires `onresult` before stop, the text is cached and returned immediately on stop
- If Web Speech hasn't returned after 2s, resolve with `null` (model skipped for this question)
- `toneDetector.detect()` **awaits** the webSpeech result before running the ensemble

### Updated `detect()` signature
```js
async detect({ samples, sampleRate }, targetBase = null, { webSpeechText = null } = {})
```
- `webSpeechText` is the raw string from Web Speech API (or null if unavailable/timed out)
- If provided and webSpeech model is "loaded", it runs the CHAR_TONE_MAP lookup and adds a vote

### Tone-5 filtering
All character→tone lookups (webSpeech, groq, and existing whisper code) MUST filter out `tone === 5` (neutral tone). Only tones 1-4 are valid Test C answers. The sensevoiceModel.js already does this correctly; whisperModel.js does NOT and should be fixed.

---

## Accepted Risks & Mitigations

1. **Web Speech API latency** — recognition may not return before we need the result. Mitigation: 2-second timeout, skip if no result.
2. **Groq rate limits** — free tier may throttle. Mitigation: graceful fallback, model returns null. Distinguish 429 (transient, skip) from 401 (permanent, disable for session).
3. **CHAR_TONE_MAP coverage** — if cloud API returns a character not in the map, no tone detected. Mitigation: map already has 80+ chars covering all Test C characters; expand if needed.
4. **CORS on Groq API** — browser may block direct API calls. Mitigation: Groq API supports CORS for browser requests.
5. **API key exposure** — `VITE_GROQ_API_KEY` is embedded in the built JS bundle on GitHub Pages. Anyone can extract it. **Accepted risk:** free tier key only, monitor usage on Groq dashboard, rotate if abused. Future: proxy via Supabase Edge Function if needed.
6. **Dual-mic conflict** — On mobile Chrome/iOS Safari, Web Speech API may interfere with AudioEngine's mic stream. **Contingency:** if observed, sequence them instead of running in parallel. Not built initially.
7. **WAV encoding** — Downsample to 16kHz mono before encoding WAV for Groq. Reduces upload size ~3x and matches Whisper's expected input.

---

## Existing bugs fixed by this work

- `CHAR_TONE_MAP` in whisperModel.js is `const` (not exported) — sensevoiceModel.js line 60 already tries to import it and silently fails. Adding `export` fixes this latent bug.
- Duplicate key `'天'` in CHAR_TONE_MAP (lines 115 and 117 of whisperModel.js) — harmless but should be cleaned up.
