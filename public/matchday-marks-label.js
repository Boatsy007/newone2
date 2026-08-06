(() => {
  const ENTRY_LOADER_ID = 'pf-matchday-entry-loader'
  const ENTRY_STAGE_TIME = 7000
  const entryStages = ['LOADING LIVE TEAM', 'LOADING GAME PLAN', 'LOADING AI ASSISTANT COACH']

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

  function removeEntryLoader() {
    const loader = document.getElementById(ENTRY_LOADER_ID)
    if (!loader) return
    if (loader instanceof HTMLDialogElement && loader.open) loader.close()
    loader.remove()
  }

  function showEntryLoader() {
    if (document.getElementById(ENTRY_LOADER_ID)) return

    const dialog = document.createElement('dialog')
    dialog.id = ENTRY_LOADER_ID
    dialog.setAttribute('role', 'status')
    dialog.setAttribute('aria-live', 'polite')
    dialog.innerHTML = `
      <style>
        #${ENTRY_LOADER_ID}{all:initial;box-sizing:border-box;position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;background:#071018!important;color:#071018!important;overflow:hidden!important}
        #${ENTRY_LOADER_ID}::backdrop{background:#071018!important}
        #${ENTRY_LOADER_ID},#${ENTRY_LOADER_ID} *{box-sizing:border-box}
        #${ENTRY_LOADER_ID} .pf-md-entry-overlay{position:absolute;inset:0;width:100%;height:100%;display:grid;place-items:center;padding:18px;background:#071018;font-family:Arial,sans-serif;overflow:hidden}
        #${ENTRY_LOADER_ID} .pf-md-entry-card{width:min(360px,calc(100vw - 36px));min-height:270px;padding:34px 28px;border-radius:22px;background:#f4f6f7;box-shadow:0 24px 70px rgba(0,0,0,.38);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:visible}
        #${ENTRY_LOADER_ID} .pf-md-entry-ring{width:47px;height:47px;flex:0 0 47px;margin:0 0 19px;border:5px solid #c9e9f8;border-top-color:#119fda;border-radius:50%;animation:pfMdEntrySpin .85s linear infinite}
        #${ENTRY_LOADER_ID} span{display:block;font-size:11px;font-weight:900;letter-spacing:.18em;color:#138cc5}
        #${ENTRY_LOADER_ID} strong{display:block;max-width:290px;margin:8px 0 13px;font-family:'Bebas Neue',Impact,sans-serif;font-size:43px;line-height:.95;letter-spacing:.01em;color:#111820;white-space:normal}
        #${ENTRY_LOADER_ID} small{display:block;font-size:13px;line-height:1.45;color:#64717b}
        @keyframes pfMdEntrySpin{to{transform:rotate(360deg)}}
      </style>
      <div class="pf-md-entry-overlay">
        <div class="pf-md-entry-card">
          <div class="pf-md-entry-ring" aria-hidden="true"></div>
          <span>PLAYFOOTY COACHING</span>
          <strong>LOADING LIVE TEAM</strong>
          <small>Live data can take up to 30 seconds to load.</small>
        </div>
      </div>
    `

    document.body.appendChild(dialog)
    try {
      dialog.showModal()
    } catch {
      dialog.setAttribute('open', '')
    }

    const heading = dialog.querySelector('strong')
    const timers = [
      window.setTimeout(() => { if (heading) heading.textContent = entryStages[1] }, ENTRY_STAGE_TIME),
      window.setTimeout(() => { if (heading) heading.textContent = entryStages[2] }, ENTRY_STAGE_TIME * 2),
      window.setTimeout(removeEntryLoader, 35000),
    ]

    const handoff = new MutationObserver(() => {
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
