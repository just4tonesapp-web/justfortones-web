# Just4Tones — Dev Context & Progress

Last updated: 2026-05-14

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
| Test X — Top 50 character tones (50q, pass 40+) | ✅ Single round | `/test-x`, `/test-xyz` | `testXYZView.js` |
| Test Y — Top 500 HSK 1–3 disyllabic words (10×20q, pass 16+) | ✅ Y1–Y10 picker | `/test-y` | `testYView.js`, `utils/hskDisyllabicWords.js` |
| Diagnostic Report | ✅ Combined view | `/report` | `diagnosticReportView.js` |
| Test History (every attempt) | ✅ Filter chips, summary | `/history` | `historyView.js` |
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

---

## Session 8 — 2026-04-24 → 2026-05-08

### Source documents this session
- `Just4Tones App Requirements.docx` (and `(1).docx` revision) — full spec
- `Test B & D Disyllabic Words/` — folder of 496 m4a recordings, 16 tone-pair sub-folders (`11`, `12`, …, `44`), filenames like `ban1jia1.m4a`. 2 garbage files skipped (`Recording.m4a`, `dianti1.m4a`).
- `Test B D Y HSK_disyllabic_words_sorted.xlsx` — 496 HSK 1–3 disyllabic words. Columns: chars, tone pattern (e.g. `44`), full pinyin, English meaning. Sorted by tone pattern (NOT by HSK frequency).

### What changed in this session

**1. Fail-screen UX bug — strange focus box on choice click**
- `practiceRecView.js`: added `outline: none` + `-webkit-tap-highlight-color: transparent` on `.choice-btn`, plus `:focus-visible` for keyboard a11y. Mirrors existing pattern in `practiceCharView.js`.

**2. Friendlier feedback wording (later replaced — see #11)**
- Tests A & B fail screens originally said "you have some work to do with your ears!" → softened, then revised to match doc cadence.

**3. Test B `_X`-style syllable filter**
- `testBView.js` `generate()` now uses `hasCharacter(s, tone)` to skip combos with no real character at the chosen tone. Carries the same filtering Test A had.

**4. History page**
- `src/views/historyView.js` — new view at `/history`. Lists every saved attempt (newest first), filter chips for All/A/B/C/D/X/Y, summary row (total / passed / failed). 📋 button added to home top bar.

**5. Supabase email-confirmation redirect fix**
- After Supabase pause/resume, confirmation links landed at `https://just4tones.github.io/#error=...` (root domain, not the `/justfortones-web/` app). Hardened `authView.js` to pass explicit `emailRedirectTo: window.location.origin + import.meta.env.BASE_URL` on signup and `redirectTo` on `resetPasswordForEmail`.
- **User must also fix Supabase Dashboard → Authentication → URL Configuration:** Site URL = `https://just4tones.github.io/justfortones-web/`, add `https://just4tones.github.io/justfortones-web/**` to Redirect URLs.

**6. Disyllabic recordings imported (Test B audio)**
- 496 m4a files copied to `public/audio/disyllables/{11,12,…,44}/*.m4a` (~42 MB).
- `src/utils/disyllableManifest.js` (auto-generated) — `DISYLLABLE_BY_PAIR`, `DISYLLABLE_COMBOS` Set, `findDisyllableRecording(syl1, t1, syl2, t2) → relative path or null`, `hasDisyllableRecording(...)`.
- 492 valid combos indexed (a few filename typos like `lin1ju1.m4a` in folder `21`; folder name is treated as authoritative for tone pair).
- `scripts/buildDisyllableManifest.mjs` — re-runnable generator.
- `src/utils/audio.js` — new `playDisyllable(syl1, t1, syl2, t2, onEnd)`. Plays the m4a; falls back to two sequential `playSyllable` calls; final fallback to synth tones.
- `src/views/testBView.js`:
  - `generate()` now picks each tone-pair question from the recorded pool first; falls back to synth syllables if a pair has no recordings (rare).
  - `playCurrent()` uses `playDisyllable` when a recording exists, otherwise TTS.

**7. Pass thresholds 10/12 → 7/12**
- All four diagnostic tests (A, B, C, D): `PASS_SCORE = 7`.
- `progressService.saveResult()` `passed:` formula adjusted to match (`Math.ceil(total * 0.58)` for non-12 totals).

**8. Test C "Practice Again" label**
- `testCView.js`: wrong-answer button changed from "🎤 Try Again" → "🎤 Practice Again" to match doc.

**9. Failure flow — 2-button layout, A/B/C/D fail screens**
- All four tests' fail screens now show two equal-weight buttons: "🔄 Retake the Test" and a typed practice CTA:
  - Test A → "🎧 Single Syllable Practice"
  - Test B → "🎧 Disyllabic Words Practice"
  - Test C → "🎤 Single Syllable Tone Practice"
  - Test D → "🎤 Disyllabic Words Tone Practice"
- Pass screens unchanged: Retake (secondary) + Continue (primary).
- Practice button writes `sessionStorage.setItem('j4t_practice_set', '1')` and `j4t_practice_return` (e.g. `/test-a`), then navigates to the practice route.

**10. Practice end-screen + balanced 12-item set mode**
- `practiceRecView.js` (recognition path — A/B failures):
  - On entry, reads `j4t_practice_set` flag. If set, runs in **set mode**: 12 items pre-built (3 per tone, balanced), shuffled. Stats bar replaced with progress bar + question counter.
  - After question 12, shows end screen with **"More Practice"** (rebuilds set, restarts at Q1) and **"I'm ready for the test again"** (clears flags, navigates to `j4t_practice_return`).
  - Home-page entry to `/practice-recognition` keeps original infinite mode.
- `practiceProView.js` (production path — C/D failures): same set-mode pattern, but using mic recording + ensemble detection. End screen + More/Ready buttons identical in feel.
- `practiceCharView.js`: clears stale set flags on entry as a safety net (no set-mode UI yet for character batch learning).

**11. Pass-screen wording (matches doc cadence)**
- Test A pass: "🎉 Great Job! Incredible! You nailed it! …Now let's see if you can identify tones of disyllabic Chinese words!" — all three exclamations in sequence.
- Test B pass: "🎉 Fantastic! …effortlessly! Now let's see if you can pronounce the four tones like a Chinese native!"
- Test C pass: "🎉 Great Job! Incredible! You nailed it! …Now let's see if you can pronounce tones of disyllabic Chinese words!"
- Test D pass: "🎉 Fantastic! …almost effortlessly! You nailed it. Now let's try to crack the tones of the most frequently used Chinese characters and words."
- All four fail screens: "Fluctuation in performance when listening/producing foreign sounds is totally expected. Want to retake the test, or go straight to practice?"

**12. Test X restructure — single 50-item test**
- `testXYZView.js` rewritten: dropped 3-round structure; runs one 50-question test from the existing `CHAR_POOL` (which has exactly 50 entries).
- `TOTAL = 50`, `PASS_SCORE = 40`. Saves only as `'X'` (no longer writes Y/Z rows).
- New routes: `/test-x` (canonical) and `/test-xyz` (legacy alias) both point to it.
- Pass → "→ Continue to Test Y" (routes to `/test-y`). Fail → "🔄 Retake the Test" + "📚 Practice Makes Perfect!" (→ `/practice-characters`).
- `progressService.getDiagnosticState()`: `step3Done` now equals `passedX` only; `passedZ` kept as `false` for legacy callers; `passedY` still surfaced.
- `diagnosticReportView.js`: dropped Y/Z rows; X row label updated to "Test X — Top 50 Character Tones".
- `homeView.js`: Step 3 now shows two cards — "Top 50 Character Tones" (Test X) and "Top 500 Disyllabic Words" (Test Y).

**13. Test Y — full implementation with HSK data**
- `src/utils/hskDisyllabicWords.js` (auto-generated from xlsx) — exports `HSK_DISYLLABIC_WORDS`: array of `{ chars, pattern, pinyin, meaning }`. 496 entries.
- `scripts/buildHskWords.mjs` — re-runnable generator from the xlsx.
- `src/views/testYView.js` — real Test Y view:
  - 10 sub-rounds Y1–Y10, each slicing `HSK_DISYLLABIC_WORDS[ (n-1)*50 : n*50 ]`.
  - 20 questions per round, pass at 16+. Distractors are 3 random tone-pair patterns from the other 15 combos.
  - Question UI shows Chinese characters + bare pinyin (tone marks stripped) + English meaning. Answer choices are 4 tone-pair patterns rendered as e.g. "4 – 4".
  - **Round picker chips** on the intro screen — tap Y1…Y10 to switch rounds. Active highlighted, empty slices disabled.
  - On round-pass: "Continue to Y(N+1)" button (uses `location.reload()` to re-mount with new round in sessionStorage).
  - Saves under both `Y{N}` and generic `Y` so `passedY` lights up.
- ⚠️ HSK xlsx is sorted by tone pattern, NOT HSK frequency. So Y1 ≠ "the 50 most-frequent words". Replace `hskDisyllabicWords.js` data when a frequency-ordered list is available.

**14. Retake → new items (no repeats from previous attempt)**
- All four Tests A/B/C/D now keep a closure-scoped `previousItems` / `previousFiles` / `previousChars` / `previousCombos` Set that survives across `startTest()` calls within the same view mount.
- Each `generate()`: prefers items NOT in the previous set. If the fresh pool is too small, falls back to the full pool.
- After generation, `previousItems` is replaced with the current set's identifiers — so Retake → Retake → Retake gives 3 distinct sets (resources permitting).

**15. Mobile layout — home header**
- `homeView.js` refactor:
  - Top action icons (📊 / 📋 / Log out) now sit on their own row, right-aligned, above the title.
  - Title "Just4Tones" + subtitle "Master the four tones of Mandarin Chinese" form a single centered block below.
  - On screens ≤480px: title shrinks to 1.9rem, top buttons get smaller padding/font.
  - Previously the icons were `position: absolute; right: 0` over a centered title and overlapped the text on narrow screens.

### New files (this session)
```
public/audio/disyllables/{11,12,...,44}/*.m4a   (496 files, ~42 MB)
scripts/buildDisyllableManifest.mjs
scripts/buildHskWords.mjs
src/utils/disyllableManifest.js                  (auto-generated)
src/utils/hskDisyllabicWords.js                  (auto-generated)
src/views/historyView.js
src/views/testYView.js
```

### Modified files (this session)
```
src/main.js                          — routes for /history, /test-x, /test-y
src/router.js                        — (unchanged this session)
src/services/progressService.js      — pass formula 0.58, dropped Z gating
src/utils/audio.js                   — playDisyllable + import disyllableManifest
src/views/authView.js                — explicit emailRedirectTo / redirectTo
src/views/diagnosticReportView.js    — dropped Y/Z rows, updated X label
src/views/homeView.js                — Step 3 X+Y split, mobile header refactor, history btn
src/views/practiceCharView.js        — clear stale set-mode flags on entry
src/views/practiceProView.js         — set-mode (12-item) + end screen (More/Ready)
src/views/practiceRecView.js         — set-mode + end screen, focus-box CSS fix
src/views/testAView.js               — pass 7, friendly fail, "Great Job! Incredible!…", retake new items, 2-btn fail flow
src/views/testBView.js               — pass 7, _X filter, real recordings via playDisyllable, retake new items, 2-btn fail flow
src/views/testCView.js               — pass 7, "Practice Again" label, "Great Job! Incredible!…", retake new items, 2-btn fail flow
src/views/testDView.js               — pass 7, "Fantastic!…You nailed it.", retake new items, 2-btn fail flow
src/views/testXYZView.js             — refactor to single 50q Test X, pass 40, removed XYZ round flow
```

### sessionStorage keys (this session)
| Key | Set by | Read by | Purpose |
|---|---|---|---|
| `j4t_practice_set` | Test A/B/C/D fail screens | `practiceRecView`, `practiceProView` | Switch practice into 12-item set mode |
| `j4t_practice_return` | Test A/B/C/D fail screens | `practiceRecView`, `practiceProView` | Where to navigate on "I'm ready for the test again" |
| `j4t_test_y_round` | Test Y round picker / Continue button | `testYView` | Which Y1–Y10 sub-round to start |

### Requirements scorecard (after this session)
| Requirement | Status |
|---|---|
| Tests A/B/C/D — 12 items, pass at 7+ | ✅ |
| Real disyllabic recordings for Test B | ✅ (492/496 indexed) |
| Failure flow with 2 buttons (Retake / typed practice) | ✅ A, B, C, D, X, Y |
| Practice set: 12 items (3/tone), end screen (More / Ready) | ✅ recognition + production |
| "Great Job! / Incredible! / You nailed it!" pass message | ✅ A, C |
| "Fantastic!" pass message | ✅ B, D |
| "Impressive!" pass message | ✅ X, Y |
| Test X: 50 items, pass at 40+ | ✅ |
| Test Y: 10 sub-rounds × 20 items, pass at 16+ | ✅ (data is tone-pattern-sorted, not frequency) |
| Retake → new items | ✅ A, B, C, D |
| Save every test result | ✅ existing `progressService` |
| User-visible data page | ✅ `/report` (best per test) + `/history` (every attempt) |

### Known open items / future work
- Replace `hskDisyllabicWords.js` data when an HSK-frequency-ordered list arrives, so Y1 = top 50 most-frequent.
- `practiceCharView` doesn't yet have set-mode (only clears stale flags). Test X fail currently routes to it in infinite mode.
- Test Y's "Continue to Y(N+1)" relies on `location.reload()` because the hash route doesn't change — could be replaced with an in-place re-mount.
- Big chunk size warning on `dist/assets/index-*.js` (~1.3 MB). Consider dynamic imports / `manualChunks` if startup gets slow.
- `node_modules/` not committed; first-time setup needs `npm install` before `npm run deploy`.

### Deploy
```bash
npm install     # first time only
npm run deploy  # vite build + force-push dist/ to gh-pages branch
```
GitHub Pages serves from the `gh-pages` branch of `https://github.com/just4tones/justfortones-web`.

---

## Session 9 — 2026-05-10 → 2026-05-14

### Source documents this session
- `Website feedback (bugs).numbers` — first batch, 8 items
- `Website feedback (bugs) (1).numbers` — second batch (font sizes, sandhi, idle redirect, arrows, Test D model leak)
- `Website feedback (bugs) (2).numbers` — third batch (Test X char swap, Tab UX, Test C simplification, sandhi, arrows). Screenshot column has 2 reference images: a "FOUR TONES" line-contour diagram and an arrow-style tone chart — confirms the line-shape glyphs (`─ ／ ∨ ＼`) are the canonical style.
- `Just4Tones App Requirements (2).docx` — re-audited against current implementation

### What changed this session

**1. Centralised audio cancellation (`src/utils/audio.js`)**
- New `stopAllAudio()` cancels `speechSynthesis` and pauses every tracked `<audio>` element.
- `playSyllable` / `playDisyllable` / `speakChinese` now register their `<audio>` instance via internal `trackAudio()` and call `stopAllAudio()` before starting, so a new playback always interrupts any in-flight audio.
- Router calls `stopAllAudio()` on every hash change.
- Practice views call it in `loadQuestion` / `loadChar` so advancing items kills lingering playback.

**2. Tone Recognition Practice rewrite (`practiceRecView.js`)**
- Two real tabs: **Single Syllables** and **Disyllabic Words**.
- Single tab uses `playSyllable` (real m4a) — was `speakChinese` (TTS).
- Disyllabic tab is new: sourced from `DISYLLABLE_BY_PAIR`, played via `playDisyllable`, single-column choice layout with full pinyin (mirrors Test B).
- Set mode auto-locks tab: `/test-a` → single, `/test-b` → pairs.
- 3+3 tone pair is excluded from both `ALL_PAIRS` and the distractor pool.

**3. Tone Production Practice rewrite (`practiceProView.js`)**
- Same two-tab structure (Single / Disyllabic).
- Single uses `playSyllable` for examples; disyllabic uses `playDisyllable`.
- Disyllabic mode splits the recording via `splitDisyllableAudio()` and runs the ensemble on each half — both must match for "passed".
- After Test C fail → Single tab; after Test D fail → Pairs tab.
- 3+3 combos removed from `DISYLLABLE_POOL`.
- Wrong-answer hint shows action description only (no "you said Tone X" / "expected Tone Y").

**4. Test D rework (`testDView.js`)**
- `listenExample` now uses `playDisyllable` (real recording), not TTS.
- `stopRecording` splits the audio with `splitDisyllableAudio` and runs the ensemble on **both** halves. Question passes only when both syllables match.
- Silence-stop window extended 400→700 ms so the inter-syllable gap doesn't end recording early.
- Result block now mirrors Test C: ✓/✗ score, short praise / "almost" msg, per-syllable verdict line, coach line on wrong, **Practice Again / Listen / Next** action buttons.
- Wrong-answer feedback does NOT mention the target tone numbers — just "1st syllable: correct/incorrect, 2nd syllable: correct/incorrect" + action-description coaching.
- 3+3 combos (你好, 可以) removed from `COMBO_POOL`.
- Model-internal views hidden: mel-spectrogram, judges panel, model-status row, confirm-Yes/No, model breakdown line.
- Pitch contour canvas **kept** (and now uses a two-panel layout — left = 1st syllable, right = 2nd syllable, labelled).

**5. Test C minor (`testCView.js`)**
- Pass message no longer includes "Detected: X · Y% confident" — just `pickPraise()`.
- Wrong message no longer includes "Detected X, expected Y · Z% confident" — just "Almost — give it another try." + the `fb.variation` action-description coach line.
- Pitch contour canvas now always visible (was debug-only). Mel-spectrogram, judges, breakdown stay debug-only.

**6. Test D scoring helper (deleted)**
- `src/utils/sandhi.js` was created mid-session for 3+3 acceptance, then deleted: Qi decided to remove all 3+3 combos rather than encode sandhi acceptance.

**7. 3+3 (tone-3 sandhi) cleanup everywhere**
- Test B: `ALL_PAIRS` and distractors exclude `[3,3]`.
- Test D: `COMBO_POOL` drops 你好 / 可以.
- Test Y: `HSK_DISYLLABIC_WORDS` filtered to skip `pattern === '33'`; distractor pool excludes 33.
- Production Practice: `DISYLLABLE_POOL` drops 你好 / 可以.
- Recognition Practice: `ALL_PAIRS` and distractors exclude `[3,3]`.

**8. Test X character pool (`testXYZView.js`)**
- Removed: 一, 不, 了, 地, 得 (variable / neutral particles — should be a separate practice per Qi).
- Added: 小 (per Qi) plus 学 / 看 / 好 / 开 to keep the pool near 50 (49 items now).
- Choice labels and tone-name maps updated to include line glyphs.

**9. Test A → Test B navigation bug fix (`testAView.js`)**
- Was wrongly navigating to `/test-c` after a pass; per the requirements doc, pass should go to Test B. Button label and `navigate` target both corrected.

**10. Persistent navigation bar (added, then removed)**
- Added `src/components/navBar.js` — bottom nav with Home / Report / History.
- Qi rejected it ("stupid"); replaced with a simple top-left `← Home` chip-style button on each test view that didn't already have one (A, B, C, D, X). Style lives as `.back-row` / `.back-home-btn` in `src/styles/global.css`. `navBar.js` deleted.

**11. Tone-arrow glyphs → line shapes**
- Final canonical set:
  - Tone 1: `─`  (high level)
  - Tone 2: `／`  (rising)
  - Tone 3: `∨`  (dip)
  - Tone 4: `＼`  (falling)
  - Neutral: `·`
- Applied consistently across every `TONE_ARROWS` map, every choice label, every report tone-name map, every reveal/coach line.

**12. Auto-redirect-to-home on idle fixed (`main.js`)**
- `supabase.auth.onAuthStateChange` was navigating to `/` on every `SIGNED_IN` event, which Supabase fires on tab refocus and token refresh — so the user was thrown back to home every few minutes mid-test.
- Now only navigates on the actual null→user transition.

**13. Feedback font sizes bumped (Test C / D)**
- `.tc-q-msg`, `.td-q-msg`, `.td-syl-line`: 0.9 rem → 1.05 rem, `text-primary` color, semi-bold, 1.45 line-height.
- `tc-coach-msg` / `td-coach-msg` inline styles: 0.85 rem → 1 rem, primary color, 1.55 line-height.
- `tc-q-score` / `td-q-score`: 2 rem → 2.4 rem.

### New files (this session)
```
src/utils/audioSplit.js        — energy-valley splitter for disyllabic recordings
                                  (used by Test D + disyllabic Production Practice)
```

### Modified files (this session)
```
CONTEXT.md                            — this update
src/main.js                           — SIGNED_IN guard against tab-refocus redirect
src/router.js                         — stopAllAudio on every nav
src/styles/global.css                 — `.back-row` / `.back-home-btn`
src/utils/audio.js                    — stopAllAudio + audio tracking
src/views/testAView.js                — pass → /test-b, tone arrows → lines, back btn
src/views/testBView.js                — exclude [3,3] from pairs + distractors, back btn
src/views/testCView.js                — line glyphs, contour always-on, wrong msg stripped of detected/expected, back btn
src/views/testDView.js                — full rewrite of stopRecording + result block,
                                          two-panel contour, 3+3 removed, simplified
                                          feedback, model UI hidden, back btn
src/views/testXYZView.js              — char pool swap, line glyphs in choices + report, back btn
src/views/testYView.js                — filter pattern==='33' out of HSK pool + distractors
src/views/practiceProView.js          — two tabs, real audio, disyllabic splitting, line glyphs, tone-num-free feedback
src/views/practiceRecView.js          — two tabs, real audio, exclude [3,3], line glyphs
src/views/practiceCharView.js         — line glyphs in tone-name labels
src/views/homeView.js                 — (untouched this session, still has the Step 1/2/3 layout)
```

### Deleted files (this session)
```
src/utils/sandhi.js              — created then deleted (3+3 combos removed instead)
src/components/navBar.js         — bottom nav rejected by Qi
src/components/                  — directory removed after navBar
```

### Behaviour summary (Tests C & D)

**Test C — Single Character Pronunciation**
- Listen example (real m4a via `playSyllable`)
- Record (≤4s, silence-stops at 400 ms)
- Result shows: ✓/✗ icon, praise on pass (no "Detected…" tone), "Almost — give it another try" + tone-coach variation on fail, **single-panel pitch contour** (user vs target), Practice Again / Listen / Next buttons
- Hidden in normal mode: mel-spectrogram, judges panel, model status row, confirm Yes/No, model breakdown
- `/test` debug route exposes everything (development only)

**Test D — Two-Character Pronunciation**
- Listen example (real m4a via `playDisyllable`)
- Record (≤6s, silence-stops at 700 ms — longer for the inter-syllable gap)
- Audio split with `splitDisyllableAudio`, ensemble runs on each half
- Result shows: ✓/✗ icon, praise on pass / "Almost — give it another try" on fail, per-syllable line ("1st syllable: correct ✓ · 2nd syllable: incorrect ✗"), coach line on fail with action descriptions (no tone numbers), **two-panel pitch contour** (1st / 2nd syllable side-by-side), Practice Again / Listen / Next buttons
- Same model UI hidden

### sessionStorage keys (unchanged this session)
| Key | Purpose |
|---|---|
| `j4t_practice_set` | Switch practice into 12-item set mode |
| `j4t_practice_return` | Where to navigate on "I'm ready for the test again" |
| `j4t_test_y_round` | Which Y1–Y10 sub-round to start |

### Open items / not-yet-done (from feedback file 2, rows 1–4)
- **Test Y** — empty row, no specific feedback yet
- **Tabs on home + test pages** — "Test A: Listening (Single Syllable Tone) / B: Listening (Disyllabic Word Tone) / C: Pronunciation (Single Syllable Tone) / D: Pronunciation (Disyllabic Word Tone)" — needs UX work on `homeView` Step 1 / Step 2 cards AND each test view header. Note column says "on both main page and on the test page."
- **Tab for Step 3** — pending, similar UX work
- **Test X char swap** — DONE (item 14)
- **Variable-tone practice (一, 不, 了, 地, 得)** — separate practice for these chars hasn't been built yet

### Deploy
```bash
npm install     # first time only
npm run deploy  # vite build + force-push dist/ to gh-pages branch
```
Build verified clean via `npx vite build`. Bundle size ~1.37 MB (gzipped ~334 kB) — same as before.
