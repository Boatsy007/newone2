(() => {
  const ORANGE_AFTER_MS = 150000
  const GREEN_AFTER_MS = 300000
  const states = new Map()
  let initialised = false
  let syncing = false
  let scheduledSync = 0

  function installStyles() {
    if (document.getElementById('pf-interchange-timer-styles')) return
    const style = document.createElement('style')
    style.id = 'pf-interchange-timer-styles'
    style.textContent = `
      .md-bench .md-player[data-pf-interchange-card="true"] {
        position: relative !important;
        box-sizing: border-box !important;
        transition: box-shadow .2s ease, outline-color .2s ease !important;
      }
      .md-bench .md-player[data-pf-interchange-status="red"] {
        outline: 3px solid #ef233c !important;
        outline-offset: -3px !important;
        box-shadow: 0 0 0 1px rgba(239,35,60,.38), 0 0 14px rgba(239,35,60,.34) !important;
      }
      .md-bench .md-player[data-pf-interchange-status="orange"] {
        outline: 3px solid #ff9f1c !important;
        outline-offset: -3px !important;
        box-shadow: 0 0 0 1px rgba(255,159,28,.38), 0 0 14px rgba(255,159,28,.34) !important;
      }
      .md-bench .md-player[data-pf-interchange-status="green"] {
        outline: 3px solid #16c784 !important;
        outline-offset: -3px !important;
        box-shadow: 0 0 0 1px rgba(22,199,132,.38), 0 0 14px rgba(22,199,132,.30) !important;
      }
      .md-bench .md-player[data-pf-interchange-time]::after {
        content: attr(data-pf-interchange-time);
        position: absolute !important;
        top: 3px !important;
        right: 3px !important;
        z-index: 20 !important;
        min-width: 39px !important;
        padding: 3px 5px !important;
        border-radius: 7px !important;
        background: rgba(5,13,22,.95) !important;
        color: #fff !important;
        font-size: 9px !important;
        font-weight: 900 !important;
        line-height: 1 !important;
        letter-spacing: .02em !important;
        text-align: center !important;
        pointer-events: none !important;
        box-shadow: 0 2px 7px rgba(0,0,0,.4) !important;
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

  function formatElapsed(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
  }

  function statusFor(elapsed) {
    if (elapsed >= GREEN_AFTER_MS) return 'green'
    if (elapsed >= ORANGE_AFTER_MS) return 'orange'
    return 'red'
  }

  function setAttributeIfChanged(element, name, value) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value)
  }

  function clearDecoration(card) {
    card.removeAttribute('data-pf-interchange-card')
    card.removeAttribute('data-pf-interchange-status')
    card.removeAttribute('data-pf-interchange-time')
  }

  function decorate(card, state, now) {
    setAttributeIfChanged(card, 'data-pf-interchange-card', 'true')
    if (state.enteredAt === null) {
      setAttributeIfChanged(card, 'data-pf-interchange-status', 'green')
      card.removeAttribute('data-pf-interchange-time')
      return
    }

    const elapsed = now - state.enteredAt
    setAttributeIfChanged(card, 'data-pf-interchange-status', statusFor(elapsed))
    setAttributeIfChanged(card, 'data-pf-interchange-time', formatElapsed(elapsed))
  }

  function syncBench() {
    if (syncing) return
    const board = document.querySelector('.md')
    const bench = board?.querySelector('.md-bench')
    if (!(bench instanceof HTMLElement)) return

    syncing = true
    try {
      installStyles()
      const now = Date.now()
      const cards = [...bench.querySelectorAll('.md-player')].filter(card => card instanceof HTMLElement)
      if (!cards.length) return

      const current = new Map()
      cards.forEach(card => {
        const key = playerKey(card)
        if (key) current.set(key, card)
      })
      if (!current.size) return

      if (!initialised) {
        states.clear()
        current.forEach((_, key) => states.set(key, { enteredAt: null }))
        initialised = true
      } else {
        current.forEach((_, key) => {
          if (!states.has(key)) states.set(key, { enteredAt: now })
        })
        for (const key of [...states.keys()]) {
          if (!current.has(key)) states.delete(key)
        }
      }

      board.querySelectorAll('.md-player[data-pf-interchange-card="true"]').forEach(card => {
        if (!bench.contains(card)) clearDecoration(card)
      })

      current.forEach((card, key) => {
        const state = states.get(key)
        if (state) decorate(card, state, now)
      })
    } finally {
      syncing = false
    }
  }

  function scheduleSync(delay = 100) {
    window.clearTimeout(scheduledSync)
    scheduledSync = window.setTimeout(syncBench, delay)
  }

  function resetBenchTimers() {
    states.clear()
    initialised = false
    document.querySelectorAll('.md-player[data-pf-interchange-card="true"]').forEach(clearDecoration)
    scheduleSync(250)
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null
    if (!button || !document.querySelector('.md')) return
    const text = String(button.textContent || '').toUpperCase().replace(/[^A-Z]/g, '')
    if (['RESET', 'RESETMATCH', 'RESTART', 'RESTARTMATCH'].includes(text)) {
      window.setTimeout(resetBenchTimers, 150)
      return
    }
    scheduleSync(180)
    window.setTimeout(syncBench, 650)
  }, true)

  window.setInterval(syncBench, 1000)
  window.addEventListener('pageshow', () => scheduleSync(100))
  window.addEventListener('resize', () => scheduleSync(150))
  window.setTimeout(syncBench, 300)
})()
