(() => {
  const ROUTE = /^\/club-portal\/([^/]+)\/whiteboard\/?$/
  if (!ROUTE.test(window.location.pathname)) return

  const STORAGE_PREFIX = 'playfooty.whiteboard.recording.v1:'
  const SAMPLE_MS = 34
  const state = {
    recording: false,
    playing: false,
    paused: false,
    startedAt: 0,
    pauseStartedAt: 0,
    pausedTotal: 0,
    duration: 0,
    speed: 1,
    frame: 0,
    tracks: {},
    activePointers: new Map(),
    ball: null,
    trailSvg: null,
    controls: null,
    boardKey: '',
    loadedRecording: null,
  }

  const clamp = value => Math.max(0, Math.min(100, Number(value) || 0))
  const now = () => performance.now()
  const deepCopy = value => JSON.parse(JSON.stringify(value))
  const boardSelect = () => document.querySelector('.wb .meta select')
  const oval = () => document.querySelector('.wb .oval')
  const clubId = () => decodeURIComponent(window.location.pathname.match(ROUTE)?.[1] || '')
  const currentBoardKey = () => `${clubId()}:${boardSelect()?.value || 'new'}`
  const localKey = key => `${STORAGE_PREFIX}${key}`

  function markerElements() {
    const field = oval()
    if (!field) return []
    return Array.from(field.querySelectorAll(':scope > .marker, :scope > .pf-record-ball'))
  }

  function markerKey(element) {
    if (element.classList.contains('pf-record-ball')) return 'ball:1'
    const side = element.classList.contains('opposition') ? 'opposition' : 'home'
    const label = (element.getAttribute('title') || element.querySelector('span')?.textContent || element.textContent || 'marker').trim()
    const peers = markerElements().filter(item => !item.classList.contains('pf-record-ball') && (item.classList.contains('opposition') ? 'opposition' : 'home') === side && ((item.getAttribute('title') || item.querySelector('span')?.textContent || item.textContent || 'marker').trim() === label))
    return `${side}:${label}:${Math.max(0, peers.indexOf(element))}`
  }

  function positionOf(element) {
    const left = parseFloat(element.style.left || '')
    const top = parseFloat(element.style.top || '')
    if (Number.isFinite(left) && Number.isFinite(top)) return { x: clamp(left), y: clamp(top) }
    const field = oval()
    if (!field) return { x: 50, y: 50 }
    const box = field.getBoundingClientRect()
    const item = element.getBoundingClientRect()
    return {
      x: clamp(((item.left + item.width / 2 - box.left) / box.width) * 100),
      y: clamp(((item.top + item.height / 2 - box.top) / box.height) * 100),
    }
  }

  function setPosition(element, point) {
    element.style.left = `${clamp(point.x)}%`
    element.style.top = `${clamp(point.y)}%`
  }

  function labelOf(element) {
    if (element.classList.contains('pf-record-ball')) return 'AFL Ball'
    return (element.getAttribute('title') || element.querySelector('span')?.textContent || 'Marker').trim()
  }

  function sideOf(element) {
    if (element.classList.contains('pf-record-ball')) return 'ball'
    return element.classList.contains('opposition') ? 'opposition' : 'home'
  }

  function ensureTrailSvg() {
    const field = oval()
    if (!field) return null
    if (state.trailSvg?.isConnected) return state.trailSvg
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.classList.add('pf-record-trails')
    svg.setAttribute('viewBox', '0 0 100 100')
    svg.setAttribute('preserveAspectRatio', 'none')
    field.appendChild(svg)
    state.trailSvg = svg
    return svg
  }

  function clearTrails() {
    state.trailSvg?.replaceChildren()
    state.trailSvg?.classList.remove('is-visible')
  }

  function drawTrails() {
    const svg = ensureTrailSvg()
    if (!svg || !state.recording) return
    svg.classList.add('is-visible')
    svg.replaceChildren()
    Object.values(state.tracks).forEach(track => {
      if (!track.frames || track.frames.length < 2) return
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
      path.setAttribute('points', track.frames.map(frame => `${frame.x},${frame.y}`).join(' '))
      path.setAttribute('class', `pf-record-trail ${track.side}`)
      svg.appendChild(path)
    })
  }

  function createBall(saved) {
    const field = oval()
    if (!field) return null
    let ball = field.querySelector('.pf-record-ball')
    if (!ball) {
      ball = document.createElement('button')
      ball.type = 'button'
      ball.className = 'pf-record-ball'
      ball.title = 'AFL Ball'
      ball.setAttribute('aria-label', 'AFL Ball')
      ball.innerHTML = '<span class="pf-ball-shape"><i></i></span><em>Ball</em><b aria-label="Remove ball">×</b>'
      ball.addEventListener('click', event => {
        if (event.target.closest('b')) {
          event.stopPropagation()
          ball.remove()
          state.ball = null
          saveLocal()
        }
      })
      field.appendChild(ball)
    }
    const point = saved || state.ball || { x: 50, y: 50 }
    setPosition(ball, point)
    state.ball = { x: clamp(point.x), y: clamp(point.y) }
    return ball
  }

  function addBall() {
    const existing = oval()?.querySelector('.pf-record-ball')
    if (existing) {
      existing.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.25)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 350 })
      return
    }
    createBall({ x: 50, y: 50 })
    saveLocal()
  }

  function recordingPayload() {
    const ball = oval()?.querySelector('.pf-record-ball')
    const ballPosition = ball ? positionOf(ball) : null
    return {
      version: 1,
      duration: Math.max(0, Math.round(state.duration)),
      tracks: deepCopy(state.tracks),
      ball: ballPosition,
      savedAt: new Date().toISOString(),
    }
  }

  function applyRecording(payload) {
    stopPlayback(false)
    state.tracks = payload?.tracks && typeof payload.tracks === 'object' ? deepCopy(payload.tracks) : {}
    state.duration = Number(payload?.duration) || 0
    state.loadedRecording = payload || null
    if (payload?.ball) createBall(payload.ball)
    else oval()?.querySelector('.pf-record-ball')?.remove()
    state.ball = payload?.ball || null
    updateControls()
  }

  function saveLocal() {
    state.boardKey = currentBoardKey()
    try { localStorage.setItem(localKey(state.boardKey), JSON.stringify(recordingPayload())) } catch {}
  }

  function loadLocal() {
    state.boardKey = currentBoardKey()
    try {
      const raw = localStorage.getItem(localKey(state.boardKey))
      if (raw) applyRecording(JSON.parse(raw))
      else applyRecording(null)
    } catch { applyRecording(null) }
  }

  function initialiseRecording() {
    stopPlayback(false)
    const elements = markerElements()
    if (!elements.length) return
    state.tracks = {}
    state.duration = 0
    state.startedAt = now()
    state.pausedTotal = 0
    elements.forEach(element => {
      const key = markerKey(element)
      const p = positionOf(element)
      state.tracks[key] = { key, label: labelOf(element), side: sideOf(element), frames: [{ t: 0, x: p.x, y: p.y }] }
    })
    state.recording = true
    document.body.classList.add('pf-whiteboard-recording')
    updateControls()
    drawTrails()
  }

  function sampleElement(element, force = false) {
    if (!state.recording) return
    const key = markerKey(element)
    const track = state.tracks[key] || (state.tracks[key] = { key, label: labelOf(element), side: sideOf(element), frames: [] })
    const t = Math.max(0, now() - state.startedAt)
    const p = positionOf(element)
    const last = track.frames[track.frames.length - 1]
    if (!force && last && t - last.t < SAMPLE_MS && Math.hypot(p.x - last.x, p.y - last.y) < 0.25) return
    track.frames.push({ t: Math.round(t), x: p.x, y: p.y })
    state.duration = Math.max(state.duration, t)
    if (element.classList.contains('pf-record-ball')) state.ball = p
    drawTrails()
    updateControls()
  }

  function stopRecording() {
    if (!state.recording) return
    markerElements().forEach(element => sampleElement(element, true))
    state.recording = false
    document.body.classList.remove('pf-whiteboard-recording')
    clearTrails()
    saveLocal()
    updateControls()
  }

  function resolveTrackElement(track) {
    if (track.key === 'ball:1') return oval()?.querySelector('.pf-record-ball') || (track.frames?.[0] ? createBall(track.frames[0]) : null)
    return markerElements().find(element => markerKey(element) === track.key) || markerElements().find(element => labelOf(element) === track.label && sideOf(element) === track.side) || null
  }

  function pointAt(frames, time) {
    if (!frames?.length) return null
    if (time <= frames[0].t) return frames[0]
    const last = frames[frames.length - 1]
    if (time >= last.t) return last
    let low = 0
    let high = frames.length - 1
    while (low + 1 < high) {
      const mid = (low + high) >> 1
      if (frames[mid].t <= time) low = mid
      else high = mid
    }
    const a = frames[low]
    const b = frames[high]
    const ratio = b.t === a.t ? 1 : (time - a.t) / (b.t - a.t)
    return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio }
  }

  function resetToStart() {
    Object.values(state.tracks).forEach(track => {
      const element = resolveTrackElement(track)
      if (element && track.frames?.[0]) setPosition(element, track.frames[0])
    })
  }

  function play() {
    if (state.recording) stopRecording()
    if (!state.duration || !Object.keys(state.tracks).length) return
    if (state.playing && state.paused) {
      state.paused = false
      state.pausedTotal += now() - state.pauseStartedAt
      updateControls()
      state.frame = requestAnimationFrame(playFrame)
      return
    }
    cancelAnimationFrame(state.frame)
    resetToStart()
    state.playing = true
    state.paused = false
    state.startedAt = now()
    state.pausedTotal = 0
    document.body.classList.add('pf-whiteboard-playing')
    updateControls()
    state.frame = requestAnimationFrame(playFrame)
  }

  function playFrame(timestamp) {
    if (!state.playing || state.paused) return
    const elapsed = Math.max(0, (timestamp - state.startedAt - state.pausedTotal) * state.speed)
    Object.values(state.tracks).forEach(track => {
      const element = resolveTrackElement(track)
      const point = pointAt(track.frames, elapsed)
      if (element && point) setPosition(element, point)
    })
    updateProgress(elapsed)
    if (elapsed >= state.duration) {
      state.playing = false
      document.body.classList.remove('pf-whiteboard-playing')
      updateControls()
      return
    }
    state.frame = requestAnimationFrame(playFrame)
  }

  function pause() {
    if (!state.playing || state.paused) return
    state.paused = true
    state.pauseStartedAt = now()
    cancelAnimationFrame(state.frame)
    updateControls()
  }

  function stopPlayback(reset = true) {
    cancelAnimationFrame(state.frame)
    state.playing = false
    state.paused = false
    document.body.classList.remove('pf-whiteboard-playing')
    if (reset) resetToStart()
    updateProgress(0)
    updateControls()
  }

  function setSpeed(value) {
    state.speed = Number(value) || 1
    updateControls()
  }

  function updateProgress(elapsed) {
    const bar = state.controls?.querySelector('.pf-rec-progress i')
    if (bar) bar.style.width = `${state.duration ? Math.min(100, (elapsed / state.duration) * 100) : 0}%`
    const time = state.controls?.querySelector('[data-rec-time]')
    if (time) time.textContent = `${(Math.min(elapsed, state.duration) / 1000).toFixed(1)} / ${(state.duration / 1000).toFixed(1)}s`
  }

  function updateControls() {
    const root = state.controls
    if (!root) return
    root.querySelector('[data-rec-record]')?.classList.toggle('is-active', state.recording)
    root.querySelector('[data-rec-record]')?.toggleAttribute('disabled', state.playing)
    root.querySelector('[data-rec-stop]')?.toggleAttribute('disabled', !state.recording)
    root.querySelector('[data-rec-play]')?.toggleAttribute('disabled', state.recording || !state.duration)
    root.querySelector('[data-rec-pause]')?.toggleAttribute('disabled', !state.playing || state.paused)
    root.querySelector('[data-rec-restart]')?.toggleAttribute('disabled', state.recording || !state.duration)
    const playLabel = root.querySelector('[data-rec-play] span')
    if (playLabel) playLabel.textContent = state.playing && state.paused ? 'Resume' : 'Play'
    const status = root.querySelector('[data-rec-status]')
    if (status) status.textContent = state.recording ? 'Recording movement…' : state.playing ? (state.paused ? 'Playback paused' : 'Playing recorded movement') : state.duration ? 'Recorded play ready' : 'Set players, then record a play'
    updateProgress(0)
  }

  function makeControls() {
    const tools = document.querySelector('.wb .tools')
    if (!tools || tools.querySelector('.pf-recorder-controls')) return tools?.querySelector('.pf-recorder-controls') || null
    const root = document.createElement('div')
    root.className = 'pf-recorder-controls'
    root.innerHTML = `
      <button type="button" data-rec-ball title="Add AFL ball"><span class="pf-mini-ball"></span><span>Add ball</span></button>
      <button type="button" data-rec-record class="pf-record-button" title="Record play"><i></i><span>Record</span></button>
      <button type="button" data-rec-stop title="Stop recording"><b></b><span>Stop</span></button>
      <button type="button" data-rec-play title="Play recorded movement"><em>▶</em><span>Play</span></button>
      <button type="button" data-rec-pause title="Pause playback"><em>Ⅱ</em><span>Pause</span></button>
      <button type="button" data-rec-restart title="Restart play"><em>↺</em><span>Restart</span></button>
      <label>Speed<select data-rec-speed><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
      <div class="pf-rec-progress"><i></i></div><small data-rec-time>0.0 / 0.0s</small><small data-rec-status>Set players, then record a play</small>`
    root.querySelector('[data-rec-ball]').addEventListener('click', addBall)
    root.querySelector('[data-rec-record]').addEventListener('click', initialiseRecording)
    root.querySelector('[data-rec-stop]').addEventListener('click', stopRecording)
    root.querySelector('[data-rec-play]').addEventListener('click', play)
    root.querySelector('[data-rec-pause]').addEventListener('click', pause)
    root.querySelector('[data-rec-restart]').addEventListener('click', () => stopPlayback(true))
    root.querySelector('[data-rec-speed]').addEventListener('change', event => setSpeed(event.target.value))
    tools.insertAdjacentElement('afterend', root)
    state.controls = root
    updateControls()
    return root
  }

  function pointerDown(event) {
    const target = event.target instanceof Element ? event.target.closest('.marker,.pf-record-ball') : null
    if (!target || !oval()?.contains(target)) return
    if (state.playing) { event.preventDefault(); event.stopPropagation(); return }
    state.activePointers.set(event.pointerId, target)
    if (state.recording) sampleElement(target, true)
  }

  function pointerMove(event) {
    const target = state.activePointers.get(event.pointerId)
    if (!target || !state.recording) return
    requestAnimationFrame(() => sampleElement(target))
  }

  function pointerEnd(event) {
    const target = state.activePointers.get(event.pointerId)
    if (target && state.recording) requestAnimationFrame(() => sampleElement(target, true))
    state.activePointers.delete(event.pointerId)
  }

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const isWhiteboard = /\/api\/club-portal\/whiteboard\/clubs\/[^/]+\/whiteboards(?:\/[^/?#]+)?/.test(url)
    let nextInit = init
    if (isWhiteboard && (method === 'POST' || method === 'PUT') && typeof init.body === 'string') {
      try {
        const payload = JSON.parse(init.body)
        payload.boardData = payload.boardData || {}
        payload.boardData.playRecording = recordingPayload()
        nextInit = { ...init, body: JSON.stringify(payload) }
      } catch {}
    }
    const response = await originalFetch(input, nextInit)
    if (isWhiteboard && method === 'GET' && !url.endsWith('/options')) {
      response.clone().json().then(payload => {
        const recording = payload?.data?.boardData?.playRecording
        if (recording) {
          applyRecording(recording)
          saveLocal()
        } else {
          setTimeout(loadLocal, 50)
        }
      }).catch(() => {})
    }
    return response
  }

  function connect() {
    if (!ROUTE.test(window.location.pathname)) return
    const field = oval()
    if (!field) return
    makeControls()
    ensureTrailSvg()
    if (state.boardKey !== currentBoardKey()) setTimeout(loadLocal, 60)
  }

  const style = document.createElement('style')
  style.dataset.pfWhiteboardRecorder = 'true'
  style.textContent = `
    .pf-recorder-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 8px;padding:8px;border:1px solid #d8e0e7;border-radius:10px;background:#f7f9fb}
    .pf-recorder-controls button{display:flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:8px;padding:8px 10px;background:#e8eef3;color:#101318;font-weight:900;cursor:pointer}
    .pf-recorder-controls button:disabled{opacity:.38;cursor:not-allowed}.pf-recorder-controls .pf-record-button{background:#fff0f0;color:#b91c1c}.pf-recorder-controls .pf-record-button.is-active{background:#dc2626;color:#fff;animation:pfRecPulse 1.1s infinite}.pf-record-button>i{width:10px;height:10px;border-radius:50%;background:#dc2626}.pf-record-button.is-active>i{background:#fff}.pf-recorder-controls [data-rec-stop]>b{width:10px;height:10px;border-radius:2px;background:currentColor}.pf-recorder-controls em{font-style:normal;font-size:12px}.pf-recorder-controls label{display:flex;align-items:center;gap:5px;font-size:9px;font-weight:950;text-transform:uppercase}.pf-recorder-controls select{margin:0;padding:6px;border:1px solid #cad4dd;border-radius:7px;background:#fff;font-weight:850}.pf-rec-progress{flex:1 1 110px;min-width:80px;height:7px;overflow:hidden;border-radius:999px;background:#dce4eb}.pf-rec-progress i{display:block;width:0;height:100%;border-radius:inherit;background:#2daaf5}.pf-recorder-controls small{font-size:9px;color:#667085;font-weight:800}.pf-recorder-controls [data-rec-status]{flex:1 1 170px;text-align:right}.pf-mini-ball{display:block;width:15px;height:10px;border-radius:50%;background:#9a4d1f;border:1px solid #fff;box-shadow:0 0 0 1px #7b3516;transform:rotate(-18deg)}
    .pf-record-ball{position:absolute;z-index:6;display:grid;place-items:center;transform:translate(-50%,-50%);width:52px;height:52px;border:0;background:transparent;touch-action:none;cursor:grab}.pf-record-ball:active{cursor:grabbing}.pf-ball-shape{position:relative;display:block;width:30px;height:19px;border:2px solid #fff;border-radius:50%;background:linear-gradient(145deg,#b7652e,#743315);box-shadow:0 3px 8px rgba(0,0,0,.35);transform:rotate(-20deg)}.pf-ball-shape:before{content:'';position:absolute;left:6px;right:6px;top:8px;height:2px;background:#fff}.pf-ball-shape i,.pf-ball-shape i:before,.pf-ball-shape i:after{position:absolute;width:2px;height:7px;background:#fff;content:''}.pf-ball-shape i{left:13px;top:5px}.pf-ball-shape i:before{left:-4px;top:0}.pf-ball-shape i:after{left:4px;top:0}.pf-record-ball>em{position:absolute;top:36px;padding:1px 4px;border-radius:4px;background:rgba(0,0,0,.75);color:#fff;font-size:7px;font-style:normal;font-weight:900}.pf-record-ball>b{position:absolute;right:0;top:0;display:none;width:16px;height:16px;border-radius:50%;background:#111;color:#fff;font-size:12px;line-height:16px}.pf-record-ball:hover>b{display:block}
    .pf-record-trails{position:absolute!important;inset:0!important;z-index:3!important;width:100%!important;height:100%!important;pointer-events:none!important;opacity:0}.pf-record-trails.is-visible{opacity:1}.pf-record-trail{fill:none;stroke-width:1.15;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:2 1}.pf-record-trail.home{stroke:#42b8ff}.pf-record-trail.opposition{stroke:#ef4444}.pf-record-trail.ball{stroke:#f7c948;stroke-width:1.45}
    body.pf-whiteboard-playing .wb .tools,body.pf-whiteboard-playing .wb aside{pointer-events:none;opacity:.55}body.pf-whiteboard-playing .marker,body.pf-whiteboard-playing .pf-record-ball{pointer-events:none}.pf-whiteboard-recording .oval{box-shadow:inset 0 0 0 3px rgba(220,38,38,.45),0 8px 22px rgba(0,0,0,.15)}
    @keyframes pfRecPulse{50%{box-shadow:0 0 0 5px rgba(220,38,38,.18)}}
    @media(max-width:760px){.pf-recorder-controls{flex-wrap:nowrap;overflow-x:auto;min-height:38px;padding:4px}.pf-recorder-controls button{flex:0 0 auto;min-width:39px;padding:7px}.pf-recorder-controls button span:not(.pf-mini-ball){display:none}.pf-recorder-controls label{flex:0 0 69px}.pf-rec-progress{flex:0 0 72px}.pf-recorder-controls [data-rec-status]{display:none}.pf-record-ball{transform:translate(-50%,-50%) scale(.78)}}
    body.pf-mobile-whiteboard .pf-recorder-controls{position:absolute!important;left:176px!important;right:6px!important;top:92px!important;z-index:10!important;margin:0!important;height:38px!important;box-sizing:border-box!important;background:#fff!important}body.pf-mobile-whiteboard .board-shell{padding-top:48px!important}
  `
  document.head.appendChild(style)

  document.addEventListener('pointerdown', pointerDown, true)
  document.addEventListener('pointermove', pointerMove, true)
  document.addEventListener('pointerup', pointerEnd, true)
  document.addEventListener('pointercancel', pointerEnd, true)
  document.addEventListener('change', event => {
    if (event.target === boardSelect()) setTimeout(loadLocal, 150)
  }, true)

  connect()
  const observer = new MutationObserver(connect)
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('beforeunload', saveLocal)
})()
