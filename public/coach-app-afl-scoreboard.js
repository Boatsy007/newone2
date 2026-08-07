(() => {
  if (window.__pfCoachAflScoreboardInstalled) return
  window.__pfCoachAflScoreboardInstalled = true

  let matchEndpoint = ''
  let matchHeaders = null
  let latestState = null

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
          const parsed = JSON.parse(String(init.body))
          if (parsed?.state) latestState = parsed.state
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

  function addLogo(team, home) {
    if (team.querySelector('.afl-team-logo')) return
    const name = team.querySelector('.score-title span')?.textContent?.trim() || (home ? 'Your team' : 'Opposition')
    const logo = document.createElement('div')
    logo.className = 'afl-team-logo'

    const shellLogo = home ? document.querySelector('.coach-club img') : null
    if (shellLogo instanceof HTMLImageElement && shellLogo.src) {
      const image = document.createElement('img')
      image.src = shellLogo.src
      image.alt = `${name} logo`
      logo.appendChild(image)
    } else {
      logo.textContent = initials(name)
      logo.setAttribute('aria-label', `${name} logo`)
    }
    team.prepend(logo)
  }

  function quarterNumber(scoreboard) {
    const text = scoreboard.querySelector('.camd-clock > span')?.textContent || 'Q1'
    return Math.max(1, Math.min(4, Number(text.replace(/\D/g, '')) || 1))
  }

  function timerButton(scoreboard) {
    return scoreboard.querySelector('.camd-clock button:not(.next-q):not(.afl-reset)')
  }

  function isRunning(scoreboard) {
    return /pause/i.test(timerButton(scoreboard)?.textContent || '')
  }

  async function saveState(nextState) {
    if (!matchEndpoint || !matchHeaders) throw new Error('Match state is not ready')
    const response = await nativeFetch(matchEndpoint, {
      method: 'PUT',
      headers: matchHeaders,
      body: JSON.stringify({ state: nextState }),
    })
    if (!response.ok) throw new Error('Unable to save match')
    latestState = nextState
  }

  async function resetMatch() {
    if (!latestState || !matchEndpoint || !matchHeaders) {
      window.alert('The Match Day record is still loading. Try again in a moment.')
      return
    }
    if (!window.confirm('Reset the entire match? This clears all scores, time, player scoring, plus/minus, time on ground, injuries and interchange timers.')) return

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

    try {
      await saveState(resetState)
      window.location.reload()
    } catch {
      window.alert('The match could not be reset. Check the internet connection and try again.')
    }
  }

  async function endGame(scoreboard, quarterButton) {
    const startPause = timerButton(scoreboard)
    if (isRunning(scoreboard) && startPause instanceof HTMLButtonElement) startPause.click()

    const finalState = latestState ? {
      ...latestState,
      elapsed: Number(latestState.elapsed) + (latestState.runningSince ? Math.floor((Date.now() - latestState.runningSince) / 1000) : 0),
      runningSince: null,
      trackingUpdatedAt: null,
      gameEnded: true,
    } : null

    if (finalState) {
      try { await saveState(finalState) } catch {
        window.alert('The game could not be ended because the latest state did not save.')
        return
      }
    }

    scoreboard.classList.add('game-ended')
    const quarterLabel = scoreboard.querySelector('.camd-clock > span')
    if (quarterLabel) quarterLabel.textContent = 'FINAL'
    quarterButton.textContent = 'Game Ended'
    quarterButton.disabled = true
  }

  function installStyles() {
    if (document.getElementById('pf-afl-scoreboard-styles')) return
    const style = document.createElement('style')
    style.id = 'pf-afl-scoreboard-styles'
    style.textContent = `
      .camd .camd-scoreboard.afl-scoreboard{grid-template-columns:minmax(0,1fr) minmax(132px,auto) minmax(0,1fr);gap:0;padding:0;overflow:hidden;border:1px solid #303d47;border-radius:11px;background:#05080b}
      .camd .afl-scoreboard .score-team{position:relative;display:grid;grid-template-columns:60px minmax(0,1fr);grid-template-rows:auto auto;gap:0;min-height:88px;padding:0;background:linear-gradient(110deg,#b60818,#ef1b30);direction:ltr}
      .camd .afl-scoreboard .score-team.away{grid-template-columns:minmax(0,1fr) 60px;background:linear-gradient(250deg,#5d3214,#b56d1a)}
      .camd .afl-scoreboard .score-team.away .afl-team-logo{grid-column:2;grid-row:1/3}
      .camd .afl-scoreboard .score-team.away .score-title,.camd .afl-scoreboard .score-team.away .score-controls{grid-column:1}
      .camd .afl-team-logo{grid-row:1/3;display:grid;place-items:center;min-width:60px;padding:6px;background:rgba(0,0,0,.2);color:#fff;font-family:'Bebas Neue',Impact,sans-serif;font-size:21px;font-weight:950}
      .camd .afl-team-logo img{width:48px;height:48px;object-fit:contain;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))}
      .camd .afl-scoreboard .score-title{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'name name' 'breakdown total';align-items:end;gap:2px 10px;padding:6px 10px 1px;color:#fff}
      .camd .afl-scoreboard .score-title span{grid-area:name;color:#fff;font-size:9px;opacity:.92}
      .camd .afl-scoreboard .score-title strong{grid-area:breakdown;font-family:'Bebas Neue',Impact,sans-serif;font-size:28px;line-height:.9;color:#fff}
      .camd .afl-scoreboard .score-title strong::before{content:'G  B  ';font-family:Barlow,Inter,sans-serif;font-size:8px;letter-spacing:.22em;vertical-align:middle;opacity:.72}
      .camd .afl-scoreboard .score-title b{grid-area:total;font-family:'Bebas Neue',Impact,sans-serif;font-size:39px;line-height:.78;color:#fff}
      .camd .afl-scoreboard .score-controls{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:3px 8px 7px}
      .camd .afl-scoreboard .score-controls>div{display:grid;grid-template-columns:auto 24px 18px 24px;align-items:center;gap:2px;padding:2px 4px;border:1px solid rgba(255,255,255,.24);border-radius:6px;background:rgba(0,0,0,.2)}
      .camd .afl-scoreboard .score-controls span{font-size:8px;color:#fff}
      .camd .afl-scoreboard .score-controls button{width:24px;height:23px;background:rgba(0,0,0,.44)}
      .camd .afl-scoreboard .score-controls b{color:#fff}
      .camd .afl-scoreboard .camd-clock{position:relative;z-index:2;min-width:142px;padding:5px 7px;background:#080c10;box-shadow:0 0 16px rgba(0,0,0,.7)}
      .camd .afl-scoreboard .camd-clock>span{font-family:'Bebas Neue',Impact,sans-serif;font-size:18px;color:#fff}
      .camd .afl-scoreboard .camd-clock>strong{font-size:31px;color:#fff}
      .camd .afl-scoreboard .camd-clock>div{display:grid;grid-template-columns:1fr 1fr;gap:4px;width:100%}
      .camd .afl-scoreboard .camd-clock button{min-height:28px;padding:4px 5px;font-size:8px}
      .camd .afl-scoreboard .camd-clock .next-q{display:flex!important;background:#f0a312;color:#160d00}
      .camd .afl-reset{grid-column:1/-1;min-height:23px!important;background:#2b343b!important;color:#fff!important}
      .camd .afl-scoreboard.game-ended .camd-clock>strong,.camd .afl-scoreboard.game-ended .camd-clock>span{color:#f7c646}
      @media(max-width:900px) and (orientation:portrait){
        .camd .camd-scoreboard.afl-scoreboard{grid-template-columns:minmax(0,1fr) 106px minmax(0,1fr)}
        .camd .afl-scoreboard .score-team{grid-template-columns:40px minmax(0,1fr);min-height:78px}
        .camd .afl-scoreboard .score-team.away{grid-template-columns:minmax(0,1fr) 40px}
        .camd .afl-team-logo{min-width:40px;padding:3px;font-size:14px}.camd .afl-team-logo img{width:34px;height:34px}
        .camd .afl-scoreboard .score-title{gap:2px 4px;padding:4px 4px 1px}.camd .afl-scoreboard .score-title span{font-size:7px}.camd .afl-scoreboard .score-title strong{font-size:21px}.camd .afl-scoreboard .score-title b{font-size:28px}
        .camd .afl-scoreboard .score-controls{display:grid;padding:2px 3px 4px;gap:3px}.camd .afl-scoreboard .score-controls>div{grid-template-columns:10px 19px 13px 19px;padding:1px}.camd .afl-scoreboard .score-controls span{font-size:0}.camd .afl-scoreboard .score-controls span::first-letter{font-size:8px}.camd .afl-scoreboard .score-controls button{width:19px;height:20px}
        .camd .afl-scoreboard .camd-clock{min-width:106px;padding:4px}.camd .afl-scoreboard .camd-clock>strong{font-size:25px}.camd .afl-scoreboard .camd-clock button{font-size:7px;padding:3px}
      }
    `
    document.head.appendChild(style)
  }

  function enhance() {
    const scoreboard = document.querySelector('.camd .camd-scoreboard')
    if (!(scoreboard instanceof HTMLElement)) return

    installStyles()
    if (!scoreboard.classList.contains('afl-scoreboard')) {
      scoreboard.classList.add('afl-scoreboard')
      const teams = scoreboard.querySelectorAll('.score-team')
      if (teams[0]) addLogo(teams[0], true)
      if (teams[1]) addLogo(teams[1], false)
    }

    const clock = scoreboard.querySelector('.camd-clock')
    if (!(clock instanceof HTMLElement)) return
    const startPause = timerButton(scoreboard)
    const quarterButton = clock.querySelector('.next-q')
    const quarter = quarterNumber(scoreboard)

    if (startPause instanceof HTMLButtonElement) {
      const label = isRunning(scoreboard) ? 'Pause' : 'Start'
      const textNode = [...startPause.childNodes].find(node => node.nodeType === Node.TEXT_NODE)
      if (textNode && textNode.textContent !== label) textNode.textContent = label
    }

    if (quarterButton instanceof HTMLButtonElement) {
      const ended = Boolean(latestState?.gameEnded)
      const label = ended ? 'Game Ended' : quarter >= 4 ? 'End Game' : 'End Qtr'
      const textNode = [...quarterButton.childNodes].find(node => node.nodeType === Node.TEXT_NODE)
      if (textNode && textNode.textContent !== label) textNode.textContent = label
      quarterButton.disabled = ended
      if (ended) scoreboard.classList.add('game-ended')

      if (!quarterButton.dataset.aflBound) {
        quarterButton.dataset.aflBound = 'true'
        quarterButton.addEventListener('click', event => {
          if (quarterNumber(scoreboard) < 4) return
          event.preventDefault()
          event.stopImmediatePropagation()
          void endGame(scoreboard, quarterButton)
        }, true)
      }
    }

    if (!clock.querySelector('.afl-reset')) {
      const reset = document.createElement('button')
      reset.type = 'button'
      reset.className = 'afl-reset'
      reset.textContent = 'Reset'
      reset.addEventListener('click', () => void resetMatch())
      clock.querySelector(':scope > div')?.appendChild(reset)
    }
  }

  const timer = window.setInterval(enhance, 500)
  window.addEventListener('pageshow', enhance)
  window.addEventListener('beforeunload', () => window.clearInterval(timer))
  enhance()
})()
