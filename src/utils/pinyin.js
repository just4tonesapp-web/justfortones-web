// ═══════════════════════════════════════
// Pinyin utilities
// ═══════════════════════════════════════

/** Common pinyin syllables (no tone marks) */
export const SYLLABLE_POOL = [
  'ba','bo','bi','bu','bai','bei','bao','ban','ben','bang','beng','bing',
  'pa','po','pi','pu','pai','pei','pao','pan','pen','pang','peng','ping',
  'ma','mo','mi','mu','mai','mei','mao','man','men','mang','meng','ming',
  'fa','fo','fu','fan','fen','fang','feng',
  'da','de','di','du','dai','dei','dao','dan','dang','deng','ding','dong','dou','dui','dun',
  'ta','te','ti','tu','tai','tao','tan','tang','teng','ting','tong','tou','tui','tun',
  'na','ne','ni','nu','nai','nei','nao','nan','nen','nang','neng','ning','nong','nou',
  'la','le','li','lu','lai','lei','lao','lan','lang','leng','ling','long','lou','lun',
  'ga','ge','gu','gai','gei','gao','gan','gen','gang','geng','gong','gou','gui','gun','guo',
  'ka','ke','ku','kai','kao','kan','ken','kang','keng','kong','kou','kui','kun','kuo',
  'ha','he','hu','hai','hei','hao','han','hen','hang','heng','hong','hou','hui','hun','huo',
  'zha','zhe','zhi','zhu','zhai','zhao','zhan','zhen','zhang','zheng','zhong','zhou','zhui','zhun','zhuo',
  'cha','che','chi','chu','chai','chao','chan','chen','chang','cheng','chong','chou','chui','chun','chuo',
  'sha','she','shi','shu','shai','shao','shan','shen','shang','sheng','shou','shui','shun','shuo',
  'za','ze','zi','zu','zai','zao','zan','zen','zang','zeng','zong','zou','zui','zun','zuo',
  'ca','ce','ci','cu','cai','cao','can','cen','cang','ceng','cong','cou','cui','cun','cuo',
  'sa','se','si','su','sai','sao','san','sen','sang','seng','song','sou','sui','sun','suo',
  'ya','ye','yi','yu','yao','yan','yang','ying','yong','you','yuan','yun','yue',
  'wa','wo','wu','wai','wei','wan','wen','wang','weng',
  'a','o','e','ai','ei','ao','an','en','ang','eng','er'
]

/** Tone mark lookup */
const TONE_MARKS = {
  a: ['ā','á','ǎ','à'],
  e: ['ē','é','ě','è'],
  i: ['ī','í','ǐ','ì'],
  o: ['ō','ó','ǒ','ò'],
  u: ['ū','ú','ǔ','ù'],
  ü: ['ǖ','ǘ','ǚ','ǜ'],
}

/**
 * Find which vowel in the syllable should carry the tone mark.
 * Standard rules: a/e always win; in "ou" → o; else last vowel.
 */
function toneVowelIndex(syl) {
  if (syl.includes('a')) return syl.indexOf('a')
  if (syl.includes('e')) return syl.indexOf('e')
  if (syl.includes('ou')) return syl.indexOf('o')
  const vowels = 'aeiouü'
  for (let i = syl.length - 1; i >= 0; i--) {
    if (vowels.includes(syl[i])) return i
  }
  return -1
}

/**
 * Apply a tone mark (1-4) to a bare pinyin syllable.
 * e.g. applyTone('bao', 3) → 'bǎo'
 */
export function applyTone(syllable, tone) {
  const idx = toneVowelIndex(syllable)
  if (idx === -1) return syllable
  const marks = TONE_MARKS[syllable[idx]]
  if (!marks) return syllable
  return syllable.substring(0, idx) + marks[tone - 1] + syllable.substring(idx + 1)
}

/**
 * Generate a two-syllable "word" for Test B.
 * Each syllable gets its own tone, returning { syl1, tone1, syl2, tone2 }.
 * Picks from the pool ensuring the two syllables are different.
 */
export function makeTwoSyllableItem(pool, tone1, tone2) {
  const shuffled = shuffle(pool)
  return {
    syl1: shuffled[0],
    tone1,
    syl2: shuffled[1],
    tone2,
  }
}

/**
 * Format a two-syllable item as a pinyin string with tone marks.
 * e.g. { syl1:'da', tone1:4, syl2:'niao', tone2:3 } → 'dànǐao'
 */
export function formatTwoSyllable(item) {
  return applyTone(item.syl1, item.tone1) + applyTone(item.syl2, item.tone2)
}

/**
 * Format a two-syllable item as bare pinyin (no tones).
 */
export function formatTwoSyllableBare(item) {
  return item.syl1 + item.syl2
}

/** Fisher-Yates shuffle (returns new array) */
export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}