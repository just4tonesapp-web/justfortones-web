// ═══════════════════════════════════════
// Interface IV – Character Batch Learning
// Learn character tones in batches of 50
// Phase I: Flashcard study + quiz
// Phase II: Sentence context (unlocked after passing)
// ═══════════════════════════════════════
import { navigate } from '../router.js'
import { speakChinese } from '../utils/audio.js'

// ── Tone mark helper (inline) ──
const TONE_MARKS = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  ü: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

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

function applyToneMark(syllable, tone) {
  if (tone === 5 || tone === 0) return syllable
  const idx = toneVowelIndex(syllable)
  if (idx === -1) return syllable
  const marks = TONE_MARKS[syllable[idx]]
  if (!marks) return syllable
  return syllable.substring(0, idx) + marks[tone] + syllable.substring(idx + 1)
}

// ── Utilities ──
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Character Data: Top 200 ──
const ALL_CHARS = [
  // Batch 1: 1-50
  { char: '的', base: 'de', tone: 5, meaning: '(possessive)' },
  { char: '一', base: 'yi', tone: 1, meaning: 'one' },
  { char: '是', base: 'shi', tone: 4, meaning: 'is' },
  { char: '不', base: 'bu', tone: 4, meaning: 'not' },
  { char: '了', base: 'le', tone: 5, meaning: '(particle)' },
  { char: '人', base: 'ren', tone: 2, meaning: 'person' },
  { char: '我', base: 'wo', tone: 3, meaning: 'I/me' },
  { char: '在', base: 'zai', tone: 4, meaning: 'at/in' },
  { char: '有', base: 'you', tone: 3, meaning: 'have' },
  { char: '他', base: 'ta', tone: 1, meaning: 'he' },
  { char: '这', base: 'zhe', tone: 4, meaning: 'this' },
  { char: '中', base: 'zhong', tone: 1, meaning: 'middle' },
  { char: '大', base: 'da', tone: 4, meaning: 'big' },
  { char: '来', base: 'lai', tone: 2, meaning: 'come' },
  { char: '上', base: 'shang', tone: 4, meaning: 'up/on' },
  { char: '国', base: 'guo', tone: 2, meaning: 'country' },
  { char: '个', base: 'ge', tone: 4, meaning: '(measure)' },
  { char: '到', base: 'dao', tone: 4, meaning: 'arrive' },
  { char: '说', base: 'shuo', tone: 1, meaning: 'speak' },
  { char: '们', base: 'men', tone: 5, meaning: '(plural)' },
  { char: '为', base: 'wei', tone: 4, meaning: 'for' },
  { char: '子', base: 'zi', tone: 3, meaning: 'child' },
  { char: '和', base: 'he', tone: 2, meaning: 'and' },
  { char: '你', base: 'ni', tone: 3, meaning: 'you' },
  { char: '地', base: 'di', tone: 4, meaning: 'earth' },
  { char: '出', base: 'chu', tone: 1, meaning: 'go out' },
  { char: '道', base: 'dao', tone: 4, meaning: 'way' },
  { char: '也', base: 'ye', tone: 3, meaning: 'also' },
  { char: '时', base: 'shi', tone: 2, meaning: 'time' },
  { char: '年', base: 'nian', tone: 2, meaning: 'year' },
  { char: '得', base: 'de', tone: 2, meaning: 'get' },
  { char: '就', base: 'jiu', tone: 4, meaning: 'then' },
  { char: '那', base: 'na', tone: 4, meaning: 'that' },
  { char: '要', base: 'yao', tone: 4, meaning: 'want' },
  { char: '下', base: 'xia', tone: 4, meaning: 'down' },
  { char: '以', base: 'yi', tone: 3, meaning: 'with' },
  { char: '生', base: 'sheng', tone: 1, meaning: 'life' },
  { char: '会', base: 'hui', tone: 4, meaning: 'can' },
  { char: '自', base: 'zi', tone: 4, meaning: 'self' },
  { char: '着', base: 'zhe', tone: 5, meaning: '(particle)' },
  { char: '去', base: 'qu', tone: 4, meaning: 'go' },
  { char: '之', base: 'zhi', tone: 1, meaning: 'of' },
  { char: '过', base: 'guo', tone: 4, meaning: 'pass' },
  { char: '家', base: 'jia', tone: 1, meaning: 'home' },
  { char: '学', base: 'xue', tone: 2, meaning: 'study' },
  { char: '对', base: 'dui', tone: 4, meaning: 'correct' },
  { char: '可', base: 'ke', tone: 3, meaning: 'can' },
  { char: '她', base: 'ta', tone: 1, meaning: 'she' },
  { char: '里', base: 'li', tone: 3, meaning: 'inside' },
  { char: '后', base: 'hou', tone: 4, meaning: 'after' },
  // Batch 2: 51-100
  { char: '小', base: 'xiao', tone: 3, meaning: 'small' },
  { char: '么', base: 'me', tone: 5, meaning: '(particle)' },
  { char: '心', base: 'xin', tone: 1, meaning: 'heart' },
  { char: '多', base: 'duo', tone: 1, meaning: 'many' },
  { char: '天', base: 'tian', tone: 1, meaning: 'sky' },
  { char: '而', base: 'er', tone: 2, meaning: 'and' },
  { char: '能', base: 'neng', tone: 2, meaning: 'can' },
  { char: '好', base: 'hao', tone: 3, meaning: 'good' },
  { char: '都', base: 'dou', tone: 1, meaning: 'all' },
  { char: '然', base: 'ran', tone: 2, meaning: 'so' },
  { char: '没', base: 'mei', tone: 2, meaning: 'not have' },
  { char: '日', base: 'ri', tone: 4, meaning: 'day' },
  { char: '于', base: 'yu', tone: 2, meaning: 'at/in' },
  { char: '起', base: 'qi', tone: 3, meaning: 'rise' },
  { char: '还', base: 'hai', tone: 2, meaning: 'still' },
  { char: '发', base: 'fa', tone: 1, meaning: 'send' },
  { char: '成', base: 'cheng', tone: 2, meaning: 'become' },
  { char: '事', base: 'shi', tone: 4, meaning: 'thing' },
  { char: '只', base: 'zhi', tone: 3, meaning: 'only' },
  { char: '作', base: 'zuo', tone: 4, meaning: 'do/make' },
  { char: '当', base: 'dang', tone: 1, meaning: 'when' },
  { char: '想', base: 'xiang', tone: 3, meaning: 'think' },
  { char: '看', base: 'kan', tone: 4, meaning: 'look' },
  { char: '文', base: 'wen', tone: 2, meaning: 'text' },
  { char: '无', base: 'wu', tone: 2, meaning: 'without' },
  { char: '开', base: 'kai', tone: 1, meaning: 'open' },
  { char: '手', base: 'shou', tone: 3, meaning: 'hand' },
  { char: '十', base: 'shi', tone: 2, meaning: 'ten' },
  { char: '用', base: 'yong', tone: 4, meaning: 'use' },
  { char: '主', base: 'zhu', tone: 3, meaning: 'main' },
  { char: '行', base: 'xing', tone: 2, meaning: 'walk' },
  { char: '方', base: 'fang', tone: 1, meaning: 'direction' },
  { char: '又', base: 'you', tone: 4, meaning: 'again' },
  { char: '如', base: 'ru', tone: 2, meaning: 'like' },
  { char: '前', base: 'qian', tone: 2, meaning: 'front' },
  { char: '所', base: 'suo', tone: 3, meaning: 'place' },
  { char: '本', base: 'ben', tone: 3, meaning: 'origin' },
  { char: '见', base: 'jian', tone: 4, meaning: 'see' },
  { char: '经', base: 'jing', tone: 1, meaning: 'already' },
  { char: '头', base: 'tou', tone: 2, meaning: 'head' },
  { char: '面', base: 'mian', tone: 4, meaning: 'face' },
  { char: '公', base: 'gong', tone: 1, meaning: 'public' },
  { char: '同', base: 'tong', tone: 2, meaning: 'same' },
  { char: '三', base: 'san', tone: 1, meaning: 'three' },
  { char: '已', base: 'yi', tone: 3, meaning: 'already' },
  { char: '老', base: 'lao', tone: 3, meaning: 'old' },
  { char: '从', base: 'cong', tone: 2, meaning: 'from' },
  { char: '动', base: 'dong', tone: 4, meaning: 'move' },
  { char: '两', base: 'liang', tone: 3, meaning: 'two' },
  { char: '长', base: 'chang', tone: 2, meaning: 'long' },
  // Batch 3: 101-150
  { char: '知', base: 'zhi', tone: 1, meaning: 'know' },
  { char: '民', base: 'min', tone: 2, meaning: 'people' },
  { char: '样', base: 'yang', tone: 4, meaning: 'kind/type' },
  { char: '现', base: 'xian', tone: 4, meaning: 'present' },
  { char: '分', base: 'fen', tone: 1, meaning: 'divide' },
  { char: '将', base: 'jiang', tone: 1, meaning: 'will' },
  { char: '外', base: 'wai', tone: 4, meaning: 'outside' },
  { char: '但', base: 'dan', tone: 4, meaning: 'but' },
  { char: '身', base: 'shen', tone: 1, meaning: 'body' },
  { char: '些', base: 'xie', tone: 1, meaning: 'some' },
  { char: '与', base: 'yu', tone: 3, meaning: 'with' },
  { char: '高', base: 'gao', tone: 1, meaning: 'tall' },
  { char: '意', base: 'yi', tone: 4, meaning: 'meaning' },
  { char: '进', base: 'jin', tone: 4, meaning: 'enter' },
  { char: '把', base: 'ba', tone: 3, meaning: '(prep)' },
  { char: '法', base: 'fa', tone: 3, meaning: 'law' },
  { char: '此', base: 'ci', tone: 3, meaning: 'this' },
  { char: '实', base: 'shi', tone: 2, meaning: 'real' },
  { char: '回', base: 'hui', tone: 2, meaning: 'return' },
  { char: '二', base: 'er', tone: 4, meaning: 'two' },
  { char: '理', base: 'li', tone: 3, meaning: 'reason' },
  { char: '美', base: 'mei', tone: 3, meaning: 'beautiful' },
  { char: '点', base: 'dian', tone: 3, meaning: 'point' },
  { char: '月', base: 'yue', tone: 4, meaning: 'moon' },
  { char: '明', base: 'ming', tone: 2, meaning: 'bright' },
  { char: '其', base: 'qi', tone: 2, meaning: 'its' },
  { char: '种', base: 'zhong', tone: 3, meaning: 'kind' },
  { char: '声', base: 'sheng', tone: 1, meaning: 'sound' },
  { char: '全', base: 'quan', tone: 2, meaning: 'whole' },
  { char: '工', base: 'gong', tone: 1, meaning: 'work' },
  { char: '己', base: 'ji', tone: 3, meaning: 'self' },
  { char: '话', base: 'hua', tone: 4, meaning: 'speech' },
  { char: '儿', base: 'er', tone: 2, meaning: 'child' },
  { char: '者', base: 'zhe', tone: 3, meaning: 'person' },
  { char: '向', base: 'xiang', tone: 4, meaning: 'toward' },
  { char: '情', base: 'qing', tone: 2, meaning: 'feeling' },
  { char: '部', base: 'bu', tone: 4, meaning: 'part' },
  { char: '正', base: 'zheng', tone: 4, meaning: 'correct' },
  { char: '名', base: 'ming', tone: 2, meaning: 'name' },
  { char: '定', base: 'ding', tone: 4, meaning: 'fix' },
  { char: '女', base: 'nv', tone: 3, meaning: 'woman' },
  { char: '问', base: 'wen', tone: 4, meaning: 'ask' },
  { char: '力', base: 'li', tone: 4, meaning: 'power' },
  { char: '机', base: 'ji', tone: 1, meaning: 'machine' },
  { char: '给', base: 'gei', tone: 3, meaning: 'give' },
  { char: '等', base: 'deng', tone: 3, meaning: 'wait' },
  { char: '几', base: 'ji', tone: 3, meaning: 'how many' },
  { char: '很', base: 'hen', tone: 3, meaning: 'very' },
  { char: '业', base: 'ye', tone: 4, meaning: 'business' },
  { char: '最', base: 'zui', tone: 4, meaning: 'most' },
  // Batch 4: 151-200
  { char: '间', base: 'jian', tone: 1, meaning: 'between' },
  { char: '新', base: 'xin', tone: 1, meaning: 'new' },
  { char: '什', base: 'shen', tone: 2, meaning: 'what' },
  { char: '打', base: 'da', tone: 3, meaning: 'hit' },
  { char: '便', base: 'bian', tone: 4, meaning: 'convenient' },
  { char: '位', base: 'wei', tone: 4, meaning: 'position' },
  { char: '因', base: 'yin', tone: 1, meaning: 'because' },
  { char: '重', base: 'zhong', tone: 4, meaning: 'heavy' },
  { char: '被', base: 'bei', tone: 4, meaning: 'by (passive)' },
  { char: '走', base: 'zou', tone: 3, meaning: 'walk' },
  { char: '电', base: 'dian', tone: 4, meaning: 'electric' },
  { char: '四', base: 'si', tone: 4, meaning: 'four' },
  { char: '第', base: 'di', tone: 4, meaning: 'ordinal' },
  { char: '门', base: 'men', tone: 2, meaning: 'door' },
  { char: '相', base: 'xiang', tone: 1, meaning: 'mutual' },
  { char: '次', base: 'ci', tone: 4, meaning: 'time (count)' },
  { char: '东', base: 'dong', tone: 1, meaning: 'east' },
  { char: '政', base: 'zheng', tone: 4, meaning: 'politics' },
  { char: '海', base: 'hai', tone: 3, meaning: 'sea' },
  { char: '口', base: 'kou', tone: 3, meaning: 'mouth' },
  { char: '使', base: 'shi', tone: 3, meaning: 'make/use' },
  { char: '教', base: 'jiao', tone: 4, meaning: 'teach' },
  { char: '西', base: 'xi', tone: 1, meaning: 'west' },
  { char: '再', base: 'zai', tone: 4, meaning: 'again' },
  { char: '平', base: 'ping', tone: 2, meaning: 'flat' },
  { char: '真', base: 'zhen', tone: 1, meaning: 'true' },
  { char: '听', base: 'ting', tone: 1, meaning: 'listen' },
  { char: '世', base: 'shi', tone: 4, meaning: 'world' },
  { char: '气', base: 'qi', tone: 4, meaning: 'air' },
  { char: '信', base: 'xin', tone: 4, meaning: 'letter/trust' },
  { char: '北', base: 'bei', tone: 3, meaning: 'north' },
  { char: '少', base: 'shao', tone: 3, meaning: 'few' },
  { char: '关', base: 'guan', tone: 1, meaning: 'close' },
  { char: '并', base: 'bing', tone: 4, meaning: 'and/also' },
  { char: '内', base: 'nei', tone: 4, meaning: 'inside' },
  { char: '加', base: 'jia', tone: 1, meaning: 'add' },
  { char: '化', base: 'hua', tone: 4, meaning: 'change' },
  { char: '由', base: 'you', tone: 2, meaning: 'from/by' },
  { char: '却', base: 'que', tone: 4, meaning: 'but' },
  { char: '代', base: 'dai', tone: 4, meaning: 'generation' },
  { char: '军', base: 'jun', tone: 1, meaning: 'army' },
  { char: '产', base: 'chan', tone: 3, meaning: 'produce' },
  { char: '入', base: 'ru', tone: 4, meaning: 'enter' },
  { char: '先', base: 'xian', tone: 1, meaning: 'first' },
  { char: '山', base: 'shan', tone: 1, meaning: 'mountain' },
  { char: '五', base: 'wu', tone: 3, meaning: 'five' },
  { char: '太', base: 'tai', tone: 4, meaning: 'too/very' },
  { char: '水', base: 'shui', tone: 3, meaning: 'water' },
  { char: '万', base: 'wan', tone: 4, meaning: 'ten thousand' },
  { char: '市', base: 'shi', tone: 4, meaning: 'city' },
]

const BATCH_SIZE = 50
const BATCHES = [
  { label: 'Batch 1', range: '1-50', start: 0 },
  { label: 'Batch 2', range: '51-100', start: 50 },
  { label: 'Batch 3', range: '101-150', start: 100 },
  { label: 'Batch 4', range: '151-200', start: 150 },
]

const QUIZ_COUNT = 10
const QUIZ_PASS = 8

const TONE_CHOICES = [
  { value: 5, label: 'Neutral (轻声)' },
  { value: 1, label: '1st tone (一声)' },
  { value: 2, label: '2nd tone (二声)' },
  { value: 3, label: '3rd tone (三声)' },
  { value: 4, label: '4th tone (四声)' },
]

const TONE_NAMES = {
  1: '1st (High)',
  2: '2nd (Rising)',
  3: '3rd (Dip)',
  4: '4th (Fall)',
  5: 'Neutral',
}

const TONE_COLORS = {
  1: 'var(--tone1)',
  2: 'var(--tone2)',
  3: 'var(--tone3)',
  4: 'var(--tone4)',
  5: 'var(--text-muted)',
}

const STORAGE_KEY = 'j4t_char_progress'

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch { return {} }
}

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ═══════════════════════════════════════
// Main view
// ═══════════════════════════════════════
export function practiceCharView(container) {
  let state = 'select'   // select | study | quiz | review | results
  let activeBatch = -1
  let cards = []
  let cardIndex = 0
  let knownSet = new Set()
  let learningSet = new Set()
  let quizQuestions = []
  let quizIndex = 0
  let quizScore = 0
  let quizAnswered = false
  let quizAnswers = []
  let missedCards = []

  const progress = loadProgress()

  function render() {
    if (state === 'select') renderBatchSelect()
    else if (state === 'study') renderFlashcard()
    else if (state === 'quiz') renderQuiz()
    else if (state === 'review') renderFlashcard()
    else if (state === 'results') renderResults()
  }

  // ── Batch Select ──
  function renderBatchSelect() {
    let batchCards = ''
    BATCHES.forEach((b, i) => {
      const done = progress[`batch_${i}`]
      const knownCount = (progress[`known_${i}`] || []).length
      const pct = Math.round((knownCount / BATCH_SIZE) * 100)
      const locked = i > 0 && !progress[`batch_${i - 1}`]
      batchCards += `
        <button class="pc-batch-card card ${locked ? 'pc-locked' : ''} ${done ? 'pc-done' : ''}"
                data-batch="${i}" ${locked ? 'disabled' : ''}>
          <div class="pc-batch-header">
            <span class="pc-batch-label">${b.label}</span>
            <span class="badge">${b.range}</span>
          </div>
          <div class="pc-batch-progress">
            <div class="pc-batch-bar-track">
              <div class="pc-batch-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="pc-batch-pct">${knownCount}/${BATCH_SIZE}</span>
          </div>
          <div class="pc-batch-status">
            ${locked ? '🔒 Complete previous batch first' : done ? '✓ Completed' : 'Tap to start'}
          </div>
        </button>`
    })

    container.innerHTML = `
      <div class="app-shell">
        <div class="pc-header">
          <button class="btn btn-secondary pc-back-btn" id="pc-back">← Back</button>
          <h1>Character Tone Learning</h1>
          <p>Master the tones of the 200 most common Chinese characters</p>
        </div>
        <div class="pc-batch-grid animate-in">
          ${batchCards}
        </div>
      </div>
    `

    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)

    document.getElementById('pc-back').addEventListener('click', () => navigate('/'))

    container.querySelectorAll('.pc-batch-card:not(.pc-locked)').forEach(btn => {
      btn.addEventListener('click', () => {
        activeBatch = parseInt(btn.dataset.batch)
        startStudy()
      })
    })
  }

  // ── Start Study ──
  function startStudy() {
    const batch = BATCHES[activeBatch]
    cards = ALL_CHARS.slice(batch.start, batch.start + BATCH_SIZE)
    cardIndex = 0
    knownSet = new Set(progress[`known_${activeBatch}`] || [])
    learningSet = new Set()
    state = 'study'
    render()
  }

  // ── Flashcard ──
  function renderFlashcard() {
    const isReview = state === 'review'
    const deck = isReview ? missedCards : cards
    const current = deck[cardIndex]
    const total = deck.length
    const pinyinDisplay = applyToneMark(current.base, current.tone)
    const toneColor = TONE_COLORS[current.tone] || 'var(--text-primary)'
    const toneName = TONE_NAMES[current.tone] || ''

    container.innerHTML = `
      <div class="app-shell">
        <div class="pc-header">
          <button class="btn btn-secondary pc-back-btn" id="pc-study-back">← Batches</button>
          <h1>${isReview ? 'Review Missed' : BATCHES[activeBatch].label} — Study</h1>
        </div>

        <div class="progress-wrap">
          <div class="progress-info">
            <span>Card ${cardIndex + 1} of ${total}</span>
            <span class="progress-score">${knownSet.size} known</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${((cardIndex + 1) / total) * 100}%"></div>
          </div>
        </div>

        <div class="card animate-in pc-flashcard" id="pc-card">
          <div class="pc-char-display">${current.char}</div>
          <div class="pc-pinyin" style="color:${toneColor}">${pinyinDisplay}</div>
          <div class="pc-meaning">${current.meaning}</div>
          <div class="pc-tone-badge" style="background:${toneColor}">
            Tone ${current.tone === 5 ? 'Neutral' : current.tone}
          </div>
          <button class="btn btn-secondary pc-play-btn" id="pc-play">
            🔊 Play
          </button>
        </div>

        <div class="pc-study-actions">
          <button class="btn pc-btn-learning" id="pc-learning">Still learning</button>
          <button class="btn pc-btn-known" id="pc-known">I know this</button>
        </div>
      </div>
    `

    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)

    document.getElementById('pc-study-back').addEventListener('click', () => {
      state = 'select'
      render()
    })

    document.getElementById('pc-play').addEventListener('click', () => {
      speakChinese(current.char, current.tone)
    })

    document.getElementById('pc-known').addEventListener('click', () => {
      knownSet.add(cardIndex)
      nextCard(deck)
    })

    document.getElementById('pc-learning').addEventListener('click', () => {
      learningSet.add(cardIndex)
      nextCard(deck)
    })
  }

  function nextCard(deck) {
    cardIndex++
    if (cardIndex >= deck.length) {
      // Save known progress
      progress[`known_${activeBatch}`] = [...knownSet]
      saveProgress(progress)

      if (state === 'review') {
        // After review, go back to results
        state = 'results'
        render()
      } else {
        // Finished study, start quiz
        startQuiz()
      }
    } else {
      render()
    }
  }

  // ── Start Quiz ──
  function startQuiz() {
    const batch = BATCHES[activeBatch]
    const pool = ALL_CHARS.slice(batch.start, batch.start + BATCH_SIZE)
    quizQuestions = shuffle(pool).slice(0, QUIZ_COUNT)
    quizIndex = 0
    quizScore = 0
    quizAnswered = false
    quizAnswers = []
    state = 'quiz'
    render()
  }

  // ── Quiz ──
  function renderQuiz() {
    const q = quizQuestions[quizIndex]

    container.innerHTML = `
      <div class="app-shell">
        <div class="pc-header">
          <h1>${BATCHES[activeBatch].label} — Quiz</h1>
        </div>

        <div class="progress-wrap">
          <div class="progress-info">
            <span>Question ${quizIndex + 1} of ${QUIZ_COUNT}</span>
            <span class="progress-score">Score: ${quizScore}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${((quizIndex) / QUIZ_COUNT) * 100}%"></div>
          </div>
        </div>

        <div class="card animate-in" id="pc-quiz-card">
          <div class="question-label">What tone is this character?</div>
          <div class="char-area">
            <div class="char-display">${q.char}</div>
            <div class="char-base">${q.base}</div>
          </div>
          <div class="tone-choices" id="pc-quiz-choices"></div>
        </div>
      </div>
      <div class="feedback-toast" id="pc-toast"></div>
    `

    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)

    const choicesEl = document.getElementById('pc-quiz-choices')
    TONE_CHOICES.forEach(tc => {
      const btn = document.createElement('button')
      btn.className = 'tone-choice-btn'
      btn.dataset.tone = tc.value
      btn.textContent = tc.label
      btn.addEventListener('click', () => pickAnswer(tc.value, btn))
      choicesEl.appendChild(btn)
    })
  }

  function pickAnswer(selected, btnEl) {
    if (quizAnswered) return
    quizAnswered = true
    const q = quizQuestions[quizIndex]
    const ok = selected === q.tone
    if (ok) quizScore++

    quizAnswers.push({
      char: q.char,
      base: q.base,
      meaning: q.meaning,
      tone: q.tone,
      selected,
      correct: ok,
    })

    document.querySelectorAll('#pc-quiz-choices .tone-choice-btn').forEach(b => {
      const t = parseInt(b.dataset.tone)
      if (t === q.tone) b.classList.add('correct')
      else if (t === selected && !ok) b.classList.add('incorrect')
      b.classList.add('disabled')
    })

    showToast(ok)

    setTimeout(() => {
      quizIndex++
      quizAnswered = false
      if (quizIndex >= QUIZ_COUNT) {
        state = 'results'
        render()
      } else {
        render()
      }
    }, 1400)
  }

  function showToast(ok) {
    const t = document.getElementById('pc-toast')
    if (!t) return
    t.className = 'feedback-toast'
    const msgs = ok
      ? ['Correct!', 'Nice!', 'Spot on!', 'Perfect!']
      : ['Not quite', 'Try next time', 'Almost!']
    t.textContent = msgs[Math.floor(Math.random() * msgs.length)]
    t.classList.add(ok ? 'correct' : 'incorrect')
    requestAnimationFrame(() => t.classList.add('show'))
    setTimeout(() => t.classList.remove('show'), 1000)
  }

  // ── Results ──
  function renderResults() {
    const passed = quizScore >= QUIZ_PASS
    const pct = Math.round((quizScore / QUIZ_COUNT) * 100)
    const missed = quizAnswers.filter(a => !a.correct)

    if (passed) {
      progress[`batch_${activeBatch}`] = true
      saveProgress(progress)
    }

    let detailRows = ''
    quizAnswers.forEach((a, i) => {
      const icon = a.correct ? '✅' : '❌'
      const toneLabels = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: 'Neutral' }
      const correctLabel = toneLabels[a.tone]
      const selectedLabel = toneLabels[a.selected]
      const display = a.correct
        ? `${a.char} (${correctLabel})`
        : `${a.char} ${selectedLabel} → ${correctLabel}`
      detailRows += `
        <div class="detail-item">
          <span class="detail-icon">${icon}</span>
          <span class="detail-qn">${i + 1}.</span>
          <span class="detail-pinyin">${display}</span>
        </div>`
    })

    const missedReviewBtn = missed.length > 0 && !passed
      ? `<button class="btn btn-secondary" id="pc-review-missed" style="width:100%">Review missed characters</button>`
      : ''

    container.innerHTML = `
      <div class="app-shell">
        <div class="pc-header animate-in">
          <h1>${BATCHES[activeBatch].label} — Results</h1>
        </div>

        <div class="text-center animate-in" style="margin-bottom:24px">
          <div class="score-ring" style="--pct:${pct}">
            <span class="score-num">${quizScore}/${QUIZ_COUNT}</span>
            <span class="score-label">${pct}%</span>
          </div>
          <div style="color:var(--text-secondary);line-height:1.5;padding:0 12px">
            ${passed
              ? `<strong>Batch complete!</strong> You passed with ${quizScore}/${QUIZ_COUNT}. ${activeBatch < 3 ? 'The next batch is now unlocked.' : 'You have completed all 4 batches!'}`
              : `You scored <strong>${quizScore}/${QUIZ_COUNT}</strong>. You need ${QUIZ_PASS}+ to pass. Review the characters you missed and try again.`
            }
          </div>
        </div>

        <div class="card animate-in" style="margin-bottom:16px">
          <h3 class="section-head">Question Details</h3>
          ${detailRows}
        </div>

        <div class="pc-result-actions">
          ${missedReviewBtn}
          <button class="btn btn-secondary" id="pc-retake" style="width:100%">Retake Quiz</button>
          <button class="btn btn-primary" id="pc-back-batches" style="width:100%">
            ${passed ? '→ Continue' : '← Back to Batches'}
          </button>
        </div>
      </div>
    `

    const style = document.createElement('style')
    style.textContent = scopedCSS
    container.appendChild(style)

    document.getElementById('pc-back-batches').addEventListener('click', () => {
      state = 'select'
      render()
    })

    document.getElementById('pc-retake').addEventListener('click', () => {
      startQuiz()
    })

    const reviewBtn = document.getElementById('pc-review-missed')
    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => {
        const batch = BATCHES[activeBatch]
        missedCards = missed.map(a => {
          return ALL_CHARS.slice(batch.start, batch.start + BATCH_SIZE)
            .find(c => c.char === a.char)
        }).filter(Boolean)
        cardIndex = 0
        state = 'review'
        render()
      })
    }
  }

  // Initial render
  render()
}

// ═══════════════════════════════════════
// Scoped CSS
// ═══════════════════════════════════════
const scopedCSS = `
  .pc-header {
    text-align: center;
    margin-bottom: 24px;
    position: relative;
  }
  .pc-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 8px 0 6px;
    background: linear-gradient(135deg, #f1f5f9 30%, #38bdf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .pc-header p {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  .pc-back-btn {
    position: absolute;
    left: 0;
    top: 0;
    font-size: 0.85rem;
    padding: 6px 14px;
  }

  /* Batch selector */
  .pc-batch-grid {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .pc-batch-card {
    text-align: left;
    cursor: pointer;
    border: 2px solid var(--card-border);
    transition: all 0.2s ease;
    padding: 18px 20px;
    width: 100%;
    font-family: inherit;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .pc-batch-card:hover:not(.pc-locked) {
    border-color: var(--accent);
    transform: translateY(-2px);
  }
  .pc-batch-card.pc-locked {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .pc-batch-card.pc-done {
    border-color: var(--correct);
  }
  .pc-batch-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .pc-batch-label {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  .pc-batch-progress {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  .pc-batch-bar-track {
    flex: 1;
    height: 6px;
    background: var(--surface);
    border-radius: 3px;
    overflow: hidden;
  }
  .pc-batch-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), #818cf8);
    border-radius: 3px;
    transition: width 0.5s ease;
  }
  .pc-batch-pct {
    font-size: 0.8rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .pc-batch-status {
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  /* Flashcard */
  .pc-flashcard {
    text-align: center;
    padding: 32px 20px;
  }
  .pc-char-display {
    font-size: 5rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--text-primary);
    margin-bottom: 12px;
  }
  .pc-pinyin {
    font-size: 1.6rem;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .pc-meaning {
    font-size: 1rem;
    color: var(--text-secondary);
    margin-bottom: 16px;
  }
  .pc-tone-badge {
    display: inline-block;
    padding: 4px 16px;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 20px;
  }
  .pc-play-btn {
    display: block;
    margin: 0 auto;
    font-size: 1rem;
    padding: 10px 28px;
  }

  .pc-study-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }
  .pc-btn-learning {
    flex: 1;
    background: var(--surface);
    border: 2px solid var(--card-border);
    color: var(--text-secondary);
    padding: 14px;
    border-radius: var(--radius);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }
  .pc-btn-learning:hover {
    border-color: var(--incorrect);
    color: var(--incorrect);
  }
  .pc-btn-known {
    flex: 1;
    background: var(--correct-bg);
    border: 2px solid var(--correct);
    color: var(--correct);
    padding: 14px;
    border-radius: var(--radius);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    transition: all 0.2s ease;
  }
  .pc-btn-known:hover {
    transform: translateY(-2px);
  }

  /* Progress (reuse from test views) */
  .progress-wrap { margin-bottom: 20px; }
  .progress-info {
    display: flex; justify-content: space-between;
    font-size: 0.82rem; color: var(--text-secondary);
    margin-bottom: 8px;
  }
  .progress-score { font-weight: 600; color: var(--accent); }
  .progress-track {
    height: 6px; background: var(--card-border);
    border-radius: 3px; overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), #818cf8);
    border-radius: 3px;
    transition: width 0.5s cubic-bezier(0.22,1,0.36,1);
  }

  /* Quiz (reuse patterns) */
  .char-area {
    display: flex; flex-direction: column;
    align-items: center; margin-bottom: 28px;
  }
  .char-display {
    font-size: 4rem;
    font-weight: 700;
    line-height: 1.2;
    color: var(--text-primary);
  }
  .char-base {
    font-size: 1.1rem;
    color: var(--text-secondary);
    margin-top: 8px;
    font-style: italic;
  }
  .question-label {
    text-align: center; font-size: 0.85rem;
    color: var(--text-muted); margin-bottom: 20px;
  }
  .tone-choices {
    display: flex; flex-direction: column; gap: 10px;
  }
  .tone-choice-btn {
    background: var(--surface);
    border: 2px solid var(--card-border);
    border-radius: var(--radius-sm);
    padding: 14px 20px;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s ease;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 500;
    color: var(--text-primary);
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .tone-choice-btn:focus-visible {
    box-shadow: 0 0 0 2px var(--accent);
  }
  .tone-choice-btn:hover:not(.disabled) {
    border-color: var(--accent);
    transform: translateY(-2px);
  }
  .tone-choice-btn.correct {
    border-color: var(--correct);
    background: var(--correct-bg);
    color: var(--correct);
  }
  .tone-choice-btn.incorrect {
    border-color: var(--incorrect);
    background: var(--incorrect-bg);
    color: var(--incorrect);
  }
  .tone-choice-btn.disabled { cursor: default; opacity: 0.55; }
  .tone-choice-btn.correct.disabled,
  .tone-choice-btn.incorrect.disabled { opacity: 1; }

  /* Score ring */
  .score-ring {
    width: 120px; height: 120px; border-radius: 50%;
    margin: 0 auto 16px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; position: relative;
  }
  .score-ring::before {
    content: ''; position: absolute; inset: 0; border-radius: 50%; padding: 4px;
    background: conic-gradient(var(--accent) calc(var(--pct) * 3.6deg), var(--card-border) 0);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 3px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #fff calc(100% - 3px));
  }
  .score-num { font-size: 2.2rem; font-weight: 700; line-height: 1; }
  .score-label { font-size: 0.78rem; color: var(--text-secondary); }

  .section-head {
    font-size: 0.85rem; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 16px;
  }

  /* Detail rows */
  .detail-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 0; border-bottom: 1px solid var(--card-border); font-size: 0.88rem;
  }
  .detail-item:last-child { border-bottom: none; }
  .detail-icon { flex-shrink: 0; font-size: 1rem; }
  .detail-qn { flex: 0 0 24px; color: var(--text-muted); font-size: 0.78rem; }
  .detail-pinyin { flex: 1; font-weight: 600; }

  /* Result actions */
  .pc-result-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
  }

  /* Toast */
  .feedback-toast {
    position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%) translateY(80px);
    padding: 12px 28px; border-radius: var(--radius); font-weight: 600;
    font-size: 0.95rem; opacity: 0; transition: all 0.35s cubic-bezier(0.22,1,0.36,1);
    pointer-events: none; z-index: 100;
  }
  .feedback-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  .feedback-toast.correct { background: var(--correct-bg); color: var(--correct); }
  .feedback-toast.incorrect { background: var(--incorrect-bg); color: var(--incorrect); }

  .text-center { text-align: center; }

  @media (max-width: 480px) {
    .pc-char-display { font-size: 4rem; }
    .pc-pinyin { font-size: 1.3rem; }
    .tone-choice-btn { padding: 12px 16px; font-size: 0.92rem; }
    .char-display { font-size: 3.2rem; }
    .pc-study-actions { flex-direction: column; }
  }
`
