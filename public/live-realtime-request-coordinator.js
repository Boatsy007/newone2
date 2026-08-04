(() => {
  if (window.PlayFootyRealtimeRequestCoordinator) return
  window.PlayFootyRealtimeRequestCoordinator = true

  const originalFetch = window.fetch.bind(window)
  const liveMatchCache = new Map()
  const MIN_INTERVAL_MS = 650

  function isLiveMatchRequest(input) {
    const url = typeof input === 'string' ? input : input?.url || ''
    return /\/api\/live-match\/clubs\//.test(url)
  }

  function keyFor(input) {
    const url = typeof input === 'string' ? input : input?.url || ''
    try {
      const parsed = new URL(url, location.origin)
      parsed.search = ''
      return parsed.toString()
    } catch {
      return url.split('?')[0]
    }
  }

  window.fetch = async function coordinatedFetch(input, init) {
    if (!isLiveMatchRequest(input)) return originalFetch(input, init)

    const key = keyFor(input)
    const now = Date.now()
    let entry = liveMatchCache.get(key)

    if (entry?.pending) {
      const response = await entry.pending
      return response.clone()
    }

    if (entry?.response && now - entry.at < MIN_INTERVAL_MS) {
      return entry.response.clone()
    }

    const pending = originalFetch(input, init).then(response => {
      const stored = response.clone()
      liveMatchCache.set(key, { response: stored, at: Date.now(), pending: null })
      return response
    }).catch(error => {
      const current = liveMatchCache.get(key)
      if (current) current.pending = null
      throw error
    })

    liveMatchCache.set(key, { response: entry?.response || null, at: entry?.at || 0, pending })
    const response = await pending
    return response.clone()
  }
})()
