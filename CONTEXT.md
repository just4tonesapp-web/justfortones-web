# Just4Tones — Dev Context & Progress

Last updated: 2026-04-11

---

## Live App
https://just4tones.github.io/justfortones-web/

## Stack
Vanilla JS SPA · Vite · Supabase auth · GitHub Pages deploy (`npm run deploy`)

---

## What's Built

| Feature | Status | Route | File |
|---------|--------|-------|------|
| Auth (Supabase email + guest mode) | ✅ | `/login` | `authView.js` |
| Home — Diagnostic landing | ✅ All unlocked | `/` | `homeView.js` |
| Test A — Single syllable listening | ✅ + saveResult | `/test-a` | `testAView.js` |
| Test B — Two-syllable listening | ✅ + saveResult | `/test-b` | `testBView.js` |
| Test C — Single char pronunciation | ✅ + saveResult | `/test-c` | `testCView.js` |
| Test D — Two-char pronunciation | ✅ Full impl | `/test-d` | `testDView.js` |
| Tests X/Y/Z — Character tone knowledge | ✅ 3x12 rounds | `/test-xyz` | `testXYZView.js` |
| Diagnostic Report | ✅ Combined view | `/report` | `diagnosticReportView.js` |
| Interface II — Tone recognition practice | ✅ Infinite drills | `/practice-recognition` | `practiceRecView.js` |
| Interface III — Tone production practice | ✅ Record + AI | `/practice-production` | `practiceProView.js` |
| Interface IV — Character batch learning | ✅ Flashcard + quiz | `/practice-characters` | `practiceCharView.js` |
| Progress tracking | ✅ Supabase + localStorage | — | `services/progressService.js` |
| Accuracy logging (Test C/D) | ✅ Per-question votes | — | `testCView.js`, `testDView.js` |

---

## Tone Detection Ensemble

Entry point: `src/utils/toneDetector.js` — singleton `toneDetector`

### Model Weights (calibrated 2026-03-30 from 36-sample analysis)

| Model | Weight | Combined Accuracy | Type | File |
|-------|--------|-------------------|------|------|
| Google Cloud Speech | **2.50** | 96.3% (100% sens / 92% spec) | Cloud API | `models/googleSpeechModel.js` |
| Pitch (ACF2PLUS+YIN) | **2.50** | 83.3% (74% sens / 94% spec) | Local | `models/pitchModel.js` |
| Azure Speech | **2.00** | 89.3% (94% sens / 83% spec) | Cloud API | `models/azureModel.js` |
| Deepgram (Nova-2) | **1.00** | 79.2% (92% sens / 64% spec) | Cloud API | `models/deepgramModel.js` |
| SenseVoice | 1.00 | — | Stub | `models/sensevoiceModel.js` |
| Groq (Whisper v3) | **0.50** | 51.9% | Cloud API | `models/groqModel.js` |
| Groq Turbo | **0.50** | 60.0% | Cloud API | `models/groqModel.js` |
| Whisper (in-browser) | 0.30 | 51.7% | Local (40MB) | `models/whisperModel.js` |
| Classifier (DistilHuBERT) | 0.10 | 52.9% | Local | `models/toneClassifierModel.js` |
| ToneNet (ONNX CNN) | ❌ DISABLED | — | — | `models/tonetModel.js` |

### Key insight: "Real Word Bias"
ASR models (Groq, Deepgram, GroqTurbo) transcribe what user *meant* to say rather than what was acoustically said. Google/Azure handle this best. Pitch is purely acoustic and avoids bias entirely.

### Accuracy improvements applied 2026-03-30:
1. **Weight recalibration** — simulated 83.3% → 94.4% overall accuracy
2. **Google retry + timeout** — 8s AbortController, up to 2 retries
3. **Azure retry** — fresh recognizer on null result
4. **Low-coverage confidence penalty** — when <5 models vote, confidence reduced
5. **Pitch T2/T3 discrimination** — T2 penalizes mid-dip, T3 requires dip-below-start

### Remaining known issues:
- 来 (lai T2) still false negative when Google/Azure don't respond
- Coverage gaps: Google 75%, Azure 78%, Deepgram 67%
- Tone 2 is weakest (60% vs 100% for T3/T4)

---

## API Cost Analysis (2026-04-01)

**Per question: ~$0.0071** (5 cloud APIs × ~3 sec audio)

### Free Tier Limits
| Model | Free Limit | Questions before paying |
|-------|-----------|----------------------|
| **Google** | 60 min/mo | **~240** (15-sec billing minimum!) |
| Azure | 5 hrs/mo | ~6,000 |
| Deepgram | $200 one-time credit | ~930,000 |
| Groq | Rate-limited free | Unlimited (throttled) |

### Cost at Scale
| Daily calls | Scenario | Monthly cost |
|------------|----------|-------------|
| 36 | 1 tester | $0 |
| 360 | 10 users/day | $0 |
| 1,200 | 30 users/day | ~$4 |
| 3,600 | 100 users/day | ~$16 |
| 36,000 | 1K users/day | ~$196 |

**Google is 90% of cost** due to 15-sec billing minimum. First free tier to bust (240 q/month).

### Cost optimization options:
1. Drop Groq + GroqTurbo (worst accuracy, negligible cost savings but less complexity)
2. Rate-limit Google per user (first 5 questions/session only)
3. Drop Google, keep Azure (93.8% vs 100%, 1/3 cost, 25x free tier)

---

## Pitch Model Details

File: `src/utils/models/pitchModel.js`

- Dual detector: ACF2PLUS (preferred) + YIN fallback
- RMS gating (0.008 threshold), percentile normalization (10th/90th)
- Flatness check in raw Hz before normalization: `rawRange/rawMean < 0.08 → Tone 1`
- Hybrid `scoreTone()`:
  - T1: highness + flatness
  - T2: Pearson + rise score − dip penalty + min-at-start bonus
  - T3: Pearson + dip score (must dip below start) + classic 214 bonus
  - T4: Pearson + fall score

---

## Key Files

```
src/
  main.js                          — routes (11 routes), auth init
  router.js                        — hash-based SPA router
  supabaseClient.js                — Supabase client + no-op stub
  services/
    progressService.js             — save/load results, getDiagnosticState()
  utils/
    audioEngine.js                 — mic recording (ScriptProcessorNode)
    toneDetector.js                — ensemble coordinator + trimSilence()
    audio.js                       — speakChinese() TTS + playToneSynth()
    pinyin.js                      — applyTone, getTTSChar, SYLLABLE_POOL, shuffle
    models/
      pitchModel.js                — ACF2PLUS+YIN, hybrid scoring
      whisperModel.js              — Whisper-tiny ONNX, CHAR_TONE_MAP (100+ entries)
      googleSpeechModel.js         — Google Cloud STT + retry
      azureModel.js                — Azure Speech + retry
      deepgramModel.js             — Deepgram Nova-2
      groqModel.js                 — Groq Whisper v3 + Turbo
      toneClassifierModel.js       — DistilHuBERT fine-tuned
      tonetModel.js                — ToneNet ONNX (DISABLED)
      sensevoiceModel.js           — stub
      webSpeechModel.js            — disabled (COOP header blocks)
  views/
    authView.js                    — login/signup/guest
    homeView.js                    — diagnostic landing, all unlocked
    testAView.js                   — single syllable listening
    testBView.js                   — two-syllable listening
    testCView.js                   — single char pronunciation (ensemble)
    testDView.js                   — two-char pronunciation (ensemble)
    testXYZView.js                 — character tone knowledge (3x12)
    diagnosticReportView.js        — combined results report
    practiceRecView.js             — tone recognition drills (Interface II)
    practiceProView.js             — tone production practice (Interface III)
    practiceCharView.js            — character batch learning (Interface IV)
  styles/
    global.css                     — design system, CSS variables
```

---

## Supabase

- Tables: `accuracy_log` (per-question votes), `test_results` (per-test scores)
- Free tier pauses after ~1 week inactivity — resume at supabase.com
- `.env.local` contains all keys (gitignored)

### Required env vars:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_GROQ_API_KEY=...
VITE_DEEPGRAM_API_KEY=...
VITE_GOOGLE_SPEECH_API_KEY=...
VITE_AZURE_SPEECH_KEY=...
VITE_AZURE_SPEECH_REGION=eastus
```

---

## Deploy
```bash
npm run deploy        # vite build + gh-pages push
```

## Dev Setup
```bash
git clone https://github.com/just4tones/justfortones-web.git
cd justfortones-web
npm install
# Create .env.local with keys above
npm run dev           # → http://localhost:5173/justfortones-web/
```

---

## Team
- **Homer** — tech lead
- **QQ / yiyi** — co-developer (voice recognition)
- **Qi** — product owner, content creator

## Session History
- **Session 1** (2026-03-18): TTS fix, audio capture fix, initial ensemble
- **Session 2** (2026-03-19): Pitch model fixes, mel-spectrogram debug, missing choices bug
- **Session 3** (2026-03-23): Groq + Deepgram integration, prompt hints, CHAR_TONE_MAP
- **Session 4** (2026-03-24): Ensemble v2 (tiered voting), Google + Azure integration
- **Session 5** (2026-03-30): Weight recalibration from 36-sample accuracy analysis, retry logic, T2/T3 fix
- **Session 6** (2026-04-01): Built all missing features — Test D, Tests X/Y/Z, Interfaces II/III/IV, diagnostic report, progress tracking. Unlocked all tests on home page. API cost analysis.
- **Session 7** (2026-04-11): Integrated human-recorded audio for Test A & Test C. Applied Test C feedback doc.

### Session 7 Details

**Human recordings integration:**
- Source: `Test A &C Single Syllables Sound Recordings/` folder (24 consonant rows × 4 tones per syllable)
- 1,640 `.m4a` files (including _X "no real character" combos) copied to `public/audio/syllables/` (~141 MB)
- Files named `{syllable}{tone}.m4a` (e.g. `ba1.m4a`, `xiao3.m4a`, `an2.m4a`)
- `_X` suffix stripped on copy — all combos treated as valid recordings

**New files:**
- `src/utils/recordingsManifest.js` — auto-generated manifest of all 1,640 available syllable+tone combos. Exports `SYLLABLES_BY_TONE`, `RECORDED_COMBOS` Set, `hasRecording(syl, tone)`.
- `src/utils/testCFeedback.js` — feedback message pools from "Test C feedback.docx": graded praise (high/mid/low confidence), "almost" encouragement, per-tone reminders with 3 variations each (A/B/C).

**Modified files:**
- `src/utils/audio.js` — added `playSyllable(syllable, tone, onEnd)`: plays from `public/audio/syllables/`, falls back to `playToneSynth()` on error. Imports `hasRecording` from manifest.
- `src/views/testAView.js` — uses `playSyllable()` instead of `speakChinese()`; `generate()` now filters `SYLLABLE_POOL` to combos with recordings via `hasRecording()`.
- `src/views/testCView.js` — `listenExample()` uses `playSyllable(q.base, q.tone)` instead of `speakChinese(q.char)`; correct answers show graded praise via `pickPraise(confidence)`; wrong answers show tone-specific reminder + coach variation via `buildWrongFeedback(tone, pitchAgreed)` in a new `tc-coach-msg` panel.
- `.gitignore` — excludes source recordings folder and feedback docx.

**Not yet done / open items:**
- Test C "retry" per question not implemented — the feedback doc's Variation A/B/C suggest re-attempts, but currently one random variation is shown per wrong answer. Could add a "Try Again" button that cycles through variations.
- `npm install` needed before `npm run deploy` (node_modules not present).
- First deploy will be slow due to ~141 MB of new audio assets.
