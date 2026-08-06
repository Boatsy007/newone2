(() => {
  const ENTRY_LOADER_STYLE_ID = 'pf-matchday-entry-loader-guard'
  const ENTRY_ACTIVE_CLASS = 'pf-matchday-entry-active'
  const MATCH_TAB_STYLE_ID = 'pf-matchday-match-tab-style'
  const TAB_LAYER_STYLE_ID = 'pf-matchday-tab-layer-style'

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

  function ensureTabLayerStyle() {
    if (document.getElementById(TAB_LAYER_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = TAB_LAYER_STYLE_ID
    style.textContent = `
      .pf-md-whiteboard-tab {
        z-index: 1 !important;
      }
      .pf-md-kpi-tab {
        z-index: 50 !important;
      }
      .pf-md-kpi-tab[aria-expanded="true"],
      .pf-md-kpi-panel:not([hidden]) {
        z-index: 10050 !important;
      }
    `
    document.head.appendChild(style)
  }

  function syncTabLayering() {
    ensureTabLayerStyle()
    const buttons = [...document.querySelectorAll('.md button')]
    const whiteboardTab = buttons.find(button => normalise(button.textContent).includes('WHITEBOARD'))
    const kpiTab = buttons.find(button => normalise(button.textContent).includes('KPI'))

    if (whiteboardTab instanceof HTMLElement) whiteboardTab.classList.add('pf-md-whiteboard-tab')
    if (!(kpiTab instanceof HTMLElement)) return

    kpiTab.classList.add('pf-md-kpi-tab')
    const panelId = kpiTab.getAttribute('aria-controls')
    if (!panelId) return
    const panel = document.getElementById(panelId)
    if (panel instanceof HTMLElement) panel.classList.add('pf-md-kpi-panel')
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
    syncTabLayering()
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
