// ═══════════════════════════════════════
// Whisper Model — ASR-based tone detection
// Uses @xenova/transformers (Whisper-tiny, ~40MB, runs in-browser via ONNX)
// Strategy: transcribe spoken syllable → Chinese character → look up tone
// Accuracy estimate: ~70-75% for single Chinese syllables
// ═══════════════════════════════════════

let transcriber = null
let loadPromise = null

/**
 * Load Whisper-tiny (downloaded once, cached in browser).
 * @param {Function} onProgress - (status, progress 0-100) callback
 */
export async function loadWhisper(onProgress) {
  if (transcriber) return transcriber
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const { pipeline } = await import('@xenova/transformers')
    transcriber = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny',
      {
        progress_callback: (p) => {
          if (p.status === 'downloading') onProgress?.('downloading', Math.round(p.progress ?? 0))
          if (p.status === 'ready') onProgress?.('ready', 100)
        },
      }
    )
    return transcriber
  })()

  return loadPromise
}

/**
 * Detect Mandarin tone from raw PCM using Whisper ASR.
 * Transcribes the audio to a Chinese character, then looks up its tone.
 *
 * @param {Float32Array} samples - raw audio at native sample rate
 * @param {number} sampleRate
 * @param {string|null} targetBase - known base syllable (e.g. 'ma'), used to prefer matching chars
 * @returns {number|null} detected tone (1-4) or null if uncertain
 */
export async function detectToneWithWhisper(samples, sampleRate, targetBase = null) {
  if (!transcriber) throw new Error('Whisper not loaded')

  // Whisper expects Float32Array at 16kHz
  const audio16k = sampleRate === 16000 ? samples : resampleTo16k(samples, sampleRate)

  let result
  try {
    result = await transcriber(
      { array: audio16k, sampling_rate: 16000 },
      { language: 'chinese', task: 'transcribe' }
    )
  } catch (e) {
    console.warn('[Whisper] inference failed:', e.message)
    return null
  }

  const text = result?.text?.trim()
  if (!text) return null

  // Try to match characters to our tone map, preferring targetBase matches
  const chars = [...text] // handles multi-byte Chinese correctly

  // First pass: look for chars matching the target base syllable
  if (targetBase) {
    for (const char of chars) {
      const entry = CHAR_TONE_MAP[char]
      if (entry && entry.base === targetBase && entry.tone !== 5) return entry.tone
    }
  }

  // Second pass: return first recognized char tone (any base)
  for (const char of chars) {
    const entry = CHAR_TONE_MAP[char]
    if (entry && entry.tone !== 5) return entry.tone
  }

  return null
}

// ── Downsample to 16kHz via linear interpolation ──
function resampleTo16k(samples, fromRate) {
  const ratio = fromRate / 16000
  const newLength = Math.floor(samples.length / ratio)
  const out = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const src = i * ratio
    const lo = Math.floor(src)
    const hi = Math.min(lo + 1, samples.length - 1)
    out[i] = samples[lo] * (1 - (src - lo)) + samples[hi] * (src - lo)
  }
  return out
}

// ── Character → { base, tone } lookup ──
// Covers the 24 characters in CHAR_POOL + tonal siblings + top common chars
// tone: 1=阴平, 2=阳平, 3=上声, 4=去声, 5=neutral (excluded from detection)
export const CHAR_TONE_MAP = {
  // ma
  '妈': { base: 'ma', tone: 1 }, '麻': { base: 'ma', tone: 2 },
  '马': { base: 'ma', tone: 3 }, '骂': { base: 'ma', tone: 4 },
  // shu
  '书': { base: 'shu', tone: 1 }, '熟': { base: 'shu', tone: 2 },
  '鼠': { base: 'shu', tone: 3 }, '树': { base: 'shu', tone: 4 },
  // ta
  '他': { base: 'ta', tone: 1 }, '她': { base: 'ta', tone: 1 },
  '它': { base: 'ta', tone: 1 }, '塔': { base: 'ta', tone: 3 },
  '踏': { base: 'ta', tone: 4 }, '塌': { base: 'ta', tone: 1 },
  // tian
  '天': { base: 'tian', tone: 1 }, '田': { base: 'tian', tone: 2 },
  '甜': { base: 'tian', tone: 2 }, '舔': { base: 'tian', tone: 3 },
  '填': { base: 'tian', tone: 2 },
  // hua
  '花': { base: 'hua', tone: 1 }, '华': { base: 'hua', tone: 2 },
  '话': { base: 'hua', tone: 4 }, '化': { base: 'hua', tone: 4 },
  // mao
  '猫': { base: 'mao', tone: 1 }, '毛': { base: 'mao', tone: 2 },
  '帽': { base: 'mao', tone: 4 }, '茂': { base: 'mao', tone: 4 },
  // ren
  '人': { base: 'ren', tone: 2 }, '忍': { base: 'ren', tone: 3 },
  '任': { base: 'ren', tone: 4 }, '刃': { base: 'ren', tone: 4 },
  // lai
  '来': { base: 'lai', tone: 2 }, '赖': { base: 'lai', tone: 4 },
  // cha
  '茶': { base: 'cha', tone: 2 }, '差': { base: 'cha', tone: 1 },
  '察': { base: 'cha', tone: 2 }, '叉': { base: 'cha', tone: 1 },
  // xue
  '学': { base: 'xue', tone: 2 }, '雪': { base: 'xue', tone: 3 },
  '血': { base: 'xue', tone: 4 },
  // yu
  '鱼': { base: 'yu', tone: 2 }, '玉': { base: 'yu', tone: 4 },
  '语': { base: 'yu', tone: 3 }, '于': { base: 'yu', tone: 2 },
  '与': { base: 'yu', tone: 3 }, '欲': { base: 'yu', tone: 4 },
  // hong
  '红': { base: 'hong', tone: 2 }, '哄': { base: 'hong', tone: 3 },
  '洪': { base: 'hong', tone: 2 },
  // xiao
  '小': { base: 'xiao', tone: 3 }, '笑': { base: 'xiao', tone: 4 },
  '消': { base: 'xiao', tone: 1 }, '晓': { base: 'xiao', tone: 3 },
  // hao
  '好': { base: 'hao', tone: 3 }, '号': { base: 'hao', tone: 4 },
  '毫': { base: 'hao', tone: 2 }, '豪': { base: 'hao', tone: 2 },
  // shui
  '水': { base: 'shui', tone: 3 }, '睡': { base: 'shui', tone: 4 },
  '谁': { base: 'shui', tone: 2 },
  // ni
  '你': { base: 'ni', tone: 3 }, '尼': { base: 'ni', tone: 2 },
  '逆': { base: 'ni', tone: 4 }, '泥': { base: 'ni', tone: 2 },
  // gou
  '狗': { base: 'gou', tone: 3 }, '沟': { base: 'gou', tone: 1 },
  '够': { base: 'gou', tone: 4 }, '购': { base: 'gou', tone: 4 },
  // da
  '大': { base: 'da', tone: 4 }, '打': { base: 'da', tone: 3 },
  '搭': { base: 'da', tone: 1 },
  // qu
  '去': { base: 'qu', tone: 4 }, '曲': { base: 'qu', tone: 1 },
  '取': { base: 'qu', tone: 3 }, '趣': { base: 'qu', tone: 4 },
  // si
  '四': { base: 'si', tone: 4 }, '丝': { base: 'si', tone: 1 },
  '死': { base: 'si', tone: 3 }, '寺': { base: 'si', tone: 4 },
  // fan
  '饭': { base: 'fan', tone: 4 }, '帆': { base: 'fan', tone: 1 },
  '烦': { base: 'fan', tone: 2 }, '反': { base: 'fan', tone: 3 },
  '范': { base: 'fan', tone: 4 },
  // kan
  '看': { base: 'kan', tone: 4 }, '刊': { base: 'kan', tone: 1 },
  '侃': { base: 'kan', tone: 3 },
  // yue
  '月': { base: 'yue', tone: 4 }, '越': { base: 'yue', tone: 4 },
  '约': { base: 'yue', tone: 1 }, '岳': { base: 'yue', tone: 4 },
  // Top 50 common Chinese characters (for future Test X/Y/Z)
  '一': { base: 'yi', tone: 1 },  '不': { base: 'bu', tone: 4 },
  '是': { base: 'shi', tone: 4 }, '了': { base: 'le', tone: 5 },
  '在': { base: 'zai', tone: 4 }, '有': { base: 'you', tone: 3 },
  '我': { base: 'wo', tone: 3 },  '他': { base: 'ta', tone: 1 },
  '这': { base: 'zhe', tone: 4 }, '中': { base: 'zhong', tone: 1 },
  '上': { base: 'shang', tone: 4 },'们': { base: 'men', tone: 5 },
  '来': { base: 'lai', tone: 2 }, '到': { base: 'dao', tone: 4 },
  '说': { base: 'shuo', tone: 1 },'和': { base: 'he', tone: 2 },
  '地': { base: 'di', tone: 4 },  '出': { base: 'chu', tone: 1 },
  '道': { base: 'dao', tone: 4 }, '也': { base: 'ye', tone: 3 },
  '时': { base: 'shi', tone: 2 }, '年': { base: 'nian', tone: 2 },
  '得': { base: 'de', tone: 2 },  '就': { base: 'jiu', tone: 4 },
  '那': { base: 'na', tone: 4 },  '要': { base: 'yao', tone: 4 },
  '下': { base: 'xia', tone: 4 }, '以': { base: 'yi', tone: 3 },
  '生': { base: 'sheng', tone: 1 },'会': { base: 'hui', tone: 4 },
  '自': { base: 'zi', tone: 4 },  '着': { base: 'zhe', tone: 5 },
  '去': { base: 'qu', tone: 4 },  '之': { base: 'zhi', tone: 1 },
  '过': { base: 'guo', tone: 4 }, '后': { base: 'hou', tone: 4 },
  '从': { base: 'cong', tone: 2 },'里': { base: 'li', tone: 3 },
  '人': { base: 'ren', tone: 2 }, '能': { base: 'neng', tone: 2 },
  '如': { base: 'ru', tone: 2 },  '对': { base: 'dui', tone: 4 },
  '多': { base: 'duo', tone: 1 }, '国': { base: 'guo', tone: 2 },
  '而': { base: 'er', tone: 2 },  '经': { base: 'jing', tone: 1 },
  '家': { base: 'jia', tone: 1 }, '两': { base: 'liang', tone: 3 },
  '没': { base: 'mei', tone: 2 }, '于': { base: 'yu', tone: 2 },
  '所': { base: 'suo', tone: 3 }, '个': { base: 'ge', tone: 4 },
}
