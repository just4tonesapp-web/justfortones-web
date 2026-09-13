// ═══════════════════════════════════════════════════════════════════
// /teacher-student — per-student weak-tone breakdown, opened from a roster
// row on /teacher. Student is handed over via sessionStorage('j4t_teacher_student'),
// the same cross-view pattern historyView.js uses to open /attempt.
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

const TEST_LABEL = { A: 'Test 1', B: 'Test 2', C: 'Test 3', P1: 'Practice I', P2: 'Practice II', P3: 'Practice III', P4: 'Practice IV', P5: 'Practice V' }

export function teacherStudentView(container) {
  const user = getUser()
  if (!user?.is_teacher) { navigate('/'); return }

  let student = null
  try { student = JSON.parse(sessionStorage.getItem('j4t_teacher_student') || 'null') } catch { /* ignore */ }
  if (!student?.id) { navigate('/teacher'); return }

  render()
  load()

  function render() {
    container.innerHTML = `
      <div class="app-shell shell-top-center">
        <div class="back-row"><button class="app-logo" id="ts-home">Just4Tones</button></div>
        <button class="btn-link ts-back" id="ts-back">← Back to roster</button>
        <h1 class="ts-title">${escapeHtml(student.username)}</h1>
        <div id="ts-tones"><p class="ts-empty">Loading…</p></div>
        <div id="ts-history"></div>
      </div>`
    inject()
    document.getElementById('ts-home').addEventListener('click', () => navigate('/'))
    document.getElementById('ts-back').addEventListener('click', () => navigate('/teacher'))
  }

  async function load() {
    const { data } = await supabase.rpc('app_teacher_student_results', { p_teacher_id: user.id, p_student_id: student.id })
    const results = Array.isArray(data) ? data : []
    renderTones(results)
    renderHistory(results)
  }

  function renderTones(results) {
    const el = document.getElementById('ts-tones')
    if (!el) return
    const buckets = bucketAnswers(results)
    const keys = Object.keys(ACTIVITY_META).filter(k => buckets[k]?.length)
    if (!keys.length) { el.innerHTML = '<p class="card ts-empty">No test/practice data yet.</p>'; return }
    el.innerHTML = keys.map((k) => {
      const answers = buckets[k]
      const analysis = analyzeBucket(k, answers)
      const score = answers.filter(a => a.correct).length
      const meta = ACTIVITY_META[k]
      return buildReportHTML({ analysis, score, total: answers.length, testLabel: meta.label, shape: meta.shape, skill: meta.skill }).html
    }).join('')
  }

  function renderHistory(results) {
    const el = document.getElementById('ts-history')
    if (!el) return
    if (!results.length) { el.innerHTML = ''; return }
    el.innerHTML = `
      <div class="card ts-history">
        <div class="ts-section-title">All attempts</div>
        <div class="ts-history-list">
          ${results.map(r => `
            <div class="ts-history-row">
              <span class="ts-history-type">${TEST_LABEL[r.test_type] || r.test_type}</span>
              <span class="ts-history-score">${r.score}/${r.total}</span>
              <span class="ts-history-date">${(r.created_at || '').slice(0, 16).replace('T', ' ')}</span>
            </div>`).join('')}
        </div>
      </div>`
  }

  function inject() {
    const style = document.createElement('style')
    style.textContent = scopedCSS + TONE_REPORT_CSS
    container.appendChild(style)
  }
}

const scopedCSS = `
  .ts-back { display: block; margin-bottom: 10px; }
  .ts-title { font-size: 1.4rem; font-weight: 700; margin-bottom: 16px; }
  .ts-empty { text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 16px; }
  .ts-tones .tr-card + .tr-card { margin-top: 12px; }

  .ts-history { padding: 16px 20px; margin-top: 14px; }
  .ts-section-title { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--text-muted); font-weight: 600; margin-bottom: 10px; }
  .ts-history-list { display: flex; flex-direction: column; }
  .ts-history-row { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 8px;
    padding: 6px 0; border-bottom: 1px solid var(--card-border); font-size: 0.82rem; }
  .ts-history-row:last-child { border-bottom: none; }
  .ts-history-type { color: var(--text-primary); font-weight: 600; }
  .ts-history-score { color: var(--accent); }
  .ts-history-date { color: var(--text-muted); text-align: right; }
`
