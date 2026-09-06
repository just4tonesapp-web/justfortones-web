// Audit every disyllable recording: transcribe with Deepgram and compare the
// AUDIO CONTENT against the manifest label (the July HSK cross-check only
// validated labels against the dictionary — a validly-named file with the
// wrong audio inside, like the 图书/chang-jiang report, slips through).
// Run: node scripts/audit-recordings.mjs
import { readFileSync, readdirSync } from 'fs'
import { DISYLLABLE_BY_PAIR, findDisyllableRecording } from '../src/utils/disyllableManifest.js'
import { findHskWord, findHskHomographs } from '../src/utils/hskDisyllabicWords.js'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const KEY = env.VITE_DEEPGRAM_API_KEY

const jobs = []
for (const [pair, items] of Object.entries(DISYLLABLE_BY_PAIR)) {
  for (const it of items) jobs.push({ pair, ...it, t1: +pair[0], t2: +pair[1] })
}
console.log(`auditing ${jobs.length} recordings…`)

const issues = []
let done = 0
async function worker() {
  while (jobs.length) {
    const j = jobs.pop()
    const rel = findDisyllableRecording(j.syl1, j.t1, j.syl2, j.t2)
    const path = `public/${rel}`
    try {
      const audio = readFileSync(path)
      const r = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=zh-CN', {
        method: 'POST', headers: { Authorization: `Token ${KEY}`, 'Content-Type': 'audio/mp4' }, body: audio,
      })
      if (!r.ok) { issues.push(`${j.pair}/${j.file}: HTTP ${r.status}`); continue }
      const d = await r.json()
      const text = d?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || ''
      const expected = findHskWord(j.syl1, j.t1, j.syl2, j.t2)
      if (!expected) { issues.push(`${j.pair}/${j.file}: no HSK word for label (heard "${text}")`); continue }
      if (!text) { issues.push(`${j.pair}/${j.file}: EMPTY transcript (expected ${expected.chars})`); continue }
      if (!text.includes(expected.chars)) {
        // tolerate homographs (deepgram may pick a same-sound different word)
        const homo = findHskHomographs(j.syl1, j.syl2).some(w => text.includes(w.chars))
        issues.push(`${j.pair}/${j.file}: expected ${expected.chars}, heard "${text}"${homo ? ' (same-syllable homograph — likely OK)' : '  ⚠️ MISMATCH'}`)
      }
    } catch (e) { issues.push(`${j.pair}/${j.file}: ${String(e).slice(0, 60)}`) }
    if (++done % 50 === 0) console.log(`  ${done} done…`)
  }
}
await Promise.all(Array.from({ length: 8 }, worker))
console.log(`\n${done} audited, ${issues.length} flagged:`)
for (const i of issues.sort()) console.log('  ' + i)
