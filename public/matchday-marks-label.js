(() => {
  function replaceLabels() {
    document.querySelectorAll('.md-fs-name').forEach(label => {
      const short = label.querySelector('b')
      const name = label.querySelector('small')
      if (short?.textContent?.trim() === 'OPM') short.textContent = 'MRK'
      if (name?.textContent?.trim().toLowerCase() === 'opposition marks') name.textContent = 'Marks'
    })

    document.querySelectorAll('.pf-kpi-label').forEach(label => {
      const short = label.querySelector('b')
      const name = label.querySelector('small')
      if (short?.textContent?.trim() === 'OPM') short.textContent = 'MRK'
      if (name?.textContent?.trim().toLowerCase() === 'opposition marks') name.textContent = 'Marks'
    })
  }

  function loadAiGameContext() {
    if (document.getElementById('pf-matchday-ai-game-context')) return
    const script = document.createElement('script')
    script.id = 'pf-matchday-ai-game-context'
    script.src = '/matchday-ai-game-context.js'
    script.defer = true
    document.head.appendChild(script)
  }

  function loadAiSignificanceGate() {
    const existing = document.getElementById('pf-matchday-ai-significance-gate')
    if (existing) {
      loadAiGameContext()
      return
    }
    const script = document.createElement('script')
    script.id = 'pf-matchday-ai-significance-gate'
    script.src = '/matchday-ai-significance-gate.js'
    script.defer = true
    script.addEventListener('load', loadAiGameContext, { once: true })
    document.head.appendChild(script)
  }

  document.addEventListener('fullscreenchange', () => window.setTimeout(replaceLabels, 50))
  document.addEventListener('webkitfullscreenchange', () => window.setTimeout(replaceLabels, 50))
  document.addEventListener('click', () => window.setTimeout(replaceLabels, 50), true)
  window.addEventListener('playfooty:matchday-stats', replaceLabels)
  window.setInterval(replaceLabels, 1000)
  loadAiSignificanceGate()
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', replaceLabels, { once: true })
  else replaceLabels()
})()
