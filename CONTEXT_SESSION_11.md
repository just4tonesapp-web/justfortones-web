# Session 11 — 2026-06-10 → 2026-06-23

Continuation of the Just4Tones build. Focus this session: the **Practice** section
(Types I/II/III), the **per-test + composite reports**, **adaptive (feedback-based)
practice**, and conforming everything to the new 36-slide deck `APP UI UX (1).pptx`.

## Source documents
- **`~/Downloads/APP UI UX (1).pptx`** (36 slides) — the active spec (supersedes the
  old 31-slide deck). Extract with: `unzip -oq deck.pptx`, slide text in
  `ppt/slides/slideN.xml` (`<a:t>` runs), speaker notes in `ppt/notesSlides/notesSlideN.xml`,
  images in `ppt/media/`.
- Key slides:
  - **6–10** — per-test/composite **report template** + worked cases (the feedback wording).
  - **12–14** — disyllabic test notes ("15 items, 1 sample each").
  - **25** — Practice Type I (1-syllable vs 2-syllable, 6 each).
  - **26** — Practice Type II (listen & speak; "the meat of the app").
  - **27–30** — Practice Type III (tone-change rules; slide 29/30 = the quiz mockups).
  - **31–32** — Test X / Practice IV (character tones) — future.

## Deploy & infra (unchanged)
- `npm run deploy` = `vite build && node scripts/deploy.js` → force-push `dist/` to
  `gh-pages`. Source on `main`. **Standing rule: after verified work, deploy without asking.**
- Auth: **username/password in our own Supabase DB** via pgcrypto RPCs
  (`app_signup`/`app_login`, bcrypt via `extensions.crypt`/`gen_salt`). **No email.**
  Session in `localStorage('j4t_user')`; `j4t-auth` event re-renders the account bar.
- Supabase project `vhumyfderrygpsvllysk`.

---

## What shipped this session (by feature)

### 1. History → per-attempt report  (`src/views/attemptReportView.js`, NEW)
- Route `/attempt` (guarded). History rows (`historyView.js`) are clickable buttons
  that stash the attempt in `sessionStorage('j4t_attempt')` and navigate to `/attempt`.
- Renders the same per-test report (score ring + three-tier feedback + distribution)
  for ONE saved attempt — no need to finish all 3 tests.
- Decodes `details.answers` for both storage paths (localStorage = object, Supabase =
  JSON string). A/B use `correct`, C uses `passed`.
- **CTA → adaptive practice**: Test 1 & 2 → `/practice-1` (recognition); Test 3 →
  `/practice-2` (speaking). Seeds `j4t_focus_tone` from that report's `recommendedTone`.

### 2. Adaptive / feedback-based practice
- `diagnosticReportView.js`: on "Start Adaptive Exercises" (complete report), stores
  `sessionStorage('j4t_focus_tone') = focusTone` before `/practice-1`.
- `practiceType1View.js` & `practiceType2View.js` read `j4t_focus_tone` → `TARGET`/`FOCUS`
  (default **3** if unset). Word selection weights toward the focus tone; a
  `🎯 Targeting your Nth tone` badge (`.prac-focus` in `global.css`) shows it.

### 3. Composite + per-test report = deck slides 6–10  (`diagnosticReportView.js`, `utils/toneReport.js`)
- **Per-tone description, grouped by tier** (only non-empty tiers shown):
  - band ≥ 0.85 (strong) → "You are really good at recognizing and speaking the {…} tone(s). Bravo!"
  - 0.45–0.85 (mid) → "You demonstrate a nascent ability with the {…} tone(s)."
  - < 0.45 (weak) → "Some work is still needed on your {…} tone(s)."
- **Recommendation = exactly ONE tone**: the worst non-empty tier, tie-broken by the
  natural distribution order **4 > 1 > 2 > 3** (`NATURAL_ORDER = [4,1,2,3]`,
  `focusTone = NATURAL_ORDER.find(t => focusPool.includes(t))`). If all four are strong → no rec.
- **Guidance** for the recommended tone = verbatim from slide-6 speaker notes
  (the `TONE_GUIDANCE`/`TONE_FEATURE` maps — kept identical in both files):
  - 1st: steady high pitch, top of range, "opera singer".
  - 2nd: start mid, rise quickly to top, like asking "What?".
  - 3rd: lower chin, dip low then rise to middle, don't prolong (else sounds 2nd).
  - 4th: start at top (like 1st), fall sharply, like saying "No!".
- Verified against case 4 (slide 10): strong=2nd, nascent=4th, work=1st+3rd → rec **1st**.

### 4. Practice Type I = slide 25  (`practiceType1View.js`, REWRITTEN)
- **Two separate button-chosen practices, 6 each** (was a combined 1-of-12):
  - "1-syllable words" — minimal pairs, "which is the Nth tone?" (target vs other 3, ×2).
  - "2-syllable words" — hear the word, pick the tone pattern (prefers words containing focus tone).
- Opens on a **chooser** (two `.p1-mode` buttons). Each runs 6 Qs → "Exercise 1 of 6".
  Completion offers the other set, then `/practice-2`. Adaptive + focus badge.
- `pickSyllable` requires `hasRecording(s,t) && hasCharacter(s,t)` → never emits
  non-existent "_X" syllables.

### 5. Practice Type II = slide 26  (`practiceType2View.js`)
- Listen-to-demo → record → replay own vs demo. **User controls record start/stop**
  via 🎤 / ⏺ buttons (`startRec`/`stopRec`); 20s `setTimeout` is only a safety cap.
- Single-syllable feedback uses on-device `detectToneWithPitch` (free). Disyllables
  lean on self-comparison. Adaptive: 2 focus-tone singles + 2 contrasts + 2 focus disyllables.

### 6. Practice Type III = slides 27–30  (`practiceType3View.js`, REWRITTEN twice)
- **Final structure (per WeChat feedback 2026-06-22): TWO PAGES.**
  - **Page 1 (rules):** all three rules on one page as **Rule 1 / Rule 2 / Rule 3**, then
    the prompt **"Are you ready to test your tone change knowledge?"** + "Start the test →".
    (The "了解" the team red-circled was actually the first question's *word* 了解/liǎojiě
    showing on the old combined page — now there are no questions on the rules page.)
  - **Page 2 (test):** **12 items** = each rule ×4. For **一** and **不**, exactly
    **2 become 2nd tone + 2 become 4th tone** (`pickBalanced` splits by `parse(f).t1`).
- Audio plays **ONLY** via the "Hear it" button, AFTER answering (slide 29/30 fix:
  no pre-answer sound). Driven by 60 real recordings in `public/audio/tone-change/{33,yi,bu}/`.
- Manifest `utils/toneChangeWords.js`: 33→20 (all t1=3), yi→7×(→2nd)/13×(→4th),
  bu→8×(→2nd)/12×(→4th). `makeQ` parses tones from filenames like `yi2ge4`.
- NOTE: an earlier interim version split into "Test A / Test B" (7+5, then 7+7) — that
  was **superseded**; do not reintroduce the A/B framing.

---

## Open questions / decisions raised by the team (WeChat "语言学习app开发小组")
1. **Composite uses most-recent, not historical-best.** `diagnosticReportView.latest()`
   = newest attempt per test. CUAL asked which to use → currently most-recent (intentional:
   avoids resurrecting old-format scores). ~5-line change to switch to best-per-test if wanted.
2. **Data collection (Azure's question), as-built:**
   - Account: username + bcrypt-hashed password in Supabase `app_users`. **No email.**
   - Results: scores + per-question detail (target tone, correct/wrong, detected tone,
     confidence) → Supabase (logged-in) + localStorage.
   - **Voice: speaking test (Test 3) sends audio to cloud STT APIs** (Groq, Deepgram,
     Google, Azure) for the ensemble in `utils/toneDetector.js`, in addition to the
     on-device pitch + ONNX models. **Raw audio is NOT stored** — only derived results.
   - Offered: a flag to make Test 3 pitch-only (fully on-device, no upload) — not yet built.

## Known caveats
- `coi-serviceworker` caches aggressively → testers must hard-refresh (Cmd+Shift+R) to
  see new deploys. This recurs constantly; suspect cache before assuming a change didn't ship.
- `models/tone_classifier.onnx` is 90 MB → GitHub LFS warning on every gh-pages push (harmless).

## Key files touched this session
```
src/views/diagnosticReportView.js   report → slides 6–10 (descriptions + 1 rec + guidance)
src/views/attemptReportView.js       NEW per-attempt report + adaptive CTA
src/views/historyView.js             rows → clickable → /attempt
src/views/practiceType1View.js       REWRITTEN: 1-syl vs 2-syl chooser, 6 each
src/views/practiceType2View.js       record start/stop buttons, adaptive focus
src/views/practiceType3View.js       REWRITTEN: rules page + 12-item test, balanced 一/不
src/utils/toneReport.js              TONE_FEATURE = deck guidance; 3-tier + 4>1>2>3 rec
src/utils/toneChangeWords.js         60-recording manifest
src/utils/audio.js                   playClip(relPath, onEnd)
src/styles/global.css                .prac-focus badge
src/main.js                          route('/attempt', …)
public/audio/tone-change/{33,yi,bu}/ 60 .m4a recordings
```

## Last deployed commit
`d902690` — Type III start-button full-width fix. Working tree clean before this doc.
