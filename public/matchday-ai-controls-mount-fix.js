(() => {
  if (window.__pfMatchDayAiControlsMountFix) return
  window.__pfMatchDayAiControlsMountFix = true

  function normalise(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase()
  }

  function findAiPanel() {
    const candidates = [...document.querySelectorAll('.md *')].filter(element =>
      normalise(element.textContent).includes('AI ASSISTANT COACH'),
    )

    const heading = candidates.sort((a, b) => a.children.length - b.children.length)[0]
    if (!(heading instanceof HTMLElement)) return null

    let panel = heading
    while (panel.parentElement && panel.parentElement.closest('.md')) {
      const text = normalise(panel.textContent)
      const hasAnalyse = [...panel.querySelectorAll('button')].some(button => normalise(button.textContent) === 'ANALYSE')
      const hasReport = [...panel.querySelectorAll('button')].some(button => normalise(button.textContent).includes('QTR REPORT'))
      if (hasAnalyse && hasReport) return panel
      panel = panel.parentElement
    }

    return heading.closest('.md-ai, .md-panel, section, article, div')
  }

  function findExistingActionRow(panel) {
    const buttons = [...panel.querySelectorAll('button')]
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

  function reconcile() {
    const panel = findAiPanel()
    if (!(panel instanceof HTMLElement)) return

    panel.classList.add('md-ai-coach-placeholder')

    const actions = panel.querySelector('.pf-ai-actions')
    if (!(actions instanceof HTMLElement)) return

    const oldRow = findExistingActionRow(panel)
    if (oldRow && oldRow !== actions) {
      oldRow.replaceWith(actions)
    }

    actions.style.setProperty('display', 'grid', 'important')
    actions.style.setProperty('grid-template-columns', '1fr 1fr 1.15fr', 'important')
    actions.style.setProperty('width', 'auto', 'important')
    actions.style.setProperty('margin', '8px 10px 10px', 'important')
  }

  const observer = new MutationObserver(reconcile)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('playfooty:matchday-stats', reconcile)
  window.setInterval(reconcile, 500)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reconcile, { once: true })
  else reconcile()
})()
