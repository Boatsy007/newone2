(() => {
  const params = new URLSearchParams(location.search)
  const clubId = params.get('clubId') || ''
  const playerShell = document.querySelector('.player')
  if (!clubId || !playerShell) return

  const style = document.createElement('style')
  style.textContent = `
    .pf-goal-replay{position:absolute;inset:0;z-index:12;overflow:hidden;background:#000;transform:translateX(105%);opacity:0;pointer-events:none;transition:transform .42s cubic-bezier(.22,.8,.24,1),opacity .25s ease}
    .pf-goal-replay.show{transform:translateX(0);opacity:1;pointer-events:auto}
    .pf-goal-replay.exit{transform:translateX(-105%);opacity:0}
    .pf-goal-replay video{display:block;width:100%;height:100%;object-fit:contain;background:#000}
    .pf-goal-replay-label{position:absolute;right:14px;top:14px;display:flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid rgba(255,255,255,.38);border-radius:8px;background:#d51f35;color:#fff;font:1000 12px/1 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;box-shadow:0 10px 28px rgba(0,0,0,.5);animation:pf-replay-flash .9s ease-in-out infinite;backdrop-filter:blur(10px)}
    .pf-goal-replay-label i{width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:0 0 0 5px rgba(255,255,255,.18)}
    .pf-goal-replay-title{position:absolute;left:14px;right:14px;bottom:14px;padding:11px 14px;border-radius:10px;background:linear-gradient(90deg,rgba(3,8,13,.92),rgba(3,8,13,.62));color:#fff;font:900 14px/1.25 Inter,Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @keyframes pf-replay-flash{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.46;transform:scale(.97)}}
    @media(max-width:600px){.pf-goal-replay-label{right:8px;top:8px;padding:7px 10px;font-size:10px}.pf-goal-replay-title{left:8px;right:8px;bottom:8px;padding:9px 11px;font-size:11px}}
    @media(prefers-reduced-motion:reduce){.pf-goal-replay{transition:none}.pf-goal-replay-label{animation:none}}
  `
  document.head.appendChild(style)

  const overlay = document.createElement('div')
  overlay.className = 'pf-goal-replay'
  overlay.setAttribute('aria-live', 'polite')
  overlay.innerHTML = '<video playsinline preload="auto"></video><div class="pf-goal-replay-label"><i></i>Replay</div><div class="pf-goal-replay-title"></div>'
  playerShell.appendChild(overlay)

  const replayVideo = overlay.querySelector('video')
  const replayTitle = overlay.querySelector('.pf-goal-replay-title')
  const queue = []
  const known = new Set()
  let ready = false
  let playing = false
  let pollTimer = 0
  let exitTimer = 0

  function isGoal(item) {
    const text = [item?.title, item?.description, ...(Array.isArray(item?.tags) ? item.tags : [])].join(' ')
    return /(^|\s)goal(\s|$|[·:—-])/i.test(text)
  }

  function enqueue(item) {
    if (!item?.id || !item?.fileUrl || !isGoal(item)) return
    queue.push(item)
    playNext()
  }

  async function playNext() {
    if (playing || !queue.length) return
    playing = true
    const item = queue.shift()
    replayTitle.textContent = item.title || 'Goal replay'
    replayVideo.src = item.fileUrl
    replayVideo.currentTime = 0
    replayVideo.muted = false
    overlay.classList.remove('exit')
    requestAnimationFrame(() => overlay.classList.add('show'))

    const finish = () => {
      replayVideo.onended = null
      replayVideo.onerror = null
      overlay.classList.remove('show')
      overlay.classList.add('exit')
      clearTimeout(exitTimer)
      exitTimer = setTimeout(() => {
        replayVideo.pause()
        replayVideo.removeAttribute('src')
        replayVideo.load()
        overlay.classList.remove('exit')
        playing = false
        playNext()
      }, 460)
    }

    replayVideo.onended = finish
    replayVideo.onerror = finish
    try {
      await replayVideo.play()
    } catch {
      replayVideo.muted = true
      try { await replayVideo.play() } catch { finish() }
    }
  }

  async function poll() {
    try {
      const response = await fetch('/api/club-portal/media/public/clubs/' + encodeURIComponent(clubId) + '/highlights?replay=' + Date.now(), {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      })
      const payload = await response.json()
      if (!response.ok) return
      const items = Array.isArray(payload.data) ? payload.data : []
      if (!ready) {
        items.forEach(item => known.add(String(item.id)))
        ready = true
        return
      }
      const arrivals = items.filter(item => !known.has(String(item.id)))
      items.forEach(item => known.add(String(item.id)))
      arrivals.slice().reverse().forEach(enqueue)
    } catch {}
  }

  poll()
  pollTimer = window.setInterval(poll, 1500)
  window.addEventListener('beforeunload', () => {
    clearInterval(pollTimer)
    clearTimeout(exitTimer)
    replayVideo.pause()
  })
})()
