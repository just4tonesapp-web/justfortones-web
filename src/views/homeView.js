// ═══════════════════════════════════════════════════════════════════
// Home — "Tone Diagnosis" landing page (slides 2–3)
// Hero CTA → start the 4-step diagnostic.
// Below: the 4 step cards, current progress, secondary links.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { supabase } from '../supabaseClient.js'
import { getDiagnosticState } from '../services/progressService.js'

export async function homeView(container) {
  const isGuest = sessionStorage.getItem('j4t_guest') === '1'

  let state = {
    passedA: false, passedB: false, passedC: false, passedD: false,
    passedX: false, passedY: false,
  }
  try { state = await getDiagnosticState() } catch (e) { /* first visit */ }

  const completed = ['A','B','C','D'].filter(t => state[`passed${t}`]).length

  // First step the user hasn't passed yet → "Start" CTA target.
  const firstUnpassed =
    !state.passedA ? '/test-a'
    : !state.passedB ? '/test-b'
    : !state.passedC ? '/test-c'
    : !state.passedD ? '/test-d'
    : '/report'

  const startCtaLabel =
    completed === 0 ? 'Test My Tone Skills Now'
    : completed === 4 ? 'View Composite Report'
    : 'Continue Diagnostic'

  const stepCard = (n, icon, title, sub, route, passed) => `
    <button class="diag-step-card ${passed ? 'done' : ''}" data-route="${route}">
      <div class="diag-step-num">${n}</div>
      <div class="diag-step-icon">${icon}</div>
      <div class="diag-step-body">
        <div class="diag-step-title">${title}</div>
        <div class="diag-step-sub">${sub}</div>
      </div>
      <div class="diag-step-status">${passed ? '✓' : '→'}</div>
    </button>`

  container.innerHTML = `
    <div class="app-shell">
      <header class="home-header">
        <div class="home-top-actions">
          <button class="top-btn" id="report-btn" title="View composite report">📊</button>
          <button class="top-btn" id="history-btn" title="View test history">📋</button>
          <button class="logout-btn" id="logout-btn" title="${isGuest ? 'Exit guest mode' : 'Log out'}">
            ${isGuest ? '👤 Guest' : '🚪 Log out'}
          </button>
        </div>
        <h1 class="home-title">Just4Tones</h1>
        <p class="home-tagline">The ultimate tool to <strong>MASTER 4 tones</strong> of Mandarin Chinese.</p>
        <p class="home-tagline-sub">Built for everyone. Notice improvements in 30 minutes.</p>
      </header>

      <div class="cta-hero card animate-in">
        <div class="cta-hero-icon">🎯</div>
        <h2 class="cta-hero-title">Tone Diagnosis</h2>
        <p class="cta-hero-desc">
          Find out exactly where your tone skills stand
          ${completed === 0 ? '' : `· <strong>${completed}/4</strong> done`}
          in four quick steps.
        </p>
        <button class="btn btn-primary btn-lg cta-hero-btn" id="start-diag">${startCtaLabel}</button>
      </div>

      <div class="diag-steps-wrap animate-in" style="animation-delay:.1s">
        <div class="diag-steps-label">The 4 quick steps</div>
        ${stepCard('1️⃣', '🎧', 'Listening',  '1-syllable words · 8 questions',  '/test-a', state.passedA)}
        ${stepCard('2️⃣', '🎧', 'Listening',  '2-syllable words · 15 questions', '/test-b', state.passedB)}
        ${stepCard('3️⃣', '🎤', 'Speaking',   '1-syllable words · 12 questions', '/test-c', state.passedC)}
        ${stepCard('4️⃣', '🎤', 'Speaking',   '2-syllable words · 12 questions', '/test-d', state.passedD)}
      </div>

      <div class="more-section animate-in" style="animation-delay:.2s">
        <div class="more-label">Beyond the diagnostic</div>
        <button class="more-card" id="go-test-x">
          <div class="more-card-icon">📚</div>
          <div class="more-card-body">
            <div class="more-card-title">Character Tone Quiz ${state.passedX ? '✓' : ''}</div>
            <div class="more-card-sub">Top 50 most-frequent characters · 50 questions</div>
          </div>
          <div class="more-card-arrow">→</div>
        </button>
        <button class="more-card" id="go-test-y">
          <div class="more-card-icon">📖</div>
          <div class="more-card-body">
            <div class="more-card-title">HSK Word Tones ${state.passedY ? '✓' : ''}</div>
            <div class="more-card-sub">Top 500 disyllabic words · 10 rounds × 20</div>
          </div>
          <div class="more-card-arrow">→</div>
        </button>
        <button class="more-card" id="go-practice-rec">
          <div class="more-card-icon">🎧</div>
          <div class="more-card-body">
            <div class="more-card-title">Recognition Practice</div>
            <div class="more-card-sub">Train your ear · no limit</div>
          </div>
          <div class="more-card-arrow">→</div>
        </button>
        <button class="more-card" id="go-practice-pro">
          <div class="more-card-icon">🎤</div>
          <div class="more-card-body">
            <div class="more-card-title">Production Practice</div>
            <div class="more-card-sub">Record & get tone feedback</div>
          </div>
          <div class="more-card-arrow">→</div>
        </button>
        <button class="more-card" id="go-practice-char">
          <div class="more-card-icon">🧠</div>
          <div class="more-card-body">
            <div class="more-card-title">Character Learning</div>
            <div class="more-card-sub">Batch flashcards + quiz</div>
          </div>
          <div class="more-card-arrow">→</div>
        </button>
      </div>

      <div class="footer-row animate-in" style="animation-delay:.3s">
        <button class="footer-link" id="goto-old">⏳ Legacy flow (/old)</button>
      </div>
    </div>
  `

  // Bind
  document.getElementById('start-diag').addEventListener('click', () => navigate(firstUnpassed))
  container.querySelectorAll('.diag-step-card').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.route))
  })
  document.getElementById('go-test-x').addEventListener('click', () => navigate('/test-x'))
  document.getElementById('go-test-y').addEventListener('click', () => navigate('/test-y'))
  document.getElementById('report-btn').addEventListener('click', () => navigate('/report'))
  document.getElementById('history-btn').addEventListener('click', () => navigate('/history'))
  document.getElementById('go-practice-rec').addEventListener('click', () => navigate('/practice-recognition'))
  document.getElementById('go-practice-pro').addEventListener('click', () => navigate('/practice-production'))
  document.getElementById('go-practice-char').addEventListener('click', () => navigate('/practice-characters'))
  document.getElementById('goto-old').addEventListener('click', () => { window.location.hash = '#/old'; })

  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (isGuest) {
      sessionStorage.removeItem('j4t_guest')
      navigate('/login')
    } else {
      await supabase.auth.signOut()
    }
  })

  // Scoped styles
  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)
}

const scopedCSS = `
  .home-header {
    text-align: center;
    margin-bottom: 24px;
  }
  .home-top-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }
  .home-title {
    font-size: 2.4rem;
    font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.1;
    margin-bottom: 8px;
  }
  .home-tagline {
    color: var(--text-secondary);
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 6px 16px 2px;
  }
  .home-tagline strong { color: var(--text-primary); }
  .home-tagline-sub {
    color: var(--text-muted);
    font-size: 0.82rem;
    line-height: 1.5;
    margin: 0 16px;
  }
  @media (max-width: 480px) {
    .home-title { font-size: 2rem; }
    .top-btn { padding: 5px 9px; font-size: 0.78rem; }
    .logout-btn { padding: 5px 10px; font-size: 0.72rem; }
  }
  .top-btn {
    background: var(--surface);
    border: 1px solid var(--card-border);
    color: var(--text-secondary);
    padding: 6px 10px;
    border-radius: 20px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .top-btn:hover { border-color: var(--accent); }
  .logout-btn {
    background: var(--surface);
    border: 1px solid var(--card-border);
    color: var(--text-secondary);
    padding: 6px 12px;
    border-radius: 20px;
    font-family: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .logout-btn:hover { border-color: var(--accent); color: var(--text-primary); }

  .cta-hero {
    text-align: center;
    padding: 24px 18px 22px;
    margin-bottom: 22px;
    background: linear-gradient(135deg, rgba(56,189,248,0.08), rgba(129,140,248,0.08));
    border: 1px solid rgba(56,189,248,0.25);
  }
  .cta-hero-icon { font-size: 2.6rem; margin-bottom: 10px; }
  .cta-hero-title { font-size: 1.45rem; font-weight: 700; margin-bottom: 8px; }
  .cta-hero-desc {
    color: var(--text-secondary);
    font-size: 0.92rem;
    line-height: 1.55;
    margin: 0 8px 16px;
  }
  .cta-hero-desc strong { color: var(--accent); }
  .cta-hero-btn { width: 100%; }

  .diag-steps-wrap {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 22px;
  }
  .diag-steps-label {
    padding: 12px 18px;
    font-size: 0.76rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
    background: var(--accent-glow);
    border-bottom: 1px solid var(--card-border);
  }
  .diag-step-card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--card-border);
    padding: 14px 18px;
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary);
    text-align: left;
    transition: background 0.2s;
  }
  .diag-step-card:last-child { border-bottom: none; }
  .diag-step-card:hover { background: rgba(56,189,248,0.04); }
  .diag-step-card.done { background: rgba(74,222,128,0.04); }
  .diag-step-card.done:hover { background: rgba(74,222,128,0.07); }
  .diag-step-num {
    font-size: 1.4rem;
    flex-shrink: 0;
  }
  .diag-step-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }
  .diag-step-body { flex: 1; }
  .diag-step-title { font-weight: 600; font-size: 0.98rem; margin-bottom: 2px; }
  .diag-step-sub { font-size: 0.78rem; color: var(--text-secondary); }
  .diag-step-status {
    font-size: 1.1rem;
    color: var(--accent);
    flex-shrink: 0;
    font-weight: 700;
  }
  .diag-step-card.done .diag-step-status { color: var(--correct); }

  .more-section {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    overflow: hidden;
    margin-bottom: 18px;
  }
  .more-label {
    padding: 12px 18px;
    font-size: 0.76rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    background: var(--surface);
    border-bottom: 1px solid var(--card-border);
  }
  .more-card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--card-border);
    padding: 14px 18px;
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary);
    text-align: left;
    transition: background 0.2s;
  }
  .more-card:last-child { border-bottom: none; }
  .more-card:hover { background: rgba(56,189,248,0.04); }
  .more-card-icon { font-size: 1.4rem; flex-shrink: 0; }
  .more-card-body { flex: 1; }
  .more-card-title { font-weight: 600; font-size: 0.92rem; margin-bottom: 2px; }
  .more-card-sub { font-size: 0.76rem; color: var(--text-secondary); }
  .more-card-arrow { color: var(--accent); font-size: 1.1rem; flex-shrink: 0; }

  .footer-row {
    text-align: center;
    padding: 16px 0 8px;
  }
  .footer-link {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.78rem;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 16px;
  }
  .footer-link:hover { color: var(--accent); }
`
