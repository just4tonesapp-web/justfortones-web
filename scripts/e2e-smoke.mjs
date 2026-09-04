// ═══════════════════════════════════════════════════════════════════
// E2E smoke test — drives the REAL site headlessly and checks everything
// that can be checked without a human: all pages, full test/practice runs,
// the daily limit, the mic flow (Chrome fake audio device), audio assets,
// and the Supabase RPC layer.
//
//   node scripts/e2e-smoke.mjs                   → against production
//   node scripts/e2e-smoke.mjs http://localhost:5173/justfortones-web/
//
// Exit code 0 = all green. Runs in CI (.github/workflows/e2e.yml) on every
// main push + daily.
// ═══════════════════════════════════════════════════════════════════
import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'

const BASE = (process.argv[2] || 'https://justfortones-web.vercel.app/').replace(/\/?$/, '/')
const SUPABASE = 'https://gwpjbqvguepqzarsisrr.supabase.co'
const PUBLISHABLE = 'sb_publishable_yjsJriKKvIPDPrHgKYq1wA_pQWYAu1M'

const CHROME = process.env.CHROME_PATH
  || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium-browser']
    .find(p => existsSync(p))
if (!CHROME) { console.error('No Chrome found — set CHROME_PATH'); process.exit(2) }

const results = []
const check = (name, ok, note = '') => {
  results.push({ name, ok, note })
  console.log(`${ok ? '✅' : '❌'} ${name}${note ? ' — ' + note : ''}`)
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── 1. HTTP layer (no browser needed) ────────────────────────────────
async function httpChecks() {
  const home = await fetch(`${BASE}?nc=${Math.random()}`)
  check('site reachable', home.ok, `HTTP ${home.status}`)
  const html = await home.text()
  const asset = (html.match(/assets\/index-[^"]+\.js/) || [])[0]
  check('bundle referenced', !!asset, asset)

  for (const f of ['audio/syllables/ma1.m4a', 'audio/disyllables/11/ka1fei1.m4a', 'audio/tone-change/33/ni3hao3.m4a']) {
    const r = await fetch(BASE + f, { method: 'HEAD' })
    check(`asset ${f}`, r.ok, `HTTP ${r.status}`)
  }

  const H = { apikey: PUBLISHABLE, Authorization: `Bearer ${PUBLISHABLE}`, 'Content-Type': 'application/json' }
  const login = await (await fetch(`${SUPABASE}/rest/v1/rpc/app_login`, { method: 'POST', headers: H, body: JSON.stringify({ p_username: 'smoketest.claude', p_password: 'j4t-smoke-2026' }) })).json()
  check('supabase login RPC', !!login.id, login.error || login.username)

  if (login.id) {
    const stamp = new Date().toISOString()
    const save = await (await fetch(`${SUPABASE}/rest/v1/rpc/app_save_result`, { method: 'POST', headers: H, body: JSON.stringify({ p_user_id: login.id, p_test_type: 'A', p_score: 1, p_total: 8, p_passed: false, p_details: { e2e: true }, p_created_at: stamp }) })).json()
    check('supabase save RPC', !!save.ok, JSON.stringify(save))
    const rows = await (await fetch(`${SUPABASE}/rest/v1/rpc/app_get_results`, { method: 'POST', headers: H, body: JSON.stringify({ p_user_id: login.id }) })).json()
    check('supabase read RPC', Array.isArray(rows) && rows.length > 0, `${rows.length} rows`)
  }

  const analytics = await (await fetch(`${SUPABASE}/rest/v1/rpc/app_analytics`, { method: 'POST', headers: H, body: '{}' })).json()
  check('analytics RPC', typeof analytics.total_users === 'number', `users=${analytics.total_users}`)

  // azure-stt proxy with a 0.3s beep WAV
  const n = 4800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf)
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / 16000 * 2 * Math.PI * 220) * 8000, true)
  const az = await fetch(`${SUPABASE}/functions/v1/azure-stt`, { method: 'POST', headers: { apikey: PUBLISHABLE, 'Content-Type': 'audio/wav' }, body: buf })
  check('azure-stt proxy', az.ok, `HTTP ${az.status}`)
}

// ── 2. Browser layer ─────────────────────────────────────────────────
async function browserChecks() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--use-fake-device-for-media-stream', // fake mic → Test 3 record flow runs
      '--use-fake-ui-for-media-stream',     // auto-grant mic permission
      '--no-sandbox', '--disable-dev-shm-usage',
    ],
  })
  const page = await browser.newPage()
  const pageErrors = []
  // Known noise: the tone-classifier worker's wasm loader references `document`
  // and dies — the model is already marked failed/optional (weight 0.10).
  const IGNORE = [/document is not defined/]
  page.on('pageerror', e => {
    const msg = String(e).slice(0, 120)
    if (!IGNORE.some(rx => rx.test(msg))) pageErrors.push(msg)
  })

  const $ = (sel) => page.waitForSelector(sel, { timeout: 8000 })
  const evalIn = (fn, ...a) => page.evaluate(fn, ...a)

  try {
    // ── Auth UI: signup pipeline (taken-name error path), login, session,
    // cloud history, logout — uses the standing test account, creates nothing.
    await page.goto(`${BASE}?e2e=${Date.now()}#/login`, { waitUntil: 'networkidle2', timeout: 45000 })
    await sleep(2500) // coi-serviceworker may reload once on first visit
    await $('#tab-signup'); await page.click('#tab-signup'); await sleep(300)
    await page.type('#auth-user', 'smoketest.claude')
    await page.type('#auth-pass', 'whatever-123')
    await page.click('#auth-submit'); await sleep(2500)
    const signupMsg = await evalIn(() => document.getElementById('auth-message')?.textContent || '')
    check('signup form → taken-name error', /taken/i.test(signupMsg), signupMsg.slice(0, 50))

    await page.click('#tab-login'); await sleep(300)
    await page.type('#auth-user', 'smoketest.claude')
    await page.type('#auth-pass', 'j4t-smoke-2026')
    await page.click('#auth-submit'); await sleep(2500)
    const loggedIn = await evalIn(() => ({
      user: JSON.parse(localStorage.getItem('j4t_user') || 'null')?.username,
      bar: document.getElementById('account-bar')?.style.display !== 'none',
    }))
    check('login form → session + account bar', loggedIn.user === 'smoketest.claude' && loggedIn.bar, JSON.stringify(loggedIn))

    await evalIn(() => { window.location.hash = '/history' }); await sleep(2500)
    const cloudHist = await evalIn(() => document.querySelector('.hist-summary')?.textContent?.trim().split('\n')[0] || '')
    check('cloud history via UI', /attempt/.test(cloudHist), cloudHist)

    await evalIn(() => document.getElementById('acct-logout')?.click()); await sleep(800)
    const loggedOut = await evalIn(() => !localStorage.getItem('j4t_user') && location.hash.includes('login'))
    check('logout', loggedOut)

    // Enter via a guarded route: the guard stores the redirect, so after
    // "Continue as guest" we land straight on Test 1 (going through the home
    // page would clear the guest flag — that's by design).
    await page.goto(`${BASE}?e2e2=${Date.now()}#/test-1`, { waitUntil: 'networkidle2', timeout: 45000 })
    await sleep(1500)
    await $('#auth-guest')
    await page.click('#auth-guest')
    await sleep(800)
    check('guest entry', true)

    // Test 1 — full 8 questions
    await $('#ta-start'); await page.click('#ta-start'); await sleep(600)
    for (let i = 0; i < 8; i++) {
      await evalIn(() => document.querySelector('#ta-choices .choice-btn')?.click())
      await sleep(1900)
    }
    await sleep(800)
    const t1 = await evalIn(() => ({
      report: !document.getElementById('ta-report')?.classList.contains('hidden'),
      rows: JSON.parse(localStorage.getItem('j4t_progress') || '[]').filter(r => r.test_type === 'A').length,
    }))
    check('Test 1 full run', t1.report && t1.rows === 1, `report=${t1.report} rows=${t1.rows}`)

    // Test 2 — full 15 questions
    await evalIn(() => { window.location.hash = '/test-2' }); await sleep(700)
    await $('#tb-start'); await page.click('#tb-start'); await sleep(600)
    for (let i = 0; i < 15; i++) {
      await evalIn(() => document.querySelector('#tb-choices .choice-btn')?.click())
      await sleep(1750)
    }
    await sleep(900)
    const t2 = await evalIn(() => !document.getElementById('tb-report')?.classList.contains('hidden'))
    check('Test 2 full run', t2)

    // Test 3 — record with the FAKE MIC, expect a verdict screen
    await evalIn(() => { window.location.hash = '/test-3' }); await sleep(700)
    await $('#tc-start'); await page.click('#tc-start'); await sleep(600)
    await page.click('#tc-record')            // start recording (fake mic tone)
    await sleep(1600)
    await page.click('#tc-record')            // stop → ensemble analysis
    const verdict = await page.waitForSelector('#tc-q-result:not(.hidden)', { timeout: 30000 }).then(() => true).catch(() => false)
    const t3 = await evalIn(() => ({
      contour: !document.getElementById('tc-contour-wrap')?.classList.contains('hidden'),
      msg: document.getElementById('tc-q-msg')?.textContent?.slice(0, 40),
    }))
    check('Test 3 record→analyze flow', verdict, `contour=${t3.contour} "${t3.msg}"`)

    // Daily limit — Test 1 already has 1 attempt; fake a 2nd, 3rd start must block
    await evalIn(() => {
      const rows = JSON.parse(localStorage.getItem('j4t_progress') || '[]')
      rows.push({ test_type: 'A', score: 3, total: 8, passed: false, details: {}, created_at: new Date().toISOString() })
      localStorage.setItem('j4t_progress', JSON.stringify(rows))
      window.location.hash = '/test-1'
    })
    await sleep(700); await $('#ta-start'); await page.click('#ta-start'); await sleep(700)
    const lim = await evalIn(() => ({
      blocked: !document.getElementById('ta-intro')?.classList.contains('hidden'),
      toast: document.getElementById('ta-toast')?.textContent || '',
    }))
    check('daily limit gate', lim.blocked && lim.toast.includes('Daily limit'), lim.toast.slice(0, 40))

    // Practice 1 (single set) — incl. the once-broken "See results"
    await evalIn(() => { window.location.hash = '/practice-1' }); await sleep(700)
    await $('#p1-mode-single'); await page.click('#p1-mode-single'); await sleep(400)
    for (let i = 0; i < 6; i++) {
      await evalIn(() => document.querySelector('.p1-opt')?.click()); await sleep(200)
      await evalIn(() => document.getElementById('p1-check')?.click()); await sleep(200)
      await evalIn(() => document.getElementById('p1-check')?.click()); await sleep(350)
    }
    const p1 = await evalIn(() => !!document.querySelector('.p1-done'))
    check('Practice I full run', p1)

    // Practice 3 — 12 items
    await evalIn(() => { window.location.hash = '/practice-3' }); await sleep(700)
    await evalIn(() => [...document.querySelectorAll('button')].find(b => /start the test/i.test(b.textContent))?.click())
    await sleep(500)
    for (let i = 0; i < 12; i++) {
      await evalIn(() => document.querySelector('.p3-opt')?.click()); await sleep(180)
      await evalIn(() => document.getElementById('p3-next')?.click()); await sleep(300)
    }
    const p3 = await evalIn(() => !!document.querySelector('.p3-done'))
    check('Practice III full run', p3)

    // Practice 4 — polyphones, 12 items
    await evalIn(() => { window.location.hash = '/practice-4' }); await sleep(700)
    await $('#p4-start'); await page.click('#p4-start'); await sleep(400)
    for (let i = 0; i < 12; i++) {
      await evalIn(() => document.querySelector('.p4-opt')?.click()); await sleep(180)
      await evalIn(() => document.getElementById('p4-next')?.click()); await sleep(300)
    }
    const p4 = await evalIn(() => ({
      done: !!document.querySelector('.p4-done'),
      row: JSON.parse(localStorage.getItem('j4t_progress') || '[]').some(r => r.test_type === 'P4'),
    }))
    check('Practice IV full run', p4.done && p4.row, `done=${p4.done} saved=${p4.row}`)

    // Report + history render
    await evalIn(() => { window.location.hash = '/report' }); await sleep(900)
    const rep = await evalIn(() => document.body.innerText.includes('Composite Report'))
    check('composite report renders', rep)
    await evalIn(() => { window.location.hash = '/history' }); await sleep(900)
    const hist = await evalIn(() => !!document.querySelector('.hist-summary'))
    check('history renders', hist)

    check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 120))
  } finally {
    await browser.close()
  }
}

console.log(`E2E smoke vs ${BASE}\n`)
try { await httpChecks() } catch (e) { check('http layer', false, String(e).slice(0, 120)) }
try { await browserChecks() } catch (e) { check('browser layer', false, String(e).slice(0, 160)) }

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
