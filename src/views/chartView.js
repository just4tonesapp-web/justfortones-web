import Chart from 'chart.js/auto'

let toneChart = null

export function drawToneChart(canvasId, userPitchData) {
  const ctx = document.getElementById(canvasId)
  
  if (toneChart) toneChart.destroy() // 防止旧图表残留

  // 模拟一个标准声调 (比如一声，是一条直线)
  // 实际开发中，这个应该从数据库 questions 表里的 correct_tone_pattern 字段拿
  const standardTone = new Array(userPitchData.length).fill(250) 

  toneChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: userPitchData.map((_, i) => i), // X轴：时间
      datasets: [
        {
          label: 'Your Voice (绿色)',
          data: userPitchData,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          borderWidth: 3
        },
        {
          label: 'Standard Tone (灰色参考线)',
          data: standardTone,
          borderColor: 'rgb(200, 200, 200)',
          borderDash: [10, 5], // 虚线
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { 
          min: 50, 
          max: 400,
          title: { display: true, text: 'Frequency (Hz)' }
        }
      }
    }
  })
}