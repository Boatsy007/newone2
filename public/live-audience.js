(() => {
  const clubId = new URLSearchParams(location.search).get('clubId') || ''
  const player = document.querySelector('.player')
  const statusbar = document.querySelector('.statusbar')
  if (!clubId || !player || !statusbar) return

  const key = 'playfooty-live-viewer-id'
  let sessionId = localStorage.getItem(key)
  if (!sessionId) {
    sessionId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `viewer-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(key, sessionId)
  }

  const style = document.createElement('style')
  style.textContent = `
    .pf-audience{display:flex;align-items:center;gap:8px;margin-left:auto;margin-right:10px;color:#dce7ed;font:900 11px/1 Inter,Arial,sans-serif;white-space:nowrap}.pf-audience i{width:8px;height:8px;border-radius:50%;background:#ef3348;box-shadow:0 0 0 4px rgba(239,51,72,.16)}
    .pf-reactions{position:absolute;right:10px;bottom:12px;z-index:11;display:flex;gap:7px}.pf-reaction-button{display:grid;place-items:center;min-width:42px;height:42px;padding:0 9px;border:1px solid rgba(255,255,255,.24);border-radius:999px;background:rgba(4,10,16,.82);color:#fff;font-size:21px;box-shadow:0 8px 24px rgba(0,0,0,.38);backdrop-filter:blur(10px);cursor:pointer;transition:transform .16s}.pf-reaction-button:active{transform:scale(.86)}
    .pf-float-reaction{position:absolute;right:24px;bottom:52px;z-index:14;font-size:34px;pointer-events:none;animation:pf-float-up 2.2s ease-out forwards;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))}@keyframes pf-float-up{0%{opacity:0;transform:translate(0,20px) scale(.7)}18%{opacity:1}100%{opacity:0;transform:translate(var(--drift),-190px) scale(1.35)}}
    @media(max-width:600px){.pf-audience{font-size:9px;margin-right:4px}.pf-reactions{right:6px;bottom:7px;gap:5px}.pf-reaction-button{min-width:36px;height:36px;padding:0 7px;font-size:18px}}
    @media(prefers-reduced-motion:reduce){.pf-float-reaction{animation-duration:.01ms}}
  `
  document.head.appendChild(style)

  const count = document.createElement('div')
  count.className = 'pf-audience'
  count.innerHTML = '<i></i><span>1 watching</span>'
  statusbar.insertBefore(count, statusbar.lastElementChild)

  const controls = document.createElement('div')
  controls.className = 'pf-reactions'
  ;['🔥','👏','❤️','😮'].forEach(reaction => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'pf-reaction-button'
    button.textContent = reaction
    button.setAttribute('aria-label', `React ${reaction}`)
    button.addEventListener('click', () => sendReaction(reaction))
    controls.appendChild(button)
  })
  player.appendChild(controls)

  const seen = new Set()
  let heartbeatTimer = 0
  let audienceTimer = 0

  function floatReaction(reaction) {
    const node = document.createElement('span')
    node.className = 'pf-float-reaction'
    node.textContent = reaction
    node.style.setProperty('--drift', `${Math.round(Math.random() * 90 - 45)}px`)
    player.appendChild(node)
    setTimeout(() => node.remove(), 2300)
  }

  async function heartbeat() {
    if (document.visibilityState === 'hidden') return
    try {
      await fetch(`/api/live-audience/clubs/${encodeURIComponent(clubId)}/heartbeat`, {
        method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({sessionId}),
      })
    } catch {}
  }

  async function loadAudience() {
    try {
      const response = await fetch(`/api/live-audience/clubs/${encodeURIComponent(clubId)}?t=${Date.now()}`, {cache:'no-store'})
      const payload = await response.json()
      if (!response.ok) return
      const data = payload.data || {}
      const viewers = Math.max(0, Number(data.viewers) || 0)
      count.querySelector('span').textContent = `${viewers} watching`
      const recent = Array.isArray(data.recent) ? data.recent.slice().reverse() : []
      recent.forEach(item => {
        const id = String(item.id || '')
        if (!id || seen.has(id)) return
        seen.add(id)
        floatReaction(item.reaction)
      })
      while (seen.size > 200) seen.delete(seen.values().next().value)
    } catch {}
  }

  async function sendReaction(reaction) {
    floatReaction(reaction)
    try {
      await fetch(`/api/live-audience/clubs/${encodeURIComponent(clubId)}/reactions`, {
        method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({sessionId,reaction}),
      })
    } catch {}
  }

  heartbeat(); loadAudience()
  heartbeatTimer = setInterval(heartbeat, 10000)
  audienceTimer = setInterval(loadAudience, 2000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { heartbeat(); loadAudience() } })
  window.addEventListener('beforeunload', () => { clearInterval(heartbeatTimer); clearInterval(audienceTimer) })

  function loadScript(src, marker, onload) {
    if (document.querySelector(`script[${marker}]`)) { if (onload) onload(); return }
    const script = document.createElement('script')
    script.src = src
    script.setAttribute(marker, '1')
    if (onload) script.onload = onload
    document.body.appendChild(script)
  }
  loadScript('/live-broadcast-director.js', 'data-live-director', () => {
    loadScript('/live-break-production.js', 'data-live-break-production', () => {
      loadScript('/live-sponsors.js', 'data-live-sponsors')
    })
  })
})()
