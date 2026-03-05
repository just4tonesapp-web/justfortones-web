// ═══════════════════════════════════════
// Auth view – Login / Sign up
// ═══════════════════════════════════════
import { supabase } from '../supabaseClient.js'
import { navigate } from '../router.js'

export function authView(container) {
  let isLogin = true
  let loading = false

  render()

  function render() {
    container.innerHTML = `
      <div class="app-shell">
        <header class="auth-header">
          <h1 class="auth-title">Just4Tones</h1>
          <p class="auth-subtitle">Master the four tones of Mandarin Chinese</p>
        </header>

        <div class="card animate-in auth-card">
          <div class="auth-tabs">
            <button class="auth-tab ${isLogin ? 'active' : ''}" id="tab-login">Log In</button>
            <button class="auth-tab ${!isLogin ? 'active' : ''}" id="tab-signup">Sign Up</button>
          </div>

          <div id="auth-message" class="auth-message hidden"></div>

          <div class="auth-form">
            <div class="field">
              <label for="auth-email">Email</label>
              <input type="email" id="auth-email" placeholder="you@example.com" autocomplete="email" />
            </div>
            <div class="field">
              <label for="auth-pass">Password</label>
              <input type="password" id="auth-pass" placeholder="At least 6 characters" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />
            </div>
            <button class="btn btn-primary btn-lg auth-submit" id="auth-submit">
              ${isLogin ? 'Log In' : 'Create Account'}
            </button>
          </div>

          <div class="auth-divider"><span>or</span></div>

          <button class="btn btn-secondary btn-lg auth-guest" id="auth-guest">
            Continue as Guest
          </button>
          <p class="auth-guest-note">Guest progress won't be saved across devices</p>
        </div>
      </div>
    `

    // Inject scoped styles
    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)

    // Bind events
    document.getElementById('tab-login').addEventListener('click', () => {
      isLogin = true; render()
    })
    document.getElementById('tab-signup').addEventListener('click', () => {
      isLogin = false; render()
    })
    document.getElementById('auth-submit').addEventListener('click', handleSubmit)
    document.getElementById('auth-guest').addEventListener('click', handleGuest)

    // Enter key submits
    document.getElementById('auth-pass').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSubmit()
    })
  }

  function showMessage(text, isError = false) {
    const el = document.getElementById('auth-message')
    el.textContent = text
    el.className = `auth-message ${isError ? 'error' : 'success'}`
  }

  function setLoading(state) {
    loading = state
    const btn = document.getElementById('auth-submit')
    if (btn) {
      btn.disabled = state
      btn.textContent = state ? 'Please wait…' : (isLogin ? 'Log In' : 'Create Account')
    }
  }

  async function handleSubmit() {
    if (loading) return
    const email = document.getElementById('auth-email').value.trim()
    const pass = document.getElementById('auth-pass').value

    if (!email || !pass) {
      showMessage('Please enter both email and password.', true)
      return
    }
    if (pass.length < 6) {
      showMessage('Password must be at least 6 characters.', true)
      return
    }

    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
        if (error) throw error
        navigate('/')
      } else {
        const { error } = await supabase.auth.signUp({ email, password: pass })
        if (error) throw error
        showMessage('Account created! Check your email to confirm, then log in.', false)
        isLogin = true
        setLoading(false)
      }
    } catch (err) {
      showMessage(err.message || 'Something went wrong.', true)
      setLoading(false)
    }
  }

  function handleGuest() {
    // Store a guest flag in sessionStorage so the app knows
    sessionStorage.setItem('j4t_guest', '1')
    navigate('/')
  }
}

// ═══════════════════════════════════════
// Scoped CSS
// ═══════════════════════════════════════
const scopedCSS = `
  .auth-header {
    text-align: center;
    margin-bottom: 32px;
    padding-top: 24px;
  }
  .auth-title {
    font-size: 2.4rem;
    font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .auth-subtitle {
    color: var(--text-secondary);
    font-size: 1rem;
    margin-top: 6px;
  }

  .auth-card {
    max-width: 420px;
    margin: 0 auto;
  }

  /* Tabs */
  .auth-tabs {
    display: flex;
    border-bottom: 1px solid var(--card-border);
    margin: -8px -24px 24px;
    padding: 0 24px;
  }
  .auth-tab {
    flex: 1;
    padding: 12px 0;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .auth-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .auth-tab:hover:not(.active) {
    color: var(--text-secondary);
  }

  /* Message */
  .auth-message {
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    margin-bottom: 16px;
    line-height: 1.4;
  }
  .auth-message.error {
    background: var(--incorrect-bg);
    color: var(--incorrect);
    border: 1px solid rgba(248,113,113,0.3);
  }
  .auth-message.success {
    background: var(--correct-bg);
    color: var(--correct);
    border: 1px solid rgba(74,222,128,0.3);
  }

  /* Form */
  .auth-form { display: flex; flex-direction: column; gap: 16px; }

  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .field input {
    padding: 12px 14px;
    background: var(--surface);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.95rem;
    transition: border-color 0.2s;
    outline: none;
  }
  .field input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .field input::placeholder {
    color: var(--text-muted);
  }

  .auth-submit {
    margin-top: 4px;
    width: 100%;
  }
  .auth-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }

  /* Divider */
  .auth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 24px 0;
    color: var(--text-muted);
    font-size: 0.82rem;
  }
  .auth-divider::before,
  .auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--card-border);
  }

  /* Guest */
  .auth-guest { width: 100%; }
  .auth-guest-note {
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 8px;
  }

  @media (max-width: 480px) {
    .auth-card { padding: 24px 16px; }
    .auth-tabs { margin: -8px -16px 24px; padding: 0 16px; }
  }
`