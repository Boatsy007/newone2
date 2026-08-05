(() => {
  const STATS = [
    ['i50', 'I50', 'Inside 50s'],
    ['clr', 'CLR', 'Clearances'],
    ['r50', 'R50', 'Rebound 50s'],
    ['one', '1%', 'One percenters'],
    ['tkl', 'TKL', 'Tackles'],
    ['opm', 'OPM', 'Opposition marks'],
    ['fa', 'FA', 'Frees against'],
  ]

  const emptyTargets = () => Object.fromEntries(STATS.map(([key]) => [key, 0]))
  const storageKey = () => `playfooty.matchday.kpis.v1.${location.pathname}`
  let targets = loadTargets()
  let drawerOpen = false
  let host = null
  let tab = null
  let drawer = null
  let observer = null
  let holdTimer = 0
  let repeatTimer = 0

  function loadTargets() {
    try {
      return { ...emptyTargets(), ...JSON.parse(localStorage.getItem(storageKey()) || '{}') }
    } catch {
      return emptyTargets()
    }
  }

  function isMatchDayFullscreen() {
    return Boolean(
      document.querySelector('.md-fs-stats') &&
      (document.body.classList.contains('pf-match-day-focus') || document.fullscreenElement || document.webkitFullscreenElement)
    )
  }

  function colourFor(value, target) {
    if (!target || target <= 0 || value < target * 0.5) return '#ff4350'
    if (value < target) return '#f0a51a'
    return '#16c980'
  }

  function applyColours() {
    document.querySelectorAll('.md-fs-row').forEach((row) => {
      const label = row.querySelector('.md-fs-name b')?.textContent?.trim()
      const match = STATS.find(([, short]) => short === label)
      if (!match) return
      const target = Number(targets[match[0]] || 0)
      row.querySelectorAll('.md-fs-count strong').forEach((number) => {
        const value = Number(number.textContent || 0)
        number.style.setProperty('color', colourFor(value, target), 'important')
        number.style.transition = 'color 160ms ease'
      })
    })
  }

  function closeDrawer() {
    drawerOpen = false
    drawer?.classList.remove('open')
    tab?.setAttribute('aria-expanded', 'false')
  }

  function persistTargets() {
    localStorage.setItem(storageKey(), JSON.stringify(targets))
    applyColours()
  }

  function setTarget(stat, delta) {
    targets[stat] = Math.max(0, Number(targets[stat] || 0) + delta)
    const value = drawer?.querySelector(`[data-kpi-value="${stat}"]`)
    if (value) value.textContent = String(targets[stat])
    persistTargets()
  }

  function stopHold() {
    window.clearTimeout(holdTimer)
    window.clearInterval(repeatTimer)
    holdTimer = 0
    repeatTimer = 0
  }

  function bindStepButton(button) {
    const stat = button.dataset.stat
    const delta = Number(button.dataset.delta || 0)
    if (!stat || !delta) return

    button.addEventListener('click', (event) => {
      event.preventDefault()
      setTarget(stat, delta)
    })

    const beginHold = (event) => {
      event.preventDefault()
      stopHold()
      holdTimer = window.setTimeout(() => {
        repeatTimer = window.setInterval(() => setTarget(stat, delta), 110)
      }, 420)
    }

    button.addEventListener('pointerdown', beginHold)
    button.addEventListener('pointerup', stopHold)
    button.addEventListener('pointercancel', stopHold)
    button.addEventListener('pointerleave', stopHold)
  }

  function createUi(board) {
    host = board

    const style = document.createElement('style')
    style.id = 'pf-matchday-kpi-styles'
    style.textContent = `
      .pf-kpi-tab{position:absolute;z-index:131;left:0;top:230px;width:34px;height:92px;border:0;border-radius:0 9px 9px 0;background:#d5a112;color:#101820;font-size:11px;font-weight:950;letter-spacing:.5px;text-transform:uppercase;writing-mode:vertical-rl;transform:rotate(180deg);box-shadow:0 6px 18px rgba(0,0,0,.3);touch-action:manipulation}
      .pf-kpi-drawer{position:absolute;z-index:130;inset:0 auto 0 0;width:50%;height:100%;box-sizing:border-box;padding:18px 20px 20px;background:#07111c;color:#fff;border-right:1px solid #263946;box-shadow:12px 0 32px rgba(0,0,0,.42);transform:translateX(-102%);transition:transform 220ms ease;overflow:auto}
      .pf-kpi-drawer.open{transform:translateX(0)}
      .pf-kpi-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
      .pf-kpi-head h2{margin:0;font-size:24px;font-weight:950;letter-spacing:.3px}
      .pf-kpi-close{width:42px;height:42px;border:1px solid #354753;border-radius:9px;background:#111f2a;color:#fff;font-size:24px;font-weight:900;touch-action:manipulation}
      .pf-kpi-copy{margin:0 0 14px;color:#94a4af;font-size:12px}
      .pf-kpi-list{display:grid;gap:8px}
      .pf-kpi-row{display:grid;grid-template-columns:minmax(0,1fr) 48px 62px 48px;align-items:center;gap:8px;padding:9px 10px;border:1px solid #263946;border-radius:10px;background:#0e1b25}
      .pf-kpi-label strong{display:block;font-size:13px}
      .pf-kpi-label small{display:block;margin-top:2px;color:#8798a4;font-size:10px}
      .pf-kpi-step{display:grid;place-items:center;width:48px;height:48px;padding:0;border:0;border-radius:10px;color:#fff;font-size:27px;font-weight:950;line-height:1;touch-action:manipulation;user-select:none;-webkit-user-select:none}
      .pf-kpi-step.minus{background:#d52c35}
      .pf-kpi-step.plus{background:#0caf68}
      .pf-kpi-value{display:grid;place-items:center;height:48px;border:1px solid #3a4d59;border-radius:9px;background:#07111c;color:#fff;font-size:22px;font-weight:950;font-variant-numeric:tabular-nums}
      .pf-kpi-save{width:100%;height:42px;margin-top:14px;border:0;border-radius:9px;background:#d5a112;color:#101820;font-size:13px;font-weight:950;text-transform:uppercase;touch-action:manipulation}
      @media(max-height:620px){.pf-kpi-tab{top:190px;height:82px}.pf-kpi-drawer{padding:12px 16px}.pf-kpi-head{margin-bottom:8px}.pf-kpi-copy{margin-bottom:8px}.pf-kpi-list{gap:5px}.pf-kpi-row{padding:5px 8px;grid-template-columns:minmax(0,1fr) 42px 54px 42px}.pf-kpi-step{width:42px;height:38px;font-size:23px}.pf-kpi-value{height:38px;font-size:19px}.pf-kpi-save{height:36px;margin-top:8px}}
    `

    tab = document.createElement('button')
    tab.type = 'button'
    tab.className = 'pf-kpi-tab'
    tab.textContent = "KPI's"
    tab.setAttribute('aria-expanded', 'false')
    tab.addEventListener('click', () => {
      drawerOpen = !drawerOpen
      drawer?.classList.toggle('open', drawerOpen)
      tab?.setAttribute('aria-expanded', String(drawerOpen))
    })

    drawer = document.createElement('aside')
    drawer.className = 'pf-kpi-drawer'
    drawer.innerHTML = `
      <div class="pf-kpi-head"><h2>Match KPIs</h2><button class="pf-kpi-close" type="button" aria-label="Close KPI drawer">×</button></div>
      <p class="pf-kpi-copy">Use the − and + buttons to set each target. Changes save automatically.</p>
      <div class="pf-kpi-list">
        ${STATS.map(([key, short, name]) => `<div class="pf-kpi-row"><span class="pf-kpi-label"><strong>${short}</strong><small>${name}</small></span><button class="pf-kpi-step minus" type="button" data-stat="${key}" data-delta="-1" aria-label="Decrease ${name} KPI">−</button><strong class="pf-kpi-value" data-kpi-value="${key}">${Number(targets[key] || 0)}</strong><button class="pf-kpi-step plus" type="button" data-stat="${key}" data-delta="1" aria-label="Increase ${name} KPI">+</button></div>`).join('')}
      </div>
      <button class="pf-kpi-save" type="button">Done</button>
    `
    drawer.querySelector('.pf-kpi-close')?.addEventListener('click', closeDrawer)
    drawer.querySelector('.pf-kpi-save')?.addEventListener('click', closeDrawer)
    drawer.querySelectorAll('.pf-kpi-step').forEach(bindStepButton)

    board.append(style, tab, drawer)
  }

  function removeUi() {
    stopHold()
    closeDrawer()
    tab?.remove()
    drawer?.remove()
    document.getElementById('pf-matchday-kpi-styles')?.remove()
    tab = null
    drawer = null
    host = null
  }

  function sync() {
    const board = document.querySelector('.md')
    if (!isMatchDayFullscreen() || !board) {
      if (host) removeUi()
      return
    }
    if (host !== board || !tab || !drawer) {
      removeUi()
      createUi(board)
    }
    applyColours()
  }

  function start() {
    observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] })
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    window.addEventListener('popstate', () => {
      targets = loadTargets()
      sync()
    })
    sync()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
})()
