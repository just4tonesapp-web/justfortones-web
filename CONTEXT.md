# Just4Tones — Dev Context & Progress

Last updated: 2026-03-19 (Session 2)

---

## Live App
https://just4tones.github.io/justfortones-web/

## Stack
Vanilla JS SPA · Vite · Supabase auth · GitHub Pages deploy (`npm run deploy`)

---

## What's Built

| Feature | Status |
|---------|--------|
| Auth (Supabase email + guest mode) | ✅ Working |
| Test A — Single syllable listening | ✅ Working |
| Test B — Two-syllable listening | ✅ Working |
| Test C — Single character pronunciation (ensemble AI) | ✅ Working |
| Test D — Two-character pronunciation | 🔒 Route exists, placeholder only, button locked |
| Tests X/Y/Z — Character tone knowledge | ❌ Not built |
| Interface II — Tone recognition practice | ❌ Not built |
| Interface III — Tone production practice | ❌ Not built |
| Interface IV — Character batch learning | ❌ Not built |
| Score persistence (Supabase DB) | ❌ Not wired up |

---

## Tone Detection Ensemble (Test C)

Entry point: `src/utils/toneDetector.js` — singleton `toneDetector`, used in `testCView.js`

| Model | Weight | Status | Notes |
|-------|--------|--------|-------|
| Pitch (ACF2PLUS + YIN) | 0.55 | ✅ Always active | `src/utils/models/pitchModel.js` |
| Whisper tiny | 0.60 | ✅ Active | Downloads ~40MB on first use. `src/utils/models/whisperModel.js` |
| ToneNet (ONNX CNN) | 0.99 | ❌ **DISABLED** | Always outputs T4 regardless of input — domain shift bug. `src/utils/models/tonetModel.js` |
| SenseVoice | 0.92 | 🔒 Stub | Fails silently. `src/utils/models/sensevoiceModel.js` |

**ToneNet status**: Model file (`public/models/tonenet.onnx`) exists and loads, but always predicts Tone 4.
Root cause: trained on clean studio recordings → doesn't generalize to browser mic (domain shift).
Commented out in `toneDetector.js` init. Line: `// load('tonenet', loadToneNet)`.

**Next steps for ToneNet**:
- Path A: Add mel-spectrogram debug canvas (DONE) → compare JS output vs Python/librosa visually
- Path B: Fine-tune `ntu-spml/distilhubert` on AISHELL-3 data in Colab → export ONNX INT8 (~6MB) → use via @xenova/transformers audio-classification pipeline

---

### Pitch Model (Session 2 fixes)
File: `src/utils/models/pitchModel.js`

**Bug fixed**: `TONE_CONTOURS[1]` = all 5s → Pearson correlation always returns 0 (zero variance template).
Tone 1 was never detected.

**Fix 1**: Flatness check in raw Hz BEFORE percentile normalization:
```js
if (rawRange / rawMean < 0.08) return 1  // flat pitch → tone 1
```
Percentile normalization amplifies noise for flat signals, destroying flatness info.

**Fix 2**: Replaced Pearson-only scoring with hybrid `scoreTone()` function:
- Tone 1: highness (mean > 2.5) + flatness (range < 3)
- Tone 2: Pearson + riseScore (endMean > startMean)
- Tone 3: Pearson + dipScore (valley in middle 25-75%, recovers after)
- Tone 4: Pearson + fallScore (startMean > endMean)

### Ensemble Weight History
- Whisper was 0.75 → lowered to 0.35 (ToneNet was dominating at 0.99)
- After disabling ToneNet, restored to 0.60
- Key insight: if ToneNet(0.99) + Whisper(0.75) + Pitch(0.55) all run, Whisper+Pitch can outvote ToneNet if both wrong (1.30 > 0.99)

### Debug: Mel-Spectrogram Canvas (Session 2)
After each recording in Test C, a 225×225 mel-spectrogram image now appears in the UI.
Used to visually verify the JS mel pipeline matches Python/librosa output.
**What correct output looks like**: colorful viridis banding, dark purple/blue at top (high freq), yellow/green at bottom (speech fundamentals), changes left→right over time.
If all black → audio too short/silent. If all same color → normalization bug.

---

### TTS Fix (Session 1)
- Was passing pinyin strings (e.g. "māo") to zh-CN TTS — Chinese TTS needs actual characters
- Test C: passes `q.char` directly
- Tests A & B: `getTTSChar(syllable, tone)` lookup in pinyin.js (200+ entries)
- Falls back to tone synth if no character found

### Audio Capture Fix (Session 1)
- Uses `ScriptProcessorNode` (4096 samples/chunk) for clean non-overlapping PCM
- Old approach used `getFloatTimeDomainData` at 60fps → 65% overlapping windows → 2.8× inflated audio
- Silence trimmed before sending to any model (`trimSilence` in toneDetector.js)

### Missing Choices Bug (Session 2 — FIXED)
- `applyTone` was removed from imports in testAView.js and testBView.js when TTS was switched to getTTSChar
- `applyTone` is still used for rendering choice buttons and result rows → ReferenceError → blank choices
- Fix: add `applyTone` back to import in both files ✅

---

## Key Files

```
src/
  main.js                          — routes, auth init
  router.js                        — hash-based SPA router
  supabaseClient.js                — Supabase client + no-op stub if env vars missing
  utils/
    audioEngine.js                 — mic recording (ScriptProcessorNode), pitch history
    toneDetector.js                — ensemble coordinator singleton + trimSilence()
    audio.js                       — speakChinese() TTS + playToneSynth() fallback
    pinyin.js                      — applyTone, getTTSChar (200+ entries), SYLLABLE_POOL, shuffle
    models/
      pitchModel.js                — ACF2PLUS+YIN, hybrid scoreTone(), flatness check, threshold=0.05
      whisperModel.js              — @xenova/transformers Whisper-tiny, CHAR_TONE_MAP (80+ entries)
      tonetModel.js                — ToneNet ONNX (DISABLED), getMelSpectrogramImage() debug export
      sensevoiceModel.js           — stub (throws silently)
  views/
    authView.js                    — login/signup
    homeView.js                    — diagnostic landing, Test D locked
    testAView.js                   — single syllable listening (applyTone + getTTSChar)
    testBView.js                   — two-syllable listening (applyTone + getTTSChar)
    testCView.js                   — pronunciation test, ensemble, mel-spectrogram debug canvas
    testDView.js                   — placeholder "coming soon"
  styles/
    global.css                     — design system, CSS variables, layout
scripts/
  export_tonenet.py                — Keras→ONNX export script (run in Colab)
public/
  models/
    tonenet.onnx                   — 20MB model file (NOT in git — copy manually after cloning)
```

---

## Vite Config
- `base: '/justfortones-web/'`
- `optimizeDeps.exclude: ['@xenova/transformers']` — uses workers, must not pre-bundle
- `worker.format: 'es'`
- `onnxruntime-web` is static import (not excluded)

---

## Supabase
- Project URL + anon key: in `.env.local` (gitignored, never commit)
- Free tier **pauses after ~1 week of inactivity** — resume at supabase.com
- After resume: no key changes needed, just wait ~30s
- Email confirmation redirect: set Site URL in Authentication → URL Configuration
  - Local: `http://localhost:5173/justfortones-web/`
  - Prod: `https://just4tones.github.io/justfortones-web/`
- `.env.local` baked into build at deploy time from local machine

---

## Deploy
```bash
npm run deploy        # vite build + gh-pages push to gh-pages branch
```

---

## Mac Setup (transferring from Windows)

1. Clone repo:
   ```bash
   git clone https://github.com/just4tones/justfortones-web.git
   cd justfortones-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` (not in git — get values from Windows machine or Supabase dashboard):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Copy `tonenet.onnx` manually (NOT in git, 20MB):
   - From Windows: `C:\Users\Homer\OneDrive\Documents\GitHub\justfortones-web\public\models\tonenet.onnx`
   - To Mac: `public/models/tonenet.onnx`
   - Note: ToneNet is currently DISABLED in code (always outputs T4). Copy anyway for future.

5. Run dev server:
   ```bash
   npm run dev
   # → http://localhost:5173/justfortones-web/
   ```

---

## Current Accuracy Status (as of Session 2)
- Tone 4 (falling): ~90% correct
- Tones 1/2/3: ~40-50% (improving — pitch model flatness fix + hybrid scoring)
- ToneNet disabled (was always T4)
- Whisper: weight 0.60, loads ~40MB on first use, unreliable on single syllables

## Next Session Priorities
1. **Compare mel-spectrogram debug output** — record a tone in Test C, screenshot the debug canvas,
   compare against Python/librosa output for same audio. Determines if ToneNet pipeline is fixable.
2. **Path B (recommended)**: Fine-tune DistilHuBERT on AISHELL-3 in Colab:
   - Model: `ntu-spml/distilhubert` (23.5M params)
   - Data: AISHELL-3 (has per-character tone annotations)
   - Task: 4-class audio classification (tones 1-4)
   - Export: ONNX → INT8 quantize → ~6MB
   - Load: `@xenova/transformers` `audio-classification` pipeline (same as Whisper)
3. Build Tests X/Y/Z (character tone knowledge)
4. Wire up Supabase score persistence

---

## Team
- **Homer** — tech lead
- **QQ / yiyi** — co-developer (voice recognition)
- **Qi** — product owner, content creator

## MVP Target
March 23, 2026
