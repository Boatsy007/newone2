(() => {
  if (window.__pfMatchDayAiControlsMountFix) return
  window.__pfMatchDayAiControlsMountFix = true

  function normalise(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase()
  }

  function findAiPanel() {
    const headings = [...document.querySelectorAll('.md *')].filter(element =>
      normalise(element.textContent) === 'AI ASSISTANT COACH',
    )

    const heading = headings.sort((a, b) => a.children.length - b.children.length)[0]
    if (!(heading instanceof HTMLElement)) return null

    let panel = heading
    while (panel.parentElement && panel.parentElement.closest('.md')) {
      const buttons = [...panel.querySelectorAll('button')].filter(button => !button.closest('.pf-ai-actions'))
      const hasAnalyse = buttons.some(button => normalise(button.textContent) === 'ANALYSE')
      const hasReport = buttons.some(button => normalise(button.textContent).includes('QTR REPORT'))
      if (hasAnalyse && hasReport) return panel
      panel = panel.parentElement
    }

    return null
  }

  function findOriginalActionRow(panel) {
    const buttons = [...panel.querySelectorAll('button')].filter(button => !button.closest('.pf-ai-actions'))
    const analyse = buttons.find(button => normalise(button.textContent) === 'ANALYSE')
    const report = buttons.find(button => normalise(button.textContent).includes('QTR REPORT'))
    if (!analyse || !report) return null

    let row = analyse.parentElement
    while (row && row !== panel) {
      if (row.contains(report)) return row
      row = row.parentElement
    }
    return null
  }

  function cleanupWrongMounts(panel, keep) {
    document.querySelectorAll('.md-ai-coach-placeholder').forEach(element => {
      if (element !== panel) element.classList.remove('md-ai-coach-placeholder')
    })

    panel.querySelectorAll('.pf-ai-actions').forEach(actions => {
      if (actions !== keep) actions.remove()
    })
  }

  function reconcile() {
    const panel = findAiPanel()
    if (!(panel instanceof HTMLElement)) return

    const originalRow = findOriginalActionRow(panel)
    if (!(originalRow instanceof HTMLElement)) return

    panel.classList.add('md-ai-coach-placeholder')

    const actions = panel.querySelector('.pf-ai-actions')
    if (!(actions instanceof HTMLElement)) return

    cleanupWrongMounts(panel, actions)

    if (originalRow !== actions && originalRow.isConnected) {
      originalRow.replaceWith(actions)
    }

    actions.style.setProperty('display', 'grid', 'important')
    actions.style.setProperty('grid-template-columns', '1fr 1fr 1.15fr', 'important')
    actions.style.setProperty('width', 'auto', 'important')
    actions.style.setProperty('margin', '8px 10px 10px', 'important')
    actions.style.setProperty('position', 'static', 'important')
    actions.style.setProperty('inset', 'auto', 'important')
    actions.style.setProperty('transform', 'none', 'important')
    actions.style.setProperty('z-index', 'auto', 'important')
  }

  const observer = new MutationObserver(reconcile)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('playfooty:matchday-stats', reconcile)
  window.setInterval(reconcile, 500)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reconcile, { once: true })
  else reconcile()
})()
