(() => {
  if (window.__pfMatchDayAiControlsMountFix) return
  window.__pfMatchDayAiControlsMountFix = true

  function normalise(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase()
  }

  function findAiPanel() {
    const headings = [...document.querySelectorAll('.md *')].filter(element =>
      normalise(element.textContent).includes('AI ASSISTANT COACH'),
    )
    const heading = headings.sort((a, b) => a.children.length - b.children.length)[0]
    if (!(heading instanceof HTMLElement)) return null

    let panel = heading
    while (panel.parentElement && panel.parentElement.closest('.md')) {
      const buttons = [...panel.querySelectorAll('button')]
      const hasAnalyse = buttons.some(button => normalise(button.textContent) === 'ANALYSE')
      const hasReport = buttons.some(button => normalise(button.textContent).includes('QTR REPORT'))
      const hasNewActions = Boolean(panel.querySelector('.pf-ai-actions'))
      if ((hasAnalyse && hasReport) || hasNewActions) return panel
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
    if (oldRow && oldRow !== actions) oldRow.replaceWith(actions)

    const analyse = actions.querySelector('[data-analyse]')
    if (analyse) analyse.remove()

    let mic = actions.querySelector('[data-panel-mic]')
    const ask = actions.querySelector('[data-ask]')
    const report = actions.querySelector('[data-report]')

    if (!mic && ask) {
      mic = document.createElement('button')
      mic.type = 'button'
      mic.dataset.panelMic = 'true'
      mic.setAttribute('aria-label', 'Speak to Assistant Coach')
      mic.textContent = '🎙'
      mic.addEventListener('click', () => {
        ask.click()
        window.setTimeout(() => {
          const modalMic = document.querySelector('#pf-matchday-ai-modal .pf-ai-mic')
          if (modalMic instanceof HTMLButtonElement) modalMic.click()
        }, 80)
      })
      actions.insertBefore(mic, ask)
    }

    if (ask instanceof HTMLButtonElement) ask.textContent = 'ASK COACH'
    if (report instanceof HTMLButtonElement) report.textContent = 'QTR REPORT'

    actions.style.setProperty('display', 'grid', 'important')
    actions.style.setProperty('grid-template-columns', '52px 1fr 1fr', 'important')
    actions.style.setProperty('gap', '8px', 'important')
    actions.style.setProperty('width', 'auto', 'important')
    actions.style.setProperty('margin', '8px 10px 10px', 'important')

    if (mic instanceof HTMLElement) {
      mic.style.setProperty('font-size', '17px', 'important')
      mic.style.setProperty('padding', '0', 'important')
    }
  }

  const observer = new MutationObserver(reconcile)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('playfooty:matchday-stats', reconcile)
  window.setInterval(reconcile, 500)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reconcile, { once: true })
  else reconcile()
})()
