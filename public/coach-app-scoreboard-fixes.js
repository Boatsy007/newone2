(() => {
  if (window.__pfCoachScoreboardFixesInstalled) return
  window.__pfCoachScoreboardFixesInstalled = true

  let matchEndpoint = ''
  let matchHeaders = null
  let latestState = null
  let directoryPromise = null
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

  const normalise = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  const initials = value => String(value || 'PF').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()

  function currentClubId() {
    const matched = matchEndpoint.match(/\/clubs\/([^/]+)\/sheets\//)
    if (matched?.[1]) return decodeURIComponent(matched[1])
    try { return localStorage.getItem('playfooty.coachApp.club.v1') || '' } catch { return '' }
  }

  async function clubs() {
    if (!directoryPromise) {
      directoryPromise = nativeFetch('/api/clubs').then(response => response.ok ? response.json() : null).then(payload => Array.isArray(payload?.data) ? payload.data : []).catch(() => [])
    }
    return directoryPromise
  }

  async function brandFor(name, clubId, fallbackLogo = '') {
    let id = clubId
    let logoUrl = fallbackLogo
    if (!id) {
      const wanted = normalise(name)
      const all = await clubs()
      const match = all.find(item => normalise(item.clubName) === wanted) || all.find(item => {
        const candidate = normalise(item.clubName)
        return candidate && (candidate.includes(wanted) || wanted.includes(candidate))
      })
      id = match?.clubId || ''
      logoUrl = match?.logoUrl || logoUrl
    }
    if (id && !logoUrl) {
      try {
        const response = await nativeFetch(`/api/clubs/${encodeURIComponent(id)}`)
        const payload = response.ok ? await response.json() : null
        logoUrl = payload?.data?.logoUrl || ''
      } catch {}
    }
    let coverPhotoUrl = ''
    if (id) {
      try {
        const response = await nativeFetch(`/api/club-covers/${encodeURIComponent(id)}`)
        const payload = response.ok ? await response.json() : null
        coverPhotoUrl = payload?.data?.coverPhotoUrl || ''
      } catch {}
    }
    return { logoUrl, coverPhotoUrl }
  }

  async function applyBrand(team, home) {
    if (!(team instanceof HTMLElement) || team.dataset.pfBrandLoading || team.dataset.pfBrandReady) return
    team.dataset.pfBrandLoading = '1'
    const name = team.querySelector('.score-title span')?.textContent?.trim() || (home ? 'Your team' : 'Opposition')
    const shellLogo = home ? document.querySelector('.coach-club img') : null
    const fallbackLogo = shellLogo instanceof HTMLImageElement ? shellLogo.src : ''
    const brand = await brandFor(name, home ? currentClubId() : '', fallbackLogo)
    let logo = team.querySelector('.afl-team-logo')
    if (!logo) {
      logo = document.createElement('div')
      logo.className = 'afl-team-logo'
      team.prepend(logo)
    }
    logo.replaceChildren()
    if (brand.logoUrl) {
      const image = document.createElement('img')
      image.src = brand.logoUrl
      image.alt = `${name} logo`
      logo.appendChild(image)
    } else logo.textContent = initials(name)
    team.style.backgroundColor = '#c8102e'
    team.style.backgroundImage = brand.coverPhotoUrl ? `linear-gradient(90deg,rgba(60,0,8,.72),rgba(12,7,10,.5)),url("${brand.coverPhotoUrl.replace(/"/g, '%22')}")` : 'linear-gradient(110deg,#b60818,#ef1b30)'
    team.style.backgroundSize = 'cover'
    team.style.backgroundPosition = 'center'
    team.dataset.pfBrandReady = '1'
    delete team.dataset.pfBrandLoading
  }

  function installQuickScore(team) {
    if (!(team instanceof HTMLElement) || team.querySelector('.pf-quick-score')) return
    const groups = [...team.querySelectorAll('.score-controls > div')]
    if (groups.length < 2) return
    const wrapper = document.createElement('div')
    wrapper.className = 'pf-quick-score'
    ;['G', 'B'].forEach((label, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = label
      button.addEventListener('click', () => {
        const add = groups[index]?.querySelector('button:last-of-type')
        if (add instanceof HTMLButtonElement) add.click()
      })
      wrapper.appendChild(button)
    })
    team.appendChild(wrapper)
  }

  async function resetMatch(event) {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (!latestState || !matchEndpoint || !matchHeaders) {
      window.alert('Match Day is still connecting. Wait a moment and try Reset again.')
      return
    }
    if (!window.confirm('Reset the entire match? This clears the score, timer, player scoring, plus/minus, time on ground, injuries and interchange timers.')) return
    const button = event.currentTarget
    if (button instanceof HTMLButtonElement) { button.disabled = true; button.textContent = 'Resetting…' }
    const state = {
      ...latestState, quarter:1, elapsed:0, runningSince:null, homeGoals:0, homeBehinds:0, awayGoals:0, awayBehinds:0,
      events:[], totalTrackedSeconds:0, trackingUpdatedAt:null, gameEnded:false,
      slots:Array.isArray(latestState.slots) ? latestState.slots.map(slot => ({...slot,goals:0,behinds:0,plusMinus:0,onGroundSeconds:0,benchEnteredAt:null,injured:false})) : [],
    }
    try {
      const response = await nativeFetch(matchEndpoint,{method:'PUT',headers:matchHeaders,body:JSON.stringify({state})})
      if (!response.ok) throw new Error('reset failed')
      latestState = state
      window.location.reload()
    } catch {
      if (button instanceof HTMLButtonElement) { button.disabled = false; button.textContent = 'Reset' }
      window.alert('The match could not be reset. Check the connection and try again.')
    }
  }

  function installStyles() {
    if (document.getElementById('pf-scoreboard-fixes-style')) return
    const style = document.createElement('style')
    style.id = 'pf-scoreboard-fixes-style'
    style.textContent = `
      .camd .afl-scoreboard .score-team{background-color:#c8102e!important;background-size:cover!important;background-position:center!important}
      .camd .afl-scoreboard .score-controls{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important}
      .camd .pf-quick-score{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px 9px 7px}
      .camd .score-team.away .pf-quick-score{grid-column:1}
      .camd .pf-quick-score button{min-height:28px;border:1px solid rgba(255,255,255,.38);border-radius:7px;background:rgba(0,0,0,.5);color:#fff;font-family:'Bebas Neue',Impact,sans-serif;font-size:18px;font-weight:950;box-shadow:0 2px 0 rgba(0,0,0,.35)}
      .camd .pf-quick-score button:active{transform:translateY(2px) scale(.96);box-shadow:none}
      @media(max-width:900px) and (orientation:portrait){.camd .pf-quick-score{gap:3px;padding:3px 4px 5px}.camd .pf-quick-score button{min-height:23px;font-size:15px}}
    `
    document.head.appendChild(style)
  }

  function enhance() {
    const scoreboard = document.querySelector('.camd .camd-scoreboard')
    if (!(scoreboard instanceof HTMLElement)) return
    installStyles()
    const teams = scoreboard.querySelectorAll('.score-team')
    if (teams[0]) { installQuickScore(teams[0]); void applyBrand(teams[0], true) }
    if (teams[1]) { installQuickScore(teams[1]); void applyBrand(teams[1], false) }
    const reset = scoreboard.querySelector('.afl-reset')
    if (reset instanceof HTMLButtonElement && !reset.dataset.pfResetFixed) {
      reset.dataset.pfResetFixed = '1'
      reset.addEventListener('click', resetMatch, true)
    }
  }

  window.setInterval(enhance, 500)
  window.addEventListener('pageshow', enhance)
  enhance()
})()
