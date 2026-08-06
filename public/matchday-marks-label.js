(() => {
  const ENTRY_LOADER_ID = 'pf-matchday-entry-loader'
  const ENTRY_LOADER_STYLE_ID = 'pf-matchday-entry-loader-guard'
  const ENTRY_ACTIVE_CLASS = 'pf-matchday-entry-active'
  const MATCH_TAB_STYLE_ID = 'pf-matchday-match-tab-style'
  const ENTRY_STAGE_TIME = 7000
  const entryStages = ['LOADING LIVE TEAM', 'LOADING GAME PLAN', 'LOADING AI ASSISTANT COACH']

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
  }

  function ensureEntryGuard() {
    if (document.getElementById(ENTRY_LOADER_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = ENTRY_LOADER_STYLE_ID
    style.textContent = `
      html.${ENTRY_ACTIVE_CLASS}, html.${ENTRY_ACTIVE_CLASS} body { overflow: hidden !important; }
      html.${ENTRY_ACTIVE_CLASS} .club-page-loading,
      html.${ENTRY_ACTIVE_CLASS} body .club-page-loading {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      #${ENTRY_LOADER_ID} {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        width: 100vw !important;
        height: 100vh !important;
        height: 100dvh !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        display: grid !important;
        place-items: center !important;
        overflow: hidden !important;
        background: #071018 !important;
        font-family: Arial, sans-serif !important;
        transform: none !important;
        contain: strict !important;
        isolation: isolate !important;
      }
      #${ENTRY_LOADER_ID}, #${ENTRY_LOADER_ID} * { box-sizing: border-box !important; }
      #${ENTRY_LOADER_ID} .pf-md-entry-card {
        width: min(360px, calc(100vw - 36px)) !important;
        min-height: 270px !important;
        margin: 0 !important;
        padding: 34px 28px !important;
        border-radius: 22px !important;
        background: #f4f6f7 !important;
        box-shadow: 0 24px 70px rgba(0,0,0,.38) !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
      }
      #${ENTRY_LOADER_ID} .pf-md-entry-ring {
        width: 47px !important;
        height: 47px !important;
        flex: 0 0 47px !important;
        margin: 0 0 19px !important;
        border: 5px solid #c9e9f8 !important;
        border-top-color: #119fda !important;
        border-radius: 50% !important;
        animation: pfMdEntrySpin .85s linear infinite !important;
      }
      #${ENTRY_LOADER_ID} span { display:block !important; font-size:11px !important; font-weight:900 !important; letter-spacing:.18em !important; color:#138cc5 !important; }
      #${ENTRY_LOADER_ID} strong { display:block !important; max-width:290px !important; margin:8px 0 13px !important; font-family:'Bebas Neue',Impact,sans-serif !important; font-size:43px !important; line-height:.95 !important; letter-spacing:.01em !important; color:#111820 !important; white-space:normal !important; }
      #${ENTRY_LOADER_ID} small { display:block !important; font-size:13px !important; line-height:1.45 !important; color:#64717b !important; }
      @keyframes pfMdEntrySpin { to { transform: rotate(360deg); } }
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

  function removeEntryLoader() {
    document.getElementById(ENTRY_LOADER_ID)?.remove()
    document.documentElement.classList.remove(ENTRY_ACTIVE_CLASS)
  }

  function showEntryLoader() {
    suppressGenericCoachingLoader()
    if (document.getElementById(ENTRY_LOADER_ID)) return

    const overlay = document.createElement('div')
    overlay.id = ENTRY_LOADER_ID
    overlay.setAttribute('role', 'status')
    overlay.setAttribute('aria-live', 'polite')
    overlay.innerHTML = `
      <div class="pf-md-entry-card">
        <div class="pf-md-entry-ring" aria-hidden="true"></div>
        <span>PLAYFOOTY COACHING</span>
        <strong>LOADING LIVE TEAM</strong>
        <small>Live data can take up to 30 seconds to load.</small>
      </div>
    `

    document.documentElement.appendChild(overlay)
    const heading = overlay.querySelector('strong')
    const timers = [
      window.setTimeout(() => { if (heading) heading.textContent = entryStages[1] }, ENTRY_STAGE_TIME),
      window.setTimeout(() => { if (heading) heading.textContent = entryStages[2] }, ENTRY_STAGE_TIME * 2),
      window.setTimeout(removeEntryLoader, 35000),
    ]

    const handoff = new MutationObserver(() => {
      suppressGenericCoachingLoader()
      const realLoader = document.querySelector('.md-canonical-live-host .md-live-loading-overlay')
      if (!realLoader) return
      timers.forEach(timer => window.clearTimeout(timer))
      handoff.disconnect()
      removeEntryLoader()
    })
    handoff.observe(document.documentElement, { childList: true, subtree: true })
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
    if (isMatchDaySidebarTrigger(event.target)) showEntryLoader()
  }, true)
  document.addEventListener('click', event => {
    if (isMatchDaySidebarTrigger(event.target)) showEntryLoader()
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
