(() => {
  const params = new URLSearchParams(location.search)
  const clubId = params.get('clubId') || ''
  const playerShell = document.querySelector('.player, .video-wrap')
  if (!clubId || !playerShell) return

  const realtime = playerShell.classList.contains('video-wrap') || /live-realtime-room\.html$/i.test(location.pathname)
  const style = document.createElement('style')
  style.textContent = `
    .pf-live-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:14px;align-items:stretch}.pf-live-layout>.player{min-width:0}
    .pf-live-timeline{min-height:0;overflow:hidden;border:1px solid #263a49;border-radius:16px;background:rgba(13,25,36,.94);box-shadow:0 24px 80px rgba(0,0,0,.28);display:grid;grid-template-rows:auto minmax(0,1fr)}
    .pf-live-timeline-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 15px;border-bottom:1px solid #263a49}.pf-live-timeline-head span{display:block;color:#eb4052;font:1000 9px/1 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase}.pf-live-timeline-head h2{margin:4px 0 0;color:#fff;font:900 24px/1 Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase}.pf-live-timeline-head b{display:flex;align-items:center;gap:6px;color:#aebdc7;font:900 9px/1 Inter,Arial,sans-serif;text-transform:uppercase}.pf-live-timeline-head b:before{content:'';width:7px;height:7px;border-radius:50%;background:#eb3348;box-shadow:0 0 0 4px rgba(235,51,72,.14)}
    .pf-live-timeline-list{overflow:auto;padding:10px;scrollbar-width:thin}.pf-live-timeline-empty{display:grid;place-items:center;height:100%;min-height:180px;padding:24px;color:#91a1ae;text-align:center;font:800 12px/1.5 Inter,Arial,sans-serif}
    .pf-live-event{position:relative;display:grid;grid-template-columns:45px minmax(0,1fr);gap:10px;padding:11px 9px;border-bottom:1px solid rgba(70,91,106,.35);animation:pf-event-in .3s ease}.pf-live-event:last-child{border-bottom:0}.pf-live-event-time{color:#91a1ae;font:900 9px/1.25 Inter,Arial,sans-serif;text-transform:uppercase}.pf-live-event-time strong{display:block;margin-bottom:3px;color:#fff;font-size:11px}.pf-live-event-copy{min-width:0}.pf-live-event-copy b{display:block;color:#fff;font:1000 10px/1 Inter,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}.pf-live-event-copy p{margin:5px 0 0;color:#c4d0d8;font:750 11px/1.35 Inter,Arial,sans-serif}.pf-live-event.goal .pf-live-event-copy b{color:#58c2ff}.pf-live-event.behind .pf-live-event-copy b{color:#dce5ea}.pf-live-event.interchange .pf-live-event-copy b{color:#efb54b}.pf-live-event.quarter .pf-live-event-copy b,.pf-live-event.final .pf-live-event-copy b{color:#9ee5bd}.pf-live-event-replay{display:inline-flex;margin-top:7px;padding:6px 8px;border:1px solid #3c596b;border-radius:7px;background:#112330;color:#fff;text-decoration:none;font:900 9px/1 Inter,Arial,sans-serif;text-transform:uppercase}
    .pf-goal-replay{position:absolute;inset:0;z-index:12;overflow:hidden;background:#000;transform:translateX(105%);opacity:0;pointer-events:none;transition:transform .42s cubic-bezier(.22,.8,.24,1),opacity .25s ease}
    .pf-goal-replay.show{transform:translateX(0);opacity:1;pointer-events:auto}.pf-goal-replay.exit{transform:translateX(-105%);opacity:0}.pf-goal-replay video{display:block;width:100%;height:100%;object-fit:cover;background:#000}
    .pf-goal-replay-label{position:absolute;right:14px;top:14px;display:flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid rgba(255,255,255,.38);border-radius:8px;background:#d51f35;color:#fff;font:1000 12px/1 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;box-shadow:0 10px 28px rgba(0,0,0,.5);animation:pf-replay-flash .9s ease-in-out infinite;backdrop-filter:blur(10px)}
    .pf-goal-replay-label i{width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:0 0 0 5px rgba(255,255,255,.18)}.pf-goal-replay-title{position:absolute;left:14px;right:14px;bottom:14px;padding:11px 14px;border-radius:10px;background:linear-gradient(90deg,rgba(3,8,13,.92),rgba(3,8,13,.62));color:#fff;font:900 14px/1.25 Inter,Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pf-interchange-overlay{position:absolute;left:14px;top:78px;z-index:11;max-width:min(460px,calc(100% - 28px));padding:12px 16px;border:1px solid rgba(255,255,255,.28);border-radius:10px;background:rgba(3,9,14,.9);color:#fff;font:900 13px/1.25 Inter,Arial,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.45);transform:translateX(-120%);opacity:0;transition:.3s ease;backdrop-filter:blur(10px)}.pf-interchange-overlay.show{transform:translateX(0);opacity:1}.pf-interchange-overlay b{display:block;margin-bottom:5px;color:#efb54b;font-size:9px;letter-spacing:.14em;text-transform:uppercase}
    body.pf-realtime-viewer .pf-live-layout{display:block}body.pf-realtime-viewer .pf-live-timeline{display:none!important}
    @keyframes pf-replay-flash{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.46;transform:scale(.97)}}@keyframes pf-event-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
    @media(max-width:860px){.pf-live-layout{display:block}.pf-live-timeline{margin-top:14px;max-height:360px;border-radius:12px}.pf-live-timeline-list{max-height:285px}.pf-live-timeline-empty{min-height:130px}}
    @media(max-width:600px){.pf-goal-replay-label{right:8px;top:8px;padding:7px 10px;font-size:10px}.pf-goal-replay-title{left:8px;right:8px;bottom:8px;padding:9px 11px;font-size:11px}.pf-live-timeline-head h2{font-size:21px}.pf-interchange-overlay{left:8px;top:58px;max-width:calc(100% - 16px);font-size:11px}}
    @media(prefers-reduced-motion:reduce){.pf-goal-replay,.pf-interchange-overlay{transition:none}.pf-goal-replay-label,.pf-live-event{animation:none}}
  `
  document.head.appendChild(style)
  if (realtime) document.body.classList.add('pf-realtime-viewer')

  let timelineList
  if (!realtime) {
    const layout = document.createElement('div')
    layout.className = 'pf-live-layout'
    playerShell.parentNode.insertBefore(layout, playerShell)
    layout.appendChild(playerShell)
    const timeline = document.createElement('aside')
    timeline.className = 'pf-live-timeline'
    timeline.setAttribute('aria-label', 'Live match timeline')
    timeline.innerHTML = '<div class="pf-live-timeline-head"><div><span>Match Centre</span><h2>Live Timeline</h2></div><b>Live</b></div><div class="pf-live-timeline-list"><div class="pf-live-timeline-empty">Goals, behinds, interchanges and quarter changes will appear here as they happen.</div></div>'
    layout.appendChild(timeline)
    timelineList = timeline.querySelector('.pf-live-timeline-list')
  } else {
    timelineList = document.createElement('div')
  }

  const overlay = document.createElement('div')
  overlay.className = 'pf-goal-replay'
  overlay.setAttribute('aria-live', 'polite')
  overlay.innerHTML = '<video playsinline preload="auto"></video><div class="pf-goal-replay-label"><i></i>Replay</div><div class="pf-goal-replay-title"></div>'
  playerShell.appendChild(overlay)

  const interchangeOverlay = document.createElement('div')
  interchangeOverlay.className = 'pf-interchange-overlay'
  interchangeOverlay.innerHTML = '<b>Interchange</b><span></span>'
  playerShell.appendChild(interchangeOverlay)

  const replayVideo = overlay.querySelector('video')
  const replayTitle = overlay.querySelector('.pf-goal-replay-title')
  const queue = []
  const known = new Set()
  const events = []
  let ready = false
  let playing = false
  let pollTimer = 0
  let matchTimer = 0
  let exitTimer = 0
  let interchangeTimer = 0
  let lastMatch = null

  const clock = seconds => { const value = Math.max(0, Math.floor(Number(seconds) || 0)); return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0') }
  const clean = value => String(value || '').trim()

  function showInterchange(label) {
    clearTimeout(interchangeTimer)
    interchangeOverlay.querySelector('span').textContent = label
    interchangeOverlay.classList.add('show')
    interchangeTimer = setTimeout(() => interchangeOverlay.classList.remove('show'), 4200)
  }

  function addEvent(type, label, match, replayUrl = '') {
    const event = { id: crypto.randomUUID?.() || String(Date.now() + Math.random()), type, label, quarter: Number(match?.quarter) || 1, elapsedSeconds: Number(match?.elapsedSeconds) || 0, replayUrl }
    events.unshift(event)
    if (events.length > 40) events.length = 40
    renderTimeline()
    return event
  }

  function renderTimeline() {
    if (realtime) return
    if (!events.length) { timelineList.innerHTML = '<div class="pf-live-timeline-empty">Goals, behinds, interchanges and quarter changes will appear here as they happen.</div>'; return }
    timelineList.innerHTML = ''
    events.forEach(event => {
      const article = document.createElement('article')
      article.className = 'pf-live-event ' + event.type.toLowerCase()
      const typeLabel = event.type === 'GOAL' ? 'Goal' : event.type === 'BEHIND' ? 'Behind' : event.type === 'INTERCHANGE' ? 'Interchange' : event.type === 'QUARTER' ? 'Quarter update' : event.type === 'FINAL' ? 'Final siren' : 'Match update'
      article.innerHTML = '<div class="pf-live-event-time"><strong>Q' + event.quarter + '</strong>' + clock(event.elapsedSeconds) + '</div><div class="pf-live-event-copy"><b>' + typeLabel + '</b><p></p></div>'
      article.querySelector('p').textContent = event.label
      if (event.replayUrl) { const replay = document.createElement('a'); replay.className = 'pf-live-event-replay'; replay.href = event.replayUrl; replay.target = '_blank'; replay.rel = 'noopener'; replay.textContent = 'Watch replay'; article.querySelector('.pf-live-event-copy').appendChild(replay) }
      timelineList.appendChild(article)
    })
  }

  function processMatch(data) {
    if (!data) return
    const current = { homeGoals:Number(data.homeGoals)||0, homeBehinds:Number(data.homeBehinds)||0, awayGoals:Number(data.awayGoals)||0, awayBehinds:Number(data.awayBehinds)||0, quarter:Number(data.quarter)||1, elapsedSeconds:Number(data.elapsedSeconds)||0, lastEvent:clean(data.lastEvent), homeName:clean(data.clubName)||'Home', awayName:clean(data.opponentName)||'Away', status:clean(data.status) }
    if (!lastMatch) { lastMatch = current; return }
    const homeGoalDiff=current.homeGoals-lastMatch.homeGoals, awayGoalDiff=current.awayGoals-lastMatch.awayGoals, homeBehindDiff=current.homeBehinds-lastMatch.homeBehinds, awayBehindDiff=current.awayBehinds-lastMatch.awayBehinds
    if (homeGoalDiff>0) for(let i=0;i<homeGoalDiff;i++) addEvent('GOAL',current.lastEvent||current.homeName+' goal',current)
    if (awayGoalDiff>0) for(let i=0;i<awayGoalDiff;i++) addEvent('GOAL',current.lastEvent||current.awayName+' goal',current)
    if (homeBehindDiff>0) for(let i=0;i<homeBehindDiff;i++) addEvent('BEHIND',current.lastEvent||current.homeName+' behind',current)
    if (awayBehindDiff>0) for(let i=0;i<awayBehindDiff;i++) addEvent('BEHIND',current.lastEvent||current.awayName+' behind',current)
    if (current.quarter!==lastMatch.quarter) addEvent('QUARTER','Quarter '+current.quarter+' started',current)
    if (current.lastEvent&&current.lastEvent!==lastMatch.lastEvent&&!homeGoalDiff&&!awayGoalDiff&&!homeBehindDiff&&!awayBehindDiff) {
      const type=/interchange|swapped|\boff\b.*\bon\b/i.test(current.lastEvent)?'INTERCHANGE':/final siren|full time/i.test(current.lastEvent)?'FINAL':/quarter|half time/i.test(current.lastEvent)?'QUARTER':'UPDATE'
      addEvent(type,current.lastEvent,current)
      if (type === 'INTERCHANGE') showInterchange(current.lastEvent)
    }
    lastMatch=current
  }

  async function pollMatch() { try { const response=await fetch('/api/live-match/clubs/'+encodeURIComponent(clubId)+'?timeline='+Date.now(),{cache:'no-store',headers:{'cache-control':'no-cache'}}); const payload=await response.json(); if(response.ok)processMatch(payload.data||payload) } catch{} }
  function isGoal(item) { const text=[item?.title,item?.description,...(Array.isArray(item?.tags)?item.tags:[])].join(' '); return /(^|\s)goal(\s|$|[·:—-])/i.test(text) }
  function attachReplayToLatestGoal(item) { const event=events.find(entry=>entry.type==='GOAL'&&!entry.replayUrl); if(event){event.replayUrl=item.fileUrl;renderTimeline()} }
  function enqueue(item) { if(!item?.id||!item?.fileUrl||!isGoal(item))return; attachReplayToLatestGoal(item); queue.push(item); playNext() }

  async function playNext() {
    if(playing||!queue.length)return
    playing=true
    const item=queue.shift()
    replayTitle.textContent=item.title||'Goal replay'; replayVideo.src=item.fileUrl; replayVideo.currentTime=0; replayVideo.muted=false; overlay.classList.remove('exit'); requestAnimationFrame(()=>overlay.classList.add('show'))
    const finish=()=>{ replayVideo.onended=null; replayVideo.onerror=null; overlay.classList.remove('show'); overlay.classList.add('exit'); clearTimeout(exitTimer); exitTimer=setTimeout(()=>{replayVideo.pause();replayVideo.removeAttribute('src');replayVideo.load();overlay.classList.remove('exit');playing=false;playNext()},460) }
    replayVideo.onended=finish; replayVideo.onerror=finish
    try{await replayVideo.play()}catch{replayVideo.muted=true;try{await replayVideo.play()}catch{finish()}}
  }

  async function poll() { try { const response=await fetch('/api/club-portal/media/public/clubs/'+encodeURIComponent(clubId)+'/highlights?replay='+Date.now(),{cache:'no-store',headers:{'cache-control':'no-cache'}}); const payload=await response.json(); if(!response.ok)return; const items=Array.isArray(payload.data)?payload.data:[]; if(!ready){items.forEach(item=>known.add(String(item.id)));ready=true;return} const arrivals=items.filter(item=>!known.has(String(item.id))); items.forEach(item=>known.add(String(item.id))); arrivals.slice().reverse().forEach(enqueue) }catch{} }

  poll();pollMatch();pollTimer=window.setInterval(poll,1500);matchTimer=window.setInterval(pollMatch,700)

  if (realtime && !window.PlayFootyBroadcastDirector) {
    const director = document.createElement('script')
    director.src = '/live-broadcast-director.js'
    director.defer = true
    document.body.appendChild(director)
  }
  if (realtime) {
    const sponsors = document.createElement('script')
    sponsors.src = '/live-sponsors.js'
    sponsors.defer = true
    document.body.appendChild(sponsors)
  }

  window.addEventListener('beforeunload',()=>{clearInterval(pollTimer);clearInterval(matchTimer);clearTimeout(exitTimer);clearTimeout(interchangeTimer);replayVideo.pause()})
})()

;(() => { const script=document.createElement('script'); script.src='/live-audience.js'; script.defer=true; document.body.appendChild(script) })()
