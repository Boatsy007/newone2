(() => {
  const clubId = new URLSearchParams(location.search).get('clubId') || ''
  const player = document.querySelector('.player, .video-wrap, #playerShell')
  if (!clubId || !player || window.PlayFootyRealtimeGraphics) return

  const style = document.createElement('style')
  style.textContent = `
    .pf-broadcast-brand{display:flex!important;align-items:center;gap:8px;color:#fff!important;text-decoration:none!important;font-style:italic;font-weight:1000;text-shadow:0 3px 14px rgba(0,0,0,.62)}
    .pf-broadcast-brand .pf-play{display:inline-block;padding:4px 9px 3px;background:#2db4f3;color:#fff;transform:skew(-10deg);font-size:clamp(18px,3vw,30px);line-height:1;letter-spacing:-1px}.pf-broadcast-brand .pf-play span{display:block;transform:skew(10deg)}.pf-broadcast-brand .pf-footy{font-size:clamp(18px,3vw,30px);line-height:1;letter-spacing:-1.2px}.pf-broadcast-brand .pf-logo-live{display:inline-flex;align-items:center;gap:6px;margin-left:2px;padding:5px 9px;border-radius:999px;background:rgba(5,9,13,.78);border:1px solid rgba(255,255,255,.25);font:950 9px/1 Inter,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase}.pf-broadcast-brand .pf-logo-live i{width:7px;height:7px;border-radius:50%;background:#ed3650;box-shadow:0 0 0 4px rgba(237,54,80,.16)}
    .pf-rt-event{position:absolute;inset:0;z-index:60;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at center,rgba(20,67,96,.97),rgba(2,7,11,.99));color:#fff;opacity:0;transform:translateX(105%);pointer-events:none;transition:transform .3s cubic-bezier(.22,.8,.24,1),opacity .2s ease}.pf-rt-event.show{opacity:1;transform:translateX(0)}.pf-rt-event.exit{opacity:0;transform:translateX(-105%)}
    .pf-rt-card{width:min(680px,92%);text-align:center}.pf-rt-kicker{font:1000 11px/1 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#78ceff}.pf-rt-logo{display:none;width:96px;height:96px;margin:18px auto 10px;object-fit:contain;filter:drop-shadow(0 12px 28px rgba(0,0,0,.5))}.pf-rt-logo.show{display:block}.pf-rt-title{margin:10px 0 0;font:1000 clamp(56px,12vw,128px)/.84 Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase;text-shadow:0 12px 34px rgba(0,0,0,.5)}.pf-rt-name{margin-top:15px;font:950 clamp(18px,4vw,34px)/1.1 Inter,Arial,sans-serif}.pf-rt-score{margin-top:12px;font:900 clamp(15px,3vw,24px)/1 Inter,Arial,sans-serif;color:#dcecf5}
    .pf-rt-event.interchange{background:radial-gradient(circle at center,rgba(25,60,82,.98),rgba(2,7,11,.99))}.pf-rt-event.interchange .pf-rt-card{padding:20px;border:1px solid rgba(255,255,255,.2);border-radius:22px;background:rgba(4,12,19,.72);box-shadow:0 24px 70px rgba(0,0,0,.42)}.pf-rt-event.interchange .pf-rt-title{font-size:clamp(38px,8vw,84px)}.pf-rt-event.interchange.to-bench .pf-rt-title{color:#ff5261}.pf-rt-event.interchange.on-field .pf-rt-title{color:#35dc87}.pf-rt-event.interchange.to-bench .pf-rt-kicker{color:#ff9ca5}.pf-rt-event.interchange.on-field .pf-rt-kicker{color:#8cf0b9}.pf-rt-event.behind .pf-rt-title{font-size:clamp(42px,9vw,96px)}
    .pf-rt-replay{position:absolute;inset:0;z-index:62;background:#000;opacity:0;transform:translateX(105%);pointer-events:none;transition:transform .32s cubic-bezier(.22,.8,.24,1),opacity .2s ease}.pf-rt-replay.show{opacity:1;transform:translateX(0);pointer-events:auto}.pf-rt-replay.exit{opacity:0;transform:translateX(-105%)}.pf-rt-replay video{width:100%;height:100%;display:block;object-fit:cover;background:#000}.pf-rt-replay-badge{position:absolute;right:14px;top:14px;padding:9px 13px;border-radius:8px;background:#d51f35;color:#fff;font:1000 12px/1 Inter,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;animation:pf-rt-flash .9s ease-in-out infinite;box-shadow:0 10px 28px rgba(0,0,0,.45)}.pf-rt-replay-title{position:absolute;left:14px;right:14px;bottom:14px;padding:11px 14px;border-radius:10px;background:linear-gradient(90deg,rgba(3,8,13,.92),rgba(3,8,13,.62));color:#fff;font:900 14px/1.25 Inter,Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    @keyframes pf-rt-flash{0%,100%{opacity:1}50%{opacity:.45}}@media(max-width:600px){.pf-broadcast-brand{gap:5px}.pf-broadcast-brand .pf-logo-live{padding:4px 7px;font-size:8px}.pf-rt-event{padding:14px}.pf-rt-logo{width:66px;height:66px}.pf-rt-replay-badge{right:8px;top:8px;padding:7px 10px;font-size:10px}.pf-rt-replay-title{left:8px;right:8px;bottom:8px;font-size:11px}}
  `
  document.head.appendChild(style)

  const existingBrand = document.querySelector('.brand')
  if (existingBrand) {
    existingBrand.className = 'brand pf-broadcast-brand'
    existingBrand.innerHTML = '<span class="pf-play"><span>PLAY</span></span><span class="pf-footy">FOOTY</span><span class="pf-logo-live"><i></i>Live</span>'
  }

  const eventOverlay = document.createElement('div')
  eventOverlay.className = 'pf-rt-event'
  eventOverlay.setAttribute('aria-live', 'assertive')
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
  const knownHighlights = new Set(), replayQueue = [], eventQueue = []
  let last = null, initialHighlightsLoaded = false, eventBusy = false, replayBusy = false
  let pendingGoalAt = 0, pendingGoalLabel = '', matchTimer = 0, highlightTimer = 0, polling = false

  const textValue = item => typeof item === 'string' ? item.trim() : ''
  const value = (...items) => items.map(textValue).find(Boolean) || ''
  const total = (g,b) => Number(g||0)*6 + Number(b||0)
  const fmt = seconds => { const s=Math.max(0,Math.floor(Number(seconds)||0)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0') }
  const nestedLogo = (data, side) => {
    const node = side === 'home' ? (data.homeClub || data.club || data.homeTeam || data.team || {}) : (data.awayClub || data.opponent || data.awayTeam || {})
    return value(node.logoUrl,node.logo,node.imageUrl,node.image,node.badgeUrl,node.crestUrl)
  }
  const logoValue = (data, side) => side === 'home'
    ? value(data.homeLogoUrl,data.clubLogoUrl,data.clubLogo,data.homeLogo,data.teamLogoUrl,data.homeTeamLogoUrl,nestedLogo(data,'home'))
    : value(data.awayLogoUrl,data.opponentLogoUrl,data.opponentLogo,data.awayLogo,data.awayTeamLogoUrl,nestedLogo(data,'away'))
  const snapshot = data => ({
    homeGoals:Number(data.homeGoals)||0, homeBehinds:Number(data.homeBehinds)||0, awayGoals:Number(data.awayGoals)||0, awayBehinds:Number(data.awayBehinds)||0,
    homeName:value(data.clubName,data.homeName,data.homeClub?.name,data.club?.name,'Home'), awayName:value(data.opponentName,data.awayName,data.awayClub?.name,data.opponent?.name,'Away'),
    homeLogo:logoValue(data,'home'), awayLogo:logoValue(data,'away'), quarter:Number(data.quarter)||1, elapsedSeconds:Number(data.elapsedSeconds)||0,
    lastEvent:String(data.lastEvent||data.latestEvent||'').trim()
  })
  const scoreLine = data => `${data.homeName} ${data.homeGoals}.${data.homeBehinds} (${total(data.homeGoals,data.homeBehinds)}) — ${total(data.awayGoals,data.awayBehinds)} (${data.awayGoals}.${data.awayBehinds}) ${data.awayName}`
  function setImage(id,url){const image=document.getElementById(id);if(!image)return;if(url){image.src=url;image.classList.add('show')}else{image.removeAttribute('src');image.classList.remove('show')}}
  function renderPublicState(raw,current){
    const set=(id,v)=>{const el=document.getElementById(id);if(el&&el.textContent!==String(v))el.textContent=String(v)}
    set('homeName',current.homeName);set('awayName',current.awayName);set('homeScore',`${current.homeGoals}.${current.homeBehinds}`);set('awayScore',`${current.awayGoals}.${current.awayBehinds}`)
    set('homeTotal',`${total(current.homeGoals,current.homeBehinds)} points`);set('awayTotal',`${total(current.awayGoals,current.awayBehinds)} points`);set('quarter',`Q${current.quarter}`);set('clock',fmt(current.elapsedSeconds))
    set('roundLabel',raw.roundLabel||'PlayFooty Live');set('title',`${current.homeName} v ${current.awayName}`);set('subtitle',current.lastEvent||'Live scores, replays and match updates on PlayFooty.')
    setImage('homeLogo',current.homeLogo);setImage('awayLogo',current.awayLogo)
  }
  function directorState(state){document.dispatchEvent(new CustomEvent('pf-director-state',{detail:{state}}))}
  function queueEvent(item){eventQueue.push(item);runEventQueue()}
  function runEventQueue(){
    if(eventBusy||replayBusy||!eventQueue.length)return
    const item=eventQueue.shift();eventBusy=true;directorState(item.kind==='goal'?'GOAL_GRAPHIC':'MATCH_GRAPHIC')
    eventOverlay.className=`pf-rt-event ${item.kind} ${item.direction||''}`.trim();kicker.textContent=item.team||'PlayFooty Live';title.textContent=item.heading;name.textContent=item.playerName||'';score.textContent=item.line||''
    if(item.image){logo.src=item.image;logo.classList.add('show')}else{logo.removeAttribute('src');logo.classList.remove('show')}
    requestAnimationFrame(()=>eventOverlay.classList.add('show'))
    setTimeout(()=>{eventOverlay.classList.remove('show');eventOverlay.classList.add('exit');setTimeout(()=>{eventOverlay.classList.remove('exit');eventBusy=false;directorState('LIVE');playReplay();runEventQueue()},330)},item.duration)
  }
  function interchangeDetails(event,current){
    const raw=String(event||'').trim(), lower=raw.toLowerCase()
    if(!raw)return null
    const toBench=/\b(to|onto|into|moved to|sent to|goes to|going to)\s+(the\s+)?bench\b|\bto bench\b|\bbench(ed)?\b|\bcomes? off\b|\bcoming off\b|\boff the field\b/.test(lower)
    const onField=/\b(from|off)\s+(the\s+)?bench\b|\b(on|onto)\s+(the\s+)?field\b|\bcomes? on\b|\bcoming on\b|\bon for\b/.test(lower)
    if(toBench===onField)return null
    const away=lower.includes(current.awayName.toLowerCase()), team=away?current.awayName:current.homeName, image=away?current.awayLogo:current.homeLogo
    const cleaned=raw.replace(/^interchange\s*[-–—:]?\s*/i,'').trim()
    return {direction:toBench?'to-bench':'on-field',heading:toBench?'TO BENCH':'ON FIELD',team,playerName:cleaned||team,image}
  }
  function processMatch(raw){
    if(!raw)return
    const current=snapshot(raw);renderPublicState(raw,current)
    if(!last){last=current;return}
    const hg=current.homeGoals-last.homeGoals,ag=current.awayGoals-last.awayGoals,hb=current.homeBehinds-last.homeBehinds,ab=current.awayBehinds-last.awayBehinds
    if(hg>0||ag>0){const home=hg>0,team=home?current.homeName:current.awayName,image=home?current.homeLogo:current.awayLogo,playerName=current.lastEvent.replace(/^goal\s*[-–—:]?\s*/i,'').replace(/\s*goal$/i,'').trim()||team;pendingGoalAt=Date.now();pendingGoalLabel=playerName;queueEvent({kind:'goal',heading:'GOAL',team,playerName,image,line:scoreLine(current),duration:2400})}
    if(hb>0||ab>0){const home=hb>0;queueEvent({kind:'behind',heading:'BEHIND',team:home?current.homeName:current.awayName,playerName:'',image:home?current.homeLogo:current.awayLogo,line:scoreLine(current),duration:1400})}
    if(current.lastEvent&&current.lastEvent!==last.lastEvent){const change=interchangeDetails(current.lastEvent,current);if(change)queueEvent({kind:'interchange',...change,line:'',duration:1900})}
    last=current
  }
  async function pollMatch(){
    if(polling)return;polling=true
    try{const response=await fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}?rtg=${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache','pragma':'no-cache'}});const payload=await response.json();if(response.ok)processMatch(payload.data||payload)}catch{}finally{polling=false}
  }
  function isGoalHighlight(item){return /(^|\s)goal(\s|$|[·:—-])/i.test([item?.title,item?.description,...(Array.isArray(item?.tags)?item.tags:[])].join(' '))}
  async function pollHighlights(){
    try{const response=await fetch(`/api/club-portal/media/public/clubs/${encodeURIComponent(clubId)}/highlights?rtg=${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache'}});const payload=await response.json();if(!response.ok)return;const items=Array.isArray(payload.data)?payload.data:[];if(!initialHighlightsLoaded){items.forEach(item=>knownHighlights.add(String(item.id)));initialHighlightsLoaded=true;return}const arrivals=items.filter(item=>!knownHighlights.has(String(item.id)));items.forEach(item=>knownHighlights.add(String(item.id)));arrivals.slice().reverse().filter(isGoalHighlight).forEach(item=>{if(Date.now()-pendingGoalAt<90000)replayQueue.push(item)});playReplay()}catch{}
  }
  async function playReplay(){
    if(replayBusy||eventBusy||!replayQueue.length)return
    replayBusy=true;directorState('REPLAY');const item=replayQueue.shift();replayTitle.textContent=item.title||pendingGoalLabel||'Goal replay';replayVideo.src=item.fileUrl;replayVideo.currentTime=0;replayVideo.muted=false;replayOverlay.classList.remove('exit');requestAnimationFrame(()=>replayOverlay.classList.add('show'))
    const finish=()=>{replayVideo.onended=null;replayVideo.onerror=null;replayOverlay.classList.remove('show');replayOverlay.classList.add('exit');setTimeout(()=>{replayVideo.pause();replayVideo.removeAttribute('src');replayVideo.load();replayOverlay.classList.remove('exit');replayBusy=false;directorState('LIVE');runEventQueue();playReplay()},340)}
    replayVideo.onended=finish;replayVideo.onerror=finish;try{await replayVideo.play()}catch{replayVideo.muted=true;try{await replayVideo.play()}catch{finish()}}
  }

  window.PlayFootyRealtimeGraphics=true;directorState('LIVE');pollMatch();pollHighlights();matchTimer=setInterval(pollMatch,250);highlightTimer=setInterval(()=>{pollHighlights();playReplay()},750)
  window.addEventListener('beforeunload',()=>{clearInterval(matchTimer);clearInterval(highlightTimer);replayVideo.pause()})
})()
