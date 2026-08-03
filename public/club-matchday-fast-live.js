(() => {
  const SESSION_KEY = 'playfooty.clubPortal.session.v1'
  let publishTimer = 0
  let requestSequence = 0

  function matchContext() {
    const match = location.pathname.match(/^\/club-portal\/([^/]+)\/match-day\/?$/)
    return match ? { clubId: decodeURIComponent(match[1]) } : null
  }

  function accessToken() {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return ''
      const parsed = JSON.parse(raw)
      return typeof parsed?.access_token === 'string' ? parsed.access_token : ''
    } catch {
      return ''
    }
  }

  function scoreParts(value) {
    const match = String(value || '').trim().match(/^(\d+)\.(\d+)$/)
    return match ? { goals: Number(match[1]), behinds: Number(match[2]) } : null
  }

  function clockSeconds(value) {
    const match = String(value || '').trim().match(/^(\d+):(\d{2})$/)
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0
  }

  function snapshot() {
    const context = matchContext()
    const token = accessToken()
    if (!context || !token) return null

    const scoreboard = document.querySelector('.md-scoreboard')
    const scoreBlocks = scoreboard?.querySelectorAll(':scope > div')
    if (!scoreboard || !scoreBlocks || scoreBlocks.length < 2) return null

    const home = scoreParts(scoreBlocks[0].querySelector('strong')?.textContent)
    const away = scoreParts(scoreBlocks[1].querySelector('strong')?.textContent)
    if (!home || !away) return null

    const selected = document.querySelector('.md-picker select')
    const selectedOption = selected?.selectedOptions?.[0]
    const optionParts = String(selectedOption?.textContent || '').split(' · ')
    const clockText = document.querySelector('.md-clock > strong')?.textContent || '00:00'
    const quarterText = document.querySelector('.md-clock > span')?.textContent || 'Q1'
    const timerButton = document.querySelector('.md-clock .start')
    const lastEvent = document.querySelector('.md-events > div b')?.textContent?.trim() || null

    return {
      context,
      token,
      body: {
        teamSheetId: selected?.value || null,
        roundLabel: optionParts[0] || null,
        opponentName: optionParts[1] || null,
        matchDate: null,
        quarter: Number(String(quarterText).replace(/\D/g, '')) || 1,
        elapsedSeconds: clockSeconds(clockText),
        clockRunning: /pause/i.test(timerButton?.textContent || ''),
        homeGoals: home.goals,
        homeBehinds: home.behinds,
        awayGoals: away.goals,
        awayBehinds: away.behinds,
        status: 'LIVE',
        lastEvent,
      },
    }
  }

  async function publishNow() {
    const data = snapshot()
    if (!data) return
    const sequence = ++requestSequence
    try {
      const response = await fetch(`/api/live-match/clubs/${encodeURIComponent(data.context.clubId)}`, {
        method: 'PUT',
        cache: 'no-store',
        headers: {
          authorization: `Bearer ${data.token}`,
          'content-type': 'application/json',
          'cache-control': 'no-cache',
        },
        body: JSON.stringify(data.body),
      })
      if (!response.ok && sequence === requestSequence) {
        console.warn('Immediate live score publish failed', response.status)
      }
    } catch (error) {
      if (sequence === requestSequence) console.warn('Immediate live score publish failed', error)
    }
  }

  function schedulePublish() {
    window.clearTimeout(publishTimer)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      publishTimer = window.setTimeout(publishNow, 30)
    }))
  }

  document.addEventListener('click', event => {
    if (!matchContext()) return
    const button = event.target instanceof Element ? event.target.closest('button') : null
    if (!button) return

    const scoreButton = button.closest('.md-player-score, .md-team-actions, .md-opposition-actions')
    const toolbarButton = button.closest('.md-clock')
    const text = String(button.textContent || '').trim().toLowerCase()
    const relevant = Boolean(scoreButton) || Boolean(toolbarButton) || text === 'undo'
    if (relevant) schedulePublish()
  }, true)
})()
