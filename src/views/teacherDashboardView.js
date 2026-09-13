// ═══════════════════════════════════════════════════════════════════
// /teacher — teacher-facing dashboard: create/share a class code, class-wide
// stats + weak-tone distribution, and a roster that drills into per-student
// detail (/teacher-student). Weak-tone numbers reuse the exact same
// analyzers/renderer the student's own composite report uses
// (src/utils/toneReport.js) via src/utils/teacherReport.js's bucketing —
// same visual language, zero new analysis code.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { supabase } from '../supabaseClient.js'
import { buildReportHTML, TONE_REPORT_CSS } from '../utils/toneReport.js'
import { bucketAnswers, analyzeBucket, ACTIVITY_META } from '../utils/teacherReport.js'

function getUser() {
  try { return JSON.parse(localStorage.getItem('j4t_user') || 'null') } catch { return null }
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export function teacherDashboardView(container) {
  const user = getUser()
  if (!user?.is_teacher) { navigate('/'); return }

  let classes = []
  let activeClassId = null

  renderLoading()
  loadClasses()

  function renderLoading() {
    container.innerHTML = `
      <div class="app-shell shell-top-center">
        <div class="back-row"><button class="app-logo" id="td-home">Just4Tones</button></div>
        <h1 class="td-title">Teacher Dashboard</h1>
        <p class="td-empty">Loading…</p>
      </div>`
    inject()
    document.getElementById('td-home').addEventListener('click', () => navigate('/'))
  }

  async function loadClasses() {
    const { data } = await supabase.rpc('app_teacher_classes', { p_teacher_id: user.id })
    classes = Array.isArray(data) ? data : []
    if (!classes.length) { renderCreateForm(); return }
    if (!classes.find(c => c.id === activeClassId)) activeClassId = classes[0].id
    renderShell()
    loadClassData()
  }

  function renderCreateForm(message) {
    container.innerHTML = `
      <div class="app-shell shell-top-center">
        <div class="back-row"><button class="app-logo" id="td-home">Just4Tones</button></div>
        <h1 class="td-title">Teacher Dashboard</h1>
        <p class="td-sub">Create a class to get a code your students can join with (at /join-class).</p>
        <div class="card td-card">
          <div class="field">
            <label for="td-name">Class name</label>
            <input type="text" id="td-name" placeholder="e.g. Fall 2026 Heritage" />
          </div>
          ${message ? `<p class="td-message ${message.error ? 'error' : ''}">${escapeHtml(message.text)}</p>` : ''}
          <button class="btn btn-primary btn-lg" id="td-create">Create class</button>
        </div>
      </div>`
    inject()
    document.getElementById('td-home').addEventListener('click', () => navigate('/'))
    document.getElementById('td-create').addEventListener('click', handleCreate)
    document.getElementById('td-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleCreate() })
  }

  async function handleCreate() {
    const name = document.getElementById('td-name').value.trim()
    if (!name) { renderCreateForm({ error: true, text: 'Enter a class name.' }); return }
    const btn = document.getElementById('td-create')
    btn.disabled = true
    btn.textContent = 'Creating…'
    try {
      const { data, error } = await supabase.rpc('app_create_class', { p_teacher_id: user.id, p_name: name })
      if (error) throw error
      if (!data || data.error) { renderCreateForm({ error: true, text: data?.error || 'Something went wrong.' }); return }
      await loadClasses()
    } catch {
      renderCreateForm({ error: true, text: "Can't reach the server right now." })
    }
  }

  function renderShell() {
    const cls = classes.find(c => c.id === activeClassId)
    container.innerHTML = `
      <div class="app-shell shell-top-center">
        <div class="back-row"><button class="app-logo" id="td-home">Just4Tones</button></div>
        <h1 class="td-title">Teacher Dashboard</h1>
        ${classes.length > 1 ? `
          <select id="td-class-select" class="td-select">
            ${classes.map(c => `<option value="${c.id}" ${c.id === activeClassId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>` : ''}
        <div class="card td-code-card">
          <div class="td-code-row">
            <span class="td-code-label">${escapeHtml(cls.name)}</span>
            <span class="td-code">${escapeHtml(cls.code)}</span>
            <button class="btn-link" id="td-copy">Copy code</button>
          </div>
          <p class="td-code-sub">${cls.student_count} student${cls.student_count === 1 ? '' : 's'} joined · share this code so students can join at /join-class</p>
        </div>
        <div id="td-stats" class="card td-empty">Loading class stats…</div>
        <div id="td-tones"></div>
        <div id="td-roster" class="card td-empty">Loading roster…</div>
      </div>`
    inject()
    document.getElementById('td-home').addEventListener('click', () => navigate('/'))
    document.getElementById('td-copy').addEventListener('click', () => {
      navigator.clipboard?.writeText(cls.code).catch(() => {})
    })
    document.getElementById('td-class-select')?.addEventListener('change', (e) => {
      activeClassId = e.target.value
      renderShell()
      loadClassData()
    })
  }

  async function loadClassData() {
    const [statsRes, rosterRes, resultsRes] = await Promise.all([
      supabase.rpc('app_teacher_class_stats', { p_teacher_id: user.id, p_class_id: activeClassId }),
      supabase.rpc('app_teacher_roster', { p_teacher_id: user.id, p_class_id: activeClassId }),
      supabase.rpc('app_teacher_class_results', { p_teacher_id: user.id, p_class_id: activeClassId }),
    ])
    renderStats(statsRes.data)
    renderTones(resultsRes.data)
    renderRoster(rosterRes.data)
  }

  function renderStats(stats) {
    const el = document.getElementById('td-stats')
    if (!el) return
    if (!stats || stats.error) { el.textContent = 'Could not load class stats.'; return }
    const by = Object.entries(stats.by_type || {}).map(([t, s]) => `${t}×${s.attempts} (${s.avg_score_pct ?? '—'}%)`).join(' · ') || '—'
    el.className = 'card td-stats'
    el.innerHTML = `
      <div class="td-section-title">Class stats</div>
      <div class="td-stat-row"><span><strong>${stats.total_students}</strong> students</span><span><strong>${stats.results_total}</strong> attempts</span></div>
      <div class="td-stat-by">${by}</div>`
  }

  function renderTones(results) {
    const el = document.getElementById('td-tones')
    if (!el) return
    if (!Array.isArray(results)) { el.innerHTML = ''; return }
    const buckets = bucketAnswers(results)
    const keys = Object.keys(ACTIVITY_META).filter(k => buckets[k]?.length)
    if (!keys.length) { el.innerHTML = '<p class="card td-empty">No test/practice data yet for this class.</p>'; return }
    el.className = 'td-tones'
    el.innerHTML = `<div class="td-section-title">Class weak-tone distribution</div>` + keys.map((k) => {
      const answers = buckets[k]
      const analysis = analyzeBucket(k, answers)
      const score = answers.filter(a => a.correct).length
      const meta = ACTIVITY_META[k]
      return buildReportHTML({ analysis, score, total: answers.length, testLabel: meta.label, shape: meta.shape, skill: meta.skill }).html
    }).join('')
  }

  function renderRoster(roster) {
    const el = document.getElementById('td-roster')
    if (!el) return
    if (!roster || roster.error) { el.textContent = 'Could not load roster.'; return }
    if (!roster.length) { el.innerHTML = '<p class="td-empty">No students have joined yet.</p>'; return }
    el.className = 'card td-roster'
    el.innerHTML = `
      <div class="td-section-title">Roster</div>
      <div class="td-roster-table">
        <div class="td-roster-head">
          <span>Student</span><span>Joined</span><span>Last active</span><span>Attempts</span>
        </div>
        ${roster.map(s => `
          <button class="td-roster-row" data-id="${s.id}" data-username="${escapeHtml(s.username)}">
            <span>${escapeHtml(s.username)}</span>
            <span>${s.class_joined_at ? s.class_joined_at.slice(0, 10) : '—'}</span>
            <span>${s.last_activity ? s.last_activity.slice(0, 10) : 'never'}</span>
            <span>${s.total_attempts}</span>
          </button>`).join('')}
      </div>`
    el.querySelectorAll('.td-roster-row').forEach(row => row.addEventListener('click', () => {
      sessionStorage.setItem('j4t_teacher_student', JSON.stringify({ id: row.dataset.id, username: row.dataset.username }))
      navigate('/teacher-student')
    }))
  }

  function inject() {
    const style = document.createElement('style')
    style.textContent = scopedCSS + TONE_REPORT_CSS
    container.appendChild(style)
  }
}

const scopedCSS = `
  .td-title { text-align: center; font-size: 1.5rem; font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    margin-bottom: 14px; }
  .td-sub { text-align: center; color: var(--text-secondary); font-size: 0.88rem; margin: 8px 0 14px; }
  .td-empty { text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 16px; }
  .td-card { padding: 20px; }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .field label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
  .field input { width: 100%; box-sizing: border-box; padding: 12px 14px; background: var(--surface);
    border: 1px solid var(--card-border); border-radius: var(--radius-sm); color: var(--text-primary);
    font-family: inherit; font-size: 1rem; outline: none; }
  .field input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
  .td-message { font-size: 0.85rem; margin-bottom: 12px; }
  .td-message.error { color: var(--incorrect); }

  .td-select { width: 100%; margin-bottom: 14px; padding: 10px 12px; background: var(--surface);
    border: 1px solid var(--card-border); border-radius: var(--radius-sm); color: var(--text-primary);
    font-family: inherit; font-size: 0.9rem; }

  .td-code-card { padding: 16px 20px; margin-bottom: 14px; }
  .td-code-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .td-code-label { font-weight: 600; flex: 1; min-width: 100px; }
  .td-code { font-family: monospace; font-size: 1.15rem; letter-spacing: 0.1em; color: var(--accent);
    background: var(--surface); border-radius: 8px; padding: 4px 10px; }
  .td-code-sub { color: var(--text-muted); font-size: 0.78rem; margin-top: 8px; }

  .td-section-title { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--text-muted); font-weight: 600; margin: 0 0 10px; }

  .td-stats { padding: 16px 20px; margin-bottom: 14px; }
  .td-stat-row { display: flex; gap: 20px; font-size: 0.95rem; margin-bottom: 6px; }
  .td-stat-row strong { color: var(--accent); font-size: 1.1rem; }
  .td-stat-by { font-size: 0.78rem; color: var(--text-secondary); }

  .td-tones { margin-bottom: 14px; }
  .td-tones .tr-card + .tr-card { margin-top: 12px; }

  .td-roster { padding: 16px 20px; }
  .td-roster-table { display: flex; flex-direction: column; }
  .td-roster-head, .td-roster-row {
    display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 8px; align-items: center;
    padding: 8px 4px; text-align: left; font-size: 0.82rem;
  }
  .td-roster-head { color: var(--text-muted); text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.06em;
    border-bottom: 1px solid var(--card-border); }
  .td-roster-row { background: none; border: none; border-bottom: 1px solid var(--card-border);
    font-family: inherit; color: var(--text-primary); cursor: pointer; width: 100%; }
  .td-roster-row:last-child { border-bottom: none; }
  .td-roster-row:hover { background: var(--accent-glow); }

  @media (max-width: 480px) {
    .td-roster-head, .td-roster-row { grid-template-columns: 2fr 1fr 1fr; font-size: 0.72rem; }
    .td-roster-head span:nth-child(2), .td-roster-row span:nth-child(2) { display: none; }
  }
`
