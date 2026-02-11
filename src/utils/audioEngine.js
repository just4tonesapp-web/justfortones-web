import { Yin } from 'pitchfinder'

export class AudioEngine {
  constructor() {
    this.audioContext = null
    this.detectPitch = Yin({ sampleRate: 44100 })
    this.isRecording = false
    this.stream = null
  }

  async start() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (this.audioContext.state === 'suspended') await this.audioContext.resume()

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      source.connect(this.analyser)
      this.isRecording = true
      this.processAudio()
      return true
    } catch (err) {
      alert('Cannot access microphone')
      return false
    }
  }

  processAudio() {
    if (!this.isRecording) return
    requestAnimationFrame(() => this.processAudio())
  }

  getPitch() {
    if (!this.isRecording || !this.analyser) return null
    const buffer = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(buffer)
    const pitch = this.detectPitch(buffer)
    return pitch
  }

  stop() {
    this.isRecording = false
    if (this.stream) this.stream.getTracks().forEach(t => t.stop())
  }
}
