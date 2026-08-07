(() => {
  const CARD_ID = 'coach-app-matchday-tools'
  const STYLE_ID = 'coach-app-matchday-tools-styles'
  const OVERLAY_ID = 'coach-app-whiteboard-overlay'

  function clubId() {
    try { return localStorage.getItem('playfooty.coachApp.club.v1') || '' } catch { return '' }
  }

  function session() {
    try { return JSON.parse(localStorage.getItem('playfooty.clubPortal.session.v1') || 'null') } catch { return null }
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

  async function activeMatchContext(id) {
    const auth = session()
    if (!auth?.access_token) return null
    try {
      const response = await fetch(`/api/club-portal/coach-app/context?clubId=${encodeURIComponent(id)}`, {
        headers: { authorization: `Bearer ${auth.access_token}` },
      })
      if (!response.ok) return null
      const payload = await response.json()
      const context = payload?.data
      const fixture = context?.fixture
      if (!fixture) return null
      const clubName = String(context?.club?.name || '')
      const homeName = String(fixture.homeName || '')
      const awayName = String(fixture.awayName || '')
      const opponent = homeName.localeCompare(clubName, undefined, { sensitivity: 'base' }) === 0 ? awayName : homeName
      const round = String(fixture.round || '')
      return {
        fixtureId: String(fixture.id || ''),
        title: opponent ? `${round || 'Match Day'} v ${opponent}` : round || 'Match Day',
        opponent,
        round,
      }
    } catch { return null }
  }

  function labelControl(doc, labelText) {
    const labels = [...doc.querySelectorAll('.wb .meta label')]
    const label = labels.find(row => (row.textContent || '').trim().toLowerCase().startsWith(labelText.toLowerCase()))
    return label?.querySelector('input,select') || null
  }

  function setControlValue(control, value) {
    if (!control || !value) return
    const setter = Object.getOwnPropertyDescriptor(control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')?.set
    if (setter) setter.call(control, value)
    else control.value = value
    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function applyMatchContext(doc, match) {
    if (!match) return
    const select = labelControl(doc, 'Saved board')
    const title = labelControl(doc, 'Title')
    const round = labelControl(doc, 'Round')
    const opponent = labelControl(doc, 'Opposition')

    if (select instanceof HTMLSelectElement) {
      const wanted = [...select.options].find(option => {
        const text = (option.textContent || '').toLowerCase()
        return Boolean(match.opponent && text.includes(match.opponent.toLowerCase()) && (!match.round || text.includes(match.round.toLowerCase())))
      })
      if (wanted) {
        setControlValue(select, wanted.value)
        window.setTimeout(() => {
          setControlValue(title, match.title)
          setControlValue(round, match.round)
          setControlValue(opponent, match.opponent)
        }, 180)
        return
      }
    }
    setControlValue(title, match.title)
    setControlValue(round, match.round)
    setControlValue(opponent, match.opponent)
  }

  function findButton(doc, scope, label) {
    const buttons = [...doc.querySelectorAll(`${scope} button`)]
    return buttons.find(button => (button.textContent || '').trim().toLowerCase().startsWith(label.toLowerCase()))
  }

  function installWhiteboardTools(frame, match) {
    try {
      const doc = frame.contentDocument
      if (!doc) return
      applyMatchContext(doc, match)
      if (doc.getElementById('coach-app-whiteboard-tools')) return

      doc.body.classList.add('coach-app-whiteboard-embedded')
      const style = doc.createElement('style')
      style.id = 'coach-app-whiteboard-frame-style'
      style.textContent = `
        html,body,#root{width:100%!important;height:100%!important;min-height:100%!important;margin:0!important;overflow:hidden!important;background:#07121b!important}
        body>header,body>nav,body>aside,#root>header,#root>nav,#root>aside,.site-header,.public-header,.club-portal-sidebar,.portal-sidebar,.pf-nav,footer{display:none!important}
        .wb{position:fixed!important;inset:0!important;width:100%!important;height:100dvh!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;box-sizing:border-box!important;background:#0b1219!important}
        .wb>header{display:none!important}
        .wb>.meta{position:absolute!important;z-index:30!important;top:0!important;left:132px!important;right:8px!important;height:68px!important;max-width:none!important;margin:0!important;padding:8px 0 8px 8px!important;display:grid!important;grid-template-columns:1.05fr 1fr .62fr .9fr 52px!important;gap:7px!important;align-items:end!important;border:0!important;background:#0b1219!important;box-sizing:border-box!important}
        .wb>.meta label{display:flex!important;min-width:0!important;flex-direction:column!important;gap:3px!important;font-size:8px!important;line-height:1!important;color:#91a0ad!important;text-transform:uppercase!important;font-weight:900!important}
        .wb>.meta input,.wb>.meta select{height:40px!important;margin:0!important;padding:0 8px!important;border:1px solid #344452!important;border-radius:9px!important;background:#17242f!important;color:#fff!important;font-size:11px!important}
        .wb>.meta .save{width:52px!important;height:40px!important;padding:0!important;font-size:0!important;background:#42b8ff!important}.wb>.meta .delete{display:none!important}
        .wb .workspace{position:absolute!important;inset:68px 6px 0 132px!important;max-width:none!important;margin:0!important;padding:7px 0 7px 4px!important;display:block!important;overflow:hidden!important;box-sizing:border-box!important}
        .wb .board-shell{position:absolute!important;inset:7px 0 7px 0!important;margin:0!important;padding:0!important;border:0!important;border-radius:15px!important;background:#f7f9fb!important;overflow:hidden!important}
        .wb .board-shell>.tools,.wb .board-shell>.playbar,.wb .board-shell>.choreo{display:none!important}
        .wb .oval{position:absolute!important;inset:12px 34px 52px 4px!important;width:auto!important;height:auto!important;aspect-ratio:auto!important;border-radius:50% / 46%!important;box-sizing:border-box!important}
        .wb .legend{position:absolute!important;z-index:20!important;left:12px!important;bottom:14px!important;right:18px!important;margin:0!important;background:rgba(247,249,251,.92)!important}
        .wb .workspace>aside{display:none!important}
        body[data-wb-tray] .wb .workspace>aside{display:block!important;position:fixed!important;z-index:100850!important;left:140px!important;top:76px!important;width:min(760px,calc(100vw - 160px))!important;max-height:230px!important;padding:5px!important;border:1px solid #2d3c49!important;border-radius:12px!important;background:#101820!important;box-shadow:0 8px 20px rgba(0,0,0,.24)!important;overflow:auto!important}
        body[data-wb-tray] .wb .workspace>aside>section{display:none!important;margin:0!important;padding:7px!important;border:0!important;border-radius:9px!important;background:#fff!important}
        body[data-wb-tray="players"] .wb .workspace>aside>section:first-child,body[data-wb-tray="opposition"] .wb .workspace>aside>section:nth-child(2),body[data-wb-tray="ball"] .wb .workspace>aside>section:nth-child(3){display:block!important}
        body[data-wb-tray="players"] .player-bank{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(102px,1fr))!important;gap:4px!important;max-height:174px!important;overflow:auto!important;padding:0!important}
        body[data-wb-tray="players"] .player-bank button:disabled{display:none!important}
        #coach-app-whiteboard-tools{position:fixed;z-index:100920;left:0;top:0;bottom:0;width:126px;padding:7px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:58px;align-content:start;gap:6px;background:#0b1219;border-right:1px solid #2a3946;box-sizing:border-box;overflow-y:auto;scrollbar-width:none}
        #coach-app-whiteboard-tools button{min-width:0;height:58px;border:1px solid #31414f;border-radius:10px;background:#182630;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:3px;font-size:8px;line-height:1.05;font-weight:900;text-align:center}
        #coach-app-whiteboard-tools button.active,#coach-app-whiteboard-tools button.save{background:#42b8ff;color:#061018;border-color:#42b8ff}
        #coach-app-whiteboard-tools .icon{font-size:18px;line-height:1}
        #coach-app-whiteboard-shapes,#coach-app-whiteboard-media{position:fixed;z-index:100940;left:134px;top:76px;display:none;grid-template-columns:repeat(4,88px);gap:5px;padding:6px;border:1px solid #31414f;border-radius:11px;background:#101820;box-shadow:0 8px 20px rgba(0,0,0,.24)}
        #coach-app-whiteboard-media{grid-template-columns:repeat(3,96px)}
        #coach-app-whiteboard-shapes.open,#coach-app-whiteboard-media.open{display:grid}
        #coach-app-whiteboard-shapes button,#coach-app-whiteboard-media button{height:40px;border:1px solid #31414f;border-radius:8px;background:#182630;color:#fff;font-size:9px;font-weight:900}
      `
      doc.head.appendChild(style)

      const rail = doc.createElement('nav')
      rail.id = 'coach-app-whiteboard-tools'
      rail.setAttribute('aria-label', 'Whiteboard tools')
      rail.innerHTML = `
        <button data-action="move"><span class="icon">↖</span><span>Move</span></button>
        <button data-action="shapes"><span class="icon">◇</span><span>Shapes</span></button>
        <button data-action="erase"><span class="icon">⌫</span><span>Erase</span></button>
        <button data-action="undo"><span class="icon">↶</span><span>Undo</span></button>
        <button data-action="redo"><span class="icon">↷</span><span>Redo</span></button>
        <button data-action="players"><span class="icon">●●</span><span>Players</span></button>
        <button data-action="opposition"><span class="icon">○○</span><span>Opposition</span></button>
        <button data-action="ball"><span class="icon">●</span><span>Ball</span></button>
        <button data-action="media"><span class="icon">◉</span><span>Record<br>& Play</span></button>
        <button class="save" data-action="save"><span class="icon">▣</span><span>Save</span></button>`

      const shapes = doc.createElement('div')
      shapes.id = 'coach-app-whiteboard-shapes'
      shapes.innerHTML = ['line','arrow','circle','rectangle','square','triangle','zone'].map(name => `<button data-tool="${name}">${name[0].toUpperCase()+name.slice(1)}</button>`).join('')

      const media = doc.createElement('div')
      media.id = 'coach-app-whiteboard-media'
      media.innerHTML = `<button data-media="record">Record play</button><button data-media="play">Play</button><button data-media="stop">Stop</button><button data-media="restart">Restart</button><button data-media="clear motion">Clear motion</button>`

      doc.body.append(rail, shapes, media)

      const closePopups = () => { shapes.classList.remove('open'); media.classList.remove('open') }
      const openTray = tray => { closePopups(); doc.body.setAttribute('data-wb-tray', tray) }
      const clickOriginal = (scope, label) => { const target = findButton(doc, scope, label); if (target && !target.disabled) target.click() }

      rail.addEventListener('click', event => {
        const button = event.target.closest('button')
        if (!button) return
        const action = button.dataset.action
        if (!['players','opposition','ball'].includes(action)) doc.body.removeAttribute('data-wb-tray')
        if (action === 'move') clickOriginal('.wb .tools', 'select')
        else if (action === 'shapes') { media.classList.remove('open'); shapes.classList.toggle('open') }
        else if (action === 'erase') clickOriginal('.wb .tools', 'erase')
        else if (action === 'undo') clickOriginal('.wb .tools', 'undo')
        else if (action === 'redo') clickOriginal('.wb .tools', 'redo')
        else if (action === 'players') openTray('players')
        else if (action === 'opposition') openTray('opposition')
        else if (action === 'ball') openTray('ball')
        else if (action === 'media') { shapes.classList.remove('open'); media.classList.toggle('open') }
        else if (action === 'save') doc.querySelector('.wb .meta .save')?.click()
      })
      shapes.addEventListener('click', event => {
        const button = event.target.closest('button[data-tool]')
        if (!button) return
        clickOriginal('.wb .tools', button.dataset.tool)
        closePopups()
      })
      media.addEventListener('click', event => {
        const button = event.target.closest('button[data-media]')
        if (!button) return
        clickOriginal('.wb .playbar', button.dataset.media)
        closePopups()
      })
    } catch {}
  }

  async function openWhiteboard() {
    const id = clubId()
    if (!id) {
      alert('Choose a club before opening the whiteboard.')
      return
    }
    if (document.getElementById(OVERLAY_ID)) return

    const match = await activeMatchContext(id)
    await lockLandscape()
    const overlay = document.createElement('section')
    overlay.id = OVERLAY_ID
    overlay.className = 'coach-whiteboard-overlay'
    overlay.innerHTML = `
      <header class="coach-whiteboard-bar">
        <div><small>COACH APP</small><strong>WHITEBOARD</strong>${match ? `<span>${match.round || 'Match Day'} · ${match.opponent || ''}</span>` : ''}</div>
        <button type="button" class="coach-whiteboard-close">Return to Match Day</button>
      </header>
      <div class="coach-whiteboard-stage">
        <iframe title="PlayFooty Whiteboard" src="/club-portal/${encodeURIComponent(id)}/whiteboard?coachApp=1${match?.fixtureId ? `&fixtureId=${encodeURIComponent(match.fixtureId)}` : ''}" allow="fullscreen"></iframe>
      </div>
      <div class="coach-whiteboard-rotate" role="status">
        <div>↻</div><strong>Rotate the iPad</strong><span>The whiteboard is available in landscape mode only.</span>
      </div>`
    document.body.appendChild(overlay)
    document.documentElement.classList.add('coach-whiteboard-open')
    overlay.querySelector('.coach-whiteboard-close')?.addEventListener('click', closeWhiteboard)
    const frame = overlay.querySelector('iframe')
    frame?.addEventListener('load', () => {
      installWhiteboardTools(frame, match)
      window.setTimeout(() => installWhiteboardTools(frame, match), 450)
      window.setTimeout(() => applyMatchContext(frame.contentDocument, match), 1000)
    })
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
      .coach-whiteboard-bar{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #263a47;background:#091721}.coach-whiteboard-bar div{display:grid}.coach-whiteboard-bar small{font-size:8px;color:#08baf3;font-weight:900}.coach-whiteboard-bar strong{font-size:17px}.coach-whiteboard-bar span{font-size:9px;color:#9fb0bc;font-weight:800}.coach-whiteboard-close{min-height:38px;padding:7px 13px;border:1px solid #405361;border-radius:8px;background:#162631;color:#fff;font-weight:900}
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
