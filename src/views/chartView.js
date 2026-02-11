import Chart from 'chart.js/auto'

let toneChart = null

export function drawToneChart(canvasId, pitchData) {
  const ctx = document.getElementById(canvasId)
  if (toneChart) toneChart.destroy()

  toneChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: pitchData.map((_, i) => i),
      datasets: [{
        label: 'User Tone',
        data: pitchData,
        borderColor: 'blue',
        tension: 0.1
      }]
    }
  })
}
