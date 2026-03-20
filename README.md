# Just4Tones

A web app that diagnoses and trains Mandarin Chinese tone skills. Built for learners who struggle with the four tones — the app tests your listening, pronunciation, and character knowledge step by step.

**Live:** https://just4tones.github.io/justfortones-web/

---

## Features

- **Test A** — Single syllable tone listening (12 questions)
- **Test B** — Two-syllable tone pair listening (12 questions)
- **Test C** — Pronunciation recording with AI ensemble tone detection
- Email auth + guest mode via Supabase

---

## Local Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Python](https://python.org/) 3.10 (optional — only needed to re-export ToneNet)
- A [Supabase](https://supabase.com) account (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/just4tones/justfortones-web.git
cd justfortones-web
npm install
```

### 2. Configure Supabase

#### Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **Project Settings → API**
3. Copy your **Project URL** and **anon public key**

#### Set environment variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> `.env.local` is gitignored — never commit your keys.

#### Configure auth redirect URL

1. In Supabase go to **Authentication → URL Configuration**
2. Set **Site URL** to `http://localhost:5173/justfortones-web/` for local dev
3. Add your production URL to **Redirect URLs** when you deploy (e.g. `https://your-username.github.io/justfortones-web/`)

> **Note:** Supabase free tier pauses projects after ~1 week of inactivity. Resume at supabase.com if auth stops working.

### 3. Add the ToneNet model

The ToneNet ONNX model file (~20MB) is not included in git due to size. Place it at:

```
public/models/tonenet.onnx
```

**Option A — Export it yourself:**
See [Exporting ToneNet](#exporting-tonenet) below.

**Option B — Skip it:**
The app still works without it. Pitch detection and Whisper will run — just without ToneNet's higher accuracy. The model loads silently and fails gracefully if missing.

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:5173/justfortones-web/

---

## Exporting ToneNet (optional)

ToneNet is a Keras CNN model from [Gao et al., Interspeech 2019](https://github.com/saber5433/ToneNet). The export script converts it to ONNX for browser use.

> **Requires Python 3.10** — TensorFlow does not support Python 3.11+. Use [Google Colab](https://colab.research.google.com) if needed (free, no install).

```bash
pip install tensorflow tf2onnx onnxruntime numpy requests
python scripts/export_tonenet.py
```

This will:
1. Download `ToneNet.h5` from GitHub automatically
2. Convert it to ONNX (opset 13)
3. Save to `public/models/tonenet.onnx`
4. Run a sanity check

**Using Google Colab** (recommended if on Python 3.11+):
1. Open a new Colab notebook at [colab.research.google.com](https://colab.research.google.com)
2. Switch runtime to Python 3.10: **Runtime → Change runtime type**
3. Paste and run the contents of `scripts/export_tonenet.py`
4. Download the output `tonenet.onnx` and place it in `public/models/`

---

## AI Tone Detection Ensemble

Test C uses multiple models in parallel. Results are combined via weighted vote:

| Model | Weight | Notes |
|-------|--------|-------|
| ToneNet (ONNX CNN) | 0.99 | Interspeech 2019, ~99% on isolated syllables |
| SenseVoice | 0.92 | Stub — not yet integrated |
| Whisper tiny | 0.75 | Downloads ~40MB on first use, cached in browser |
| Pitch (ACF2PLUS + YIN) | 0.55 | Always active, no downloads needed |

Models that fail to load are silently skipped — the app always falls back to pitch detection.

---

## Deploying to GitHub Pages

### First-time setup

1. In `vite.config.js`, make sure `base` matches your repo name:
   ```js
   base: '/your-repo-name/'
   ```

2. In Supabase → **Authentication → URL Configuration**, add your GitHub Pages URL to **Redirect URLs**:
   ```
   https://your-username.github.io/justfortones-web/
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

This builds the app and pushes the `dist` folder to the `gh-pages` branch.

### Subsequent deploys

```bash
npm run deploy
```

> The Supabase keys from `.env.local` are baked into the build at deploy time from your local machine. If you want GitHub Actions CI/CD, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets and update the workflow accordingly.

---

## Project Structure

```
src/
  main.js                    — app entry, routes, auth init
  router.js                  — hash-based SPA router
  supabaseClient.js          — Supabase client (falls back to guest stub if unconfigured)
  utils/
    audioEngine.js           — mic recording, raw PCM + pitch capture
    toneDetector.js          — ensemble coordinator singleton
    audio.js                 — Chinese TTS (Web Speech API)
    pinyin.js                — tone marks, syllable pool, shuffle
    models/
      pitchModel.js          — ACF2PLUS + YIN pitch detection
      whisperModel.js        — Whisper ASR via @xenova/transformers
      tonetModel.js          — ToneNet ONNX inference + mel-spectrogram pipeline
      sensevoiceModel.js     — SenseVoice stub (future)
  views/
    authView.js              — login / sign up
    homeView.js              — diagnostic landing page
    testAView.js             — single syllable listening test
    testBView.js             — two-syllable listening test
    testCView.js             — pronunciation recording test
    testDView.js             — placeholder (in development)
  styles/
    global.css               — design system, tokens, layout
scripts/
  export_tonenet.py          — Keras → ONNX conversion script
public/
  models/
    tonenet.onnx             — ToneNet model file (not in git — add manually)
```

---

## Tech Stack

- **Vanilla JS** — no framework
- **Vite** — build tool and dev server
- **Supabase** — email auth
- **onnxruntime-web** — runs ToneNet ONNX in the browser via WASM
- **@xenova/transformers** — runs Whisper in the browser
- **pitchfinder** — ACF2PLUS and YIN pitch detection
- **Web Speech API** — Chinese TTS for audio examples
- **GitHub Pages** — hosting
