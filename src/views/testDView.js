// ═══════════════════════════════════════
// Test D – Two-Character Pronunciation (coming soon)
// ═══════════════════════════════════════
import { navigate } from '../router.js'

export function testDView(container) {
  container.innerHTML = `
    <div class="app-shell">
      <div style="text-align:center;padding:60px 24px">
        <div style="font-size:3rem;margin-bottom:16px">🚧</div>
        <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:8px">Test D — Coming Soon</h1>
        <p style="color:var(--text-secondary);margin-bottom:32px">
          Two-character tone pronunciation · in development
        </p>
        <button class="btn btn-secondary" id="td-back">← Back to Home</button>
      </div>
    </div>
  `
  document.getElementById('td-back').addEventListener('click', () => navigate('/'))
}
