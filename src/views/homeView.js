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

      <!-- Practice entry points: three small square tiles -->
      <div class="s2-practice">
        <div class="s2-practice-head">Practice</div>
        <div class="s2-prac-grid">
          <button class="s2-prac-btn" data-nav="/practice-1">
            <span class="s2-prac-icon">👂</span>
            <span class="s2-prac-title">Recognition</span>
          </button>
          <button class="s2-prac-btn" data-nav="/practice-2">
            <span class="s2-prac-icon">🎤</span>
            <span class="s2-prac-title">Speaking</span>
          </button>
          <button class="s2-prac-btn" data-nav="/practice-3">
            <span class="s2-prac-icon">🔄</span>
            <span class="s2-prac-title">Tone Changes</span>
          </button>
        </div>
      </div>
    </div>
  `

  document.getElementById('start-diag').addEventListener('click', () => navigate('/diagnose'))
  container.querySelectorAll('.s2-prac-btn').forEach(btn =>
    btn.addEventListener('click', () => navigate(btn.dataset.nav)))

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

  /* ── Practice entry points: three small square tiles ── */
  .s2-practice { margin-top: 28px; }
  .s2-practice-head {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .s2-prac-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .s2-prac-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 10px 4px;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: inherit;
    color: var(--text-secondary);
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .s2-prac-btn:hover {
    border-color: var(--accent);
    background: var(--accent-glow);
    color: var(--text-primary);
  }
  .s2-prac-icon { font-size: 1.15rem; line-height: 1; }
  .s2-prac-title {
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1.2;
    text-align: center;
  }

  @media (max-width: 480px) {
    .home2 { padding-top: 32px; }
    .s2-title { font-size: 2.4rem; }
  }
`
