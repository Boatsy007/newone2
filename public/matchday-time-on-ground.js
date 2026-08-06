(() => {
  const playerSeconds = new Map()
  let totalMatchSeconds = 0
  let lastClock = null
  let lastDisplayedMinute = -1
  let scheduledUpdate = 0
  let syncing = false

  function installStyles() {
    if (document.getElementById('pf-time-on-ground-styles')) return
    const style = document.createElement('style')
    style.id = 'pf-time-on-ground-styles'
    style.textContent = `
      .md .md-player-main {
        position: relative !important;
      }
      .md .md-player-main .pf-time-on-ground {
        position: absolute !important;
        right: 3px !important;
        bottom: 2px !important;
        z-index: 18 !important;
        color: #16c784 !important;
        font-size: 8px !important;
        font-weight: 950 !important;
        line-height: 1 !important;
        letter-spacing: .01em !important;
        text-shadow: 0 1px 2px rgba(0,0,0,.45) !important;
        pointer-events: none !important;
        white-space: nowrap !important;
      }
      .md:fullscreen .md-player-main .pf-time-on-ground,
      .md:-webkit-full-screen .md-player-main .pf-time-on-ground,
      body.pf-match-day-focus .md-player-main .pf-time-on-ground {
        right: 2px !important;
        bottom: 1px !important;
        font-size: 6px !important;
      }
    `
    document.head.appendChild(style)
  }

  function playerKey(card) {
    const directId = card.dataset.playerId || card.dataset.id || card.getAttribute('data-player-id') || card.getAttribute('data-player')
    if (directId) return `id:${directId}`
    const number = card.querySelector('.number')?.textContent?.trim() || ''
    const name = card.querySelector('.md-player-main strong')?.textContent?.replace(/\s+/g, ' ').trim() || ''
    return name ? `player:${number}:${name.toLowerCase()}` : ''
  }

  function readClock(board) {
    const quarterText = board.querySelector('.md-clock > span')?.textContent || ''
    const timeText = board.querySelector('.md-clock > strong')?.textContent || ''
    const quarter = Number(quarterText.match(/\d+/)?.[0] || 0)
    const match = timeText.match(/(\d{1,3}):(\d{2})/)
    if (!quarter || !match) return null
    return { quarter, seconds: Number(match[1]) * 60 + Number(match[2]) }
  }

  function getCards(board) {
    const bench = board.querySelector('.md-bench')
    const cards = [...board.querySelectorAll('.md-player')].filter(card => card instanceof HTMLElement)
    const players = new Map()

    cards.forEach(card => {
      const key = playerKey(card)
      if (!key) return
      const record = players.get(key) || { cards: [], onGround: false }
      record.cards.push(card)
      if (!(bench instanceof HTMLElement) || !bench.contains(card)) record.onGround = true
      players.set(key, record)
      if (!playerSeconds.has(key)) playerSeconds.set(key, 0)
    })

    return players
  }

  function calculateClockDelta(clock) {
    if (!lastClock) {
      lastClock = clock
      return 0
    }

    let delta = 0
    if (clock.quarter === lastClock.quarter && clock.seconds >= lastClock.seconds) {
      delta = clock.seconds - lastClock.seconds
    } else if (clock.quarter > lastClock.quarter) {
      delta = clock.seconds
    } else if (clock.quarter < lastClock.quarter || clock.seconds < lastClock.seconds) {
      resetTracking(false)
    }

    lastClock = clock
    return Math.max(0, delta)
  }

  function ensureLabel(card, percentage) {
    const main = card.querySelector('.md-player-main')
    if (!(main instanceof HTMLElement)) return
    let label = main.querySelector('.pf-time-on-ground')
    if (!(label instanceof HTMLElement)) {
      label = document.createElement('span')
      label.className = 'pf-time-on-ground'
      label.setAttribute('aria-label', 'Time on ground percentage')
      main.appendChild(label)
    }
    const value = `${percentage}%`
    if (label.textContent !== value) label.textContent = value
  }

  function updateDisplay(players, force = false) {
    const minute = Math.floor(totalMatchSeconds / 60)
    if (!force && minute === lastDisplayedMinute) return
    lastDisplayedMinute = minute

    players.forEach((record, key) => {
      const seconds = playerSeconds.get(key) || 0
      const percentage = totalMatchSeconds > 0
        ? Math.max(0, Math.min(100, Math.round((seconds / totalMatchSeconds) * 100)))
        : (record.onGround ? 100 : 0)
      record.cards.forEach(card => ensureLabel(card, percentage))
    })
  }

  function sync(forceDisplay = false) {
    if (syncing) return
    const board = document.querySelector('.md')
    if (!(board instanceof HTMLElement)) return

    syncing = true
    try {
      installStyles()
      const players = getCards(board)
      if (!players.size) return

      const clock = readClock(board)
      if (clock) {
        const delta = calculateClockDelta(clock)
        if (delta > 0) {
          totalMatchSeconds += delta
          players.forEach((record, key) => {
            if (record.onGround) playerSeconds.set(key, (playerSeconds.get(key) || 0) + delta)
          })
        }
      }

      updateDisplay(players, forceDisplay || lastDisplayedMinute < 0)
    } finally {
      syncing = false
    }
  }

  function scheduleSync(delay = 120, forceDisplay = false) {
    window.clearTimeout(scheduledUpdate)
    scheduledUpdate = window.setTimeout(() => sync(forceDisplay), delay)
  }

  function resetTracking(schedule = true) {
    playerSeconds.clear()
    totalMatchSeconds = 0
    lastClock = null
    lastDisplayedMinute = -1
    document.querySelectorAll('.pf-time-on-ground').forEach(label => label.remove())
    if (schedule) scheduleSync(250, true)
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null
    if (!button || !document.querySelector('.md')) return
    const text = String(button.textContent || '').toUpperCase().replace(/[^A-Z]/g, '')
    if (['RESET', 'RESETMATCH', 'RESTART', 'RESTARTMATCH'].includes(text)) {
      window.setTimeout(() => resetTracking(true), 150)
      return
    }
    scheduleSync(180, false)
    window.setTimeout(() => sync(false), 650)
  }, true)

  window.setInterval(() => sync(false), 1000)
  window.addEventListener('pageshow', () => scheduleSync(100, true))
  window.addEventListener('resize', () => scheduleSync(150, true))
  window.setTimeout(() => sync(true), 350)
})()
