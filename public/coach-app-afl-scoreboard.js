(() => {
  if (window.__pfCoachAflScoreboardInstalled) return
  window.__pfCoachAflScoreboardInstalled = true

  let matchEndpoint = ''
  let matchHeaders = null
  let latestState = null
  let ended = false

  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const [input, init] = args
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
    const isMatchState = /\/api\/club-portal\/match-day\/clubs\/[^/]+\/sheets\/[^/?]+/.test(url)

    if (isMatchState) {
      matchEndpoint = url
      if (init?.headers) matchHeaders = init.headers
      if (init?.body) {
        try {
          const body = JSON.parse(String(init.body))
          if (body?.state) latestState = body.state
        } catch {}
      }
    }

    const response = await nativeFetch(...args)
    if (isMatchState && (!init?.method || String(init.method).toUpperCase() === 'GET')) {
      response.clone().json().then(payload => {
        if (payload?.data?.state) latestState = payload.data.state
      }).catch(() => undefined)
    }
    return response
  }

  function initials(name) {
    return String(name || 'PF').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  }

  function findLogo(name, home) {
    const images = [...document.images]
    const normal = String(name || '').toLowerCase()
    const named = images.find(image => {
      const text = `${image.alt || ''} ${image.title || ''}`.toLowerCase()
      return normal && text.includes(normal)
    })
    if (named?.src) return named.src
    if (home) {
      const shell = document.querySelector('.coach-app-shell img, .coach-app-header img, header img')
      if (shell instanceof HTMLImageElement && shell.src) return shell.src
    }
    return ''
  }

  function addLogo(team, home) {
    if (team.querySelector('.afl-team-logo')) return
    const name = team.querySelector('.score-title span')?.textContent?.trim() || (home ? 'Your team' : 'Opposition')
    const logo = document.createElement('div')
    logo.className = 'afl-team-logo'
    const source = findLogo(name, home)
    if (source) {
      const image = document.createElement('img')
      image.src = source
      image.alt = `${name} logo`
      logo.appendChild(image)
    } else {
      logo.textContent = initials(name)
      logo.setAttribute('aria-label', `${name} logo unavailable`)
    }
    team.prepend(logo)
  }

  function currentQuarter(scoreboard) {
    const value = scoreboard.querySelector('.camd-clock > span')?.textContent || 'Q1'
    return Math.max(1, Math.min(4, Number(value.replace(/\D/g, '')) || 1))
  }

  function isRunning(scoreboard) {
    const button = scoreboard.querySelector('.camd-clock button:not(.next-q)')
    return /pause/i.test(button?.textContent || '')
  }

  function resetMatch() {
    if (!latestState || !matchEndpoint || !matchHeaders) {
      window.alert('The Match Day record is still loading. Please try reset again in a moment.')
      return
    }
    if (!window.confirm('Reset the entire match? This clears the score, timer, player scores, plus/minus, time on ground, injuries and interchange timers.')) return

    const resetState = {
      ...latestState,
      quarter: 1,
      elapsed: 0,
      runningSince: null,
      homeGoals: 0,
      homeBehinds: 0,
      awayGoals: 0,
      awayBehinds: 0,
      events: [],
      totalTrackedSeconds: 0,
      trackingUpdatedAt: null,
      gameEnded: false,
      slots: Array.isArray(latestState.slots) ? latestState.slots.map(slot => ({
        ...slot,
        goals: 0,
        behinds: 0,
        plusMinus: 0,
        onGroundSeconds: 0,
        benchEnteredAt: null,
        injured: false,
      })) : [],
    }

    nativeFetch(matchEndpoint, {
      method: 'PUT',
      headers: matchHeaders,
      body: JSON.stringify({ state: resetState }),
    }).then(async response => {
      if (!response.ok) throw new Error('Reset failed')
      latestState = resetState
      window.location.reload()
    }).catch(() => window.alert('The match could not be reset. Please check the connection and try again.'))
  }

  function installStyles() {
    if (document.getElementById('pf-afl-scoreboard-styles')) return
    const style = document.createElement('style')
    style.id = 'pf-afl-scoreboard-styles'
    style.textContent = `
      .camd .camd-scoreboard.afl-scoreboard{grid-template-columns:minmax(0,1fr) minmax(126px,auto) minmax(0,1fr);gap:0;padding:0;overflow:hidden;border:1px solid #31424e;border-radius:11px;background:#05080b}
      .camd .afl-scoreboard .score-team{position:relative;display:grid;grid-template-columns:58px minmax(0,1fr);gap:0;min-height:86px;padding:0;background:linear-gradient(105deg,#bd0717,#ef172b);direction:ltr}
      .camd .afl-scoreboard .score-team.away{grid-template-columns:minmax(0,1fr) 58px;background:linear-gradient(255deg,#6f3813,#b66a17)}
      .camd .afl-scoreboard .score-team.away .afl-team-logo{grid-column:2;grid-row:1/3}
      .camd .afl-scoreboard .score-team.away .score-title,.camd .afl-scoreboard .score-team.away .score-controls{grid-column:1}
      .camd .afl-team-logo{grid-row:1/3;display:grid;place-items:center;min-width:58px;padding:7px;background:rgba(0,0,0,.18);color:#fff;font-family:'Bebas Neue',Impact,sans-serif;font-size:20px;font-weight:900}
      .camd .afl-team-logo img{width:46px;height:46px;object-fit:contain;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))}
      .camd .afl-scoreboard .score-title{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:7px 11px 2px;color:#fff}
      .camd .afl-scoreboard .score-title span{grid-column:1/-1;color:#fff;font-size:9px;opacity:.9}
      .camd .afl-scoreboard .score-title strong{font-size:29px;line-height:1;color:#fff}
      .camd .afl-scoreboard .score-title strong::before{content:'G  B  ';font-family:Barlow,Inter,sans-serif;font-size:9px;letter-spacing:.25em;vertical-align:middle;opacity:.72}
      .camd .afl-scoreboard .score-title b{font-family:'Bebas Neue',Impact,sans-serif;font-size:37px;line-height:.8;color:#fff}
      .camd .afl-scoreboard .score-controls{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:3px 9px 7px}
      .camd .afl-scoreboard .score-controls>div{display:grid;grid-template-columns:auto 23px 18px 23px;gap:2px;padding:2px 4px;border-color:rgba(255,255,255,.24);background:rgba(0,0,0,.19)}
      .camd .afl-scoreboard .score-controls span{font-size:8px;color:#fff}
      .camd .afl-scoreboard .score-controls button{width:23px;height:22px;background:rgba(0,0,0,.42)}
      .camd .afl-scoreboard .score-controls b{color:#fff}
      .camd .afl-scoreboard .camd-clock{position:relative;z-index:2;min-width:138px;padding:5px 8px;background:#080c10;box-shadow:0 0 16px rgba(0,0,0,.65)}
      .camd .afl-scoreboard .camd-clock>span{font-family:'Bebas Neue',Impact,sans-serif;font-size:17px;color:#fff}
      .camd .afl-scoreboard .camd-clock>strong{font-size:30px;color:#fff}
      .camd .afl-scoreboard .camd-clock>div{display:grid;grid-template-columns:1fr 1fr;gap:4px;width:100%}
      .camd .afl-scoreboard .camd-clock button{min-height:27px;padding:4px 5px;font-size:8px}
      .camd .afl-scoreboard .camd-clock .next-q{display:flex!important;background:#f0a312;color:#160d00}
      .camd .afl-reset{grid-column:1/-1;min-height:23px!important;background:#2b343b!important;color:#fff!important}
      .camd .afl-scoreboard.game-ended .camd-clock>strong{color:#f7c646}
      @media(max-width:900px) and (orientation:portrait){
        .camd .camd-scoreboard.afl-scoreboard{grid-template-columns:minmax(0,1fr) 102px minmax(0,1fr)}
        .camd .afl-scoreboard .score-team{grid-template-columns:38px minmax(0,1fr);min-height:75px}
        .camd .afl-scoreboard .score-team.away{grid-template-columns:minmax(0,1fr) 38px}
        .camd .afl-team-logo{min-width:38px;padding:3px;font-size:14px}.camd .afl-team-logo img{width:32px;height:32px}
        .camd .afl-scoreboard .score-title{gap:4px;padding:5px 5px 2px}.camd .afl-scoreboard .score-title strong{font-size:22px}.camd .afl-scoreboard .score-title b{font-size:28px}
        .camd .afl-scoreboard .score-controls{display:grid;padding:2px 4px 5px}.camd .afl-scoreboard .score-controls>div{grid-template-columns:12px 20px 14px 20px}.camd .afl-scoreboard .score-controls span{font-size:0}.camd .afl-scoreboard .score-controls span::first-letter{font-size:8px}
        .camd .afl-scoreboard .camd-clock{min-width:102px;padding:4px}.camd .afl-scoreboard .camd-clock>strong{font-size:25px}.camd .afl-scoreboard .camd-clock button{font-size:7px;padding:3px}
      }
    `
    document.head.appendChild(style)
  }

  function enhance() {
    const scoreboard = document.querySelector('.camd .camd-scoreboard')
    if (!(scoreboard instanceof HTMLElement)) return
    installStyles()
    scoreboard.classList.add('afl-scoreboard')

    const teams = scoreboard.querySelectorAll('.score-team')
    if (teams[0]) addLogo(teams[0], true)
    if (teams[1]) addLogo(teams[1], false)

    const clock = scoreboard.querySelector('.camd-clock')
    if (!(clock instanceof HTMLElement)) return
    const timerButton = clock.querySelector('button:not(.next-q)')
    const quarterButton = clock.querySelector('.next-q')
    const quarter = currentQuarter(scoreboard)

    if (timerButton) {
      const running = isRunning(scoreboard)
      timerButton.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = running ? 'Pause' : 'Start'
      })
    }

    if (quarterButton instanceof HTMLButtonElement) {
      quarterButton.disabled = false
      quarterButton.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = quarter >= 4 ? 'End Game' : 'End Qtr'
      })
      if (!quarterButton.dataset.aflBound) {
        quarterButton.dataset.aflBound = 'true'
        quarterButton.addEventListener('click', event => {
          const current = currentQuarter(scoreboard)
          if (current < 4) return
          event.preventDefault()
          event.stopImmediatePropagation()
          if (isRunning(scoreboard) && timerButton instanceof HTMLButtonElement) timerButton.click()
          ended = true
          scoreboard.classList.add('game-ended')
          const clockText = clock.querySelector(':scope > strong')
          if (clockText) clockText.textContent = 'FINAL'
          quarterButton.textContent = 'Game Ended'
          quarterButton.disabled = true
        }, true)
      }
    }

    if (!clock.querySelector('.afl-reset')) {
      const reset = document.createElement('button')
      reset.type = 'button'
      reset.className = 'afl-reset'
      reset.textContent = 'Reset'
      reset.addEventListener('click', resetMatch)
      clock.querySelector(':scope > div')?.appendChild(reset)
    }

    if (ended) scoreboard.classList.add('game-ended')
  }

  new MutationObserver(enhance).observe(document.documentElement, { childList: true, subtree: true, characterData: true })
  window.setInterval(enhance, 750)
  window.addEventListener('pageshow', enhance)
  enhance()
})()
