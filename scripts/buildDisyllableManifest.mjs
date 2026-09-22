import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = '/Users/homer/Documents/justfortones-web/public/audio/disyllables'
const ADV_ROOT = '/Users/homer/Documents/justfortones-web/public/audio/disyllables-adv' // HSK 7-9 (Jul 8 decision)
const OUT = '/Users/homer/Documents/justfortones-web/src/utils/disyllableManifest.js'

// Core (human recordings, HSK 1-3):  disyllables/<pair>/<syl1><t1><syl2><t2>.m4a
// Most files match that; "(2)"-style duplicates are deduped.
const FN_RE = /^([a-z]+)([1-5])([a-z]+)([1-5])(?:\s*\(\d+\))?\.m4a$/i
// Advanced (HSK 7-9, Test 2 only):   disyllables-adv/<pair>/<syl1><t1><syl2><t2>[.<voice>].(mp3|m4a)
// One file per voice take; the characters come from disyllables-adv/words.tsv.
const ADV_RE = /^([a-z]+)([1-5])([a-z]+)([1-5])(?:\.([a-z]+))?\.(mp3|m4a)$/i

const byPair = {}
const skipped = []

for (const dir of readdirSync(ROOT).sort()) {
  if (!/^[1-4]{2}$/.test(dir)) continue
  const files = readdirSync(join(ROOT, dir)).filter(f => f.endsWith('.m4a'))
  byPair[dir] = []
  const seenSyls = new Set()
  for (const f of files) {
    const m = f.match(FN_RE)
    if (!m) { skipped.push(`${dir}/${f}`); continue }
    const syl1 = m[1].toLowerCase()
    const syl2 = m[3].toLowerCase()
    const key = `${syl1}|${syl2}`
    if (seenSyls.has(key)) continue   // dedupe (e.g., "(2)" variants)
    seenSyls.add(key)
    byPair[dir].push({ syl1, syl2, file: f })
  }
}

// Advanced words live in their OWN map so the practices — which iterate
// DISYLLABLE_BY_PAIR — keep drawing familiar words. Only Test 2 reads this one.
// Both TSVs are edited by hand: tolerate CRLF/CR endings and stray spaces/caps.
const readTsv = (name) => readFileSync(join(ADV_ROOT, name), 'utf8').split(/\r\n|\r|\n/).slice(1)
  .map(l => l.split('\t').map(c => c.trim())).filter(([pair, key]) => pair && key)
  .map(([pair, key, ...rest]) => [pair, key.toLowerCase(), ...rest])
const chars = {}
try {
  for (const [pair, key, word] of readTsv('words.tsv')) chars[`${pair}/${key}`] = word
} catch { /* no word list yet */ }
// quarantine.tsv — words kept OUT of Test 2 (audio stays on disk). Each line says
// why; delete the line and rebuild to restore a word once someone has listened.
const quarantined = new Map()
try {
  for (const [pair, key, , reason] of readTsv('quarantine.tsv')) quarantined.set(`${pair}/${key}`, reason || '')
} catch { /* nothing quarantined */ }
const removed = new Set()

const advByPair = {}
let advFiles = 0
let advDirs = []
try { advDirs = readdirSync(ADV_ROOT).filter(d => /^[1-4]{2}$/.test(d)).sort() } catch { /* none yet */ }
for (const dir of advDirs) {
  const byKey = {}
  for (const f of readdirSync(join(ADV_ROOT, dir)).sort()) {
    const m = f.match(ADV_RE)
    if (!m) { if (!f.startsWith('.')) skipped.push(`adv/${dir}/${f}`); continue }
    if (`${m[2]}${m[4]}` !== dir) { skipped.push(`adv/${dir}/${f} (tones ≠ folder)`); continue }
    const key = `${m[1]}${m[2]}${m[3]}${m[4]}`.toLowerCase()
    byKey[key] ||= { syl1: m[1].toLowerCase(), syl2: m[3].toLowerCase(), file: key, voices: [] }
    byKey[key].voices.push(f)
    advFiles++
  }
  advByPair[dir] = Object.values(byKey)
    .filter(e => !(quarantined.has(`${dir}/${e.file}`) && removed.add(`${dir}/${e.file}`)))
    .map(e => ({ ...e, chars: chars[`${dir}/${e.file}`] || '' }))
}

const allCombos = []
for (const [pair, items] of Object.entries(byPair)) {
  for (const it of items) allCombos.push(`${it.syl1}${pair[0]}${it.syl2}${pair[1]}`)
}

// One entry per line: 800 advanced words pretty-printed would bury the core map.
const advJson = '{\n' + Object.entries(advByPair)
  .map(([pair, items]) => `  ${JSON.stringify(pair)}: [\n${items.map(e => `    ${JSON.stringify(e)}`).join(',\n')}\n  ]`)
  .join(',\n') + '\n}'

const out = `// AUTO-GENERATED — do not edit by hand (node scripts/buildDisyllableManifest.mjs)
// Core:     public/audio/disyllables/<tone-pair>/<file>.m4a      — human recordings, HSK 1-3
// Advanced: public/audio/disyllables-adv/<tone-pair>/<key>.<voice>.mp3 — HSK 7-9, Test 2 only
// Folder name (e.g. "23") is authoritative for tones; filename gives the actual audio file path.

export const DISYLLABLE_BY_PAIR = ${JSON.stringify(byPair, null, 2)}

// HSK 7-9 words (Jul 8 decision: Test 2 must use words students DON'T know, or
// they answer from memory instead of by listening). Each entry has one file
// per voice in \`voices\`; \`file\` is the stable id Test 2 dedupes on.
export const DISYLLABLE_ADV_BY_PAIR = ${advJson}

export const DISYLLABLE_COMBOS = new Set(${JSON.stringify(allCombos.sort())})

/** Find the recording file for a given disyllable, or null. Advanced words with
 *  several voice takes return a random one per call, like playSyllable's variants. */
export function findDisyllableRecording(syl1, tone1, syl2, tone2) {
  const pair = \`\${tone1}\${tone2}\`
  const hit = (DISYLLABLE_BY_PAIR[pair] || []).find(it => it.syl1 === syl1 && it.syl2 === syl2)
  if (hit) return \`audio/disyllables/\${pair}/\${hit.file}\`
  const adv = (DISYLLABLE_ADV_BY_PAIR[pair] || []).find(it => it.syl1 === syl1 && it.syl2 === syl2)
  if (!adv) return null
  return \`audio/disyllables-adv/\${pair}/\${adv.voices[Math.floor(Math.random() * adv.voices.length)]}\`
}

export function hasDisyllableRecording(syl1, tone1, syl2, tone2) {
  return findDisyllableRecording(syl1, tone1, syl2, tone2) !== null
}
`
writeFileSync(OUT, out)
const advWords = Object.values(advByPair).reduce((n, a) => n + a.length, 0)
console.log(`Wrote ${OUT} — ${allCombos.length} core combos across ${Object.keys(byPair).length} tone-pairs; ${advWords} advanced words (${advFiles} voice files, ${removed.size} quarantined)`)
const unmatched = [...quarantined.keys()].filter(k => !removed.has(k))
if (unmatched.length) console.warn(`⚠️  quarantine.tsv lines that match no audio (typo? wrong pair folder?): ${unmatched.join(', ')}`)
console.log(`Skipped ${skipped.length} files: ${skipped.join(', ')}`)
for (const k of Object.keys(byPair).sort()) console.log(`  ${k}: ${byPair[k].length} core, ${(advByPair[k] || []).length} adv`)
