// ═══════════════════════════════════════
// Diagnostic Report — Combined results across all tests
//
// Shows a comprehensive report identifying specific tone issues
// after the user completes diagnostic steps.
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { getDiagnosticState } from '../services/progressService.js'

export async function diagnosticReportView(container) {
  const state = await getDiagnosticState()
  const { results, step1Done, step2Done, step3Done } = state

  // Gather best scores per test
  const best = (type) => {
    const matching = results.filter(r => r.test_type === type)
    if (!matching.length) return null
    return matching.reduce((a, b) => (a.score > b.score ? a : b))
  }

  const tests = ['A', 'B', 'C', 'D', 'X', 'Y', 'Z']
  const testData = {}
  for (const t of tests) testData[t] = best(t)

  // Overall progress
  const completedTests = tests.filter(t => testData[t]?.passed).length
  const totalTests = tests.length
  const overallPct = Math.round((completedTests / totalTests) * 100)

  // Identify weak areas
  const weakAreas = []
  if (testData.A && !testData.A.passed) weakAreas.push('single syllable tone recognition')
  if (testData.B && !testData.B.passed) weakAreas.push('two-syllable tone pair recognition')
  if (testData.C && !testData.C.passed) weakAreas.push('single character tone production')
  if (testData.D && !testData.D.passed) weakAreas.push('two-character tone production')
  if (testData.X && !testData.X.passed) weakAreas.push('character tone knowledge (round 1)')
  if (testData.Y && !testData.Y.passed) weakAreas.push('character tone knowledge (round 2)')
  if (testData.Z && !testData.Z.passed) weakAreas.push('character tone knowledge (round 3)')

  // Build test rows
  let testRows = ''
  const testLabels = {
    A: 'Test A — Single Syllable Listening',
    B: 'Test B — Two-Syllable Listening',
    C: 'Test C — Single Char Pronunciation',
    D: 'Test D — Two-Char Pronunciation',
    X: 'Test X — Character Tones (Round 1)',
    Y: 'Test Y — Character Tones (Round 2)',
    Z: 'Test Z — Character Tones (Round 3)',
  }

  for (const t of tests) {
    const d = testData[t]
    const status = !d ? '—' : d.passed ? '✅' : '❌'
    const scoreText = d ? `${d.score}/${d.total}` : 'Not taken'
    const pct = d ? Math.round((d.score / d.total) * 100) : 0
    const barColor = !d ? 'var(--card-border)' : d.passed ? 'var(--correct)' : 'var(--incorrect)'

    testRows += `
      <div class="diag-row">
        <span class="diag-status">${status}</span>
        <div class="diag-info">
          <div class="diag-label">${testLabels[t]}</div>
          <div class="diag-bar-track">
            <div class="diag-bar-fill" style="width:${pct}%;background:${barColor}"></div>
          </div>
        </div>
        <span class="diag-score">${scoreText}</span>
      </div>`
  }

  // Diagnosis
  let diagnosis = ''
  if (!step1Done) {
    diagnosis = `
      <div class="diag-finding">
        <div class="diag-finding-icon">👂</div>
        <div>
          <strong>Area to improve: Tone Recognition</strong>
          <p>You're still working on identifying tones by ear. This is the foundation — keep practicing with listening exercises until you can consistently distinguish all four tones.</p>
        </div>
      </div>`
  }
  if (step1Done && !step2Done) {
    diagnosis += `
      <div class="diag-finding">
        <div class="diag-finding-icon">🎤</div>
        <div>
          <strong>Area to improve: Tone Production</strong>
          <p>You can hear the difference between tones, but producing them accurately needs more practice. Focus on matching your pitch contour to the target tone patterns.</p>
        </div>
      </div>`
  }
  if (step2Done && !step3Done) {
    diagnosis += `
      <div class="diag-finding">
        <div class="diag-finding-icon">📚</div>
        <div>
          <strong>Area to improve: Character Tone Knowledge</strong>
          <p>You can hear and pronounce tones well, but you need to memorize which tone goes with which character. The top 50 characters cover 60% of all written Chinese — focus on these first!</p>
        </div>
      </div>`
  }
  if (step3Done) {
    diagnosis = `
      <div class="diag-finding success">
        <div class="diag-finding-icon">🎉</div>
        <div>
          <strong>Excellent work!</strong>
          <p>You've demonstrated strong tone skills across all three areas: recognition, production, and character knowledge. Keep practicing to maintain and extend your abilities!</p>
        </div>
      </div>`
  }
  if (weakAreas.length && !step3Done) {
    diagnosis += `
      <div class="diag-finding">
        <div class="diag-finding-icon">🔍</div>
        <div>
          <strong>Specific weak areas identified:</strong>
          <ul>${weakAreas.map(w => `<li>${w}</li>`).join('')}</ul>
        </div>
      </div>`
  }

  // Recommended next step
  let nextAction = ''
  if (!step1Done) {
    nextAction = `<button class="btn btn-primary" id="diag-next">→ Practice Tone Recognition</button>`
  } else if (!step2Done) {
    nextAction = `<button class="btn btn-primary" id="diag-next">→ Practice Tone Production</button>`
  } else if (!step3Done) {
    nextAction = `<button class="btn btn-primary" id="diag-next">→ Learn Character Tones</button>`
  } else {
    nextAction = `<button class="btn btn-primary" id="diag-next">→ Advanced Practice</button>`
  }

  container.innerHTML = `
    <div class="app-shell">
      <div class="diag-header">
        <span class="badge">Diagnostic Report</span>
        <h1>Your Tone Profile</h1>
        <p>Based on your test results</p>
      </div>

      <div class="card animate-in text-center" style="margin-bottom:24px">
        <div class="score-ring" style="--pct:${overallPct}">
          <span class="score-num">${completedTests}/${totalTests}</span>
          <span class="score-label">tests passed</span>
        </div>
        <div class="diag-steps">
          <div class="diag-step ${step1Done ? 'done' : ''}">
            <div class="diag-step-icon">${step1Done ? '✅' : '⬜'}</div>
            <div class="diag-step-label">Hearing</div>
          </div>
          <div class="diag-step-arrow">→</div>
          <div class="diag-step ${step2Done ? 'done' : ''}">
            <div class="diag-step-icon">${step2Done ? '✅' : '⬜'}</div>
            <div class="diag-step-label">Speaking</div>
          </div>
          <div class="diag-step-arrow">→</div>
          <div class="diag-step ${step3Done ? 'done' : ''}">
            <div class="diag-step-icon">${step3Done ? '✅' : '⬜'}</div>
            <div class="diag-step-label">Knowledge</div>
          </div>
        </div>
      </div>

      <div class="card animate-in" style="margin-bottom:24px;animation-delay:.1s">
        <h3 class="section-head">Test Results</h3>
        ${testRows}
      </div>

      <div class="card animate-in" style="margin-bottom:24px;animation-delay:.2s">
        <h3 class="section-head">Diagnosis</h3>
        ${diagnosis || '<p style="color:var(--text-secondary)">Complete some tests to get your diagnosis.</p>'}
      </div>

      <div class="report-actions animate-in" style="animation-delay:.3s">
        <button class="btn btn-secondary" id="diag-home">← Home</button>
        ${nextAction}
      </div>
    </div>
  `

  // Scoped styles
  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)

  // Bind
  document.getElementById('diag-home').addEventListener('click', () => navigate('/'))
  document.getElementById('diag-next')?.addEventListener('click', () => {
    if (!step1Done) navigate('/practice-recognition')
    else if (!step2Done) navigate('/practice-production')
    else navigate('/practice-characters')
  })
}

const scopedCSS = `
  .diag-header {
    text-align: center;
    margin-bottom: 28px;
  }
  .diag-header h1 {
    font-size: 1.65rem;
    font-weight: 700;
    margin: 10px 0 6px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .diag-header p {
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  .score-ring {
    width: 120px; height: 120px; border-radius: 50%;
    margin: 0 auto 20px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; position: relative;
  }
  .score-ring::before {
    content: ''; position: absolute; inset: 0; border-radius: 50%; padding: 4px;
    background: conic-gradient(var(--accent) calc(var(--pct) * 3.6deg), var(--card-border) 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 3px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 3px));
  }
  .score-num { font-size: 2.2rem; font-weight: 700; line-height: 1; }
  .score-label { font-size: 0.78rem; color: var(--text-secondary); }

  .diag-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
  }
  .diag-step {
    text-align: center;
  }
  .diag-step-icon { font-size: 1.5rem; }
  .diag-step-label {
    font-size: 0.72rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 4px;
  }
  .diag-step.done .diag-step-label { color: var(--correct); }
  .diag-step-arrow {
    color: var(--text-muted);
    font-size: 1rem;
    margin-bottom: 16px;
  }

  .section-head {
    font-size: 0.85rem; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 16px;
  }

  .diag-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--card-border);
  }
  .diag-row:last-child { border-bottom: none; }
  .diag-status { font-size: 1rem; flex-shrink: 0; }
  .diag-info { flex: 1; }
  .diag-label {
    font-size: 0.82rem;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }
  .diag-bar-track {
    height: 6px;
    background: var(--surface);
    border-radius: 3px;
    overflow: hidden;
  }
  .diag-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s ease;
  }
  .diag-score {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    flex: 0 0 48px;
    text-align: right;
  }

  .diag-finding {
    display: flex;
    gap: 14px;
    padding: 16px;
    background: var(--surface);
    border-radius: var(--radius-sm);
    margin-bottom: 12px;
  }
  .diag-finding:last-child { margin-bottom: 0; }
  .diag-finding.success {
    border: 1px solid rgba(74,222,128,0.3);
    background: rgba(74,222,128,0.05);
  }
  .diag-finding-icon { font-size: 1.5rem; flex-shrink: 0; }
  .diag-finding strong { display: block; margin-bottom: 4px; }
  .diag-finding p {
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }
  .diag-finding ul {
    margin: 8px 0 0;
    padding-left: 18px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .report-actions { display: flex; gap: 12px; }
  @media (max-width: 480px) {
    .report-actions { flex-direction: column; }
  }
`
