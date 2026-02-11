// ═══════════════════════════════════════
// Home view – Diagnostic landing page
// ═══════════════════════════════════════
import { navigate } from '../router.js'

export function homeView(container) {
  container.innerHTML = `
    <div class="app-shell">
      <header class="home-header">
        <h1 class="home-title">Just4Tones</h1>
        <p class="home-subtitle">Master the four tones of Mandarin Chinese</p>
      </header>

      <div class="card animate-in home-hero">
        <div class="home-hero-icon">🎯</div>
        <h2>Tone Diagnostic</h2>
        <p class="home-desc">
          Find out exactly where your tone skills stand. We'll test your ears,
          your voice, and your character knowledge in three quick steps.
        </p>
      </div>

      <div class="steps">
        <button class="step-card animate-in" id="step-1" style="animation-delay:.1s">
          <div class="step-num">1</div>
          <div class="step-body">
            <h3>Can you hear the tones?</h3>
            <p>Listen to syllables and identify their tones</p>
            <span class="step-tag">Test A · 12 questions</span>
          </div>
          <div class="step-arrow">→</div>
        </button>

        <button class="step-card locked animate-in" id="step-2" style="animation-delay:.2s" disabled>
          <div class="step-num">2</div>
          <div class="step-body">
            <h3>Can you pronounce the tones?</h3>
            <p>Record yourself and compare with the target</p>
            <span class="step-tag">Test C · coming soon</span>
          </div>
          <div class="step-lock">🔒</div>
        </button>

        <button class="step-card locked animate-in" id="step-3" style="animation-delay:.3s" disabled>
          <div class="step-num">3</div>
          <div class="step-body">
            <h3>Do you know the character tones?</h3>
            <p>Match tones to the most common characters</p>
            <span class="step-tag">Test X · coming soon</span>
          </div>
          <div class="step-lock">🔒</div>
        </button>
      </div>
    </div>
  `

  document.getElementById('step-1').addEventListener('click', () => navigate('/test-a'))

  // styles scoped to this view
  const style = document.createElement('style')
  style.textContent = `
    .home-header {
      text-align: center;
      margin-bottom: 28px;
    }
    .home-title {
      font-size: 2.2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .home-subtitle {
      color: var(--text-secondary);
      font-size: 1rem;
      margin-top: 4px;
    }
    .home-hero {
      text-align: center;
      margin-bottom: 32px;
    }
    .home-hero-icon { font-size: 2.5rem; margin-bottom: 12px; }
    .home-hero h2 { font-size: 1.35rem; margin-bottom: 10px; }
    .home-desc {
      color: var(--text-secondary);
      font-size: 0.92rem;
      line-height: 1.6;
    }

    .steps { display: flex; flex-direction: column; gap: 12px; }

    .step-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      font-family: inherit;
      color: var(--text-primary);
      width: 100%;
    }
    .step-card:hover:not(.locked) {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(56,189,248,0.15);
    }
    .step-card.locked {
      opacity: 0.5;
      cursor: default;
    }

    .step-num {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: var(--accent-glow);
      border: 1px solid rgba(56,189,248,0.3);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; color: var(--accent);
      flex-shrink: 0;
    }
    .step-body { flex: 1; }
    .step-body h3 { font-size: 0.95rem; margin-bottom: 4px; }
    .step-body p { font-size: 0.82rem; color: var(--text-secondary); line-height: 1.4; }
    .step-tag {
      display: inline-block;
      margin-top: 6px;
      font-size: 0.72rem;
      color: var(--accent);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .step-arrow {
      font-size: 1.3rem;
      color: var(--accent);
      flex-shrink: 0;
    }
    .step-lock {
      font-size: 1rem;
      flex-shrink: 0;
    }
  `
  container.appendChild(style)
}
