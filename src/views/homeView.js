// ═══════════════════════════════════════
// Home view – Diagnostic landing page
// Shows test progress and routes to appropriate next step
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { supabase } from '../supabaseClient.js'
import { getDiagnosticState } from '../services/progressService.js'

export async function homeView(container) {
  const isGuest = sessionStorage.getItem('j4t_guest') === '1'

  // Get diagnostic progress
  let state = { step1Done: false, step2Done: false, step3Done: false,
                passedA: false, passedB: false, passedC: false, passedD: false,
                passedX: false, passedY: false, passedZ: false }
  try { state = await getDiagnosticState() } catch (e) { /* first visit */ }

  const check = (passed) => passed ? '✅' : ''

  container.innerHTML = `
    <div class="app-shell">
      <header class="home-header">
        <div class="home-top-bar">
          <h1 class="home-title">Just4Tones</h1>
          <div class="home-top-actions">
            <button class="top-btn" id="report-btn" title="View diagnostic report">📊</button>
            <button class="logout-btn" id="logout-btn" title="${isGuest ? 'Exit guest mode' : 'Log out'}">
              ${isGuest ? '👤 Guest' : '🚪 Log out'}
            </button>
          </div>
        </div>
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
        <!-- Step 1: Test A + Test B -->
        <div class="step-group animate-in" style="animation-delay:.1s">
          <div class="step-group-label">Step 1 · Can you hear the tones?</div>
          <button class="step-card" id="go-test-a">
            <div class="step-num">A</div>
            <div class="step-body">
              <h3>Single Syllable Tones ${check(state.passedA)}</h3>
              <p>Listen to one syllable and pick the correct tone</p>
              <span class="step-tag">Test A · 12 questions</span>
            </div>
            <div class="step-arrow">→</div>
          </button>
          <button class="step-card" id="go-test-b">
            <div class="step-num">B</div>
            <div class="step-body">
              <h3>Two-Syllable Tone Pairs ${check(state.passedB)}</h3>
              <p>Listen to two syllables and identify both tones</p>
              <span class="step-tag">Test B · 12 questions</span>
            </div>
            <div class="step-arrow">→</div>
          </button>
          <button class="step-card practice-card" id="go-practice-rec">
            <div class="step-num practice">🎧</div>
            <div class="step-body">
              <h3>Tone Recognition Practice</h3>
              <p>Unlimited listening exercises to train your ear</p>
              <span class="step-tag">Practice · no limit</span>
            </div>
            <div class="step-arrow">→</div>
          </button>
        </div>

        <!-- Step 2: Pronunciation -->
        <div class="step-group animate-in" style="animation-delay:.2s">
          <div class="step-group-label">Step 2 · Can you pronounce the tones?</div>
          <button class="step-card" id="go-test-c">
            <div class="step-num">C</div>
            <div class="step-body">
              <h3>Single Character Pronunciation ${check(state.passedC)}</h3>
              <p>See a character, record yourself saying it</p>
              <span class="step-tag">Test C · 12 questions</span>
            </div>
            <div class="step-arrow">→</div>
          </button>
          <button class="step-card" id="go-test-d">
            <div class="step-num">D</div>
            <div class="step-body">
              <h3>Two-Character Pronunciation ${check(state.passedD)}</h3>
              <p>Pronounce two-syllable combinations</p>
              <span class="step-tag">Test D · 12 questions</span>
            </div>
            <div class="step-arrow">→</div>
          </button>
          <button class="step-card practice-card" id="go-practice-pro">
            <div class="step-num practice">🎤</div>
            <div class="step-body">
              <h3>Tone Production Practice</h3>
              <p>Record and get feedback on your pronunciation</p>
              <span class="step-tag">Practice · no limit</span>
            </div>
            <div class="step-arrow">→</div>
          </button>
        </div>

        <!-- Step 3: Character tones -->
        <div class="step-group animate-in" style="animation-delay:.3s">
          <div class="step-group-label">Step 3 · Do you know the character tones?</div>
          <button class="step-card" id="go-test-xyz">
            <div class="step-num">X</div>
            <div class="step-body">
              <h3>Character Tone Knowledge ${check(state.passedX && state.passedY && state.passedZ)}</h3>
              <p>Match tones to the most common characters</p>
              <span class="step-tag">Tests X, Y, Z · 36 questions</span>
            </div>
            <div class="step-arrow">→</div>
          </button>
          <button class="step-card practice-card" id="go-practice-char">
            <div class="step-num practice">📚</div>
            <div class="step-body">
              <h3>Character Batch Learning</h3>
              <p>Learn character tones in batches of 50</p>
              <span class="step-tag">Practice · 200 characters</span>
            </div>
            <div class="step-arrow">→</div>
          </button>
        </div>
      </div>

    </div>
  `

  // Bind navigation
  document.getElementById('go-test-a').addEventListener('click', () => navigate('/test-a'))
  document.getElementById('go-test-b').addEventListener('click', () => navigate('/test-b'))
  document.getElementById('go-test-c').addEventListener('click', () => navigate('/test-c'))
  document.getElementById('go-test-d').addEventListener('click', () => navigate('/test-d'))
  document.getElementById('go-test-xyz').addEventListener('click', () => navigate('/test-xyz'))
  document.getElementById('report-btn').addEventListener('click', () => navigate('/report'))
  document.getElementById('go-practice-rec').addEventListener('click', () => navigate('/practice-recognition'))
  document.getElementById('go-practice-pro').addEventListener('click', () => navigate('/practice-production'))
  document.getElementById('go-practice-char').addEventListener('click', () => navigate('/practice-characters'))

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
  style.textContent = `
    .home-header {
      text-align: center;
      margin-bottom: 28px;
    }
    .home-top-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .home-title {
      font-size: 2.2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .home-top-actions {
      position: absolute;
      right: 0;
      display: flex;
      gap: 8px;
      align-items: center;
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
    .top-btn:hover {
      border-color: var(--accent);
    }
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
    .logout-btn:hover {
      border-color: var(--accent);
      color: var(--text-primary);
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

    .step-group {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    .step-group-label {
      padding: 12px 20px;
      font-size: 0.78rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent);
      border-bottom: 1px solid var(--card-border);
      background: var(--accent-glow);
    }
    .step-group .step-card {
      border: none;
      border-radius: 0;
      border-bottom: 1px solid var(--card-border);
    }
    .step-group .step-card:last-child {
      border-bottom: none;
    }

    .step-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      padding: 18px 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      font-family: inherit;
      color: var(--text-primary);
      width: 100%;
    }
    .step-card:hover:not(.locked) {
      background: rgba(56,189,248,0.04);
    }
    .step-card.locked {
      opacity: 0.5;
      cursor: default;
    }
    .step-card.practice-card {
      background: rgba(56,189,248,0.02);
    }
    .step-card.practice-card:hover:not(.locked) {
      background: rgba(56,189,248,0.06);
    }

    .step-num {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: var(--accent-glow);
      border: 1px solid rgba(56,189,248,0.3);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.85rem; color: var(--accent);
      flex-shrink: 0;
    }
    .step-num.practice {
      background: rgba(129,140,248,0.1);
      border-color: rgba(129,140,248,0.3);
      font-size: 1.1rem;
    }
    .step-body { flex: 1; }
    .step-body h3 { font-size: 0.92rem; margin-bottom: 3px; }
    .step-body p { font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4; }
    .step-tag {
      display: inline-block;
      margin-top: 5px;
      font-size: 0.7rem;
      color: var(--accent);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .step-arrow {
      font-size: 1.2rem;
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
