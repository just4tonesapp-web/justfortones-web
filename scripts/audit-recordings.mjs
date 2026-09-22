// Audit every disyllable recording: transcribe with Deepgram and compare the
// AUDIO CONTENT against the manifest label (the July HSK cross-check only
// validated labels against the dictionary — a validly-named file with the
// wrong audio inside, like the 图书/chang-jiang report, slips through).
// This checks WHICH WORD is spoken, not its tones — see audit-tones.mjs for that.
// Run: node scripts/audit-recordings.mjs          (core + advanced)
//      node scripts/audit-recordings.mjs --adv    (advanced HSK 7-9 set only)
import { readFileSync } from 'fs'
import { DISYLLABLE_BY_PAIR, DISYLLABLE_ADV_BY_PAIR } from '../src/utils/disyllableManifest.js'
import { findHskWord, findHskHomographs } from '../src/utils/hskDisyllabicWords.js'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const KEY = env.VITE_DEEPGRAM_API_KEY
const ADV_ONLY = process.argv.includes('--adv')

const jobs = []
if (!ADV_ONLY) {
  for (const [pair, items] of Object.entries(DISYLLABLE_BY_PAIR)) {
    for (const it of items) {
      const t1 = +pair[0], t2 = +pair[1]
      jobs.push({ pair, file: it.file, path: `public/audio/disyllables/${pair}/${it.file}`,
        expected: findHskWord(it.syl1, t1, it.syl2, t2)?.chars, homographs: findHskHomographs(it.syl1, it.syl2) })
    }
  }
}
// Advanced words: one job per voice take. `chars` may hold homophones joined by
// "/" (发觉/发掘 share one recording) — any of them counts as a match.
for (const [pair, items] of Object.entries(DISYLLABLE_ADV_BY_PAIR)) {
  for (const it of items) {
    for (const v of it.voices) {
      jobs.push({ pair, file: v, path: `public/audio/disyllables-adv/${pair}/${v}`,
        expected: it.chars || undefined, alternatives: (it.chars || '').split('/').filter(Boolean), homographs: [] })
    }
  }
}
console.log(`auditing ${jobs.length} recordings…`)

const issues = []
let done = 0
async function worker() {
  while (jobs.length) {
    const j = jobs.pop()
    try {
      const audio = readFileSync(j.path)
      const type = j.path.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4'
      const r = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=zh-CN', {
        method: 'POST', headers: { Authorization: `Token ${KEY}`, 'Content-Type': type }, body: audio,
      })
      if (!r.ok) { issues.push(`${j.pair}/${j.file}: HTTP ${r.status}`); continue }
      const d = await r.json()
      const text = (d?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '').replace(/\s+/g, '')
      if (!j.expected) { issues.push(`${j.pair}/${j.file}: no word for label (heard "${text}")`); continue }
      if (!text) { issues.push(`${j.pair}/${j.file}: EMPTY transcript (expected ${j.expected})`); continue }
      const wanted = j.alternatives?.length ? j.alternatives : [j.expected]
      if (!wanted.some(w => text.includes(w))) {
        // tolerate homographs (deepgram may pick a same-sound different word)
        const homo = j.homographs.some(w => text.includes(w.chars))
        issues.push(`${j.pair}/${j.file}: expected ${j.expected}, heard "${text}"${homo ? ' (same-syllable homograph — likely OK)' : '  ⚠️ MISMATCH'}`)
      }
    } catch (e) { issues.push(`${j.pair}/${j.file}: ${String(e).slice(0, 60)}`) }
    if (++done % 100 === 0) console.log(`  ${done} done…`)
  }
}
await Promise.all(Array.from({ length: 8 }, worker))
console.log(`\n${done} audited, ${issues.length} flagged:`)
for (const i of issues.sort()) console.log('  ' + i)
