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

/**
 * Lookup table: syllable → [tone1_char, tone2_char, tone3_char, tone4_char]
 * null means no common word exists for that tone. Used for TTS in Tests A & B.
 */
const SYLLABLE_TTS_CHAR = {
  'a':    ['啊',null,null,null],
  'ai':   ['哎','挨','矮','爱'],
  'an':   ['安',null,'暗','案'],
  'ang':  ['肮',null,null,null],
  'ao':   ['凹','熬','袄','奥'],
  'ba':   ['巴','拔','把','爸'],
  'bai':  ['掰','白','摆','拜'],
  'ban':  ['班','办','板','半'],
  'bang': ['帮',null,'榜','棒'],
  'bao':  ['包','雹','宝','报'],
  'bei':  ['杯','北',null,'背'],
  'ben':  ['奔',null,'本','笨'],
  'beng': ['崩',null,null,'蹦'],
  'bi':   ['逼','鼻','比','必'],
  'bing': ['冰',null,'饼','病'],
  'bo':   ['波','博',null,'薄'],
  'bu':   [null,null,'补','不'],
  'ca':   ['擦',null,null,null],
  'cai':  ['猜','才','采','菜'],
  'can':  ['餐','残','惨','灿'],
  'cang': ['仓','藏',null,null],
  'cao':  ['操',null,null,'草'],
  'ce':   [null,null,null,'测'],
  'cha':  ['叉','茶','差','诧'],
  'chai': ['拆',null,null,'柴'],
  'chan': ['搀','禅','产','颤'],
  'chang':['昌','长','厂','唱'],
  'chao': ['抄','朝',null,'炒'],
  'che':  ['车',null,null,'彻'],
  'chen': [null,'陈',null,'趁'],
  'cheng':['称',null,null,'称'],
  'chi':  ['吃','迟','齿','赤'],
  'chong':['冲','虫',null,'冲'],
  'chou': ['抽','绸','丑','臭'],
  'chu':  ['出',null,'处','处'],
  'chuan':['川','传','喘','串'],
  'chui': ['吹',null,'捶',null],
  'chun': ['春',null,'蠢',null],
  'ci':   [null,'词','此','次'],
  'cong': ['聪',null,null,'从'],
  'cu':   ['粗',null,null,'促'],
  'cui':  ['催',null,null,'脆'],
  'cun':  ['村',null,'寸',null],
  'cuo':  ['搓',null,null,'错'],
  'da':   ['搭','达','打','大'],
  'dai':  ['呆','抬','待','带'],
  'dan':  ['单','担','胆','但'],
  'dang': ['当',null,'党','当'],
  'dao':  ['刀',null,'倒','道'],
  'de':   ['德',null,null,'的'],
  'deng': ['灯',null,'等',null],
  'di':   ['低','笛','底','弟'],
  'ding': ['丁',null,'顶','定'],
  'dong': ['东',null,'懂','动'],
  'dou':  ['兜',null,'抖','豆'],
  'du':   ['都','读','堵','度'],
  'dui':  ['堆',null,null,'对'],
  'dun':  ['敦',null,'盾','顿'],
  'duo':  ['多','夺','朵','堕'],
  'e':    ['鹅',null,'饿','恶'],
  'en':   ['恩',null,null,null],
  'er':   ['儿',null,'耳','二'],
  'fa':   ['发',null,'法',null],
  'fan':  ['番','凡','反','饭'],
  'fang': ['方',null,'访','放'],
  'fei':  ['飞','肥',null,'废'],
  'fen':  ['分',null,'粉','奋'],
  'feng': ['风',null,'讽','凤'],
  'fo':   [null,'佛',null,null],
  'fu':   ['夫','服','府','父'],
  'gai':  ['该',null,'改','盖'],
  'gan':  ['干',null,'感','干'],
  'gang': ['刚',null,'港',null],
  'gao':  ['高',null,'稿','告'],
  'ge':   ['哥',null,'个','各'],
  'gen':  ['根',null,null,null],
  'geng': ['更',null,null,'更'],
  'gong': ['工',null,'拱','共'],
  'gou':  ['勾',null,'狗','够'],
  'gu':   ['孤',null,'鼓','故'],
  'gua':  ['瓜',null,'寡','挂'],
  'guai': ['乖',null,null,'怪'],
  'guan': ['关',null,'管','惯'],
  'guang':['光',null,'广',null],
  'gui':  ['规',null,'鬼','贵'],
  'guo':  ['锅','国',null,'过'],
  'ha':   ['哈',null,null,null],
  'hai':  ['孩',null,'海','害'],
  'han':  ['寒',null,'汉','汗'],
  'hang': ['航',null,null,null],
  'hao':  ['蒿',null,'好','号'],
  'he':   ['喝','河',null,'和'],
  'hei':  ['黑',null,null,null],
  'hen':  ['痕',null,'很','恨'],
  'hong': ['烘','红',null,'哄'],
  'hou':  ['喉',null,'吼','后'],
  'hu':   ['呼','壶','虎','护'],
  'hua':  ['花','华',null,'话'],
  'huai': ['怀',null,null,'坏'],
  'huan': ['欢',null,'缓','换'],
  'huang':['荒','黄',null,'晃'],
  'hui':  ['灰',null,'毁','惠'],
  'hun':  ['昏',null,null,'混'],
  'huo':  ['活',null,null,'货'],
  'ji':   ['机','极','几','记'],
  'jia':  ['家',null,'假','架'],
  'jian': ['间',null,'减','见'],
  'jiang':['江',null,'讲','酱'],
  'jiao': ['交',null,'脚','叫'],
  'jie':  ['接',null,'解','介'],
  'jin':  ['今',null,'紧','近'],
  'jing': ['京',null,'景','竟'],
  'jiu':  ['究',null,'九','就'],
  'ju':   ['居',null,'举','句'],
  'jue':  ['觉',null,null,'决'],
  'jun':  ['军',null,null,'俊'],
  'ka':   ['卡',null,null,'卡'],
  'kai':  ['开',null,null,'慨'],
  'kan':  ['刊',null,'坎','看'],
  'kang': ['康',null,null,'抗'],
  'kao':  [null,null,'烤','靠'],
  'ke':   ['科',null,'可','课'],
  'ken':  [null,null,'肯',null],
  'kong': ['空',null,'孔','控'],
  'kou':  ['抠',null,'口','扣'],
  'ku':   ['哭',null,'苦','库'],
  'kui':  ['亏',null,'愧',null],
  'kun':  ['昆',null,'捆','困'],
  'la':   ['拉',null,null,'辣'],
  'lai':  ['来',null,null,'赖'],
  'lan':  ['兰',null,'懒','烂'],
  'lang': ['朗',null,'朗',null],
  'lao':  ['捞',null,'老','涝'],
  'le':   ['勒',null,null,'乐'],
  'lei':  ['雷',null,null,'泪'],
  'leng': ['棱',null,'冷',null],
  'li':   ['离',null,'里','力'],
  'lian': ['连',null,'脸','练'],
  'liang':['量',null,'两','亮'],
  'liao': ['聊',null,null,'料'],
  'lin':  ['林',null,null,'吝'],
  'ling': ['零',null,'领','另'],
  'liu':  ['留',null,'柳','六'],
  'long': ['龙',null,null,'弄'],
  'lou':  ['楼',null,null,'漏'],
  'lu':   ['炉',null,'旅','路'],
  'lun':  ['论',null,null,'论'],
  'luo':  ['锣',null,'裸','落'],
  'ma':   ['妈','麻','马','骂'],
  'mai':  [null,null,'买','卖'],
  'man':  [null,'蛮','满','慢'],
  'mang': ['忙',null,null,null],
  'mao':  ['猫','毛','卯','帽'],
  'mei':  [null,'没','美','妹'],
  'men':  ['门',null,null,null],
  'meng': ['蒙',null,'猛','梦'],
  'mi':   ['迷',null,'米','秘'],
  'mian': [null,'棉',null,'面'],
  'miao': ['苗',null,'秒','庙'],
  'ming': ['明',null,null,'命'],
  'mo':   [null,'磨',null,'墨'],
  'mu':   ['木',null,'母','墓'],
  'na':   ['拿',null,'哪','那'],
  'nai':  [null,null,'奶',null],
  'nan':  [null,'南',null,'难'],
  'nao':  [null,null,'恼','闹'],
  'nei':  [null,null,null,'内'],
  'ni':   ['泥',null,'你','逆'],
  'nian': ['年',null,'碾','念'],
  'niang':['娘',null,null,null],
  'ning': ['宁',null,'宁',null],
  'niu':  ['牛',null,'纽',null],
  'nong': [null,'农',null,'弄'],
  'nuo':  ['挪',null,null,'诺'],
  'o':    ['哦',null,null,null],
  'ou':   ['欧',null,'呕','偶'],
  'pa':   [null,'爬',null,'怕'],
  'pai':  ['拍','牌',null,'派'],
  'pan':  ['盘',null,'判','叛'],
  'pang': [null,'旁',null,'胖'],
  'pao':  ['抛','袍','跑','炮'],
  'pei':  ['陪',null,null,'配'],
  'pen':  ['盆',null,null,'喷'],
  'peng': [null,'朋',null,'碰'],
  'pi':   ['批','皮','痞','屁'],
  'ping': [null,'平',null,null],
  'po':   ['坡','婆',null,'破'],
  'pu':   [null,'葡','普','铺'],
  'qi':   ['期','其','起','气'],
  'qian': ['钱',null,'浅','欠'],
  'qiang':['强',null,null,'强'],
  'qiao': [null,'桥','巧',null],
  'qin':  ['琴',null,null,null],
  'qing': ['清',null,'请','庆'],
  'qiu':  ['秋','球',null,null],
  'qu':   ['曲',null,'取','去'],
  'quan': [null,'全',null,null],
  'ran':  [null,'然','染',null],
  'rang': [null,null,null,'让'],
  'ren':  ['人',null,'忍','任'],
  'ri':   [null,null,null,'日'],
  'rong': [null,'荣',null,null],
  'rou':  [null,'柔',null,'肉'],
  'ru':   ['如',null,null,'入'],
  'ruo':  [null,null,null,'若'],
  'sa':   ['撒',null,null,null],
  'sai':  ['腮',null,null,'赛'],
  'san':  ['三',null,'伞','散'],
  'sang': ['桑',null,'嗓',null],
  'sao':  ['骚',null,null,'扫'],
  'sha':  ['沙',null,'傻',null],
  'shai': ['筛',null,null,'晒'],
  'shan': ['山',null,'闪','扇'],
  'shang':['商',null,null,'上'],
  'shao': ['烧',null,'少','绍'],
  'she':  [null,'蛇',null,'射'],
  'shen': ['深',null,'审','慎'],
  'sheng':['生',null,'省','盛'],
  'shi':  ['诗','时','始','是'],
  'shou': ['收',null,'手','受'],
  'shu':  ['书','熟','鼠','树'],
  'shui': [null,'谁','水','睡'],
  'shun': [null,null,'顺',null],
  'shuo': [null,null,null,'说'],
  'si':   ['丝',null,'死','四'],
  'song': ['松',null,null,'送'],
  'su':   ['苏',null,'素','速'],
  'sui':  ['虽',null,null,'碎'],
  'sun':  ['孙',null,null,'损'],
  'suo':  [null,null,'所',null],
  'ta':   ['他',null,'塔','踏'],
  'tai':  ['台','抬',null,'太'],
  'tan':  ['谈',null,'坦','探'],
  'tang': ['汤',null,'躺','烫'],
  'tao':  ['掏',null,null,'套'],
  'ti':   ['踢','提','体','替'],
  'tian': ['天','田','舔',null],
  'ting': ['厅',null,'挺',null],
  'tong': ['通',null,'桶','痛'],
  'tou':  ['头',null,null,'透'],
  'tu':   ['图',null,'土','兔'],
  'tui':  ['推',null,null,'腿'],
  'tun':  ['吞',null,null,'顿'],
  'wa':   ['挖',null,null,'袜'],
  'wai':  ['歪',null,null,'外'],
  'wan':  ['弯',null,'碗','晚'],
  'wang': ['王',null,'往','忘'],
  'wei':  ['威',null,'为','位'],
  'wen':  ['温',null,'稳','问'],
  'wo':   ['窝',null,'我','握'],
  'wu':   ['乌',null,'五','物'],
  'xi':   ['西',null,'喜','系'],
  'xia':  ['虾',null,null,'下'],
  'xian': ['先',null,'险','现'],
  'xiang':['香',null,'响','向'],
  'xiao': ['消',null,'小','笑'],
  'xie':  ['些',null,'写','谢'],
  'xin':  ['心',null,null,'信'],
  'xing': ['星',null,'醒','性'],
  'xu':   ['需',null,'许','续'],
  'xue':  [null,'学','雪','血'],
  'xun':  ['寻',null,null,'训'],
  'ya':   ['压',null,'哑','亚'],
  'yan':  ['烟',null,'眼','燕'],
  'yang': ['羊',null,'养','样'],
  'yao':  ['腰',null,'咬','要'],
  'ye':   [null,null,'也','夜'],
  'yi':   ['一',null,'以','义'],
  'yin':  ['因',null,'引','印'],
  'ying': ['英',null,'影','应'],
  'yong': ['勇',null,null,'用'],
  'you':  ['由',null,'有','又'],
  'yu':   ['鱼',null,'语','玉'],
  'yuan': ['源',null,'远','院'],
  'yue':  [null,null,null,'月'],
  'yun':  ['云',null,'允','运'],
  'za':   ['扎',null,null,'杂'],
  'zai':  ['灾',null,null,'在'],
  'zan':  [null,null,'咱','赞'],
  'zao':  ['糟',null,'早','造'],
  'ze':   ['则',null,null,null],
  'zen':  [null,null,'怎',null],
  'zha':  ['扎',null,null,'炸'],
  'zhai': ['摘',null,null,'窄'],
  'zhan': ['占',null,'展','站'],
  'zhang':['张',null,'长','涨'],
  'zhao': ['招',null,'找','照'],
  'zhe':  ['折',null,null,'这'],
  'zhen': ['真',null,'枕','阵'],
  'zheng':['争',null,null,'正'],
  'zhi':  ['知','之','只','治'],
  'zhong':['中',null,'肿','重'],
  'zhou': ['周',null,'肘','宙'],
  'zhu':  ['猪',null,'主','住'],
  'zhuan':['专',null,'转','传'],
  'zhui': ['追',null,null,null],
  'zhun': ['准',null,null,null],
  'zhuo': ['桌',null,null,'着'],
  'zi':   ['资',null,'子','字'],
  'zong': ['宗',null,null,'总'],
  'zou':  ['走',null,null,null],
  'zu':   ['足',null,'祖',null],
  'zui':  ['嘴',null,null,'最'],
  'zuo':  ['昨',null,'左','做'],
}

/**
 * Get a Chinese character suitable for TTS for a given syllable + tone.
 * Returns null if no character is known (caller should fall back to tone synth).
 */
export function getTTSChar(syllable, tone) {
  const row = SYLLABLE_TTS_CHAR[syllable]
  return row?.[tone - 1] ?? null
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