(() => {
  const clubId = new URLSearchParams(location.search).get('clubId') || ''
  const player = document.querySelector('.player')
  const overlay = document.querySelector('.pf-director-overlay')
  const card = overlay?.querySelector('.pf-director-card')
  if (!clubId || !player || !overlay || !card || window.PlayFootyBreakProduction) return

  const style = document.createElement('style')
  style.textContent = `
    .pf-break-stats{display:none;width:min(650px,96%);margin:20px auto 0;gap:10px}.pf-break-stats.show{display:grid}.pf-break-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.pf-break-stat{padding:10px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:rgba(3,9,14,.42)}.pf-break-stat small{display:block;color:#9fc7dc;font:900 8px/1 Inter,Arial,sans-serif;letter-spacing:.11em;text-transform:uppercase}.pf-break-stat b{display:block;margin-top:6px;color:#fff;font:1000 16px/1 Inter,Arial,sans-serif}.pf-break-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:10px}.pf-break-panel{padding:12px;border:1px solid rgba(255,255,255,.18);border-radius:11px;background:rgba(3,9,14,.48);text-align:left}.pf-break-panel h3{margin:0 0 9px;color:#78ceff;font:1000 9px/1 Inter,Arial,sans-serif;letter-spacing:.13em;text-transform:uppercase}.pf-quarter-row,.pf-kicker-row{display:grid;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.1);font:800 10px/1.2 Inter,Arial,sans-serif}.pf-quarter-row{grid-template-columns:34px minmax(0,1fr) minmax(0,1fr)}.pf-kicker-row{grid-template-columns:minmax(0,1fr) auto}.pf-quarter-row:last-child,.pf-kicker-row:last-child{border-bottom:0}.pf-quarter-row span:nth-child(n+2){text-align:center}.pf-break-empty{color:#a9bdc8;font:750 10px/1.4 Inter,Arial,sans-serif}.pf-ended-state{position:absolute;inset:0;z-index:18;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at center,rgba(22,61,80,.97),rgba(3,8,13,.99));opacity:0;pointer-events:none;transition:opacity .35s}.pf-ended-state.show{opacity:1;pointer-events:auto}.pf-ended-card{text-align:center;color:#fff}.pf-ended-card small{font:1000 10px/1 Inter,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#78ceff}.pf-ended-card h2{margin:12px 0 8px;font:1000 clamp(42px,9vw,86px)/.9 Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase}.pf-ended-card p{margin:0;color:#c4d3dc;font:800 13px/1.4 Inter,Arial,sans-serif}
    @media(max-width:600px){.pf-break-stats{margin-top:12px}.pf-break-summary{gap:5px}.pf-break-stat{padding:7px}.pf-break-stat b{font-size:12px}.pf-break-grid{grid-template-columns:1fr}.pf-break-panel{padding:9px}.pf-quarter-row,.pf-kicker-row{font-size:8px}.pf-director-overlay.quarter .pf-director-title,.pf-director-overlay.full .pf-director-title{font-size:clamp(34px,9vw,58px)}}
  `
  document.head.appendChild(style)

  const stats = document.createElement('div')
  stats.className = 'pf-break-stats'
  stats.innerHTML = '<div class="pf-break-summary"><div class="pf-break-stat"><small>Margin</small><b data-stat="margin">Level</b></div><div class="pf-break-stat"><small>Goals</small><b data-stat="goals">0–0</b></div><div class="pf-break-stat"><small>Total score</small><b data-stat="total">0–0</b></div></div><div class="pf-break-grid"><section class="pf-break-panel"><h3>Scoring by quarter</h3><div data-stat="quarters"></div></section><section class="pf-break-panel"><h3>Leading goal kickers</h3><div data-stat="kickers"></div></section></div>'
  card.appendChild(stats)

  const ended = document.createElement('div')
  ended.className = 'pf-ended-state'
  ended.innerHTML = '<div class="pf-ended-card"><small>PlayFooty Live</small><h2>Broadcast ended</h2><p data-ended-score>Thanks for watching.</p></div>'
  player.appendChild(ended)

  let last = null
  let latest = null
  let currentQuarter = 1
  let quarterStart = { home:0, away:0 }
  const quarters = []
  const kickers = new Map()
  let pollTimer = 0
  let finalTimer = 0

  const total = (g,b) => Number(g||0)*6+Number(b||0)
  const scoreText = m => `${m.homeName} ${m.homeGoals}.${m.homeBehinds} (${m.homeTotal}) — ${m.awayTotal} (${m.awayGoals}.${m.awayBehinds}) ${m.awayName}`
  function snapshot(data){
    return {homeGoals:Number(data.homeGoals)||0,homeBehinds:Number(data.homeBehinds)||0,awayGoals:Number(data.awayGoals)||0,awayBehinds:Number(data.awayBehinds)||0,homeName:String(data.clubName||'Home'),awayName:String(data.opponentName||'Away'),quarter:Number(data.quarter)||1,lastEvent:String(data.lastEvent||''),status:String(data.status||''),homeTotal:total(data.homeGoals,data.homeBehinds),awayTotal:total(data.awayGoals,data.awayBehinds),streamStatus:String(data.streamStatus||''),playbackUrl:String(data.playbackUrl||data.hlsUrl||data.streamPlaybackUrl||data.livePlaybackUrl||'')}
  }
  function scorerName(event, team){
    const value=String(event||'').replace(/^goal\s*[-–—:]?\s*/i,'').replace(/\s*goal$/i,'').replace(/\s*\([^)]*\)\s*$/,'').trim()
    if(!value || /^goal$/i.test(value) || value===team) return `${team} scorer`
    return value.slice(0,80)
  }
  function addKicker(name,team){const key=`${team}|${name}`;const row=kickers.get(key)||{name,team,goals:0};row.goals+=1;kickers.set(key,row)}
  function closeQuarter(match,quarter){
    const home=match.homeTotal-quarterStart.home,away=match.awayTotal-quarterStart.away
    const existing=quarters.find(row=>row.quarter===quarter)
    if(existing){existing.home=home;existing.away=away}else quarters.push({quarter,home,away})
    quarterStart={home:match.homeTotal,away:match.awayTotal}
  }
  function process(data){
    if(!data)return
    const current=snapshot(data); latest=current
    if(!last){last=current;currentQuarter=current.quarter;quarterStart={home:current.homeTotal,away:current.awayTotal};return}
    const hg=current.homeGoals-last.homeGoals,ag=current.awayGoals-last.awayGoals
    for(let i=0;i<hg;i++)addKicker(scorerName(current.lastEvent,current.homeName),current.homeName)
    for(let i=0;i<ag;i++)addKicker(scorerName(current.lastEvent,current.awayName),current.awayName)
    if(current.quarter!==last.quarter){closeQuarter(current,last.quarter);currentQuarter=current.quarter}
    const finalNow=/final siren|full time|final score/i.test(current.lastEvent)
    const finalBefore=/final siren|full time|final score/i.test(last.lastEvent)
    if(finalNow&&!finalBefore){closeQuarter(current,current.quarter);clearTimeout(finalTimer);finalTimer=setTimeout(()=>showEnded(current),12500)}
    if(current.streamStatus==='ENDED' || (!current.playbackUrl && last.playbackUrl && finalNow)) showEnded(current)
    last=current
  }
  function renderStats(match){
    if(!match)return
    const margin=Math.abs(match.homeTotal-match.awayTotal)
    stats.querySelector('[data-stat="margin"]').textContent=margin?`${margin} points`:'Level'
    stats.querySelector('[data-stat="goals"]').textContent=`${match.homeGoals}–${match.awayGoals}`
    stats.querySelector('[data-stat="total"]').textContent=`${match.homeTotal}–${match.awayTotal}`
    const quarterHost=stats.querySelector('[data-stat="quarters"]')
    const rows=quarters.slice().sort((a,b)=>a.quarter-b.quarter)
    quarterHost.innerHTML=rows.length?rows.map(row=>`<div class="pf-quarter-row"><b>Q${row.quarter}</b><span>${match.homeName} ${row.home}</span><span>${match.awayName} ${row.away}</span></div>`).join(''):'<div class="pf-break-empty">Quarter scoring will appear as the match progresses.</div>'
    const kickerHost=stats.querySelector('[data-stat="kickers"]')
    const leaders=[...kickers.values()].sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name)).slice(0,5)
    kickerHost.innerHTML=leaders.length?leaders.map(row=>`<div class="pf-kicker-row"><span>${row.name}<small style="display:block;color:#8da6b4;margin-top:2px">${row.team}</small></span><b>${row.goals}</b></div>`).join(''):'<div class="pf-break-empty">Goal kickers will appear after goals are recorded.</div>'
  }
  function showEnded(match){
    if(!match)return
    ended.querySelector('[data-ended-score]').textContent=scoreText(match)
    ended.classList.add('show')
    const liveState=document.querySelector('#liveState span');if(liveState)liveState.textContent='Broadcast ended'
  }
  document.addEventListener('pf-director-state',event=>{
    const state=event.detail?.state||''
    if(state==='QUARTER_GRAPHIC'||state==='FULL_TIME'){renderStats(latest);stats.classList.add('show')}
    else stats.classList.remove('show')
  })

  async function poll(){try{const response=await fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}?breaks=${Date.now()}`,{cache:'no-store',headers:{'cache-control':'no-cache'}});const payload=await response.json();if(response.ok)process(payload.data||payload)}catch{}}
  poll();pollTimer=setInterval(poll,700)
  window.PlayFootyBreakProduction={getQuarterScores:()=>quarters.slice(),getGoalKickers:()=>[...kickers.values()]}
  window.addEventListener('beforeunload',()=>{clearInterval(pollTimer);clearTimeout(finalTimer)})
})()
