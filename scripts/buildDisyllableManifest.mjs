import { readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = '/Users/homer/Documents/justfortones-web/public/audio/disyllables'
const OUT = '/Users/homer/Documents/justfortones-web/src/utils/disyllableManifest.js'

// File pattern: optional leading tone digits, syllable letters, possibly more
// We extract two syllable bases by stripping all digits and parens, then splitting.
// Most files match: <syl1><tone1><syl2><tone2>.m4a
const FN_RE = /^([a-z]+)([1-5])([a-z]+)([1-5])(?:\s*\(\d+\))?\.m4a$/i

const byPair = {}
const skipped = []

for (const dir of readdirSync(ROOT).sort()) {
  if (!/^[1-4]{2}$/.test(dir)) continue
  const tone1 = +dir[0], tone2 = +dir[1]
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

const allCombos = []
for (const [pair, items] of Object.entries(byPair)) {
  for (const it of items) allCombos.push(`${it.syl1}${pair[0]}${it.syl2}${pair[1]}`)
}

const out = `// AUTO-GENERATED — do not edit by hand
// Built from public/audio/disyllables/<tone-pair>/<file>.m4a
// Folder name (e.g. "23") is authoritative for tones; filename gives the actual audio file path.

export const DISYLLABLE_BY_PAIR = ${JSON.stringify(byPair, null, 2)}

export const DISYLLABLE_COMBOS = new Set(${JSON.stringify(allCombos.sort())})

/** Find the recording file for a given disyllable, or null */
export function findDisyllableRecording(syl1, tone1, syl2, tone2) {
  const pair = \`\${tone1}\${tone2}\`
  const items = DISYLLABLE_BY_PAIR[pair]
  if (!items) return null
  const hit = items.find(it => it.syl1 === syl1 && it.syl2 === syl2)
  if (!hit) return null
  return \`audio/disyllables/\${pair}/\${hit.file}\`
}

export function hasDisyllableRecording(syl1, tone1, syl2, tone2) {
  return findDisyllableRecording(syl1, tone1, syl2, tone2) !== null
}
`
writeFileSync(OUT, out)
const total = allCombos.length
console.log(`Wrote ${OUT} — ${total} combos across ${Object.keys(byPair).length} tone-pairs`)
console.log(`Skipped ${skipped.length} files: ${skipped.join(', ')}`)
for (const k of Object.keys(byPair).sort()) console.log(`  ${k}: ${byPair[k].length}`)
