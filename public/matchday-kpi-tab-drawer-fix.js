(() => {
  function findGamePlanTab() {
    return [...document.querySelectorAll('button')].find(button =>
      button.textContent?.trim().toLowerCase().includes('game plan')
    ) || null
  }

  function placeKpiTab() {
    const kpi = document.getElementById('pf-kpi-tab')
    const gamePlan = findGamePlanTab()
    const host = gamePlan?.parentElement
    if (!kpi || !gamePlan || !host) return

    if (kpi.parentElement !== host) host.appendChild(kpi)

    host.style.setProperty('overflow', 'visible', 'important')

    if (!kpi.querySelector('span')) {
      kpi.textContent = ''
      const label = document.createElement('span')
      label.textContent = "KPI'S"
      kpi.appendChild(label)
    }

    kpi.style.setProperty('position', 'absolute', 'important')
    kpi.style.setProperty('z-index', '100097', 'important')
    kpi.style.setProperty('left', '0', 'important')
    kpi.style.setProperty('right', 'auto', 'important')
    kpi.style.setProperty('top', 'auto', 'important')
    kpi.style.setProperty('bottom', 'calc(100% + 10px)', 'important')
    kpi.style.setProperty('inset', 'auto auto calc(100% + 10px) 0', 'important')
    kpi.style.setProperty('display', 'flex', 'important')
    kpi.style.setProperty('flex-direction', 'column', 'important')
    kpi.style.setProperty('align-items', 'center', 'important')
    kpi.style.setProperty('justify-content', 'center', 'important')
    kpi.style.setProperty('gap', '7px', 'important')
    kpi.style.setProperty('width', '42px', 'important')
    kpi.style.setProperty('min-width', '42px', 'important')
    kpi.style.setProperty('max-width', '42px', 'important')
    kpi.style.setProperty('height', '126px', 'important')
    kpi.style.setProperty('min-height', '126px', 'important')
    kpi.style.setProperty('max-height', '126px', 'important')
    kpi.style.setProperty('margin', '0', 'important')
    kpi.style.setProperty('padding', '10px 6px', 'important')
    kpi.style.setProperty('border', '1px solid #d7ad2b', 'important')
    kpi.style.setProperty('border-left', '0', 'important')
    kpi.style.setProperty('border-radius', '0 12px 12px 0', 'important')
    kpi.style.setProperty('background', 'linear-gradient(180deg,#e1b72f,#c99208)', 'important')
    kpi.style.setProperty('color', '#101820', 'important')
    kpi.style.setProperty('box-shadow', '7px 0 20px rgba(0,0,0,.35)', 'important')
    kpi.style.setProperty('font-size', '9px', 'important')
    kpi.style.setProperty('font-weight', '950', 'important')
    kpi.style.setProperty('line-height', '1', 'important')
    kpi.style.setProperty('text-transform', 'uppercase', 'important')
    kpi.style.setProperty('transform', 'none', 'important')
    kpi.style.setProperty('overflow', 'hidden', 'important')
    kpi.style.setProperty('box-sizing', 'border-box', 'important')

    const label = kpi.querySelector('span')
    if (label instanceof HTMLElement) {
      label.style.setProperty('display', 'block', 'important')
      label.style.setProperty('width', 'auto', 'important')
      label.style.setProperty('height', 'auto', 'important')
      label.style.setProperty('writing-mode', 'vertical-rl', 'important')
      label.style.setProperty('transform', 'rotate(180deg)', 'important')
      label.style.setProperty('font-size', '9px', 'important')
      label.style.setProperty('line-height', '1', 'important')
      label.style.setProperty('letter-spacing', '.08em', 'important')
      label.style.setProperty('white-space', 'nowrap', 'important')
    }
  }

  function schedulePlacement() {
    window.setTimeout(placeKpiTab, 30)
    window.setTimeout(placeKpiTab, 120)
    window.setTimeout(placeKpiTab, 300)
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('.md-fullscreen-button') || target?.closest('#pf-kpi-tab')) schedulePlacement()
  }, true)
  document.addEventListener('fullscreenchange', schedulePlacement)
  document.addEventListener('webkitfullscreenchange', schedulePlacement)
  window.addEventListener('playfooty:matchday-stats', schedulePlacement)
  window.addEventListener('resize', schedulePlacement)

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedulePlacement, { once: true })
  } else {
    schedulePlacement()
  }
})()
