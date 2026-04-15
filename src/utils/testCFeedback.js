// ═══════════════════════════════════════
// Test C — feedback message pools
// Source: "Test C feedback.docx" (Qi)
// ═══════════════════════════════════════

/** Praise lines for a fully-correct answer (high confidence). */
export const PRAISE_HIGH = [
  'You nailed it!',
  'Perfect!',
  'Exactly right!',
  "That's it!",
  'You got it!',
  "That's exactly what I wanted!",
  'Right on!',
]

/** Praise lines for a correct answer (medium confidence). */
export const PRAISE_MID = [
  "That's really good!",
  "That's excellent!",
  "That's very nice!",
  'That sounds great!',
  "That's much better!",
  "That's impressive!",
  "That's spot on!",
]

/** Praise lines for a correct but lower-confidence answer. */
export const PRAISE_LOW = [
  'Good job!',
  'Nice work!',
  'Well done!',
  'Great effort!',
  'Good work!',
  'Keep it up!',
  'Nicely done!',
]

/** Encouragement when the user was wrong but close (e.g. pitch model agreed). */
export const ALMOST = [
  'Almost perfect!',
  'Very close!',
  'Just about perfect!',
  'Nearly there!',
  'So close!',
  "That's almost it!",
  'Just a tiny bit more!',
]

/**
 * Per-tone reminders + 3 retry-style variations.
 * `intro` = reminder of what the tone is.
 * `variations` = alternative encouraging phrasings.
 */
export const TONE_REMINDERS = {
  1: {
    intro:
      'Remember, the first tone is a high, level, steady pitch. Imagine you are an opera singer holding a high note. Start high and keep it there — don\'t let it drop.',
    variations: [
      "Good! Let's try it again. Keep your voice high and steady, like you're holding a long musical note. Don't let it move up or down — just stay flat and strong.",
      'Almost there — one more time. Start high and keep the sound even all the way through. Think of a straight line, not a curve.',
      "Nice try! Let's do it again. Imagine your voice is floating at the top and staying there. No dropping, no rising — just smooth and level.",
    ],
  },
  2: {
    intro:
      'Remember, the second tone is a rising pitch. In English we use a rising pitch when asking questions. Think of how your voice sounds when you say "what?" with curiosity.',
    variations: [
      "Good! Let's try it again. Start a bit lower and let your voice rise, like you're asking a question. Let it move upward naturally.",
      'Almost there — one more time. Think of your voice going up, like saying "huh?" or "what?" with curiosity. Keep that upward feeling.',
      "Nice try! Let's do it again. Begin in the middle and glide up. Don't jump — make it a smooth rise.",
    ],
  },
  3: {
    intro:
      'Remember, the third tone has a falling–rising contour. It starts mid, dips down to a low point, and then rises slightly. Tip: lower your chin as your voice falls, then lift it slightly as it rises.',
    variations: [
      "Good! Let's try it again. Let your voice go down first, then come back up slightly. It's like a small dip, not a big jump.",
      'Almost there — one more time. Lower your voice to the bottom, then lift it a little. Think of a gentle "V" shape.',
      "Nice try! Let's do it again. Start mid, go down low, and then rise a bit. Don't rush — feel the full movement.",
    ],
  },
  4: {
    intro:
      'Remember, the fourth tone is a sharp, falling pitch. Start high and drop quickly and strongly. Imagine saying "no!" in a decisive way — that\'s the feeling of the fourth tone.',
    variations: [
      "Good! Let's try it again. Start high and drop your voice quickly and clearly. Make it strong and short.",
      'Almost there — one more time. Think of giving a firm command. Your voice should fall fast and sound decisive.',
      "Nice try! Let's do it again. Go from high to low in one quick movement. No hesitation — just a sharp drop.",
    ],
  },
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Pick a praise line based on ensemble confidence (0-100).
 * High confidence → strongest praise; lower confidence → milder praise.
 */
export function pickPraise(confidence = 0) {
  if (confidence >= 85) return pick(PRAISE_HIGH)
  if (confidence >= 70) return pick(PRAISE_MID)
  return pick(PRAISE_LOW)
}

/**
 * Build a wrong-answer feedback message for a given target tone.
 * Returns { intro, variation } so the UI can format as it likes.
 *
 * @param {number} tone        target tone 1-4
 * @param {boolean} pitchAgreed if true, returns an "almost" line instead
 */
export function buildWrongFeedback(tone, pitchAgreed = false) {
  if (pitchAgreed) {
    return { intro: pick(ALMOST), variation: TONE_REMINDERS[tone]?.intro || '' }
  }
  const r = TONE_REMINDERS[tone]
  if (!r) return { intro: 'Try again!', variation: '' }
  return { intro: r.intro, variation: pick(r.variations) }
}
