// Per-user usage report — answers "how many times did user X use the app/models".
// Run locally: node scripts/usage-report.mjs
// Uses SUPABASE_SECRET_KEY from .env.local (server-side key, never in the bundle).
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.SUPABASE_SECRET_KEY
if (!URL_ || !KEY) { console.error('Missing VITE_SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local'); process.exit(1) }

const get = async (path) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`)
  return r.json()
}

const users = await get('app_users?select=id,username,created_at&order=created_at')
const results = await get('app_results?select=user_id,test_type,score,total,created_at&order=created_at')
const logs = await get('accuracy_log?select=user_id,session_id,created_at')

const byUser = new Map(users.map(u => [u.id, {
  username: u.username, signup: u.created_at.slice(0, 10),
  tests: {}, practices: {}, modelRuns: 0, sessions: new Set(), lastActive: null,
}]))

for (const r of results) {
  const u = byUser.get(r.user_id); if (!u) continue
  const bucket = r.test_type.startsWith('P') ? u.practices : u.tests
  bucket[r.test_type] = (bucket[r.test_type] || 0) + 1
  if (!u.lastActive || r.created_at > u.lastActive) u.lastActive = r.created_at
}
let guestRuns = 0
for (const l of logs) {
  const u = byUser.get(l.user_id)
  if (!u) { guestRuns++; continue }
  u.modelRuns++
  u.sessions.add(l.session_id)
  if (!u.lastActive || l.created_at > u.lastActive) u.lastActive = l.created_at
}

const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}×${v}`).join(' ') || '—'
console.log('username           signup      tests           practices       modelRuns  T3sessions  lastActive')
console.log('─'.repeat(110))
for (const u of [...byUser.values()].sort((a, b) => (b.lastActive || '') < (a.lastActive || '') ? -1 : 1)) {
  console.log(
    u.username.padEnd(19) + u.signup.padEnd(12) + fmt(u.tests).padEnd(16) + fmt(u.practices).padEnd(16)
    + String(u.modelRuns).padEnd(11) + String(u.sessions.size).padEnd(12) + (u.lastActive?.slice(0, 16) || '—')
  )
}
console.log('─'.repeat(110))
console.log(`${users.length} users · ${results.length} results · ${logs.length} model runs (${guestRuns} from guests/anonymous)`)
