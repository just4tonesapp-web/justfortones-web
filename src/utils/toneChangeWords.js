// ═══════════════════════════════════════════════════════════════════
// Tone-change practice words — 20 per type, 60 total.
// Recordings: public/audio/tone-change/<type>/<f>.m4a  (real sandhi speech)
//   '33'  — two 3rd tones written 3+3, said 2+3 (filename uses WRITTEN tones)
//   'yi'  — 一 sandhi (filename's FIRST tone = 一's ACTUAL/sandhi tone)
//   'bu'  — 不 sandhi (filename's FIRST tone = 不's ACTUAL/sandhi tone)
// f = "<s1><t1><s2><t2>" (parsed in the view); c = characters.
// ═══════════════════════════════════════════════════════════════════
export const TONE_CHANGE = {
  '33': [
    { f: 'ni3hao3', c: '你好' }, { f: 'hao3jiu3', c: '好久' }, { f: 'shui3guo3', c: '水果' }, { f: 'na3li3', c: '哪里' },
    { f: 'wan3dian3', c: '晚点' }, { f: 'xi3zao3', c: '洗澡' }, { f: 'da3sao3', c: '打扫' }, { f: 'liao3jie3', c: '了解' },
    { f: 'ying3xiang3', c: '影响' }, { f: 'shou3biao3', c: '手表' }, { f: 'wang3bei3', c: '往北' }, { f: 'suo3yi3', c: '所以' },
    { f: 'lao3hu3', c: '老虎' }, { f: 'lao3shu3', c: '老鼠' }, { f: 'biao3yan3', c: '表演' }, { f: 'ke3yi3', c: '可以' },
    { f: 'hen3yuan3', c: '很远' }, { f: 'hen3hao3', c: '很好' }, { f: 'hen3mei3', c: '很美' }, { f: 'zhi3you3', c: '只有' },
  ],
  'yi': [
    { f: 'yi2ban4', c: '一半' }, { f: 'yi2ding4', c: '一定' }, { f: 'yi2ge4', c: '一个' }, { f: 'yi2gong4', c: '一共' },
    { f: 'yi2wei4', c: '一位' }, { f: 'yi2xia4', c: '一下' }, { f: 'yi2yang4', c: '一样' }, { f: 'yi4ba3', c: '一把' },
    { f: 'yi4ban1', c: '一般' }, { f: 'yi4bian1', c: '一边' }, { f: 'yi4duo3', c: '一朵' }, { f: 'yi4ming2', c: '一名' },
    { f: 'yi4qi3', c: '一起' }, { f: 'yi4shuang1', c: '一双' }, { f: 'yi4tiao2', c: '一条' }, { f: 'yi4tou2', c: '一头' },
    { f: 'yi4xie1', c: '一些' }, { f: 'yi4zhang1', c: '一张' }, { f: 'yi4zhi1', c: '一只' }, { f: 'yi4zhi2', c: '一直' },
  ],
  'bu': [
    { f: 'bu2cuo4', c: '不错' }, { f: 'bu2da4', c: '不大' }, { f: 'bu2dan4', c: '不但' }, { f: 'bu2jian4', c: '不见' },
    { f: 'bu2qu4', c: '不去' }, { f: 'bu2re4', c: '不热' }, { f: 'bu2yao4', c: '不要' }, { f: 'bu2yong4', c: '不用' },
    { f: 'bu4ai3', c: '不矮' }, { f: 'bu4chi1', c: '不吃' }, { f: 'bu4duo1', c: '不多' }, { f: 'bu4gao1', c: '不高' },
    { f: 'bu4hao3', c: '不好' }, { f: 'bu4jiu3', c: '不久' }, { f: 'bu4leng3', c: '不冷' }, { f: 'bu4mei3', c: '不美' },
    { f: 'bu4shao3', c: '不少' }, { f: 'bu4tong2', c: '不同' }, { f: 'bu4xiao3', c: '不小' }, { f: 'bu4xing2', c: '不行' },
  ],
}
