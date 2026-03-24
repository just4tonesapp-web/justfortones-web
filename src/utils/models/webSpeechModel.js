// ═══════════════════════════════════════
// Web Speech API — browser-native speech recognition for tone detection
//
// Uses webkitSpeechRecognition (Chrome/Edge/Safari) with lang:'zh-CN'
// to transcribe spoken Chinese, then looks up tone via CHAR_TONE_MAP.
//
// Must run in parallel with AudioEngine (separate mic stream).
// Call startWebSpeech() when recording starts, stopWebSpeech() when done.
// ═══════════════════════════════════════

import { CHAR_TONE_MAP } from './whisperModel.js'

let recognition = null
let lastResult = null
let resultPromiseResolve = null

/**
 * Feature detection — is Web Speech API available in this browser?
 */
export function isWebSpeechAvailable() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

/**
 * Dummy "load" for consistency with other models.
 * Throws if browser doesn't support Web Speech API.
 */
export async function loadWebSpeech() {
  if (!isWebSpeechAvailable()) {
    throw new Error('Web Speech API not supported in this browser')
  }
}

/**
 * Start a recognition session. Call this when mic recording begins.
 */
export function startWebSpeech() {
  lastResult = null

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 3

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript.trim()
      if (transcript) lastResult = transcript
    }
  }

  recognition.onerror = (event) => {
    console.warn('[WebSpeech] error:', event.error)
  }

  recognition.onend = () => {
    if (resultPromiseResolve) {
      resultPromiseResolve(lastResult)
      resultPromiseResolve = null
    }
  }

  recognition.start()
}

/**
 * Stop recognition and return the result.
 * Resolves within 2 seconds (returns null on timeout).
 * @returns {Promise<string|null>} recognized Chinese text
 */
export function stopWebSpeech() {
  return new Promise((resolve) => {
    if (lastResult) {
      try { recognition?.stop() } catch (e) { /* ignore */ }
      resolve(lastResult)
      return
    }

    resultPromiseResolve = resolve

    try { recognition?.stop() } catch (e) { /* ignore */ }

    setTimeout(() => {
      if (resultPromiseResolve) {
        resultPromiseResolve(lastResult)
        resultPromiseResolve = null
      }
    }, 2000)
  })
}

/**
 * Given recognized text, look up tone via CHAR_TONE_MAP.
 * @param {string|null} text — recognized Chinese text
 * @param {string|null} targetBase — known base syllable hint (e.g. 'ma')
 * @returns {number|null} tone 1-4 or null
 */
export function detectToneFromText(text, targetBase = null) {
  if (!text) return null
  const chars = [...text]

  if (targetBase) {
    for (const char of chars) {
      const entry = CHAR_TONE_MAP[char]
      if (entry && entry.base === targetBase && entry.tone !== 5) return entry.tone
    }
  }

  for (const char of chars) {
    const entry = CHAR_TONE_MAP[char]
    if (entry && entry.tone !== 5) return entry.tone
  }

  return null
}
