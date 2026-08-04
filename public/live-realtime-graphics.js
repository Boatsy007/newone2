(() => {
  const clubId = new URLSearchParams(location.search).get('clubId') || ''
  const player = document.querySelector('.player, .video-wrap, #playerShell')
  if (!clubId || !player || window.PlayFootyRealtimeGraphics) return

  const style = document.createElement('style')
  style.textContent = `
    .pf-rt-event{position:absolute;inset:0;z-index:30;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at center,rgba(20,67,96,.96),rgba(2,7,11,.98));color:#fff;opacity:0;transform:translateX(105%);pointer-events:none;transition:transform .42s cubic-bezier(.22,.8,.24,1),opacity .25s ease}.pf-rt-event.show{opacity:1;transform:translateX(0)}.pf-rt-event.exit{opacity:0;transform:translateX(-105%)}
    .pf-rt-card{width:min(680px,92%);text-align:center}.pf-rt-kicker{font:1000 11px/1 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#78ceff}.pf-rt-logo{display:none;width:96px;height:96px;margin:18px auto 10px;object-fit:contain;filter:drop-shadow(0 12px 28px rgba(0,0,0,.5))}.pf-rt-logo.show{display:block}.pf-rt-title{margin:10px 0 0;font:1000 clamp(56px,12vw,128px)/.84 Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase;text-shadow:0 12px 34px rgba(0,0,0,.5)}.pf-rt-name{margin-top:15px;font:950 clamp(18px,4vw,34px)/1.1 Inter,Arial,sans-serif}.pf-rt-score{margin-top:12px;font:900 clamp(15px,3vw,24px)/1 Inter,Arial,sans-serif;color:#dcecf5}
    .pf-rt-event.interchange{background:linear-gradient(120deg,rgba(7,19,29,.97),rgba(22,48,66,.97))}.pf-rt-event.interchange .pf-rt-title{font-size:clamp(38px,8vw,84px);color:#efb54b}.pf-rt-event.behind .pf-rt-title{font-size:clamp(42px,9vw,96px)}
    .pf-rt-replay{position:absolute;inset:0;z-index:32;background:#000;opacity:0;transform:translateX(105%);pointer-events:none;transition:transform .42s cubic-bezier(.22,.8,.24,1),opacity .25s ease}.pf-rt-replay.show{opacity:1;transform:translateX(0);pointer-events:auto}.pf-rt-replay.exit{opacity:0;transform:translateX(-105%)}.pf-rt-replay video{width:100%;height:100%;display:block;object-fit:cover;background:#000}.pf-rt-replay-badge{position:absolute;right:14px;top:14px;padding:9px 13px;border-radius:8px;background:#d51f35;color:#fff;font:1000 12px/1 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;animation:pf-rt-flash .9s ease-in-out infinite;box-shadow:0 10px 28px rgba(0,0,0,.45)}.pf-rt-replay-title{position:absolute;left:14px;right:14px;bottom:14px;padding:11px 14px;border-radius:10px;background:linear-gradient(90deg,rgba(3,8,13,.92),rgba(3,8,13,.62));color:#fff;font:900 14px/1.25 Inter,Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @keyframes pf-rt-flash{0%,100%{opacity:1}50%{opacity:.45}}@media(max-width:600px){.pf-rt-event{padding:14px}.pf-rt-logo{width:66px;height:66px}.pf-rt-replay-badge{right:8px;top:8px;padding:7px 10px;font-size:10px}.pf-rt-replay-title{left:8px;right:8px;bottom:8px;font-size:11px}}
  `
  document.head.appendChild(style)

  const eventOverlay = document.createElement('div')
  eventOverlay.className = 'pf-rt-event'
  eventOverlay.innerHTML = '<div class="pf-rt-card"><div class="pf-rt-kicker"></div><img class="pf-rt-logo" alt=""><div class="pf-rt-title"></div><div class="pf-rt-name"></div><div class="pf-rt-score"></div></div>'
  player.appendChild(eventOverlay)
  const replayOverlay = document.createElement('div')
  replayOverlay.className = 'pf-rt-replay'
  replayOverlay.innerHTML = '<video playsinline preload="auto"></video><div class="pf-rt-replay-badge">Replay</div><div class="pf-rt-replay-title"></div>'
  player.appendChild(replayOverlay)

  const kicker = eventOverlay.querySelector('.pf-rt-kicker')
  const logo = eventOverlay.querySelector('.pf-rt-logo')
  const title = eventOverlay.querySelector('.pf-rt-title')
  const name = eventOverlay.querySelector('.pf-rt-name')
  const score = eventOverlay.querySelector('.pf-rt-score')
  const replayVideo = replayOverlay.querySelector('video')
  const replayTitle = replayOverlay.querySelector('.pf-rt-replay-title')

  const knownHighlights = new Set()
  const replayQueue = []
  let last = null
  let initialHighlightsLoaded = false
  let eventBusy = false
  let replayBusy = false
  let pendingGoalAt = 0
  let pendingGoalLabel = ''
  let matchTimer = 0
  let highlightTimer = 0

  const value = (...items) => items.find(item => typeof item === 'string' && item.trim()) || ''
  const logoValue = (data, side) => side === 'home'
    ? value(data.homeLogoUrl, data.clubLogoUrl, data.clubLogo, data.homeLogo, data.teamLogoUrl)
    : value(data.awayLogoUrl, data.opponentLogoUrl, data.opponentLogo, data.awayLogo)
  const total = (g,b) => Number(g||0)*6 + Number(b||0)
  const scoreLine = data => `${data.homeName} ${data.homeGoals}.${data.homeBehinds} (${total(data.homeGoals,data.homeBehinds)}) — ${total(data.awayGoals,data.awayBehinds)} (${data.awayGoals}.${data.awayBehinds}) ${data.awayName}`
  const snapshot = data => ({
    homeGoals:Number(data.homeGoals)||0, homeBehinds:Number(data.homeBehinds)||0,
    awayGoals:Number(data.awayGoals)||0, awayBehinds:Number(data.awayBehinds)||0,
    homeName:value(data.clubName,data.homeName,'Home'), awayName:value(data.opponentName,data.awayName,'Away'),
    homeLogo:logoValue(data,'home'), awayLogo:logoValue(data,'away'),
    quarter:Number(data.quarter)||1, lastEvent:String(data.lastEvent||'').trim()
  })

  function showEvent(kind, heading, team, playerName, image, line, duration) {
    if (eventBusy) return
    eventBusy = true
    eventOverlay.className = `pf-rt-event ${kind}`
    kicker.textContent = team || 'PlayFooty Live'
    title.textContent = heading
    name.textContent = playerName || ''
    score.textContent = line || ''
    if (image) { logo.src = image; logo.classList.add('show') } else { logo.removeAttribute('src'); logo.classList.remove('show') }
    requestAnimationFrame(() => eventOverlay.classList.add('show'))
    setTimeout(() => {
      eventOverlay.classList.remove('show'); eventOverlay.classList.add('exit')
      setTimeout(() => { eventOverlay.classList.remove('exit'); eventBusy = false }, 460)
    }, duration)
  }

  function processMatch(raw) {
    if (!raw) return
    const current = snapshot(raw)
    if (!last) { last = current; return }
    const hg = current.homeGoals-last.homeGoals, ag=current.awayGoals-last.awayGoals
    const hb = current.homeBehinds-last.homeBehinds, ab=current.awayBehinds-last.awayBehinds
    if (hg>0 || ag>0) {
      const home = hg>0
      const team = home ? current.homeName : current.awayName
      const image = home ? current.homeLogo : current.awayLogo
      const playerName = current.lastEvent.replace(/^goal\s*[-–—:]?\s*/i,'').replace(/\s*goal$/i,'').trim() || team
      pendingGoalAt = Date.now(); pendingGoalLabel = playerName
      showEvent('goal','GOAL',team,playerName,image,scoreLine(current),2800)
    } else if (hb>0 || ab>0) {
      const home = hb>0
      showEvent('behind','BEHIND',home?current.homeName:current.awayName,'',home?current.homeLogo:current.awayLogo,scoreLine(current),1700)
    } else if (current.lastEvent && current.lastEvent !== last.lastEvent && /interchange|swapped|\boff\b.*\bon\b/i.test(current.lastEvent)) {
      showEvent('interchange','INTERCHANGE','Player change',current.lastEvent,'','',2200)
    }
    last = current
  }

  async function pollMatch() {
    try { const response=await fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}?rtg=${Date.now()}`,{cache:'no-store'}); const payload=await response.json(); if(response.ok) processMatch(payload.data||payload) } catch {}
  }
  function isGoalHighlight(item) { return /(^|\s)goal(\s|$|[·:—-])/i.test([item?.title,item?.description,...(Array.isArray(item?.tags)?item.tags:[])].join(' ')) }
  async function pollHighlights() {
    try {
      const response=await fetch(`/api/club-portal/media/public/clubs/${encodeURIComponent(clubId)}/highlights?rtg=${Date.now()}`,{cache:'no-store'})
      const payload=await response.json(); if(!response.ok) return
      const items=Array.isArray(payload.data)?payload.data:[]
      if(!initialHighlightsLoaded){items.forEach(item=>knownHighlights.add(String(item.id)));initialHighlightsLoaded=true;return}
      const arrivals=items.filter(item=>!knownHighlights.has(String(item.id)))
      items.forEach(item=>knownHighlights.add(String(item.id)))
      arrivals.slice().reverse().filter(isGoalHighlight).forEach(item=>{ if(Date.now()-pendingGoalAt<45000) replayQueue.push(item) })
      playReplay()
    } catch {}
  }
  async function playReplay() {
    if(replayBusy || eventBusy || !replayQueue.length) return
    replayBusy = true
    const item = replayQueue.shift()
    replayTitle.textContent = item.title || pendingGoalLabel || 'Goal replay'
    replayVideo.src = item.fileUrl
    replayVideo.currentTime = 0
    replayVideo.muted = false
    replayOverlay.classList.remove('exit')
    requestAnimationFrame(()=>replayOverlay.classList.add('show'))
    const finish = () => {
      replayVideo.onended = null; replayVideo.onerror = null
      replayOverlay.classList.remove('show'); replayOverlay.classList.add('exit')
      setTimeout(()=>{replayVideo.pause();replayVideo.removeAttribute('src');replayVideo.load();replayOverlay.classList.remove('exit');replayBusy=false;playReplay()},460)
    }
    replayVideo.onended = finish; replayVideo.onerror = finish
    try { await replayVideo.play() } catch { replayVideo.muted=true; try{await replayVideo.play()}catch{finish()} }
  }

  window.PlayFootyRealtimeGraphics = true
  pollMatch(); pollHighlights()
  matchTimer=setInterval(pollMatch,650)
  highlightTimer=setInterval(()=>{pollHighlights();playReplay()},1200)
  window.addEventListener('beforeunload',()=>{clearInterval(matchTimer);clearInterval(highlightTimer);replayVideo.pause()})
})()
