(() => {
  const CARD_ID = 'coach-app-matchday-tools'
  const STYLE_ID = 'coach-app-matchday-tools-styles'
  const OVERLAY_ID = 'coach-app-whiteboard-overlay'

  function clubId() {
    try { return localStorage.getItem('playfooty.coachApp.club.v1') || '' } catch { return '' }
  }

  function isLandscape() { return matchMedia('(orientation: landscape)').matches }

  async function lockLandscape() {
    try {
      if (screen.orientation?.lock) await screen.orientation.lock('landscape')
    } catch {}
  }

  function unlockOrientation() {
    try { screen.orientation?.unlock?.() } catch {}
  }

  function updateOrientationGate() {
    const overlay = document.getElementById(OVERLAY_ID)
    if (!overlay) return
    overlay.classList.toggle('portrait-blocked', !isLandscape())
  }

  function closeWhiteboard() {
    document.getElementById(OVERLAY_ID)?.remove()
    document.documentElement.classList.remove('coach-whiteboard-open')
    unlockOrientation()
  }

  function fitOriginalWhiteboard(frame) {
    try {
      const doc = frame.contentDocument
      if (!doc || doc.getElementById('coach-app-whiteboard-frame-style')) return
      const style = doc.createElement('style')
      style.id = 'coach-app-whiteboard-frame-style'
      style.textContent = `
        html,body,#root{width:100%!important;height:100%!important;min-height:100%!important;margin:0!important;overflow:hidden!important;background:#07121b!important}
        body>header,body>nav,body>aside,#root>header,#root>nav,#root>aside,.site-header,.public-header,.club-portal-sidebar,.portal-sidebar{display:none!important}
        .wb{width:100%!important;height:100dvh!important;min-height:100dvh!important;margin:0!important;padding:8px!important;overflow:hidden!important;box-sizing:border-box!important}
      `
      doc.head.appendChild(style)
    } catch {}
  }

  async function openWhiteboard() {
    const id = clubId()
    if (!id) {
      alert('Choose a club before opening the whiteboard.')
      return
    }
    if (document.getElementById(OVERLAY_ID)) return

    await lockLandscape()
    const overlay = document.createElement('section')
    overlay.id = OVERLAY_ID
    overlay.className = 'coach-whiteboard-overlay'
    overlay.innerHTML = `
      <header class="coach-whiteboard-bar">
        <div><small>COACH APP</small><strong>WHITEBOARD</strong></div>
        <button type="button" class="coach-whiteboard-close">Return to Match Day</button>
      </header>
      <div class="coach-whiteboard-stage">
        <iframe title="PlayFooty Whiteboard" src="/club-portal/${encodeURIComponent(id)}/whiteboard" allow="fullscreen"></iframe>
      </div>
      <div class="coach-whiteboard-rotate" role="status">
        <div>↻</div><strong>Rotate the iPad</strong><span>The whiteboard is available in landscape mode only.</span>
      </div>`
    document.body.appendChild(overlay)
    document.documentElement.classList.add('coach-whiteboard-open')
    overlay.querySelector('.coach-whiteboard-close')?.addEventListener('click', closeWhiteboard)
    const frame = overlay.querySelector('iframe')
    frame?.addEventListener('load', () => fitOriginalWhiteboard(frame))
    updateOrientationGate()
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      .camd .camd-tools-card{width:min(100%,1000px);margin:8px auto 0;padding:7px;border:1px solid #253b49;border-radius:12px;background:#0a1721;box-shadow:0 8px 22px rgba(0,0,0,.22)}
      .camd .camd-tools-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      .camd .camd-tool-button{min-height:46px;display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid rgba(255,255,255,.16);border-radius:9px;padding:8px 10px;color:#fff;font:950 12px Barlow,Inter,Arial,sans-serif;letter-spacing:.025em;text-transform:uppercase;box-shadow:0 4px 0 rgba(0,0,0,.34);touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform .09s ease,box-shadow .09s ease,filter .09s ease}
      .camd .camd-tool-button:active{transform:translateY(4px) scale(.98);box-shadow:none;filter:brightness(.91)}
      .camd .camd-tool-button.whiteboard{background:#233c4d}.camd .camd-tool-button.game-plan{background:#058ec6}.camd .camd-tool-button.kpis{background:#d18a05;color:#101419}.camd .camd-tool-icon{font-size:17px;line-height:1}
      html.coach-whiteboard-open,html.coach-whiteboard-open body{overflow:hidden!important}
      .coach-whiteboard-overlay{position:fixed;z-index:2147483000;inset:0;display:grid;grid-template-rows:54px 1fr;background:#07121b;color:#fff;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
      .coach-whiteboard-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #263a47;background:#091721}.coach-whiteboard-bar div{display:grid}.coach-whiteboard-bar small{font-size:8px;color:#08baf3;font-weight:900}.coach-whiteboard-bar strong{font-size:19px}.coach-whiteboard-close{min-height:38px;padding:7px 13px;border:1px solid #405361;border-radius:8px;background:#162631;color:#fff;font-weight:900}
      .coach-whiteboard-stage,.coach-whiteboard-stage iframe{width:100%;height:100%;border:0;background:#07121b}.coach-whiteboard-stage{min-height:0;overflow:hidden}
      .coach-whiteboard-rotate{display:none;position:absolute;inset:0;z-index:4;place-content:center;justify-items:center;gap:8px;padding:28px;text-align:center;background:#07121b}.coach-whiteboard-rotate div{font-size:54px;color:#08baf3}.coach-whiteboard-rotate strong{font-size:25px}.coach-whiteboard-rotate span{font-size:14px;color:#b9c7d1}.coach-whiteboard-overlay.portrait-blocked .coach-whiteboard-rotate{display:grid}
      @media (orientation:landscape) and (min-width:900px){.camd .camd-oval{height:calc(100% - 151px)!important;min-height:365px!important}.camd .camd-interchange{height:72px!important}.camd .camd-tools-card{margin-top:4px;padding:4px}.camd .camd-tools-grid{gap:5px}.camd .camd-tool-button{min-height:39px;padding:5px 8px;font-size:10px}.camd .camd-tool-icon{font-size:14px}}
      @media (orientation:portrait) and (max-width:900px){.camd .camd-tools-card{margin-top:7px}.camd .camd-tool-button{min-height:48px;font-size:11px}}
    `
    document.head.appendChild(style)
  }

  function makeButton(label, className, icon, action) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `camd-tool-button ${className}`
    button.setAttribute('aria-label', label)
    button.innerHTML = `<span class="camd-tool-icon" aria-hidden="true">${icon}</span><span>${label}</span>`
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); action?.() })
    return button
  }

  function installCard() {
    if (!location.pathname.startsWith('/coach-app')) return
    installStyles()
    const interchange = document.querySelector('.camd .camd-interchange')
    if (!(interchange instanceof HTMLElement) || document.getElementById(CARD_ID)) return
    const card = document.createElement('section')
    card.id = CARD_ID
    card.className = 'camd-tools-card'
    card.setAttribute('aria-label','Match Day coaching tools')
    const grid = document.createElement('div')
    grid.className = 'camd-tools-grid'
    grid.append(makeButton('Whiteboard','whiteboard','✎',openWhiteboard),makeButton('Game Plan','game-plan','●'),makeButton('KPIs','kpis','▦'))
    card.appendChild(grid)
    interchange.insertAdjacentElement('afterend',card)
  }

  const observer = new MutationObserver(installCard)
  observer.observe(document.documentElement,{childList:true,subtree:true})
  addEventListener('orientationchange',updateOrientationGate)
  addEventListener('resize',updateOrientationGate)
  addEventListener('pageshow',installCard)
  addEventListener('popstate',installCard)
  setInterval(installCard,1200)
  installCard()
})()
