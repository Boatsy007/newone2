(() => {
  function findGamePlanTab() {
    return [...document.querySelectorAll('button')].find(button =>
      button.textContent?.trim().toLowerCase().includes('game plan')
    ) || null
  }

  function placeKpiTab() {
    const kpi = document.getElementById('pf-kpi-tab')
    const gamePlan = findGamePlanTab()
    if (!kpi || !gamePlan || !gamePlan.parentElement) return

    if (kpi.parentElement !== gamePlan.parentElement || gamePlan.nextElementSibling !== kpi) {
      gamePlan.insertAdjacentElement('afterend', kpi)
    }

    const styles = getComputedStyle(gamePlan)
    kpi.style.setProperty('position', 'relative', 'important')
    kpi.style.setProperty('inset', 'auto', 'important')
    kpi.style.setProperty('top', 'auto', 'important')
    kpi.style.setProperty('left', 'auto', 'important')
    kpi.style.setProperty('right', 'auto', 'important')
    kpi.style.setProperty('bottom', 'auto', 'important')
    kpi.style.setProperty('transform', 'none', 'important')
    kpi.style.setProperty('width', styles.width, 'important')
    kpi.style.setProperty('min-width', styles.width, 'important')
    kpi.style.setProperty('max-width', styles.width, 'important')
    kpi.style.setProperty('height', styles.height, 'important')
    kpi.style.setProperty('min-height', styles.height, 'important')
    kpi.style.setProperty('max-height', styles.height, 'important')
    kpi.style.setProperty('margin', styles.margin, 'important')
    kpi.style.setProperty('border-radius', styles.borderRadius, 'important')
    kpi.style.setProperty('font-size', styles.fontSize, 'important')
    kpi.style.setProperty('font-weight', styles.fontWeight, 'important')
    kpi.style.setProperty('letter-spacing', styles.letterSpacing, 'important')
    kpi.style.setProperty('padding', styles.padding, 'important')
    kpi.style.setProperty('flex', styles.flex, 'important')
    kpi.style.setProperty('display', 'flex', 'important')
    kpi.style.setProperty('align-items', 'center', 'important')
    kpi.style.setProperty('justify-content', 'center', 'important')
    kpi.style.setProperty('background', '#d5a112', 'important')
    kpi.style.setProperty('color', '#101820', 'important')
    kpi.style.setProperty('z-index', '125', 'important')
  }

  function schedulePlacement() {
    window.setTimeout(placeKpiTab, 50)
    window.setTimeout(placeKpiTab, 180)
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('.md-fullscreen-button')) schedulePlacement()
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
