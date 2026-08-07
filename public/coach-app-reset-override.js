(() => {
  if (window.__pfCoachResetOverrideInstalled) return
  window.__pfCoachResetOverrideInstalled = true

  let endpoint = ''
  let headers = null
  let latestState = null
  const nativeFetch = window.fetch.bind(window)

  const clone = value => {
    try { return JSON.parse(JSON.stringify(value)) } catch { return value }
  }

  window.fetch = async (...args) => {
    const [input, init] = args
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
    const isMatchState = /\/api\/club-portal\/match-day\/clubs\/[^/]+\/sheets\/[^/?]+/.test(url)
    let outgoingState = null

    if (isMatchState) {
      endpoint = url
      if (init?.headers) headers = init.headers
      if (init?.body) {
        try {
          const parsed = JSON.parse(String(init.body))
          if (parsed?.state) outgoingState = parsed.state
        } catch {}
      }
    }

    const response = await nativeFetch(...args)

    if (isMatchState && (!init?.method || String(init.method).toUpperCase() === 'GET')) {
      response.clone().json().then(payload => {
        if (payload?.data?.state) latestState = payload.data.state
      }).catch(() => undefined)
    } else if (isMatchState && response.ok && outgoingState) {
      latestState = outgoingState
    }

    return response
  }

  function findStateDispatch() {
    const nodes = [document.getElementById('root'), document.querySelector('.camd'), ...document.querySelectorAll('.camd *')].filter(Boolean)
    const visited = new Set()

    for (const node of nodes) {
      const key = Object.keys(node).find(item => item.startsWith('__reactFiber$'))
      let fiber = key ? node[key] : null
      while (fiber && !visited.has(fiber)) {
        visited.add(fiber)
        let hook = fiber.memoizedState
        while (hook) {
          const value = hook.memoizedState
          if (value && typeof value === 'object' && typeof value.sheetId === 'string' && Array.isArray(value.slots) && typeof hook.queue?.dispatch === 'function') {
            return hook.queue.dispatch
          }
          hook = hook.next
        }
        fiber = fiber.return
      }
    }
    return null
  }

  function zeroState(state) {
    return {
      ...state,
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
      slots: Array.isArray(state.slots) ? state.slots.map(slot => ({
        ...slot,
        goals: 0,
        behinds: 0,
        plusMinus: 0,
        onGroundSeconds: 0,
        benchEnteredAt: null,
        injured: false,
      })) : [],
    }
  }

  async function handleReset(event) {
    const target = event.target instanceof Element ? event.target.closest('.afl-reset') : null
    if (!(target instanceof HTMLButtonElement)) return

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    if (!latestState || !endpoint || !headers) {
      window.alert('Match Day is still connecting. Wait a moment and try Reset again.')
      return
    }

    if (!window.confirm('Reset the entire match? This clears the score, timer, player scoring, plus/minus, time on ground, injuries and interchange timers.')) return

    const previousText = target.textContent || 'Reset'
    target.disabled = true
    target.textContent = 'Resetting…'

    const nextState = zeroState(latestState)
    const dispatch = findStateDispatch()

    try {
      if (dispatch) dispatch(clone(nextState))

      const response = await nativeFetch(endpoint, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ state: nextState }),
      })
      if (!response.ok) throw new Error('Reset save failed')

      latestState = nextState
      target.disabled = false
      target.textContent = previousText
    } catch {
      target.disabled = false
      target.textContent = previousText
      window.alert('The game could not be reset. Check the connection and try again.')
    }
  }

  document.addEventListener('click', handleReset, true)
})()
