(() => {
  const ORANGE_AFTER_MS = 150000
  const GREEN_AFTER_MS = 300000
  const states = new Map()
  let initialised = false
  let syncing = false

  function isMatchDay() {
    return location.pathname.includes('/match-day') || Boolean(document.querySelector('.md-bench'))
  }

  function installStyles() {
    if (document.getElementById('pf-interchange-timer-styles')) return
    const style = document.createElement('style')
    style.id = 'pf-interchange-timer-styles'
    style.textContent = `
      [data-pf-interchange-card="true"] {
        position: relative !important;
        box-sizing: border-box !important;
        transition: box-shadow .2s ease, outline-color .2s ease !important;
      }
      [data-pf-interchange-status="red"] {
        outline: 3px solid #ef233c !important;
        outline-offset: -3px !important;
        box-shadow: 0 0 0 1px rgba(239,35,60,.35), 0 0 14px rgba(239,35,60,.28) !important;
      }
      [data-pf-interchange-status="orange"] {
        outline: 3px solid #ff9f1c !important;
        outline-offset: -3px !important;
        box-shadow: 0 0 0 1px rgba(255,159,28,.35), 0 0 14px rgba(255,159,28,.28) !important;
      }
      [data-pf-interchange-status="green"] {
        outline: 3px solid #16c784 !important;
        outline-offset: -3px !important;
        box-shadow: 0 0 0 1px rgba(22,199,132,.35), 0 0 14px rgba(22,199,132,.24) !important;
      }
      .pf-interchange-timer {
        position: absolute;
        top: 3px;
        right: 3px;
        z-index: 20;
        min-width: 38px;
        padding: 3px 5px;
        border-radius: 7px;
        background: rgba(5,13,22,.94);
        color: #fff;
        font-size: 9px;
        font-weight: 900;
        line-height: 1;
        text-align: center;
        pointer-events: none;
        box-shadow: 0 2px 7px rgba(0,0,0,.35);
      }
    `
    document.head.appendChild(style)
  }

  function cleanText(element) {
    return String(element.textContent || '').replace(/\s+/g, ' ').trim()
  }

  function looksLikePlayerCard(element) {
    if (!(element instanceof HTMLElement)) return false
    if (element.classList.contains('pf-interchange-timer')) return false
    const text = cleanText(element)
    if (!text || text.length > 160) return false
    const hasInt = /\bINT\b/i.test(text)
    const hasGoal = /\bG\s*\d+\b/i.test(text)
    const hasBehind = /\bB\s*\d+\b/i.test(text)
    return hasInt && hasGoal && hasBehind
  }

  function cardCandidates(bench) {
    const nodes = [...bench.querySelectorAll('div,button,article,li')].filter(looksLikePlayerCard)
    const cards = nodes.filter(element => !nodes.some(other => other !== element && element.contains(other)))
    if (cards.length) return cards

    return [...bench.children]
      .flatMap(child => child instanceof HTMLElement ? [child, ...child.querySelectorAll(':scope > *')] : [])
      .filter(looksLikePlayerCard)
  }

  function playerKey(card) {
    const directId = card.dataset.playerId || card.dataset.id || card.getAttribute('data-player') || card.id
    if (directId) return `id:${directId}`

    const clone = card.cloneNode(true)
    clone.querySelectorAll?.('.pf-interchange-timer').forEach(node => node.remove())
    const text = String(clone.textContent || '')
      .replace(/\bG\s*\d+\b/gi, ' ')
      .replace(/\bB\s*\d+\b/gi, ' ')
      .replace(/\bINT\b/gi, ' ')
      .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const words = text.split(' ').filter(Boolean)
    const nameWords = words.filter(word => !/^\d+$/.test(word)).slice(0, 4)
    return `text:${nameWords.join('-').toLowerCase()}`
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

  function decorate(card, state, now) {
    card.dataset.pfInterchangeCard = 'true'
    if (state.enteredAt === null) {
      card.dataset.pfInterchangeStatus = 'green'
      card.querySelector('.pf-interchange-timer')?.remove()
      return
    }

    const elapsed = now - state.enteredAt
    card.dataset.pfInterchangeStatus = statusFor(elapsed)
    let badge = card.querySelector('.pf-interchange-timer')
    if (!badge) {
      badge = document.createElement('span')
      badge.className = 'pf-interchange-timer'
      badge.setAttribute('aria-label', 'Time on interchange')
      card.appendChild(badge)
    }
    badge.textContent = formatElapsed(elapsed)
  }

  function syncBench() {
    if (!isMatchDay() || syncing) return
    const bench = document.querySelector('.md-bench')
    if (!(bench instanceof HTMLElement)) return

    syncing = true
    try {
      installStyles()
      const now = Date.now()
      const cards = cardCandidates(bench)
      if (!cards.length) return

      const current = new Map()
      cards.forEach(card => {
        const key = playerKey(card)
        if (key && key !== 'text:') current.set(key, card)
      })
      if (!current.size) return

      if (!initialised) {
        states.clear()
        current.forEach((_, key) => states.set(key, { enteredAt: null }))
        initialised = true
      } else {
        for (const key of [...states.keys()]) {
          if (!current.has(key)) states.delete(key)
        }
        current.forEach((_, key) => {
          if (!states.has(key)) states.set(key, { enteredAt: now })
        })
      }

      current.forEach((card, key) => {
        const state = states.get(key)
        if (state) decorate(card, state, now)
      })
    } finally {
      syncing = false
    }
  }

  function resetBenchTimers() {
    states.clear()
    initialised = false
    document.querySelectorAll('[data-pf-interchange-card="true"]').forEach(card => {
      card.removeAttribute('data-pf-interchange-card')
      card.removeAttribute('data-pf-interchange-status')
      card.querySelector('.pf-interchange-timer')?.remove()
    })
    window.setTimeout(syncBench, 250)
  }

  document.addEventListener('click', event => {
    if (!isMatchDay()) return
    const button = event.target instanceof Element ? event.target.closest('button') : null
    if (!button) return
    const text = String(button.textContent || '').toUpperCase().replace(/[^A-Z]/g, '')
    if (['RESET', 'RESETMATCH', 'RESTART', 'RESTARTMATCH'].includes(text)) {
      window.setTimeout(resetBenchTimers, 100)
    } else {
      window.setTimeout(syncBench, 100)
    }
  }, true)

  const observer = new MutationObserver(() => window.requestAnimationFrame(syncBench))
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.setInterval(syncBench, 1000)
  window.addEventListener('pageshow', syncBench)
  window.addEventListener('resize', syncBench)
  document.addEventListener('fullscreenchange', syncBench)
  document.addEventListener('webkitfullscreenchange', syncBench)
  syncBench()
})()
