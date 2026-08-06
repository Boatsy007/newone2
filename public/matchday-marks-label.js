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
    document.getElementById(ENTRY_LOADER_ID)?.remove()
  }

  function showEntryLoader() {
    if (document.getElementById(ENTRY_LOADER_ID)) return

    const host = document.createElement('div')
    host.id = ENTRY_LOADER_ID
    host.setAttribute('role', 'status')
    host.setAttribute('aria-live', 'polite')
    host.style.setProperty('position', 'fixed', 'important')
    host.style.setProperty('inset', '0', 'important')
    host.style.setProperty('width', '100vw', 'important')
    host.style.setProperty('height', '100dvh', 'important')
    host.style.setProperty('min-width', '100vw', 'important')
    host.style.setProperty('min-height', '100dvh', 'important')
    host.style.setProperty('margin', '0', 'important')
    host.style.setProperty('padding', '0', 'important')
    host.style.setProperty('z-index', '2147483647', 'important')
    host.style.setProperty('transform', 'none', 'important')
    host.style.setProperty('overflow', 'hidden', 'important')
    host.style.setProperty('pointer-events', 'auto', 'important')

    const shadow = host.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host{all:initial;position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483647!important;display:block!important}
        *,*::before,*::after{box-sizing:border-box}
        .overlay{position:absolute;inset:0;width:100%;height:100%;display:grid;place-items:center;padding:18px;background:#071018;color:#071018;font-family:Arial,sans-serif;overflow:hidden}
        .card{width:min(360px,calc(100vw - 36px));min-height:270px;padding:34px 28px;border-radius:22px;background:#f4f6f7;box-shadow:0 24px 70px rgba(0,0,0,.38);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
        .ring{width:47px;height:47px;margin-bottom:19px;border:5px solid #c9e9f8;border-top-color:#119fda;border-radius:50%;animation:spin .85s linear infinite}
        span{font-size:11px;font-weight:900;letter-spacing:.18em;color:#138cc5}
        strong{max-width:290px;margin:8px 0 13px;font-family:'Bebas Neue',Impact,sans-serif;font-size:43px;line-height:.95;letter-spacing:.01em;color:#111820}
        small{font-size:13px;line-height:1.45;color:#64717b}
        @keyframes spin{to{transform:rotate(360deg)}}
      </style>
      <div class="overlay">
        <div class="card">
          <div class="ring" aria-hidden="true"></div>
          <span>PLAYFOOTY COACHING</span>
          <strong>LOADING LIVE TEAM</strong>
          <small>Live data can take up to 30 seconds to load.</small>
        </div>
      </div>
    `

    document.documentElement.appendChild(host)

    const heading = shadow.querySelector('strong')
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
