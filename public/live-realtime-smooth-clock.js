(() => {
  const clubId = new URLSearchParams(location.search).get('clubId') || ''
  const networkClock = document.getElementById('clock')
  if (!clubId || !networkClock || window.PlayFootySmoothLiveClock) return

  window.PlayFootySmoothLiveClock = true
  networkClock.style.display = 'none'

  const smoothClock = document.createElement('span')
  smoothClock.id = 'smoothClock'
  smoothClock.textContent = networkClock.textContent || '00:00'
  networkClock.insertAdjacentElement('afterend', smoothClock)

  let anchorSeconds = 0
  let anchorAt = performance.now()
  let running = false
  let initialised = false
  let currentQuarter = 1
  let polling = false
  let pollTimer = 0
  let renderTimer = 0

  const format = value => {
    const seconds = Math.max(0, Math.floor(Number(value) || 0))
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
  }

  const displayedSeconds = now => anchorSeconds + (running ? Math.max(0, Math.floor((now - anchorAt) / 1000)) : 0)

  function render() {
    const next = format(displayedSeconds(performance.now()))
    if (smoothClock.textContent !== next) smoothClock.textContent = next
  }

  function synchronise(data) {
    if (!data) return
    const now = performance.now()
    const serverSeconds = Math.max(0, Math.floor(Number(data.elapsedSeconds) || 0))
    const nextRunning = Boolean(data.clockRunning)
    const nextQuarter = Math.max(1, Number(data.quarter) || 1)
    const localSeconds = displayedSeconds(now)
    const stateChanged = !initialised || nextRunning !== running || nextQuarter !== currentQuarter
    const meaningfulDrift = Math.abs(serverSeconds - localSeconds) > 2

    if (stateChanged || meaningfulDrift || !nextRunning) {
      anchorSeconds = serverSeconds
      anchorAt = now
    }

    running = nextRunning
    currentQuarter = nextQuarter
    initialised = true
    render()
  }

  async function poll() {
    if (polling) return
    polling = true
    try {
      const response = await fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}?clock=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
      })
      const payload = await response.json()
      if (response.ok) synchronise(payload.data || payload)
    } catch {
      // Keep counting locally through a temporary network interruption.
    } finally {
      polling = false
    }
  }

  poll()
  renderTimer = window.setInterval(render, 200)
  pollTimer = window.setInterval(poll, 1500)

  window.addEventListener('beforeunload', () => {
    clearInterval(renderTimer)
    clearInterval(pollTimer)
  })
})()
