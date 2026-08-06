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

  document.addEventListener('fullscreenchange', () => window.setTimeout(replaceLabels, 50))
  document.addEventListener('webkitfullscreenchange', () => window.setTimeout(replaceLabels, 50))
  document.addEventListener('click', () => window.setTimeout(replaceLabels, 50), true)
  window.addEventListener('playfooty:matchday-stats', replaceLabels)
  window.setInterval(replaceLabels, 1000)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', replaceLabels, { once: true })
  else replaceLabels()
})()
