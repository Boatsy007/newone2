(() => {
  const networkClock = document.getElementById('clock')
  if (!networkClock || window.PlayFootySmoothLiveClock) return

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
    const quarterChanged = initialised && nextQuarter !== currentQuarter
    const started = initialised && !running && nextRunning
    const paused = initialised && running && !nextRunning

    if (!initialised || quarterChanged || started || paused) {
      anchorSeconds = serverSeconds
      anchorAt = now
    } else if (nextRunning) {
      if (serverSeconds > localSeconds + 2) {
        anchorSeconds = serverSeconds
        anchorAt = now
      }
    } else {
      anchorSeconds = serverSeconds
      anchorAt = now
    }

    running = nextRunning
    currentQuarter = nextQuarter
    initialised = true
    render()
  }

  document.addEventListener('pf-live-match-response', event => synchronise(event.detail))
  renderTimer = window.setInterval(render, 200)

  window.addEventListener('beforeunload', () => clearInterval(renderTimer))
})()
