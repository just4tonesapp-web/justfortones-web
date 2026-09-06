// ═══════════════════════════════════════════════════════════════════
// /status — live health dashboard (team-facing, unlisted).
// Probes every external dependency FROM THE BROWSER (so it tests exactly
// what students' browsers experience: keys, CORS, referrer restrictions),
// plus live DB aggregates and build info.
// ═══════════════════════════════════════════════════════════════════
import { navigate } from '../router.js'

const SUPABASE = import.meta.env.VITE_SUPABASE_URL
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_SPEECH_API_KEY
const DG_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY

function beepWav(sec = 0.3) {
  const n = Math.floor(16000 * sec), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf)
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 16000 * 2 * Math.PI * 220) * 8000, true)
  return buf
}

// name → async () => ({ ok, note })
const PROBES = {
  'Supabase 数据库': async () => {
    const r = await fetch(`${SUPABASE}/rest/v1/rpc/app_login`, {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_username: '__status__', p_password: '__status__' }),
    })
    const t = await r.text()
    return { ok: r.ok && t.includes('invalid'), note: r.ok ? '登录/存储 RPC 正常' : `HTTP ${r.status}` }
  },
  'Azure 语音（服务端代理）': async () => {
    const r = await fetch(`${SUPABASE}/functions/v1/azure-stt`, {
      method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'audio/wav' }, body: beepWav(),
    })
    return { ok: r.ok, note: r.ok ? '代理+Azure key 正常' : `HTTP ${r.status}（查 Edge Function / AZURE_SPEECH_KEY）` }
  },
  'Google 语音识别': async () => {
    if (!GOOGLE_KEY) return { ok: false, note: '未配置 key' }
    const r = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    const d = await r.json().catch(() => ({}))
    const msg = d?.error?.message || ''
    if (msg.includes('RecognitionAudio')) return { ok: true, note: 'key 有效（含本域名白名单）' }
    return { ok: false, note: msg.slice(0, 60) || `HTTP ${r.status}` }
  },
  'Deepgram 语音识别': async () => {
    if (!DG_KEY) return { ok: false, note: '未配置 key' }
    const r = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=zh-CN', {
      method: 'POST', headers: { Authorization: `Token ${DG_KEY}`, 'Content-Type': 'audio/wav' }, body: beepWav(),
    })
    return { ok: r.ok, note: r.ok ? 'key 有效' : `HTTP ${r.status}` }
  },
  '音频资源 (CDN)': async () => {
    const r = await fetch(`${import.meta.env.BASE_URL}audio/syllables/ma1.m4a`, { method: 'HEAD' })
    return { ok: r.ok, note: r.ok ? '录音文件可达' : `HTTP ${r.status}` }
  },
}

// Static rows — availability is a build-time fact, not a network probe.
const STATIC_ROWS = [
  ['Groq / OpenRouter', false, '未配置 key（Groq 待服务端代理；OpenRouter 会议标记暂不用）'],
  ['端上模型 Pitch', true, '打包内置，永远可用'],
  ['端上模型 Whisper/Classifier', true, '进入 Test 3 时按需加载（约 90MB，慢属正常）'],
]

const FEATURES = [
  ['Test 1 听辨单音节', '/test-1'], ['Test 2 听辨双音节', '/test-2'], ['Test 3 发音测试', '/test-3'],
  ['练习 I 听辨', '/practice-1'], ['练习 II 发音', '/practice-2'], ['练习 III 变调', '/practice-3'],
  ['练习 IV 多音字', '/practice-4'], ['练习 V 认字', '/practice-5'],
  ['综合报告', '/report'], ['历史记录', '/history'],
]

export function statusView(container) {
  container.innerHTML = `
    <div class="app-shell shell-top-center">
      <div class="back-row"><button class="app-logo" id="st-home">Just4Tones</button></div>
      <h1 class="st-title">系统状态</h1>
      <p class="st-sub">构建 ${typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : 'dev'} · 探测自你的浏览器（真实用户视角）</p>

      <div class="card st-card">
        <div class="st-section">服务与模型</div>
        <div id="st-probes">${Object.keys(PROBES).map(n => `
          <div class="st-row" id="st-${btoa(unescape(encodeURIComponent(n))).replace(/[^a-z0-9]/gi, '')}">
            <span class="st-dot pending"></span><span class="st-name">${n}</span><span class="st-note">检测中…</span>
          </div>`).join('')}
          ${STATIC_ROWS.map(([n, ok, note]) => `
          <div class="st-row"><span class="st-dot ${ok ? 'ok' : 'off'}"></span><span class="st-name">${n}</span><span class="st-note">${note}</span></div>`).join('')}
        </div>

        <div class="st-section">数据库实时统计</div>
        <div id="st-analytics" class="st-analytics">读取中…</div>

        <div class="st-section">功能入口</div>
        <div class="st-features">${FEATURES.map(([n, r]) => `<button class="st-feat" data-nav="${r}">${n}</button>`).join('')}</div>
      </div>
      <p class="st-refresh"><button class="btn-link" id="st-reload">重新检测</button></p>
    </div>
  `
  const style = document.createElement('style')
  style.textContent = scopedCSS
  container.appendChild(style)

  document.getElementById('st-home').addEventListener('click', () => navigate('/'))
  document.getElementById('st-reload').addEventListener('click', () => statusView(container))
  container.querySelectorAll('.st-feat').forEach(b => b.addEventListener('click', () => navigate(b.dataset.nav)))

  for (const [name, probe] of Object.entries(PROBES)) {
    const id = 'st-' + btoa(unescape(encodeURIComponent(name))).replace(/[^a-z0-9]/gi, '')
    const t0 = performance.now()
    probe().then(({ ok, note }) => {
      const el = document.getElementById(id)
      if (!el) return
      el.querySelector('.st-dot').className = `st-dot ${ok ? 'ok' : 'bad'}`
      el.querySelector('.st-note').textContent = `${note} · ${Math.round(performance.now() - t0)}ms`
    }).catch(e => {
      const el = document.getElementById(id)
      if (!el) return
      el.querySelector('.st-dot').className = 'st-dot bad'
      el.querySelector('.st-note').textContent = String(e).slice(0, 60)
    })
  }

  fetch(`${SUPABASE}/rest/v1/rpc/app_analytics`, {
    method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: '{}',
  }).then(r => r.json()).then(d => {
    const by = Object.entries(d.by_type || {}).map(([t, s]) => `${t}×${s.attempts}`).join(' · ') || '—'
    document.getElementById('st-analytics').innerHTML = `
      <span><strong>${d.total_users}</strong> 注册用户</span>
      <span><strong>${d.results_total}</strong> 条成绩</span>
      <span><strong>${d.accuracy_log_rows}</strong> 次模型判分</span>
      <span class="st-by">${by}</span>
      <span class="st-last">最近活动 ${d.last_activity ? d.last_activity.slice(0, 16).replace('T', ' ') : '—'} UTC</span>`
  }).catch(() => {
    document.getElementById('st-analytics').textContent = '读取失败（数据库不可达？）'
  })
}

const scopedCSS = `
  .st-title { text-align: center; font-size: 1.5rem; font-weight: 700;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .st-sub { text-align: center; color: var(--text-muted); font-size: 0.75rem; margin: 6px 0 18px; }
  .st-card { padding: 18px 20px; }
  .st-section { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--text-muted); font-weight: 600; margin: 14px 0 8px; }
  .st-section:first-child { margin-top: 0; }
  .st-row { display: flex; align-items: center; gap: 10px; padding: 7px 0;
    border-bottom: 1px solid var(--card-border); font-size: 0.85rem; }
  .st-row:last-child { border-bottom: none; }
  .st-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .st-dot.ok { background: var(--correct); box-shadow: 0 0 8px var(--correct); }
  .st-dot.bad { background: var(--incorrect); box-shadow: 0 0 8px var(--incorrect); }
  .st-dot.off { background: var(--text-muted); opacity: 0.5; }
  .st-dot.pending { background: var(--accent); animation: stpulse 1s infinite; }
  @keyframes stpulse { 50% { opacity: 0.3; } }
  .st-name { flex: 0 0 200px; color: var(--text-primary); }
  .st-note { color: var(--text-secondary); font-size: 0.78rem; }
  .st-analytics { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 0.85rem; color: var(--text-secondary); }
  .st-analytics strong { color: var(--accent); font-size: 1.05rem; }
  .st-by, .st-last { flex-basis: 100%; font-size: 0.75rem; color: var(--text-muted); }
  .st-features { display: flex; flex-wrap: wrap; gap: 6px; }
  .st-feat { background: var(--surface); border: 1px solid var(--card-border); border-radius: 14px;
    padding: 5px 11px; font-family: inherit; font-size: 0.75rem; color: var(--text-secondary); cursor: pointer; }
  .st-feat:hover { border-color: var(--accent); color: var(--accent); }
  .st-refresh { text-align: center; margin-top: 14px; }
  @media (max-width: 480px) { .st-name { flex-basis: 140px; } }
`
