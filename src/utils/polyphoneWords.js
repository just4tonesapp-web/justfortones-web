// ═══════════════════════════════════════════════════════════════════
// Polyphone (多音字) question pool — Practice IV.
// DRAFT content by Claude 2026-09-02, pending QSY's review: she owns the
// character/phrase selection and the explanation wording (per team feature
// spec: 发音-多音字, 选择题, 参照变调练习).
// Each entry: the phrase shown (target char highlighted by the view),
// the readings offered as choices, which one is correct here, and why.
// ═══════════════════════════════════════════════════════════════════

export const POLYPHONES = [
  { char: '得', phrase: '我得走了', gloss: 'I have to go', options: ['dé', 'děi', 'de'], correct: 1, why: 'Meaning "must / have to" → děi.' },
  { char: '得', phrase: '得到礼物', gloss: 'receive a gift', options: ['dé', 'děi', 'de'], correct: 0, why: 'Meaning "obtain / get" → dé.' },
  { char: '得', phrase: '他跑得快', gloss: 'he runs fast', options: ['dé', 'děi', 'de'], correct: 2, why: 'Linking a verb to how it\'s done (degree particle) → neutral de.' },
  { char: '了', phrase: '吃了饭', gloss: 'have eaten', options: ['le', 'liǎo'], correct: 0, why: 'Completed-action particle → neutral le.' },
  { char: '了', phrase: '了解情况', gloss: 'understand the situation', options: ['le', 'liǎo'], correct: 1, why: 'Meaning "to understand / finish" → liǎo.' },
  { char: '长', phrase: '头发很长', gloss: 'hair is long', options: ['cháng', 'zhǎng'], correct: 0, why: 'Meaning "long" → cháng.' },
  { char: '长', phrase: '长大以后', gloss: 'after growing up', options: ['cháng', 'zhǎng'], correct: 1, why: 'Meaning "to grow" → zhǎng.' },
  { char: '行', phrase: '骑自行车', gloss: 'ride a bicycle', options: ['xíng', 'háng'], correct: 0, why: 'Meaning "to go / OK" (自行车 = self-moving vehicle) → xíng.' },
  { char: '行', phrase: '去银行', gloss: 'go to the bank', options: ['xíng', 'háng'], correct: 1, why: 'Meaning "a place of business / row" → háng.' },
  { char: '还', phrase: '还没吃饭', gloss: 'haven\'t eaten yet', options: ['hái', 'huán'], correct: 0, why: 'Meaning "still / yet" → hái.' },
  { char: '还', phrase: '还书给老师', gloss: 'return the book', options: ['hái', 'huán'], correct: 1, why: 'Meaning "to give back" → huán.' },
  { char: '重', phrase: '箱子很重', gloss: 'the box is heavy', options: ['zhòng', 'chóng'], correct: 0, why: 'Meaning "heavy" → zhòng.' },
  { char: '重', phrase: '重新开始', gloss: 'start over', options: ['zhòng', 'chóng'], correct: 1, why: 'Meaning "again / repeat" → chóng.' },
  { char: '教', phrase: '教你说中文', gloss: 'teach you Chinese', options: ['jiāo', 'jiào'], correct: 0, why: 'The verb "to teach (someone something)" → jiāo.' },
  { char: '教', phrase: '在教室里', gloss: 'in the classroom', options: ['jiāo', 'jiào'], correct: 1, why: 'In compound nouns like 教室/教育 → jiào.' },
  { char: '乐', phrase: '生日快乐', gloss: 'happy birthday', options: ['lè', 'yuè'], correct: 0, why: 'Meaning "happy" → lè.' },
  { char: '乐', phrase: '听音乐', gloss: 'listen to music', options: ['lè', 'yuè'], correct: 1, why: 'Meaning "music" → yuè.' },
  { char: '觉', phrase: '睡觉', gloss: 'to sleep', options: ['jué', 'jiào'], correct: 1, why: 'In 睡觉 (sleep) → jiào.' },
  { char: '觉', phrase: '觉得很好', gloss: 'feel it\'s good', options: ['jué', 'jiào'], correct: 0, why: 'Meaning "to feel / sense" → jué.' },
  { char: '好', phrase: '好朋友', gloss: 'good friend', options: ['hǎo', 'hào'], correct: 0, why: 'Meaning "good" → hǎo (3rd tone).' },
  { char: '好', phrase: '爱好是画画', gloss: 'hobby is drawing', options: ['hǎo', 'hào'], correct: 1, why: 'Meaning "to like / hobby" → hào (4th tone).' },
  { char: '中', phrase: '中国人', gloss: 'Chinese person', options: ['zhōng', 'zhòng'], correct: 0, why: 'Meaning "middle / China" → zhōng.' },
  { char: '中', phrase: '中奖了', gloss: 'won a prize', options: ['zhōng', 'zhòng'], correct: 1, why: 'Meaning "to hit / win" → zhòng.' },
  { char: '数', phrase: '数学课', gloss: 'math class', options: ['shù', 'shǔ'], correct: 0, why: 'The noun "number" (数学 = math) → shù.' },
  { char: '数', phrase: '数一数', gloss: 'count them', options: ['shù', 'shǔ'], correct: 1, why: 'The verb "to count" → shǔ.' },
  { char: '便', phrase: '很方便', gloss: 'very convenient', options: ['biàn', 'pián'], correct: 0, why: 'Meaning "convenient" → biàn.' },
  { char: '便', phrase: '很便宜', gloss: 'very cheap', options: ['biàn', 'pián'], correct: 1, why: 'In 便宜 (cheap) → pián.' },
  { char: '地', phrase: '地方很大', gloss: 'the place is big', options: ['dì', 'de'], correct: 0, why: 'Meaning "ground / place" → dì.' },
  { char: '地', phrase: '慢慢地走', gloss: 'walk slowly', options: ['dì', 'de'], correct: 1, why: 'Turning an adjective into an adverb → neutral de.' },
  { char: '空', phrase: '天空很蓝', gloss: 'the sky is blue', options: ['kōng', 'kòng'], correct: 0, why: 'Meaning "sky / empty" → kōng.' },
  { char: '空', phrase: '有空来玩', gloss: 'come over when free', options: ['kōng', 'kòng'], correct: 1, why: 'Meaning "free time" → kòng.' },
]
