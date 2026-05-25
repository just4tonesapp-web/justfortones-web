import { readFileSync, writeFileSync } from 'fs'
const TMP = '/tmp/xlsx-inspect'
const sharedStrings = readFileSync(`${TMP}/xl/sharedStrings.xml`, 'utf8')
const sheet1 = readFileSync(`${TMP}/xl/worksheets/sheet1.xml`, 'utf8')
const strings = []
const all = sharedStrings.match(/<si>[\s\S]*?<\/si>/g) || []
for (const si of all) {
  const tMatch = si.match(/<t[^>]*>([^<]*)<\/t>/)
  strings.push(tMatch ? tMatch[1] : '')
}
const rows = sheet1.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []
const words = []
// Skip header (row 0)
for (let i = 1; i < rows.length; i++) {
  const cells = rows[i].match(/<c[^>]*>[\s\S]*?<\/c>/g) || []
  const decoded = cells.map(c => {
    const isStr = /t="s"/.test(c)
    const v = c.match(/<v>([^<]*)<\/v>/)
    if (!v) return ''
    return isStr ? strings[+v[1]] : v[1]
  })
  const [chars, pattern, pinyin, meaning] = decoded
  if (!chars || !pattern || !pinyin) continue
  words.push({ chars, pattern: String(pattern), pinyin, meaning: meaning || '' })
}

const out = `// AUTO-GENERATED — do not edit by hand
// Top HSK 1–3 disyllabic Chinese words for Test Y.
// Generated from "Test B D Y HSK_disyllabic_words_sorted.xlsx".

export const HSK_DISYLLABIC_WORDS = ${JSON.stringify(words, null, 2)}
`
writeFileSync('/Users/homer/Documents/justfortones-web/src/utils/hskDisyllabicWords.js', out)
console.log(`Wrote ${words.length} words`)
// Distribution by tone pattern
const dist = {}
for (const w of words) dist[w.pattern] = (dist[w.pattern] || 0) + 1
console.log('Patterns:', Object.entries(dist).sort().map(([k, v]) => `${k}:${v}`).join('  '))
