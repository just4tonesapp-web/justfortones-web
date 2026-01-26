import { supabase } from './supabaseClient'
import { AudioEngine } from './utils/audioEngine'
import { drawToneChart } from './views/chartView'

const engine = new AudioEngine()
const btn = document.querySelector('#record-btn')
const status = document.querySelector('#status')
const dataArray = []
let timer = null

// 绑定按钮
btn.addEventListener('mousedown', startRec)
btn.addEventListener('mouseup', stopRec)
btn.addEventListener('touchstart', (e) => { e.preventDefault(); startRec() })
btn.addEventListener('touchend', (e) => { e.preventDefault(); stopRec() })

async function startRec() {
  const success = await engine.start()
  if (success) {
    status.innerText = "Recording..."
    dataArray.length = 0 // 清空
    // 启动一个计时器每 20ms 拿一次数据
    timer = setInterval(() => {
      const pitch = engine.getPitch()
      if (pitch && pitch > 50 && pitch < 500) dataArray.push(pitch)
    }, 20)
  }
}

function stopRec() {
  engine.stop()
  clearInterval(timer)
  status.innerText = `Done! Frames: ${dataArray.length}`
  drawToneChart('canvas', dataArray)
}