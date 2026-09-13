# Session 12 — 2026-07-26 → 2026-09-05

The "infrastructure & hardening" era: team feedback rounds, a forced full
account migration, the speaking-pipeline overhaul, two new practice types,
market research, and productionization (Vercel + own domain + CI).
Fall pilot: **15 heritage students, 09/08/2026 – 12/15/2026, focus 认字**;
spring cohort planned 01/15 – 05/15/2027 (~20 beginners).

## Live system (as of 2026-09-05)

- **Site**: https://www.just4tones.org (primary; apex 308→www).
  Vercel project `justfortones-web` (scope `just4tones`, account via GitHub
  `just4tonesapp-web`). **Deploy = `git push origin main`** (auto-build).
  index.html served max-age=0 → no hard-refresh problem anymore.
  Legacy: `npm run deploy` still pushes gh-pages (github.io URL dies when the
  repo goes private — planned, do AFTER everyone is on the new domain).
- **GitHub**: `just4tonesapp-web/justfortones-web` (public until flip).
  Old `just4tones` org + `dearyg` account lost to 2FA lockout (recovery was
  filed; new accounts are canonical). git history scrubbed of .env.local.
  gh CLI holds both accounts — if pushes 403, `gh auth switch -u just4tonesapp-web`.
- **Supabase**: project `gwpjbqvguepqzarsisrr` (email-independent login for
  dashboard? NO — created fresh; check with Homer which login). Whole schema
  from ONE file: `scripts/sql/bootstrap.sql` (app_users + bcrypt RPCs,
  app_results + save/get RPCs, accuracy_log + anon insert, app_analytics).
  New-style keys: publishable in client, `SUPABASE_SECRET_KEY` in .env.local
  (non-VITE) for local admin scripts. Keepalive workflow pings every 3 days
  and FAILS LOUDLY; free tier may still pause → **Supabase Pro before serious
  classroom dependence** (still pending).
- **Domain**: bought at Squarespace, DNS pointed to Vercel
  (A @ 216.198.79.1, CNAME www → 70df074089400729.vercel-dns-017.com).
- **Env keys** (all rotated 2026-09-02 after the old repo leak):
  Vercel env = VITE_SUPABASE_URL/ANON_KEY + VITE_DEEPGRAM_API_KEY +
  VITE_GOOGLE_SPEECH_API_KEY only. Azure key lives ONLY in the Supabase Edge
  Function secret. Groq key exists (commented in .env.local) but is unusable
  client-side (GitHub blocks + Groq auto-revokes public keys) — revive via a
  proxy function like azure-stt. Google key should carry HTTP-referrer
  restrictions incl. just4tones.org + *.vercel.app (verify in Cloud Console).

## Routes / features

| Route | What |
|---|---|
| `/` | home: hero CTA + 5 practice tiles |
| `/test-1..3` | the diagnostic tests (B prefers `disyllables-adv/` recordings when present) |
| `/report`, `/history`, `/attempt` | reports |
| `/practice-1..3` | recognition / speaking / tone-change |
| `/practice-4` | polyphones 多音字 (data: `utils/polyphoneWords.js`, DRAFT pending QSY) |
| `/practice-5` | 认字 character tones (fall-cohort headliner; CHAR_TONE_MAP + manifest∩HSK words) |
| `/test` | Test 3 DEBUG: model badge + per-question judges panel + Yes/No labeling |
| `/practice-2-debug` | disyllable judging internals (Azure/Google/Deepgram heard-text + pitch) |
| `/status` | unlisted team dashboard: live service probes, DB aggregates, build stamp |
| `/privacy` | data-practices page (linked from login) |

Rules: daily limit = 2 completed attempts per test/day (client-side);
Test 3 per-question retry = 1; guest mode demoted (results-not-saved pill).

## Speaking pipeline (今夏大修的最终形态)

Test 3 ensemble (toneDetector, 9s/job bound): google 2.5 · pitch 2.5 ·
azure 2.0 (via `supabase/functions/azure-stt` proxy) · deepgram 1.0 ·
whisper 0.3 · classifier 0.1 (wasm-flaky) · groq/openrouter dormant.
Every detection logs an accuracy_log row (user-bound; debug adds human labels).

pitchModel: peak-normalize (99.5pct, floor .01) → trimToUtterance (dominant
voiced stretch, bridges <250ms) → relative RMS gate (0.2×peak, clamp-value
rejection) → contour scoring with T3 low-register path + T2 late-rise
penalty. `detectTonePairWithPitch` = shared-scale halves + flat-word guard.
Practice II judge = Azure recognition first (expected-word/homograph compare
via `findHskWord`/`findHskHomographs`), pitch fallback, 80%-margin leniency,
half-third rule. Recording UX everywhere: tap start → auto-stop after 900ms
silence (adaptive thresholds vs take's own peak) → tap-stop always works.

Bugs killed this session (all were live for months): FOCUS/TARGET
ReferenceError froze Practice I "See results"; 5s job timeout voided every
cloud vote; 31/60 Test-3 chars missing from CHAR_TONE_MAP (half the pool
invisible to ASR); model badge spread-order bug (lied since day one);
debug-page insertBefore crash; playOwn suspended AudioContext (→ playPcm
WAV path); kai1fei1/咖啡 + 8 more mislabeled recordings.

## Audio content state

- 492 disyllable recordings, ALL audio-verified against labels
  (`scripts/audit-recordings.mjs`, Deepgram + Azure double-check; fixed 6
  swapped/shifted groups; 希望 lost/removed, 外面 lost; 路口→入口, 一边→一篇).
  **Rerun the audit after every new recording batch.**
- `public/audio/disyllables-adv/` awaits Qi's HSK 7-9 recordings (Jul 8
  decision: Test 2 needs words students DON'T know). README inside.
- Multi-voice: drop `ma1.b.m4a`-style variants in syllables/, run
  `scripts/buildSyllableVariants.mjs` (录音多样化, survey ask).

## Testing / observability

- `scripts/e2e-smoke.mjs` — 27 checks vs production (HTTP+RPC layer, auth
  UI incl. signup error path, full Test 1/2 runs, Test 3 fake-mic record→
  analyze, daily limit, Practices I/III/IV/V, status probes, error sweep).
  CI: `.github/workflows/e2e.yml` on every main push + daily cron.
- `scripts/usage-report.mjs` — per-user usage table (secret key, local).
- `/status` — live probes in-browser.
- accuracy_log grows with every real Test 3 answer = future training data.

## Business context (research 2026-09-02, PDF on Desktop)

Verdict: small-SaaS ($50–200k/yr steady-state). US uni Chinese market
46,492 enrollments / ~700 programs, shrinking 14%/cycle (MLA 2021).
Columbia P-Card: <$2,500 = no procurement → price dept license ~$1,999/yr;
Extempore template $12.99/student/class student-paid. No major app verified
to do tone-level assessment; nobody sells into these programs. Partner
anchor: comparable tools ≈ $100-200k/yr; "Harvard pays ~$3k/yr" (meeting).
GTM: Qi's class (free pilot, running) → CLTA/peer spread → dept licenses.
**Teacher dashboard is the sale prerequisite and remains the next big build.**

## Open items

1. **Teacher dashboard** (class code, roster, per-student progress, weak-tone
   distribution) — Qi's own tracking complaint + research prerequisite. NEXT.
2. Qi content: HSK 7-9 recordings; polyphone content review; 生僻字录音;
   multi-voice takes (少奇).
3. Repo → private (kills github.io; only after everyone's on just4tones.org).
4. Supabase Pro + Vercel Pro (~$45/mo) when charging begins.
5. Groq revival via proxy (optional); OpenRouter dormant (meeting: 用不上).
6. "Hiding speaking" decision explicitly deferred by Homer (先不管).
7. Old GitHub recovery outcome — if dearyg returns, archive old org properly.
8. Payment for practice tier (Jun 3 decision) — post-pilot.

## Key memory files (~/.claude/.../memory/)
deploy-prod-directly · supabase-pending-sql (infra map) · api-keys-are-public
· practice-types-design · report-format-slides-6-10 · data-collection ·
design-source-pptx · fall pilot note. Meeting notes source:
~/Downloads/会议记录.docx (reviewed 2026-09-05, gaps closed same day).
