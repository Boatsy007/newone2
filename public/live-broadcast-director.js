(() => {
  const clubId = new URLSearchParams(location.search).get('clubId') || ''
  const player = document.querySelector('.player')
  if (!clubId || !player || window.PlayFootyBroadcastDirector) return

  const style = document.createElement('style')
  style.textContent = `
    .pf-director-overlay{position:absolute;inset:0;z-index:15;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at center,rgba(22,63,88,.96),rgba(3,8,13,.97));opacity:0;transform:scale(1.04);pointer-events:none;transition:opacity .28s ease,transform .35s ease}.pf-director-overlay.show{opacity:1;transform:scale(1);pointer-events:auto}
    .pf-director-card{width:min(650px,92%);text-align:center;color:#fff}.pf-director-kicker{font:1000 11px/1 Inter,Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#78ceff}.pf-director-logo{display:none;width:92px;height:92px;margin:18px auto 10px;object-fit:contain;filter:drop-shadow(0 10px 24px rgba(0,0,0,.45))}.pf-director-logo.show{display:block}.pf-director-title{margin:12px 0 0;font:1000 clamp(58px,12vw,128px)/.82 Impact,'Arial Narrow Bold',sans-serif;letter-spacing:.01em;text-transform:uppercase;text-shadow:0 12px 35px rgba(0,0,0,.5)}.pf-director-name{margin-top:16px;font:950 clamp(18px,4vw,34px)/1.1 Inter,Arial,sans-serif}.pf-director-score{margin-top:12px;font:900 clamp(16px,3vw,25px)/1 Inter,Arial,sans-serif;color:#dcecf5}.pf-director-state{position:absolute;left:10px;top:10px;z-index:19;padding:5px 8px;border-radius:999px;background:rgba(4,10,16,.72);color:#a9bfcc;font:900 8px/1 Inter,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;opacity:.72}
    .pf-director-overlay.behind .pf-director-title{font-size:clamp(46px,10vw,104px);color:#e7eef2}.pf-director-overlay.quarter .pf-director-title,.pf-director-overlay.full .pf-director-title{font-size:clamp(46px,9vw,94px)}.pf-director-overlay.full{background:radial-gradient(circle at center,rgba(23,70,49,.97),rgba(3,8,13,.98))}
    @media(max-width:600px){.pf-director-overlay{padding:14px}.pf-director-logo{width:64px;height:64px;margin-top:12px}.pf-director-name{margin-top:12px}.pf-director-state{left:6px;top:6px}}
    @media(prefers-reduced-motion:reduce){.pf-director-overlay{transition:none}}
  `
  document.head.appendChild(style)

  const overlay = document.createElement('div')
  overlay.className = 'pf-director-overlay'
  overlay.innerHTML = '<div class="pf-director-state">Live</div><div class="pf-director-card"><div class="pf-director-kicker"></div><img class="pf-director-logo" alt=""><div class="pf-director-title"></div><div class="pf-director-name"></div><div class="pf-director-score"></div></div>'
  player.appendChild(overlay)

  const stateBadge = overlay.querySelector('.pf-director-state')
  const kicker = overlay.querySelector('.pf-director-kicker')
  const logo = overlay.querySelector('.pf-director-logo')
  const title = overlay.querySelector('.pf-director-title')
  const name = overlay.querySelector('.pf-director-name')
  const score = overlay.querySelector('.pf-director-score')
  const queue = []
  let state = 'LIVE', active = false, last = null, timer = 0, pollTimer = 0, replayWaitTimer = 0

  function setState(next) {
    state = next
    stateBadge.textContent = next.replaceAll('_', ' ')
    document.dispatchEvent(new CustomEvent('pf-director-state', { detail: { state: next } }))
  }
  function total(g,b){ return Number(g||0)*6+Number(b||0) }
  function scoreLine(m){ return `${m.homeName} ${m.homeGoals}.${m.homeBehinds} (${total(m.homeGoals,m.homeBehinds)}) — ${total(m.awayGoals,m.awayBehinds)} (${m.awayGoals}.${m.awayBehinds}) ${m.awayName}` }
  function showGraphic(item) {
    overlay.className = 'pf-director-overlay ' + item.kind.toLowerCase()
    kicker.textContent = item.kicker || 'PlayFooty Live'
    title.textContent = item.title
    name.textContent = item.name || ''
    score.textContent = item.score || ''
    if (item.logo) { logo.src = item.logo; logo.classList.add('show') } else { logo.removeAttribute('src'); logo.classList.remove('show') }
    requestAnimationFrame(() => overlay.classList.add('show'))
  }
  function hideGraphic() { overlay.classList.remove('show') }
  function enqueue(item) { queue.push(item); runNext() }
  function finish(delay = 350) {
    hideGraphic(); clearTimeout(timer)
    timer = setTimeout(() => { active = false; setState('LIVE'); runNext() }, delay)
  }
  function waitForReplay() {
    setState('WAITING_FOR_REPLAY')
    const replay = document.querySelector('.pf-goal-replay')
    if (!replay) { finish(); return }
    const onChange = () => {
      if (replay.classList.contains('show')) setState('REPLAY')
      else if (state === 'REPLAY' && !replay.classList.contains('show')) { observer.disconnect(); clearTimeout(replayWaitTimer); finish() }
    }
    const observer = new MutationObserver(onChange)
    observer.observe(replay, { attributes:true, attributeFilter:['class'] })
    replayWaitTimer = setTimeout(() => { observer.disconnect(); finish() }, 20000)
  }
  function runNext() {
    if (active || !queue.length) return
    active = true
    const item = queue.shift()
    setState(item.state)
    showGraphic(item)
    clearTimeout(timer)
    timer = setTimeout(() => {
      hideGraphic()
      if (item.state === 'GOAL_GRAPHIC') {
        setTimeout(waitForReplay, 320)
      } else if (item.state === 'QUARTER_GRAPHIC') {
        document.dispatchEvent(new CustomEvent('pf-director-request-sponsor', { detail:{ placement:'QUARTER', quarter:item.quarter } }))
        setState('SPONSOR')
        timer = setTimeout(() => { active=false; setState('LIVE'); runNext() }, 9200)
      } else finish()
    }, item.duration)
  }

  function snapshot(data) {
    return {
      homeGoals:Number(data.homeGoals)||0, homeBehinds:Number(data.homeBehinds)||0,
      awayGoals:Number(data.awayGoals)||0, awayBehinds:Number(data.awayBehinds)||0,
      homeName:String(data.clubName||'Home'), awayName:String(data.opponentName||'Away'),
      homeLogo:String(data.homeLogoUrl||''), awayLogo:String(data.awayLogoUrl||''),
      quarter:Number(data.quarter)||1, lastEvent:String(data.lastEvent||''), status:String(data.status||''),
    }
  }
  function scorer(event, fallback) {
    const clean = String(event||'').replace(/^goal\s*[-–—:]?\s*/i,'').replace(/\s*goal$/i,'').trim()
    return clean && !/^goal$/i.test(clean) ? clean : fallback
  }
  function process(data) {
    if (!data) return
    const current = snapshot(data)
    if (!last) { last = current; return }
    const homeGoal = current.homeGoals-last.homeGoals, awayGoal=current.awayGoals-last.awayGoals
    const homeBehind=current.homeBehinds-last.homeBehinds, awayBehind=current.awayBehinds-last.awayBehinds
    if (homeGoal>0) enqueue({kind:'GOAL',state:'GOAL_GRAPHIC',title:'GOAL',kicker:current.homeName,name:scorer(current.lastEvent,current.homeName),logo:current.homeLogo,score:scoreLine(current),duration:2800})
    if (awayGoal>0) enqueue({kind:'GOAL',state:'GOAL_GRAPHIC',title:'GOAL',kicker:current.awayName,name:scorer(current.lastEvent,current.awayName),logo:current.awayLogo,score:scoreLine(current),duration:2800})
    if (homeBehind>0) enqueue({kind:'BEHIND',state:'BEHIND_GRAPHIC',title:'BEHIND',kicker:current.homeName,name:'',logo:current.homeLogo,score:scoreLine(current),duration:1700})
    if (awayBehind>0) enqueue({kind:'BEHIND',state:'BEHIND_GRAPHIC',title:'BEHIND',kicker:current.awayName,name:'',logo:current.awayLogo,score:scoreLine(current),duration:1700})
    if (current.quarter !== last.quarter) enqueue({kind:'QUARTER',state:'QUARTER_GRAPHIC',title:`Quarter ${last.quarter} Complete`,kicker:'PlayFooty Match Centre',name:'',logo:'',score:scoreLine(current),quarter:last.quarter,duration:4200})
    if (/final siren|full time|final score/i.test(current.lastEvent) && !/final siren|full time|final score/i.test(last.lastEvent)) enqueue({kind:'FULL',state:'FULL_TIME',title:'Full Time',kicker:'Final Score',name:`${current.homeName} v ${current.awayName}`,logo:'',score:scoreLine(current),duration:10000})
    last = current
  }
  async function poll() {
    try {
      const response = await fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}?director=${Date.now()}`, {cache:'no-store',headers:{'cache-control':'no-cache'}})
      const payload = await response.json()
      if (response.ok) process(payload.data || payload)
    } catch {}
  }

  window.PlayFootyBroadcastDirector = { enqueue, getState:()=>state }
  setState('LIVE'); poll(); pollTimer=setInterval(poll,700)
  window.addEventListener('beforeunload',()=>{clearInterval(pollTimer);clearTimeout(timer);clearTimeout(replayWaitTimer)})
})()
