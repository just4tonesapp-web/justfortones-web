// ═══════════════════════════════════════════════════════════════════
// /privacy — plain-language data practices (meeting item Apr 29; needed
// for the classroom pilot and any institutional conversation).
// Content mirrors the as-built facts recorded with the team 2026-06-22.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'

export function privacyView(container) {
  container.innerHTML = `
    <div class="app-shell shell-top-center">
      <div class="back-row"><button class="app-logo" id="pv-home">Just4Tones</button></div>
      <h1 class="pv-title">Privacy &amp; Data</h1>
      <div class="card pv-card">
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account:</strong> a username you choose and a password (stored hashed). <strong>No email, no real name, no phone number</strong> — we can't identify you and don't try to.</li>
          <li><strong>Results:</strong> your test and practice scores, with per-question detail (which tone was asked, what was answered), linked to your username so you can see your own history.</li>
        </ul>
        <h2>About your voice</h2>
        <ul>
          <li>Speaking exercises analyze your recording on your device and via cloud speech services (Microsoft Azure, Google, Deepgram) to detect the tone you produced.</li>
          <li><strong>Recordings are not stored.</strong> Audio is processed for recognition and discarded; only the derived result (detected tone, correct/incorrect) is saved.</li>
        </ul>
        <h2>What we don't do</h2>
        <ul>
          <li>No ads, no trackers, no analytics beyond the scores above.</li>
          <li>We never sell or share your data. Aggregate, anonymized statistics (e.g. average scores) may be used in teaching research.</li>
        </ul>
        <p class="pv-contact">Questions or deletion requests: <a href="mailto:support@fourfones.com">support@fourfones.com</a></p>
      </div>
    </div>
  `
  const style = document.createElement('style')
  style.textContent = `
    .pv-title { text-align: center; font-size: 1.5rem; font-weight: 700; margin-bottom: 16px;
      background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .pv-card { padding: 22px 24px; }
    .pv-card h2 { font-size: 0.95rem; color: var(--accent); margin: 14px 0 8px; }
    .pv-card h2:first-child { margin-top: 0; }
    .pv-card ul { margin: 0 0 4px 18px; }
    .pv-card li { font-size: 0.88rem; line-height: 1.6; color: var(--text-primary); margin-bottom: 6px; }
    .pv-contact { margin-top: 16px; font-size: 0.82rem; color: var(--text-secondary); }
    .pv-contact a { color: var(--accent); }
  `
  container.appendChild(style)
  document.getElementById('pv-home').addEventListener('click', () => navigate('/'))
}
