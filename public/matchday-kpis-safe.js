(() => {
  const STATS = [
    ['i50', 'I50', 'Inside 50s'], ['clr', 'CLR', 'Clearances'], ['r50', 'R50', 'Rebound 50s'],
    ['one', '1%', 'One percenters'], ['tkl', 'TKL', 'Tackles'], ['opm', 'OPM', 'Opposition marks'], ['fa', 'FA', 'Frees against']
  ]
  const EMPTY = () => Object.fromEntries(STATS.map(([key]) => [key, 0]))
  let lastPath = ''
  let open = false

  const clubId = () => location.pathname.match(/^\/club-portal\/([^/]+)/)?.[1] || 'current'
  const key = () => `playfooty.matchday.kpis.v2.${clubId()}`
  const load = () => { try { return { ...EMPTY(), ...JSON.parse(localStorage.getItem(key()) || '{}') } } catch { return EMPTY() } }
  const save = targets => localStorage.setItem(key(), JSON.stringify(targets))
  const colour = (value, target) => !target || value < target / 2 ? '#ff4350' : value < target ? '#f0a51a' : '#16c980'

  function style() {
    if (document.getElementById('pf-kpi-safe-style')) return
    const node = document.createElement('style')
    node.id = 'pf-kpi-safe-style'
    node.textContent = `
      .pf-kpi-setup{margin:24px 0;padding:20px;border:1px solid #d9e1e8;border-radius:18px;background:#fff}.pf-kpi-setup h2{margin:0 0 5px}.pf-kpi-setup p{margin:0 0 15px;color:#647482}.pf-kpi-grid{display:grid;gap:8px}.pf-kpi-row{display:grid;grid-template-columns:minmax(0,1fr) 46px 58px 46px;gap:8px;align-items:center;padding:9px 10px;border:1px solid #dfe6ec;border-radius:11px;background:#f7f9fb}.pf-kpi-label b,.pf-kpi-label small{display:block}.pf-kpi-label small{color:#72818d}.pf-kpi-step{height:44px;border:0;border-radius:9px;color:#fff;font-size:24px;font-weight:900;touch-action:manipulation}.pf-kpi-minus{background:#d52c35}.pf-kpi-plus{background:#0caf68}.pf-kpi-value{display:grid;place-items:center;height:44px;border:1px solid #cbd5dd;border-radius:9px;background:#fff;font-size:20px;font-weight:900}
      .pf-kpi-tab{position:absolute;z-index:125;left:0;top:326px;width:92px;height:34px;border:0;border-radius:0 9px 9px 0;background:#d5a112;color:#101820;font-size:11px;font-weight:950;text-transform:uppercase;box-shadow:0 5px 16px rgba(0,0,0,.3);touch-action:manipulation}.pf-kpi-drawer{position:absolute;z-index:124;inset:0 auto 0 0;width:50%;box-sizing:border-box;padding:18px;background:#07111c;color:#fff;border-right:1px solid #263946;transform:translateX(-102%);transition:transform .2s ease;overflow:auto}.pf-kpi-drawer.open{transform:translateX(0)}.pf-kpi-drawer-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.pf-kpi-drawer-head h2{margin:0}.pf-kpi-close{width:40px;height:40px;border:1px solid #334754;border-radius:9px;background:#13232e;color:#fff;font-size:22px}.pf-kpi-drawer .pf-kpi-row{border-color:#263946;background:#0e1b25}.pf-kpi-drawer .pf-kpi-label small{color:#8798a4}.pf-kpi-drawer .pf-kpi-value{border-color:#3a4d59;background:#07111c;color:#fff}
      @media(max-height:620px){.pf-kpi-tab{top:286px}.pf-kpi-drawer{padding:11px 14px}.pf-kpi-drawer .pf-kpi-row{padding:5px 8px;grid-template-columns:minmax(0,1fr) 40px 50px 40px}.pf-kpi-drawer .pf-kpi-step,.pf-kpi-drawer .pf-kpi-value{height:36px}}
    `
    document.head.append(node)
  }

  function rows(targets) {
    return STATS.map(([stat, short, name]) => `<div class="pf-kpi-row"><span class="pf-kpi-label"><b>${short}</b><small>${name}</small></span><button type="button" class="pf-kpi-step pf-kpi-minus" data-kpi-stat="${stat}" data-kpi-delta="-1">−</button><strong class="pf-kpi-value" data-kpi-value="${stat}">${targets[stat] || 0}</strong><button type="button" class="pf-kpi-step pf-kpi-plus" data-kpi-stat="${stat}" data-kpi-delta="1">+</button></div>`).join('')
  }

  function mountCoaching() {
    const main = document.querySelector('.coach-workspace')
    if (!main || document.getElementById('pf-kpi-coaching')) return
    const targets = load()
    const section = document.createElement('section')
    section.id = 'pf-kpi-coaching'
    section.className = 'pf-kpi-setup'
    section.innerHTML = `<h2>Match KPIs</h2><p>Set the targets used by the live Match Day colours. Changes save instantly.</p><div class="pf-kpi-grid">${rows(targets)}</div>`
    main.append(section)
  }

  function mountMatchDay() {
    const board = document.querySelector('.md')
    const active = board && document.querySelector('.md-fs-stats') && (document.body.classList.contains('pf-match-day-focus') || document.fullscreenElement || document.webkitFullscreenElement)
    if (!active || document.getElementById('pf-kpi-tab')) return
    const targets = load()
    const tab = document.createElement('button')
    tab.id = 'pf-kpi-tab'; tab.type = 'button'; tab.className = 'pf-kpi-tab'; tab.textContent = "KPI's"
    const drawer = document.createElement('aside')
    drawer.id = 'pf-kpi-drawer'; drawer.className = 'pf-kpi-drawer'
    drawer.innerHTML = `<div class="pf-kpi-drawer-head"><h2>Match KPIs</h2><button type="button" class="pf-kpi-close" aria-label="Close">×</button></div><div class="pf-kpi-grid">${rows(targets)}</div>`
    board.append(tab, drawer)
  }

  function unmountMatchDay() {
    document.getElementById('pf-kpi-tab')?.remove(); document.getElementById('pf-kpi-drawer')?.remove(); open = false
  }

  function applyColours() {
    const targets = load()
    document.querySelectorAll('.md-fs-row').forEach(row => {
      const label = row.querySelector('.md-fs-name b')?.textContent?.trim()
      const stat = STATS.find(([, short]) => short === label)?.[0]
      if (!stat) return
      const number = row.querySelector('.md-fs-count strong')
      if (number) number.style.setProperty('color', colour(Number(number.textContent || 0), Number(targets[stat] || 0)), 'important')
    })
  }

  function sync() {
    style(); mountCoaching(); mountMatchDay(); applyColours()
    const active = document.querySelector('.md-fs-stats') && (document.body.classList.contains('pf-match-day-focus') || document.fullscreenElement || document.webkitFullscreenElement)
    if (!active) unmountMatchDay()
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null
    const step = target?.closest('[data-kpi-stat]')
    if (step) {
      event.preventDefault()
      const targets = load(); const stat = step.getAttribute('data-kpi-stat'); const delta = Number(step.getAttribute('data-kpi-delta') || 0)
      if (stat && delta) { targets[stat] = Math.max(0, Number(targets[stat] || 0) + delta); save(targets); document.querySelectorAll(`[data-kpi-value="${stat}"]`).forEach(value => value.textContent = String(targets[stat])); applyColours() }
      return
    }
    if (target?.closest('#pf-kpi-tab')) { open = !open; document.getElementById('pf-kpi-drawer')?.classList.toggle('open', open); return }
    if (target?.closest('.pf-kpi-close')) { open = false; document.getElementById('pf-kpi-drawer')?.classList.remove('open'); return }
    if (target?.closest('.md-fullscreen-button')) window.setTimeout(sync, 80)
    if (target?.closest('.md-fs-count button')) window.setTimeout(applyColours, 0)
  }, true)
  window.addEventListener('playfooty:matchday-stats', applyColours)
  document.addEventListener('fullscreenchange', sync)
  document.addEventListener('webkitfullscreenchange', sync)
  window.addEventListener('popstate', () => window.setTimeout(sync, 0))
  window.setInterval(() => { if (location.pathname !== lastPath) { lastPath = location.pathname; sync() } }, 1000)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true }); else sync()
})()
