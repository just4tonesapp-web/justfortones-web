# Session 10 — 2026-05-24 → 2026-06-02

> Paste this into `CONTEXT.md` once the xattr issue clears
> (`xattr -dr com.apple.provenance src/` to unblock all modified files).

## Source documents this session
- `APP UI UX.pptx` (25 slides) — Qi's full mock for the new "Tone Diagnosis" flow.
  Slides 2–21 are the active spec; slides 24–25 are explicit future work.

## What changed at a glance
- **Adopted the pptx as the spec.** Each slide is its own page.
- **New 4-step diagnostic flow** at `/` → `/diagnose` → `/test-a` → `/test-b` → `/test-c` → `/test-d` → `/report`.
- **Question counts updated** per slides 4/15/17/19: A=8, B=15, C=12, D=12.
- **Brand-new per-test report templates** (slides 6 & 12) + accordion score screens (slides 5/16/18/20) + composite report (slide 21).
- **Legacy snapshot preserved** at `/old/*` so Qi can A/B compare.

---

## Slide-to-route map (the canonical mapping)

| Slide | Content | Route | View |
|---|---|---|---|
| 2 | Hero "Just4Tones" + "Test My Tone Skills Now" | `/` | `homeView.js` |
| 3 | Tone Diagnosis · 4 step cards · Begin | `/diagnose` | `diagnoseView.js` |
| 4 | Test 1 intro "hear 8 different…" | `/test-a` (intro state) | `testAView.js` |
| 5 | Test 1 score + accordion REPORT + Try Next Challenge | `/test-a` (score state) | `testAView.js` |
| 6 | Single-syl report TEMPLATE (used by Tests 1, 3) | — | `utils/toneReport.js` |
| 7–11 | Worked single-syl report cases | — | (template covers them) |
| 12 | Disyl report TEMPLATE (used by Tests 2, 4) | — | `utils/toneReport.js` |
| 13–14 | Worked disyl report cases | — | (template covers them) |
| 15 | Test 2 intro "hear 15 different…" | `/test-b` (intro) | `testBView.js` |
| 16 | Test 2 score + accordion + Jump to Speaking | `/test-b` (score) | `testBView.js` |
| 17 | Test 3 intro | `/test-c` (intro) | `testCView.js` |
| 18 | Test 3 score + Final Challenge | `/test-c` (score) | `testCView.js` |
| 19 | Test 4 intro | `/test-d` (intro) | `testDView.js` |
| 20 | Test 4 score + "Get your full report" | `/test-d` (score) | `testDView.js` |
| 21 | Composite Report | `/report` | `diagnosticReportView.js` |
| 24–25 | Future steps (adaptive, sandhi, 认字, pitch feedback) | — | NOT BUILT |

---

## 1. New shared utility — `src/utils/toneReport.js`

The single source of truth for slides 6 + 12 report logic. Every test view and the composite report import from it.

**Exports:**
- `analyzeSingleSyllable(answers)` — slide 6 algorithm
  - Input: `[{ tone: 1..4, correct: bool }, …]`
  - Per tone: `ratio = correct/total`, mapped to band `{ 0, 0.5, 1 }` (0 if 0/N, 1 if N/N, else 0.5).
  - Returns `{ perTone, bravoTones, nascentTones, workTones, recommendedTone, isPerfect }`.
- `analyzeDisyllabic(answers)` — slide 12 algorithm
  - Input: `[{ tones: [t1, t2], correct: bool }, …]`
  - Per tone t: `pct = correct / total combos containing t` × 100.
  - Bands: 67–100 = 1 (Bravo), 34–66 = 0.5 (nascent), 0–33 = 0 (work needed).
- `buildReportHTML({ analysis, score, total, testLabel, shape })`
  - `shape: 'single' | 'disyl'` switches subject phrasing.
  - Renders score ring + per-tone bars + banded feedback + recommendation block.
- `bindAccordion(rootEl)` — wires `.tr-accordion-head` click → toggles `.open` class.
- `TONE_REPORT_CSS` — shared CSS string (accordion shell, bar rows, score ring).

**Recommendation tiebreak:** When the worst band ties between multiple tones, pick by natural Mandarin distribution order **`[4, 1, 2, 3]`** (per the pptx note: "通过4，1，2，3 的自然分布顺序").

**Tone feature copy** (used in recommendation block):
```js
TONE_FEATURE = {
  1: 'The 1st tone is high and flat — your voice stays level…',
  2: 'The 2nd tone rises from mid to high — like asking a question…',
  3: 'The 3rd tone dips low then rises — the trickiest one…',
  4: 'The 4th tone falls sharply — sounds firm, almost commanding…',
}
```

---

## 2. Home (`/`) — slide 2 only

`homeView.js` — was overloaded with progress cards & "Beyond the diagnostic" section. Now stripped to just:
- "Just4Tones LOGO" placeholder chip
- `<h1>Just4Tones</h1>`
- Tagline: "The ultimate tool to **MASTER 4 tones** of Mandarin Chinese."
- Sub: "Built for every one. Notice improvements in 30 minutes."
- Big `Test My Tone Skills Now` button → `navigate('/diagnose')`
- Footer chips: 📊 Report · 📋 History · 🚪 Log out · ⏳ Legacy

No `getDiagnosticState()` call here anymore.

---

## 3. Diagnose (`/diagnose`) — slide 3, NEW view

`diagnoseView.js` — new file. Renders:
- "Just4Tones LOGO"
- `<h1>Tone Diagnosis</h1>`
- Sub: "Find out exactly where your tone skills stand in four quick steps!"
- 2×2 grid of 4 step cards (1️⃣ Listening 1-syl, 2️⃣ Listening 2-syl, 3️⃣ Speaking 1-syl, 4️⃣ Speaking 2-syl). Each card is clickable → jumps straight to that test. Passed steps get a ✓ chip.
- Big `Begin` button → first unpassed test (`/test-a` if none passed, else next one).

Back button to `/`.

---

## 4. Test A (`/test-a`) — 8 questions, slides 4 + 5

`testAView.js` rewrite:
- `TOTAL = 8`, `PER_TONE = 2`, `PASS_SCORE = 5` (~58%, kept old threshold).
- `generate()`: shuffles `[1,1,2,2,3,3,4,4]`, picks distinct syllables with available recordings + real characters.
- **Intro (slide 4):** badge "1️⃣ Listening — 1-Syllable Words", one-sentence copy
  ("In this test, you are going to hear 8 different single-syllable Chinese words. Pick the correct tones."), `START NOW` button. Dropped the "How it works" rules box.
- **Score (slide 5):**
  - "You scored" / big `5/8` / `click to open your REPORT` accordion containing the slide-6 template.
  - "Try Next Challenge!" → big card "Two Syllables words" → `/test-b`.
  - "Do you want to take that test again? Fluctuation in performance in listening foreign sounds is totally expected." + `Test Again` button.
- `saveResult('A', score, TOTAL, { answers, totalTime })`.

`answers[i] = { syllable, tone, selected, correct, time }` — `correct` field is what `analyzeSingleSyllable` expects.

---

## 5. Test B (`/test-b`) — 15 questions, slides 15 + 16

`testBView.js` rewrite:
- `TOTAL = 15`, `PASS_SCORE = 9` (~58%).
- `ALL_PAIRS` = all 16 (t1,t2) combos minus `[3,3]` = 15. `generate()` uses every combo exactly once, shuffled.
- Recordings first (`DISYLLABLE_BY_PAIR`), TTS fallback.
- **Intro (slide 15):** "2️⃣ Listening — 2-Syllable Words" + "In this test, you are going to hear 15 different two-syllable Chinese words. Pick the correct tones." + `START NOW`.
- **Score (slide 16):** same accordion pattern as A, with `shape: 'disyl'` report inside. CTA: "Jump to Speaking Challenges" → `/test-c`. Retake prompt with "listening foreign sounds is totally expected."
- `answers[i] = { syl1, syl2, tone1, tone2, tones: [t1, t2], selT1, selT2, correct, correctPinyin, selectedPinyin, time }`.
  - `tones: [t1, t2]` is the field `analyzeDisyllabic` expects.

---

## 6. Test C (`/test-c`) — 12 questions, slides 17 + 18

`testCView.js` — kept 12-question core, swapped intro + report:
- **Intro (slide 17):** "3️⃣ Speaking — 1-Syllable Words" + "You are going to listen to 12 single Chinese sounds. Pick the one with the correct tones." + mic-permission notice + `START NOW`.
- **Score (slide 18):** accordion REPORT (slide-6 template) + "Final Challenge: Speak two syllable words" → `/test-d`. Retake prompt with "speaking foreign sounds is totally expected."
- Per-q `answers` has `{ char, base, tone, passed, detectedTone, confidence, agreement, modelResults, … }`. In `showReport()`, adapted via `answers.map(a => ({ tone: a.tone, correct: !!a.passed }))` before calling `analyzeSingleSyllable`.

Imports added at top of file:
```js
import {
  analyzeSingleSyllable, buildReportHTML, TONE_REPORT_CSS, bindAccordion,
} from '../utils/toneReport.js'
```

CSS injection: `style.textContent = scopedCSS + TONE_REPORT_CSS + tcExtraCSS` (the `tcExtraCSS` constant lives at end of file with `.score-card`, `.next-challenge-c`, `.retake-row-c` rules).

---

## 7. Test D (`/test-d`) — 12 questions, slides 19 + 20

`testDView.js` — same pattern as C but for the disyl template:
- **Intro (slide 19):** "4️⃣ Speaking — 2-Syllable Words" + "You are going to listen to 12 two-syllable Chinese words. Pick the one with the correct tones." + mic notice + `START NOW`.
- **Score (slide 20):** accordion REPORT + "REPORT — Get your full report" CTA (slide 20's title) → `navigate('/report')`. Retake prompt with "speaking foreign sounds is totally expected."
- `answers[i].tones` is already `[t1, t2]`; adapter `answers.map(a => ({ tones: a.tones, correct: !!a.passed }))` → `analyzeDisyllabic`.

CSS injection same pattern: `scopedCSS + TONE_REPORT_CSS + tdExtraCSS`.

---

## 8. Composite Report (`/report`) — slide 21

`diagnosticReportView.js` full rewrite. Structure mirrors slide 21 verbatim:

1. **Title** `Composite Report`
2. **Bilingual opening** — uses the exact pptx wording:
   > 谢谢你走到这里，你的学习热情让我吃惊，一定可以的。（只有 30% 的人可以完成这个测试，学语言是终生的，四声 notoriously difficult，但是我们一定可以做到。）
3. **Personalised tone-ranking prose** — generated from cross-test aggregate band:
   - Aggregate: per tone, average of band across the 4 test analyses.
   - Buckets: strong (≥0.85), mid (0.45–0.85), weak (<0.45).
   - Output in slide-21 cadence: "在四声中，你对于X声真的很敏锐… 然后 X、X声，次之… 你的X声，确实需要加强."
   - English mirror paragraph.
4. **Recommendation** — worst bucket → natural-order `[4,1,2,3]` tiebreak → `focusTone`:
   > 我们建议你选择一个突破口 — 尤其是在说含有X声双音节词的时候。请你从听开始，专注在X声的学习上。这可能是反直觉，但是如果你想说得更好，你得先听得更好。
   + "You are getting there."
5. **Four "Open Report of X" accordions** (slide 21 lists them as separate buttons):
   - Open Report of 1 syllable word listening
   - Open Report of 2 syllable word listening
   - Open Report of 1 syllable word speaking
   - Open Report of 2 syllable word speaking
   Each contains the full slide-6/12 report template rendered via `buildReportHTML`.
6. **Closing CTA:**
   > Ready for some exercises? These adaptive exercises will help you improve on perception and pronunciation of tones!
   → currently routes to `/practice-recognition` (adaptive surface not built yet).

**Data wiring:** reads best attempt per test via `getResults()` → `best('A')` etc., then `JSON.parse(details)` on the `details` field (Supabase stores it as a string; localStorage as object — handled defensively).

If not all 4 tests are completed, shows an "X of 4 completed" message and the `Continue Diagnostic` CTA in place of the prose.

---

## 9. Legacy snapshot at `/old/*`

Verbatim copy of pre-session-10 views, kept so Qi can compare side-by-side:

| Route | View |
|---|---|
| `/old` | `homeViewOld.js` — has amber banner + "→ Try the new flow" button |
| `/old/test-a` | `testAOldView.js` (12q version) |
| `/old/test-b` | `testBOldView.js` (12q version) |
| `/old/test-c` | `testCOldView.js` |
| `/old/test-d` | `testDOldView.js` |
| `/old/test-x`, `/old/test-xyz` | `testXYZView` (shared — only one X view exists) |
| `/old/test-y` | `testYView` (shared) |
| `/old/report` | `diagnosticReportOldView.js` |

Routes registered in `main.js`. Internal `navigate('/test-…')` calls in the Old views were rewritten to `navigate('/old/test-…')` via sed during the duplication.

---

## 10. Pass-threshold formula

Unchanged in `services/progressService.js`:
```js
passed: score >= (total === 12 ? 7 : Math.ceil(total * 0.58))
```
- 12q → 7 (legacy)
- 8q → 5 (`ceil(8 * 0.58) = 5`)
- 15q → 9 (`ceil(15 * 0.58) = 9`)

No code change needed — the formula naturally produces the new thresholds.

---

## New / modified files

### New files this session
```
src/views/diagnoseView.js          — slide 3 (Tone Diagnosis preview)
src/views/homeViewOld.js           — /old snapshot of slide-2 area
src/views/testAOldView.js          — /old snapshot
src/views/testBOldView.js          — /old snapshot
src/views/testCOldView.js          — /old snapshot
src/views/testDOldView.js          — /old snapshot
src/views/diagnosticReportOldView.js — /old snapshot
src/utils/toneReport.js            — shared per-test report template
CONTEXT_SESSION_10.md              — this file (to be merged into CONTEXT.md)
```

### Modified files this session
```
src/main.js                      — added /diagnose route, /old/* routes,
                                    imports for new Old views and diagnoseView
src/views/homeView.js            — full rewrite: slide 2 only (hero + CTA + utility chips)
src/views/testAView.js           — full rewrite: 8q, new intro, accordion score, slide-5 wording
src/views/testBView.js           — full rewrite: 15q, new intro, accordion score, slide-16 wording
src/views/testCView.js           — intro + showReport() replaced (kept 12q core,
                                    kept ensemble recording flow, swapped UI per slides 17/18)
src/views/testDView.js           — intro + showReport() replaced (same surgical pattern as C)
src/views/diagnosticReportView.js — full rewrite per slide 21
```

### Not touched this session
- All practice views, history view, Test X/Y/Z, audio utilities, tone detector models.
- HSK / disyllable manifests.

---

## Known issues / deferred work

### Deferred per slide 24 ("Next steps" — pptx flags as future)
1. **Adaptive practices** — the `Ready for some exercises?` CTA on `/report` currently falls through to `/practice-recognition`. No real adaptive logic yet.
2. **变调 (sandhi) practice** — not built.
3. **认字 practice** — Test X / Y are character quizzes; a dedicated *learn* surface for chars hasn't been built.
4. **Granular pitch feedback** ("你的三声第一段太高了") — Test C/D contour shows shape but doesn't diagnose contour segments.
5. **Slide 25 — tone change** — placeholder title only.

### Other open items
- **macOS xattr lock:** Files I write in a Claude Code session pick up `com.apple.provenance` xattr, which then blocks further reads/writes from the sandbox. Workaround: `xattr -dr com.apple.provenance src/` clears it. This blocked me from updating `CONTEXT.md` directly at end of session — hence this addendum file.
- **`practiceCharView` set-mode** — not yet wired (still infinite mode only).
- **Test Y "Continue to Y(N+1)"** — still uses `location.reload()`.
- **Bundle ~1.49 MB** — same as before; no chunking work this session.

---

## Deploy

```bash
npm install     # first time only
npm run deploy  # vite build + force-push dist/ to gh-pages branch
```

Build is clean as of this session (verified `npx vite build` after every major change).

### Quick sanity test path
1. `/` → click `Test My Tone Skills Now` → arrives at `/diagnose`
2. `/diagnose` → click `Begin` (or any of the 4 step cards) → arrives at `/test-a`
3. `/test-a` → intro shows ONE sentence + `START NOW` (no rules box)
4. After 8 questions → score screen with accordion `click to open your REPORT`
5. Try Next Challenge → `Two Syllables words` → `/test-b`
6. After 15 questions → score → Jump to Speaking Challenges → `/test-c`
7. Test 3 / Test 4 same pattern.
8. After Test D → "REPORT — Get your full report" → `/report`
9. `/report` shows slide-21 layout with bilingual prose + 4 "Open Report of X" accordions + adaptive-exercises CTA
10. From any page, the footer `⏳ Legacy` chip on `/` (or direct URL `/old`) opens the legacy flow.
