// ═══════════════════════════════════════
// History view — every saved test attempt
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { getResults } from '../services/progressService.js'

const TEST_LABELS = {
  A: 'Test A — Single Syllable Listening',
  B: 'Test B — Two-Syllable Listening',
  C: 'Test C — Single Character Pronunciation',
  D: 'Test D — Two-Character Pronunciation',
  X: 'Test X — Top 50 Character Tones',
  Y: 'Test Y — Disyllabic Word Tones',
}

function formatDate(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return iso
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const opts = sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  return d.toLocaleString(undefined, opts)
}

export async function historyView(container) {
  container.innerHTML = `
    <div class="app-shell">
      <div class="hist-header">
        <button class="hist-back-btn" id="hist-back" aria-label="Back to home">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 16L7 10L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="hist-header-text">
          <h1>Test History</h1>
          <p>Every attempt, most recent first</p>
        </div>
      </div>

      <div class="hist-filter" id="hist-filter">
        <button class="hist-chip active" data-filter="all">All</button>
        ${Object.keys(TEST_LABELS).map(t => `<button class="hist-chip" data-filter="${t}">${t}</button>`).join('')}
      </div>

      <div class="card animate-in" id="hist-body">
        <div class="hist-loading">Loading…</div>
      </div>
    </div>
  `

  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)

  document.getElementById('hist-back').addEventListener('click', () => navigate('/'))

  const results = await getResults()
  renderList(results, 'all')

  document.querySelectorAll('#hist-filter .hist-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#hist-filter .hist-chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
      renderList(results, chip.dataset.filter)
    })
  })
}

function renderList(results, filter) {
  const body = document.getElementById('hist-body')
  const filtered = filter === 'all' ? results : results.filter(r => r.test_type === filter)

  if (!filtered.length) {
    body.innerHTML = `<div class="hist-empty">No attempts yet${filter === 'all' ? '' : ` for Test ${filter}`}.</div>`
    return
  }

  const total = filtered.length
  const passed = filtered.filter(r => r.passed).length

  const rows = filtered.map(r => {
    const pct = Math.round((r.score / r.total) * 100)
    const icon = r.passed ? '✅' : '❌'
    const label = TEST_LABELS[r.test_type] || `Test ${r.test_type}`
    const date = formatDate(r.created_at)
    const barColor = r.passed ? 'var(--correct)' : 'var(--incorrect)'
    return `
      <div class="hist-row">
        <span class="hist-status">${icon}</span>
        <div class="hist-info">
          <div class="hist-row-top">
            <span class="hist-label">${label}</span>
            <span class="hist-score">${r.score}/${r.total}</span>
          </div>
          <div class="hist-bar-track">
            <div class="hist-bar-fill" style="width:${pct}%;background:${barColor}"></div>
          </div>
          <span class="hist-date">${date}</span>
        </div>
      </div>`
  }).join('')

  body.innerHTML = `
    <div class="hist-summary">
      <span>${total} attempt${total === 1 ? '' : 's'}</span>
      <span class="hist-sep">·</span>
      <span>${passed} passed</span>
      <span class="hist-sep">·</span>
      <span>${total - passed} failed</span>
    </div>
    <div class="hist-list">${rows}</div>
  `
}

const scopedCSS = `
  .hist-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 20px;
  }
  .hist-back-btn {
    flex-shrink: 0;
    width: 40px; height: 40px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--card-border);
    background: var(--surface);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  .hist-back-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(56,189,248,0.08);
  }
  .hist-header-text h1 {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 4px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hist-header-text p {
    color: var(--text-secondary);
    font-size: 0.85rem;
    margin: 0;
  }

  .hist-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 16px;
  }
  .hist-chip {
    background: var(--surface);
    border: 1px solid var(--card-border);
    color: var(--text-secondary);
    padding: 6px 12px;
    border-radius: 16px;
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .hist-chip:hover { border-color: var(--accent); color: var(--accent); }
  .hist-chip.active {
    background: var(--accent-glow);
    border-color: var(--accent);
    color: var(--accent);
  }

  .hist-loading, .hist-empty {
    text-align: center;
    color: var(--text-muted);
    padding: 24px;
    font-size: 0.9rem;
  }

  .hist-summary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--card-border);
    font-size: 0.82rem;
    color: var(--text-secondary);
  }
  .hist-sep { color: var(--text-muted); }

  .hist-list { display: flex; flex-direction: column; gap: 4px; }

  .hist-row {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--card-border);
  }
  .hist-row:last-child { border-bottom: none; }
  .hist-status { font-size: 1.1rem; flex-shrink: 0; line-height: 1.4; }
  .hist-info { flex: 1; min-width: 0; }
  .hist-row-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 6px;
  }
  .hist-label {
    font-size: 0.85rem;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hist-score {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    flex-shrink: 0;
  }
  .hist-bar-track {
    height: 5px;
    background: var(--surface);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 4px;
  }
  .hist-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s ease;
  }
  .hist-date {
    font-size: 0.72rem;
    color: var(--text-muted);
  }
`
