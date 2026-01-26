import { Yin } from 'pitchfinder'

export class AudioEngine {
  constructor() {
    this.audioContext = null
    this.analyser = null
    this.detectPitch = Yin({ sampleRate: 44100 }) // 算法初始化
    this.isRecording = false
    this.pitchData = [] 
    this.stream = null
  }

  async start() {
    // 1. 初始化 AudioContext (浏览器要求必须在点击事件中触发)
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    // 2. 获取麦克风权限
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048 // 采样精度
      source.connect(this.analyser)
      
      this.isRecording = true
      this.pitchData = [] // 清空旧数据
      this.processAudio()
      console.log("Recording started...")
    } catch (err) {
      console.error("Microphone access denied:", err)
      alert("请允许麦克风权限！")
    }
  }

  processAudio() {
    if (!this.isRecording) return

    const buffer = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(buffer)
    
    // 计算音高
    const pitch = this.detectPitch(buffer)
    
    // 简单的降噪：只记录 70Hz (男低音) 到 500Hz (女高音) 之间的声音
    // 如果 pitch 为 null，说明没说话
    if (pitch && pitch > 70 && pitch < 500) {
      this.pitchData.push(pitch)
    }

    requestAnimationFrame(() => this.processAudio())
  }

  stop() {
    this.isRecording = false
    // 停止麦克风占用
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
    }
    console.log("Recording stopped. Data points:", this.pitchData.length)
    return this.pitchData
  }
}