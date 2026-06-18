// ═══════════════════════════════════════════════════════════════════
// Diagnose — pptx slide 3.
//   "Tone Diagnosis"
//   "Find out exactly where your tone skills stand in four quick steps!"
//   2×2 grid of step icons (1️⃣ 2️⃣ 3️⃣ 4️⃣)
//   "Just4Tones LOGO" placeholder + Begin button.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { getDiagnosticState } from '../services/progressService.js'

export async function diagnoseView(container) {
  let state = {
    passedA: false, passedB: false, passedC: false,
  }
  try { state = await getDiagnosticState() } catch (e) { /* first visit */ }

  const stepCard = (n, line1, line2, route, passed) => `
    <button class="d3-card ${passed ? 'done' : ''}" data-route="${route}">
      <div class="d3-card-num">${n}</div>
      <div class="d3-card-line1">${line1}</div>
      <div class="d3-card-line2">${line2}</div>
      ${passed ? '<div class="d3-card-check">✓</div>' : ''}
    </button>`

  container.innerHTML = `
    <div class="app-shell diagnose shell-top-center">
      <div class="back-row">
        <button class="app-logo" id="d3-home">Just4Tones</button>
      </div>

      <h1 class="s3-title">Tone Diagnosis</h1>
      <p class="s3-sub">
        Find out exactly where your tone skills stand in three quick steps!
      </p>

      <div class="s3-grid">
        ${stepCard('1', 'Recognizing', '1-syllable<br>words', '/test-1', state.passedA)}
        ${stepCard('2', 'Recognizing', '2-syllable<br>words', '/test-2', state.passedB)}
        ${stepCard('3', 'Speaking',    '1-syllable<br>words', '/test-3', state.passedC)}
      </div>
    </div>
  `

  document.getElementById('d3-home').addEventListener('click', () => navigate('/'))
  container.querySelectorAll('.d3-card').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.route))
  })

  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)
}

const scopedCSS = `
  .diagnose {
    text-align: center;
  }
  .s3-title {
    font-size: 1.85rem;
    font-weight: 700;
    margin-bottom: 12px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .s3-sub {
    color: var(--text-secondary);
    font-size: 1rem;
    line-height: 1.55;
    margin: 0 8px 28px;
  }
  .s3-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 28px;
  }
  .d3-card {
    position: relative;
    min-width: 0;
    aspect-ratio: 1 / 1;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: var(--radius);
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px 10px;
    transition: all 0.2s;
  }
  .d3-card:hover {
    border-color: var(--accent);
    background: rgba(56,189,248,0.05);
    transform: translateY(-2px);
  }
  .d3-card.done {
    border-color: var(--correct);
    background: rgba(74,222,128,0.05);
  }
  .d3-card-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px; height: 46px;
    border-radius: 12px;
    background: var(--accent-glow);
    border: 1px solid rgba(56,189,248,0.4);
    color: var(--accent);
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1;
  }
  .d3-card.done .d3-card-num {
    background: var(--correct-bg);
    border-color: rgba(74,222,128,0.4);
    color: var(--correct);
  }
  .d3-card-line1 {
    font-size: 1.02rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  .d3-card-line2 {
    font-size: 0.82rem;
    color: var(--text-secondary);
    line-height: 1.35;
  }
  .d3-card-check {
    position: absolute;
    top: 8px; right: 10px;
    font-size: 0.95rem;
    color: var(--correct);
    font-weight: 700;
  }
  @media (max-width: 480px) {
    .s3-title { font-size: 1.6rem; }
    .s3-grid { gap: 8px; }
    .d3-card { padding: 12px 6px; gap: 6px; }
    .d3-card-num { width: 36px; height: 36px; font-size: 1.1rem; border-radius: 9px; }
    .d3-card-line1 { font-size: 0.8rem; }
    .d3-card-line2 { font-size: 0.66rem; }
  }
`
