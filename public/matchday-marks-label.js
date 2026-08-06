(() => {
  const ENTRY_LOADER_STYLE_ID = 'pf-matchday-entry-loader-guard'
  const ENTRY_ACTIVE_CLASS = 'pf-matchday-entry-active'
  const MATCH_TAB_STYLE_ID = 'pf-matchday-match-tab-style'
  const DRAWER_CLOSE_STYLE_ID = 'pf-matchday-drawer-close-style'

  function normalise(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  }

  function replaceKpiText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      if (normalise(node.textContent).includes('KPI')) {
        node.textContent = String(node.textContent || '').replace(/KPI'?S?/i, 'MATCH')
        return
      }
      node = walker.nextNode()
    }
  }

  function ensureMatchTabStyle() {
    if (document.getElementById(MATCH_TAB_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = MATCH_TAB_STYLE_ID
    style.textContent = `
      .md-match-control-tab::before { content: none !important; }
      .md-match-control-tab .pf-match-play-icon {
        position: absolute !important;
        top: 10px !important;
        left: 50% !important;
        z-index: 2 !important;
        display: block !important;
        width: auto !important;
        height: auto !important;
        margin: 0 !important;
        color: #fff !important;
        font: inherit !important;
        font-size: .78em !important;
        line-height: 1 !important;
        transform: translateX(-50%) !important;
        pointer-events: none !important;
      }
    `
    document.head.appendChild(style)
  }

  function ensureDrawerCloseStyle() {
    if (document.getElementById(DRAWER_CLOSE_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = DRAWER_CLOSE_STYLE_ID
    style.textContent = `
      .pf-md-drawer-close {
        position: absolute !important;
        top: 50% !important;
        right: -22px !important;
        left: auto !important;
        z-index: 2147482000 !important;
        width: 44px !important;
        height: 72px !important;
        min-width: 44px !important;
        min-height: 72px !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 1px solid rgba(255,255,255,.22) !important;
        border-left: 0 !important;
        border-radius: 0 14px 14px 0 !important;
        display: grid !important;
        place-items: center !important;
        background: rgba(18,34,48,.98) !important;
        color: #fff !important;
        box-shadow: 8px 0 18px rgba(0,0,0,.28) !important;
        font-family: Arial,sans-serif !important;
        font-size: 38px !important;
        font-weight: 400 !important;
        line-height: 1 !important;
        transform: translateY(-50%) !important;
        cursor: pointer !important;
      }
      .pf-md-drawer-close:hover,
      .pf-md-drawer-close:focus-visible {
        background: rgba(28,50,68,.99) !important;
        outline: 2px solid #fff !important;
        outline-offset: 1px !important;
      }
    `
    document.head.appendChild(style)
  }

  function syncDrawerCloseButtons() {
    const board = document.querySelector('.md')
    if (!(board instanceof HTMLElement)) return
    ensureDrawerCloseStyle()
    const boardRect = board.getBoundingClientRect()

    board.querySelectorAll('button').forEach(button => {
      if (!(button instanceof HTMLButtonElement)) return
      const label = normalise(`${button.textContent || ''} ${button.getAttribute('aria-label') || ''} ${button.title || ''}`)
      const isClose = label === 'X' || label === 'CLOSE' || label.includes('CLOSEPANEL') || label.includes('CLOSEDRAWER') || label.includes('CLOSEWHITEBOARD') || label.includes('CLOSEGAMEPLAN') || label.includes('CLOSEKPI')
      if (!isClose) return

      const rect = button.getBoundingClientRect()
      const isMainMatchExit = rect.left < boardRect.left + 130 && rect.top < boardRect.top + 130
      if (isMainMatchExit) return

      let panel = button.parentElement
      while (panel && panel !== board) {
        const panelRect = panel.getBoundingClientRect()
        if (panelRect.width >= 240 && panelRect.height >= 180) break
        panel = panel.parentElement
      }
      if (!panel || panel === board) return

      if (window.getComputedStyle(panel).position === 'static') panel.style.position = 'relative'
      button.classList.add('pf-md-drawer-close')
      button.textContent = '‹'
      button.setAttribute('aria-label', 'Close drawer')
      button.title = 'Close drawer'
    })
  }

  function syncMatchTab() {
    const matchTab = document.querySelector('.md-match-control-tab')
    if (!(matchTab instanceof HTMLButtonElement)) return

    const kpiTab = [...document.querySelectorAll('.md button')].find(button =>
      button !== matchTab && button.dataset.mdMatchControls !== 'true' && normalise(button.textContent).includes('KPI'),
    )
    if (!(kpiTab instanceof HTMLButtonElement)) return

    ensureMatchTabStyle()
    const expectedClassName = `${kpiTab.className} md-match-control-tab`.trim()
    if (matchTab.className !== expectedClassName) matchTab.className = expectedClassName

    const sourceStructure = kpiTab.innerHTML
    if (matchTab.dataset.pfMatchStructureSource !== sourceStructure) {
      matchTab.innerHTML = sourceStructure
      replaceKpiText(matchTab)
      const icon = document.createElement('span')
      icon.className = 'pf-match-play-icon'
      icon.setAttribute('aria-hidden', 'true')
      icon.textContent = '▶'
      matchTab.appendChild(icon)
      matchTab.dataset.pfMatchStructureSource = sourceStructure
    }
  }

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

    syncMatchTab()
    syncDrawerCloseButtons()
  }

  function ensureEntryGuard() {
    if (document.getElementById(ENTRY_LOADER_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = ENTRY_LOADER_STYLE_ID
    style.textContent = `
      html.${ENTRY_ACTIVE_CLASS} .club-page-loading,
      html.${ENTRY_ACTIVE_CLASS} body .club-page-loading {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `
    document.head.appendChild(style)
  }

  function suppressGenericCoachingLoader() {
    ensureEntryGuard()
    document.documentElement.classList.add(ENTRY_ACTIVE_CLASS)
    document.querySelectorAll('.club-page-loading').forEach(loader => {
      if (loader instanceof HTMLElement) loader.style.setProperty('display', 'none', 'important')
    })
  }

  function beginMatchDayEntry() {
    suppressGenericCoachingLoader()

    const releaseGuard = () => {
      if (!document.querySelector('.md-canonical-live-host')) return false
      document.documentElement.classList.remove(ENTRY_ACTIVE_CLASS)
      return true
    }

    if (releaseGuard()) return

    const observer = new MutationObserver(() => {
      suppressGenericCoachingLoader()
      if (!releaseGuard()) return
      observer.disconnect()
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
    window.setTimeout(() => {
      observer.disconnect()
      document.documentElement.classList.remove(ENTRY_ACTIVE_CLASS)
    }, 35000)
  }

  function isMatchDaySidebarTrigger(target) {
    const control = target instanceof Element ? target.closest('button,a,[role="button"]') : null
    if (!control || control.closest('.md')) return false
    const text = (control.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase()
    return text === 'MATCH DAY' || text === 'MATCHDAY'
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

  document.addEventListener('pointerdown', event => {
    if (isMatchDaySidebarTrigger(event.target)) beginMatchDayEntry()
  }, true)
  document.addEventListener('click', event => {
    if (isMatchDaySidebarTrigger(event.target)) beginMatchDayEntry()
    window.setTimeout(replaceLabels, 50)
  }, true)
  document.addEventListener('fullscreenchange', () => window.setTimeout(replaceLabels, 50))
  document.addEventListener('webkitfullscreenchange', () => window.setTimeout(replaceLabels, 50))
  window.addEventListener('playfooty:matchday-stats', replaceLabels)
  window.setInterval(replaceLabels, 1000)
  loadAiSignificanceGate()
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', replaceLabels, { once: true })
  else replaceLabels()
})()
