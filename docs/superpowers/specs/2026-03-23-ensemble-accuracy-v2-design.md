# Ensemble Accuracy v2 — Target 90% Design Spec

## Goal

Improve Test C tone detection accuracy from ~50-60% to 90%+ by adding prompt hints to Groq, fixing ensemble voting to trust high-accuracy models, reducing the classifier's influence, adding Deepgram as a second cloud ASR, and activating SenseVoice via sherpa-onnx WASM.

## Architecture

The existing ensemble in `toneDetector.js` runs all loaded models in parallel and combines results via weighted vote. This spec makes five targeted changes to that system:

1. **Groq prompt hints** — bias Whisper-large-v3 toward expected characters
2. **Tiered ensemble voting** — prevent weak models from outvoting strong ones
3. **Classifier weight reduction** — stop the 40%-accurate model from swinging votes
4. **Deepgram cloud ASR** — second cloud model for redundancy and confidence
5. **SenseVoice activation** — high-accuracy in-browser model via sherpa-onnx WASM

## Tech Stack

- Groq Whisper API (existing, adding `prompt` parameter)
- Deepgram Nova-2 API (new, REST, free tier, `VITE_DEEPGRAM_API_KEY`)
- sherpa-onnx WebAssembly (new, runs SenseVoice in-browser)
- Existing: onnxruntime-web, @xenova/transformers, pitchfinder

---

## Change 1: Groq Prompt Hints

**File:** `src/utils/models/groqModel.js`

**What:** When `targetBase` is provided (e.g. `"ma"`), build a prompt string from all CHAR_TONE_MAP entries matching that base (e.g. `"妈麻马骂"`). Pass this as the `prompt` field in the Groq API FormData.

**Why:** Whisper's `prompt` parameter biases the model's decoder toward the provided tokens. For a known syllable set, this dramatically improves transcription accuracy from ~85% to ~95%+.

**Details:**
- Import `CHAR_TONE_MAP` (already imported)
- Build hint: filter CHAR_TONE_MAP entries where `entry.base === targetBase`, join the characters into a string
- Append `formData.append('prompt', hintChars)` before the fetch call
- If `targetBase` is null, skip the prompt (no bias)

**Expected impact:** Groq accuracy ~85% -> ~95%+ for known syllables.

---

## Change 2: Tiered Ensemble Voting

**File:** `src/utils/toneDetector.js`

**What:** Replace flat weighted voting with a tiered system that respects model quality.

**New weights:**
| Model | Old Weight | New Weight | Tier |
|-------|-----------|-----------|------|
| Groq | 0.90 | 1.50 | 1 (cloud ASR, high accuracy) |
| Deepgram | n/a | 1.20 | 1 (cloud ASR, high accuracy) |
| SenseVoice | 0.92 | 1.00 | 2 (in-browser ASR) |
| Whisper | 0.60 | 0.50 | 2 (in-browser ASR) |
| Pitch | 0.55 | 0.35 | 3 (signal-based) |
| Classifier | 0.40 | 0.20 | 3 (signal-based) |

**Groq override rule in `_combine()`:** If Groq voted and its weighted contribution exceeds 40% of total weight from all voting models, use Groq's tone. This prevents scenarios where 3-4 weak models outvote the most accurate one.

**Rationale for 40% threshold:** With all 6 models voting (total weight = 4.75), Groq's 1.50 = 31.6%. So the override only fires when some weaker models abstain (didn't vote / returned null), making Groq's share rise above 40%. This avoids blindly trusting Groq when the full ensemble disagrees.

**Expected impact:** Eliminates the main failure mode (weak models outvoting Groq).

---

## Change 3: Classifier Weight Reduction

**File:** `src/utils/toneDetector.js`

**What:** Reduce classifier weight from 0.40 to 0.20.

**Why:** The DistilHuBERT classifier has ~40% accuracy on real microphone audio (it was trained on edge-tts synthetic voices). At 0.20 weight, it still contributes when it agrees with better models but cannot swing votes on its own. Disabling entirely would waste a loaded model; reducing weight is the right balance.

**Expected impact:** Prevents classifier from being the deciding vote in close calls.

---

## Change 4: Deepgram Cloud ASR

**New file:** `src/utils/models/deepgramModel.js`

**What:** Add Deepgram Nova-2 as a second cloud-based ASR model for Mandarin tone detection. Follows the same pattern as `groqModel.js`.

**API details:**
- Endpoint: `https://api.deepgram.com/v1/listen?language=zh&model=nova-2`
- Auth: `Authorization: Token ${apiKey}` header
- Body: raw WAV blob (Content-Type: audio/wav)
- Response: JSON with `results.channels[0].alternatives[0].transcript`
- Free tier: $200 credit (no credit card required for signup)

**Flow:**
1. `loadDeepgram()` — validate `VITE_DEEPGRAM_API_KEY` exists
2. `detectToneWithDeepgram(samples, sampleRate, targetBase)`:
   - Resample to 16kHz
   - Encode as WAV (reuse or duplicate `encodeWAV` from groqModel)
   - POST to Deepgram API
   - Parse transcript, look up tone via CHAR_TONE_MAP
   - Handle 401 (disable), 429 (skip), errors gracefully

**Integration in toneDetector.js:**
- Import `loadDeepgram`, `detectToneWithDeepgram`
- Add to `MODEL_WEIGHTS` with weight 1.20
- Add `load('deepgram', loadDeepgram)` in `init()`
- Add deepgram job block in `detect()` (same pattern as groq)

**Integration in testCView.js:**
- Add `deepgram` persona: `{ emoji: '🔊', name: 'Deep' }`
- Add to judges array and shown array

**Expected impact:** Two cloud models agreeing provides ~95%+ confidence. When they disagree, the other models break the tie.

---

## Change 5: Activate SenseVoice via sherpa-onnx WASM

**File:** `src/utils/models/sensevoiceModel.js`

**What:** Replace the stub with real sherpa-onnx WASM integration to run SenseVoice-small in-browser.

**Dependencies:**
- `sherpa-onnx-wasm` npm package (or load from CDN)
- SenseVoice-small int8 ONNX model files (~30MB total):
  - `model.int8.onnx`
  - `tokens.txt`
  - Placed in `public/models/sensevoice/`

**Flow:**
1. `loadSenseVoice()`:
   - Import sherpa-onnx WASM module
   - Initialize offline recognizer with model paths
   - Handle download progress via callback
2. `detectToneWithSenseVoice(samples, sampleRate, targetBase)`:
   - Create stream, feed audio, decode
   - Get transcript text
   - Look up tone via CHAR_TONE_MAP (already imported)

**Risk mitigation:** sherpa-onnx WASM may have build/compatibility issues. If it can't be made to work within reasonable effort, skip it — the other 4 changes should still hit ~88-90%. The stub's `throw new Error()` pattern means the rest of the ensemble works fine without it.

**Expected impact:** Adds a ~90-95% accurate in-browser model with no cloud dependency.

---

## Model Ensemble After All Changes

| Model | Type | Weight | Est. Accuracy | Status |
|-------|------|--------|--------------|--------|
| Groq + prompt | Cloud ASR | 1.50 | ~95% | Existing, enhanced |
| Deepgram | Cloud ASR | 1.20 | ~85-90% | New |
| SenseVoice | In-browser ASR | 1.00 | ~90-95% | Activated from stub |
| Whisper-tiny | In-browser ASR | 0.50 | ~70% | Existing |
| Pitch | Signal analysis | 0.35 | ~55% | Existing, reweighted |
| Classifier | DistilHuBERT | 0.20 | ~40% | Existing, reweighted |

**Total weight:** 4.75 (when all models vote)

**Expected overall accuracy:** 88-93%, depending on SenseVoice activation success.

---

## Files Changed

| File | Action |
|------|--------|
| `src/utils/models/groqModel.js` | Modify: add prompt hint from targetBase |
| `src/utils/toneDetector.js` | Modify: new weights, override rule, deepgram/sensevoice wiring |
| `src/utils/models/deepgramModel.js` | Create: new Deepgram cloud ASR model |
| `src/utils/models/sensevoiceModel.js` | Modify: replace stub with sherpa-onnx WASM |
| `src/views/testCView.js` | Modify: add deepgram persona to judges |
| `public/models/sensevoice/` | Create: model files for SenseVoice |

## Testing

- Manual Test C runs comparing before/after accuracy on all 4 tones
- Console `[ensemble]` logs showing all model votes and final decision
- Verify Deepgram API key works on prod (same VITE_ pattern as Groq)
- Verify SenseVoice model downloads and runs inference in-browser
