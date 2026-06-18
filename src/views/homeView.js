// ═══════════════════════════════════════════════════════════════════
// Home — pptx slide 2 ONLY.
//   Title, tagline, "Test My Tone Skills Now" button.
//   Slide 3 (Tone Diagnosis preview) lives on its own page at /diagnose.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'

export function homeView(container) {
  // Landing = a fresh start. Clear any lingering guest flag so pressing the CTA
  // re-gates to the login page unless the visitor has a real account. (Guest is
  // re-established only via "Continue as Guest" on the login page.)
  sessionStorage.removeItem('j4t_guest')

  container.innerHTML = `
    <div class="app-shell home2 shell-top-center">

      <!-- Slide 2 — Hero -->
      <div class="s2-logo">Just4Tones</div>
      <h1 class="s2-title">Just4Tones</h1>
      <p class="s2-tagline">
        The ultimate tool to <strong>MASTER 4 tones</strong> of Mandarin Chinese.
      </p>
      <p class="s2-tagline-sub">
        Built for every one. Notice improvements in 30 minutes.
      </p>
      <button class="btn btn-primary btn-lg s2-cta" id="start-diag">
        Test My Tone Skills Now
      </button>
    </div>
  `

  document.getElementById('start-diag').addEventListener('click', () => navigate('/diagnose'))

  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)
}

const scopedCSS = `
  /* .app-shell already centres vertically; home just needs centred text + a
     full-width CTA. */
  .home2 {
    text-align: center;
    align-items: stretch;
  }

  .s2-logo {
    align-self: flex-start;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--text-muted);
    margin-bottom: 28px;
    padding: 6px 14px;
    border: 1px dashed var(--card-border);
    border-radius: 20px;
  }
  .s2-title {
    font-size: 3rem;
    font-weight: 700;
    line-height: 1.05;
    margin-bottom: 20px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .s2-tagline {
    color: var(--text-primary);
    font-size: 1.1rem;
    line-height: 1.55;
    margin: 0 8px 8px;
  }
  .s2-tagline strong { color: var(--accent); font-weight: 700; }
  .s2-tagline-sub {
    color: var(--text-secondary);
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 0 8px 40px;
  }
  .s2-cta {
    width: 100%;
    font-size: 1.05rem;
    padding: 18px 18px;
    background: linear-gradient(135deg, #7dd3fc 0%, #38bdf8 100%);
    box-shadow: 0 10px 30px rgba(56, 189, 248, 0.28);
  }
  .s2-cta:hover {
    background: linear-gradient(135deg, #93dbfd 0%, #4cc4f9 100%);
    box-shadow: 0 12px 34px rgba(56, 189, 248, 0.4);
  }

  @media (max-width: 480px) {
    .home2 { padding-top: 32px; }
    .s2-title { font-size: 2.4rem; }
  }
`
