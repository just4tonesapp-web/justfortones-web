// ═══════════════════════════════════════════════════════════════════
// /join-class — student-facing class enrollment. A student's class_id is a
// single column on app_users (one class at a time, matches the pilot's
// actual scale) set via the app_join_class RPC. Entering a different code
// simply switches classes.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'
import { supabase } from '../supabaseClient.js'

function getUser() {
  try { return JSON.parse(localStorage.getItem('j4t_user') || 'null') } catch { return null }
}
function setUser(u) { localStorage.setItem('j4t_user', JSON.stringify(u)) }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export function joinClassView(container) {
  const user = getUser()
  if (!user) { navigate('/login'); return }

  render()

  function render(message) {
    container.innerHTML = `
      <div class="app-shell shell-top-center">
        <div class="back-row"><button class="app-logo" id="jc-home">Just4Tones</button></div>
        <h1 class="jc-title">My Class</h1>
        ${user.class_id ? `
          <div class="card jc-current-card">
            <p class="jc-current">You're in <strong>${escapeHtml(user.class_name || 'a class')}</strong></p>
            <p class="jc-code-sub">Class code: <code>${escapeHtml(user.class_code || '')}</code></p>
          </div>
          <p class="jc-sub">Joined the wrong class? Enter a different code below to switch.</p>
        ` : `
          <p class="jc-sub">Enter the class code your teacher shared with you.</p>
        `}
        <div class="card jc-card">
          <div class="field">
            <label for="jc-code">Class code</label>
            <input type="text" id="jc-code" placeholder="e.g. AB12CD" autocapitalize="characters" autocomplete="off" maxlength="8" />
          </div>
          ${message ? `<p class="jc-message ${message.error ? 'error' : 'success'}">${escapeHtml(message.text)}</p>` : ''}
          <button class="btn btn-primary btn-lg jc-submit" id="jc-submit">${user.class_id ? 'Switch class' : 'Join class'}</button>
        </div>
      </div>
    `
    inject()
    document.getElementById('jc-home').addEventListener('click', () => navigate('/'))
    document.getElementById('jc-submit').addEventListener('click', handleJoin)
    document.getElementById('jc-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleJoin() })
  }

  async function handleJoin() {
    const code = document.getElementById('jc-code').value.trim()
    if (!code) { render({ error: true, text: 'Enter a class code.' }); return }
    const btn = document.getElementById('jc-submit')
    btn.disabled = true
    btn.textContent = 'Joining…'
    try {
      const { data, error } = await supabase.rpc('app_join_class', { p_user_id: user.id, p_code: code })
      if (error) throw error
      if (!data || data.error) {
        const MSG = {
          'invalid code': "That code doesn't match a class.",
          'invalid user': 'Your session has expired — please log in again.',
          'you are the teacher of this class': "That's your own class — open the Teacher Dashboard instead.",
        }
        render({ error: true, text: MSG[data?.error] || 'Something went wrong.' })
        return
      }
      setUser({ ...user, class_id: data.class_id, class_name: data.class_name, class_code: data.class_code })
      navigate('/')
    } catch {
      render({ error: true, text: "Can't reach the server right now. Try again." })
    }
  }

  function inject() {
    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)
  }
}

const scopedCSS = `
  .jc-title { text-align: center; font-size: 1.5rem; font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    margin-bottom: 14px; }
  .jc-sub { text-align: center; color: var(--text-secondary); font-size: 0.88rem; margin: 8px 0 14px; }
  .jc-current-card { text-align: center; padding: 16px 20px; }
  .jc-current { font-size: 0.98rem; }
  .jc-code-sub { color: var(--text-secondary); font-size: 0.82rem; margin-top: 4px; }
  .jc-code-sub code { background: var(--surface); border-radius: 6px; padding: 2px 8px; letter-spacing: 0.06em; }
  .jc-card { padding: 20px; }
  .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .field label { font-size: 0.82rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
  .field input { padding: 12px 14px; background: var(--surface); border: 1px solid var(--card-border);
    border-radius: var(--radius-sm); color: var(--text-primary); font-family: inherit; font-size: 1.05rem;
    letter-spacing: 0.08em; text-transform: uppercase; outline: none; }
  .field input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
  .jc-message { font-size: 0.85rem; margin-bottom: 12px; }
  .jc-message.error { color: var(--incorrect); }
  .jc-message.success { color: var(--correct); }
  .jc-submit { width: 100%; }
  .jc-submit:disabled { opacity: 0.6; cursor: not-allowed; }
`
