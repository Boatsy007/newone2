(() => {
  const STAT_KEYS = ['i50', 'clr', 'r50', 'one', 'tkl', 'opm', 'fa']
  const blankSide = () => Object.fromEntries(STAT_KEYS.map(key => [key, 0]))
  let latestStats = null
  let currentQuarter = 1
  let gameStarted = false
  let updateTimer = 0
  let lastRule = ''
  let lastMessageAt = 0

  function isMatchDayActive() {
    return Boolean(document.querySelector('.md') && document.querySelector('.md-fs-stats') && (
      document.body.classList.contains('pf-match-day-focus') ||
      document.fullscreenElement ||
      document.webkitFullscreenElement
    ))
  }

  function style() {
    if (document.getElementById('pf-assistant-coach-style')) return
    const node = document.createElement('style')
    node.id = 'pf-assistant-coach-style'
    node.textContent = `
      .pf-assistant-coach{position:absolute;z-index:64;right:12px;bottom:12px;width:calc(50vw - 24px);height:calc(50vh - 24px);box-sizing:border-box;padding:16px 18px;border:1px solid #263946;border-radius:14px;background:rgba(7,17,28,.97);color:#fff;display:flex;flex-direction:column;justify-content:center}
      .pf-assistant-coach-head{display:flex;align-items:center;gap:9px;margin-bottom:12px;color:#80d7ff;font-size:10px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
      .pf-assistant-coach-dot{width:9px;height:9px;border-radius:50%;background:#677985;box-shadow:0 0 0 4px rgba(103,121,133,.15)}
      .pf-assistant-coach.ready .pf-assistant-coach-dot{background:#16c980;box-shadow:0 0 0 4px rgba(22,201,128,.16)}
      .pf-assistant-coach-message{margin:0;font-size:clamp(15px,2vw,24px);font-weight:850;line-height:1.25}
      .pf-assistant-coach-wait{color:#8ea0ad;font-size:12px;font-weight:700;line-height:1.4}
      @media(max-height:620px){.pf-assistant-coach{right:10px;bottom:8px;width:calc(50vw - 20px);height:calc(50vh - 14px);padding:11px 14px}.pf-assistant-coach-head{margin-bottom:7px}.pf-assistant-coach-message{font-size:14px}}
    `
    document.head.append(node)
  }

  function mount() {
    if (!isMatchDayActive()) {
      document.getElementById('pf-assistant-coach')?.remove()
      return
    }
    if (document.getElementById('pf-assistant-coach')) return
    const board = document.querySelector('.md')
    if (!board) return
    const panel = document.createElement('section')
    panel.id = 'pf-assistant-coach'
    panel.className = 'pf-assistant-coach'
    panel.innerHTML = `<div class="pf-assistant-coach-head"><span class="pf-assistant-coach-dot"></span><span>AI assistant coach</span></div><p class="pf-assistant-coach-message pf-assistant-coach-wait">Waiting for the game to start and enough match data to build a useful read.</p>`
    board.append(panel)
    scheduleUpdate()
  }

  function total(stats, side, key) {
    return Object.values(stats || {}).reduce((sum, quarter) => sum + Number(quarter?.[side]?.[key] || 0), 0)
  }

  function quarterSide(stats, quarter, side) {
    return { ...blankSide(), ...(stats?.[String(quarter)]?.[side] || {}) }
  }

  function enoughInformation(stats) {
    if (!stats) return false
    const home = quarterSide(stats, currentQuarter, 'home')
    const away = quarterSide(stats, currentQuarter, 'away')
    const combined = STAT_KEYS.reduce((sum, key) => sum + home[key] + away[key], 0)
    const activeCategories = STAT_KEYS.filter(key => home[key] + away[key] > 0).length
    return combined >= 8 && activeCategories >= 3
  }

  function difference(a, b) {
    return Number(a || 0) - Number(b || 0)
  }

  function closeEnough(a, b) {
    const high = Math.max(a, b, 1)
    return Math.abs(a - b) <= Math.max(2, Math.round(high * .2))
  }

  function chooseMessage(stats) {
    const home = quarterSide(stats, currentQuarter, 'home')
    const away = quarterSide(stats, currentQuarter, 'away')
    const hi50 = home.i50, ai50 = away.i50
    const hclr = home.clr, aclr = away.clr
    const hr50 = home.r50, ar50 = away.r50
    const htkl = home.tkl, atkl = away.tkl
    const hopm = home.opm, aopm = away.opm

    if (aopm >= Math.max(6, hopm + 5)) return ['marks-against', `Hey coach, they’re plus ${aopm - hopm} in marks this quarter and starting to control the footy. Tighten up and make them kick long to a contest.`]
    if (hi50 >= 8 && ar50 >= Math.max(6, Math.round(hi50 * .65))) return ['entries-coming-out', 'Hey coach, we’re getting it in there, but it’s coming straight back out. We need to lock it in and get more pressure around the ball.']
    if (ar50 >= Math.max(7, hr50 + 4)) return ['opp-rebound', `Coach, they’ve had ${ar50} rebound 50s this quarter, so it’s coming out of our forward line too easily. We need better pressure once the ball hits the ground.`]
    if (hr50 >= Math.max(7, ar50 + 4)) return ['our-rebound', 'Hey coach, our backs are getting plenty of it, which means the ball’s spending too much time down there. We need to win more footy further up the ground.']
    if (aclr >= Math.max(6, hclr + 4) && ai50 >= hi50 + 3) return ['clearance-territory', 'Coach, we’re down badly in clearances and inside 50s. Get numbers around the contest and win some territory.']
    if (aclr >= Math.max(6, hclr + 4)) return ['clearances-down', 'Coach, they’re getting first use around the contest. Get the mids in tighter and make sure someone stays defensive side.']
    if (hclr >= aclr + 4 && hi50 <= ai50 - 3) return ['clearance-no-territory', 'Hey coach, we’re winning it at the contest but not getting enough territory from it. First option needs to be forward.']
    if (ai50 >= Math.max(8, hi50 + 5) && aopm >= hopm + 4) return ['territory-control', 'Coach, they’re controlling the footy and the territory at the moment. Tighten up, make it a contest and get the game played on our terms again.']
    if (hi50 <= Math.max(2, Math.round(ai50 * .55)) && ai50 >= 6) return ['few-inside-50s', 'Hey coach, we’re not getting enough ball into our forward half. Get us moving it forward quicker instead of overusing it.']
    if (hi50 >= ai50 + 5 && ar50 < 5) return ['direct-territory', 'Hey coach, we’re getting it forward more often when we win it. Keep playing direct and don’t start overusing it.']
    if (htkl >= atkl + 6 && hclr < aclr) return ['tackles-chasing', 'Coach, we’re laying plenty of tackles, but the numbers suggest they’re getting to the footy first. We need to win the first possession, not just chase them.']
    if (closeEnough(hi50, ai50) && closeEnough(hclr, aclr) && closeEnough(hr50, ar50)) return ['close', 'Hey coach, there’s not much between the sides in the numbers. Keep it simple and make sure we take our chances.']
    return ['no-clear-pattern', 'Hey coach, there’s nothing major standing out in those numbers yet. Keep an eye on the inside 50s and clearances over the next few minutes.']
  }

  function render() {
    const panel = document.getElementById('pf-assistant-coach')
    if (!panel) return
    const message = panel.querySelector('.pf-assistant-coach-message')
    if (!message) return

    if (!gameStarted) {
      panel.classList.remove('ready')
      message.className = 'pf-assistant-coach-message pf-assistant-coach-wait'
      message.textContent = 'Waiting for the game to start and enough match data to build a useful read.'
      return
    }
    if (!enoughInformation(latestStats)) {
      panel.classList.remove('ready')
      message.className = 'pf-assistant-coach-message pf-assistant-coach-wait'
      message.textContent = 'Game underway. Waiting for a few more stats before making a call.'
      return
    }

    const [rule, text] = chooseMessage(latestStats)
    const now = Date.now()
    if (rule === lastRule && now - lastMessageAt < 45000 && message.textContent) return
    lastRule = rule
    lastMessageAt = now
    panel.classList.add('ready')
    message.className = 'pf-assistant-coach-message'
    message.textContent = text
  }

  function scheduleUpdate() {
    window.clearTimeout(updateTimer)
    updateTimer = window.setTimeout(render, 900)
  }

  function inferStarted() {
    const statsTotal = latestStats ? Object.values(latestStats).reduce((sum, quarter) => sum + ['home', 'away'].reduce((sideSum, side) => sideSum + STAT_KEYS.reduce((statSum, key) => statSum + Number(quarter?.[side]?.[key] || 0), 0), 0), 0) : 0
    if (statsTotal > 0) gameStarted = true
    const startButton = document.querySelector('.md-clock button:first-of-type')
    const label = startButton?.textContent?.trim().toLowerCase() || ''
    if (label && label !== 'start') gameStarted = true
  }

  window.addEventListener('playfooty:matchday-stats', event => {
    const detail = event.detail || {}
    latestStats = detail.stats || latestStats
    currentQuarter = Number(detail.quarter || currentQuarter || 1)
    inferStarted()
    mount()
    scheduleUpdate()
  })

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest('.md-clock button:first-of-type')) {
      gameStarted = true
      window.setTimeout(() => { mount(); scheduleUpdate() }, 50)
      return
    }
    if (target?.closest('.md-fullscreen-button')) window.setTimeout(mount, 100)
    if (target?.closest('.md-fs-tabs button')) {
      const label = target.closest('button')?.textContent || ''
      const quarter = Number(label.replace(/\D/g, ''))
      if (quarter >= 1 && quarter <= 4) currentQuarter = quarter
      scheduleUpdate()
    }
  }, true)

  document.addEventListener('fullscreenchange', () => window.setTimeout(mount, 0))
  document.addEventListener('webkitfullscreenchange', () => window.setTimeout(mount, 0))
  style()
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount()
})()