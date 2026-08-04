(() => {
  const SESSION_KEY='playfooty.clubPortal.session.v1'
  const params=new URLSearchParams(location.search)
  const clubId=params.get('clubId')||''
  const sheetId=params.get('sheetId')||''
  const frame=document.getElementById('studio')
  if(!clubId||!frame||window.PlayFootyRealtimeStateRelay)return

  let lastSignature='',lastClock='',lastClockAt=0,lastEvent='',sendTimer=0,tickTimer=0,slotTimer=0,previousSlots=null,inFlight=false,pending=null
  const token=()=>{try{const raw=localStorage.getItem(SESSION_KEY),value=raw?JSON.parse(raw):null;return typeof value?.access_token==='string'?value.access_token:''}catch{return''}}
  const docs=()=>{const out=[];try{const d3=frame.contentDocument;if(d3)out.push(d3);const d2=d3?.getElementById('interchange')?.contentDocument;if(d2)out.push(d2);const db=d2?.getElementById('broadcast')?.contentDocument;if(db)out.push(db);const ds=db?.getElementById('studio')?.contentDocument;if(ds)out.push(ds)}catch{}return out}
  const doc=()=>{const all=docs();return all[all.length-1]||null}
  const text=(d,id)=>String(d?.getElementById(id)?.textContent||'').trim()
  const score=value=>{const m=String(value||'').match(/(\d+)\s*\.\s*(\d+)/);return m?{goals:Number(m[1]),behinds:Number(m[2])}:{goals:0,behinds:0}}
  const seconds=value=>{const m=String(value||'').match(/(\d+)\s*:\s*(\d+)/);return m?Number(m[1])*60+Number(m[2]):0}
  const live=()=>Boolean(document.getElementById('badge')?.classList.contains('live'))

  function snapshot(eventOverride){
    const d=doc();if(!d)return null
    const home=score(text(d,'homeScore')),away=score(text(d,'awayScore')),clock=text(d,'clock'),now=Date.now()
    const clockRunning=clock===lastClock?now-lastClockAt<1800:true
    if(clock!==lastClock){lastClock=clock;lastClockAt=now}
    const event=eventOverride??text(d,'latest')
    return {teamSheetId:sheetId||null,roundLabel:params.get('roundLabel')||null,opponentName:text(d,'awayName')||null,matchDate:null,quarter:Math.max(1,Number(text(d,'quarter').replace(/\D/g,''))||1),elapsedSeconds:seconds(clock),clockRunning,homeGoals:home.goals,homeBehinds:home.behinds,awayGoals:away.goals,awayBehinds:away.behinds,status:live()?'LIVE':'HIDDEN',lastEvent:event||null}
  }
  async function flush(){
    if(inFlight||!pending||!token())return
    const body=pending;pending=null;inFlight=true
    try{await fetch('/api/live-match/clubs/'+encodeURIComponent(clubId),{method:'PUT',headers:{authorization:'Bearer '+token(),'content-type':'application/json','cache-control':'no-cache'},body:JSON.stringify(body),keepalive:true})}catch{}finally{inFlight=false;if(pending)queueMicrotask(flush)}
  }
  function send(eventOverride,immediate=false){
    if(!live())return
    const state=snapshot(eventOverride);if(!state)return
    const signature=JSON.stringify(state)
    if(signature===lastSignature&&!immediate)return
    lastSignature=signature;pending=state
    clearTimeout(sendTimer);sendTimer=setTimeout(flush,immediate?0:40)
  }

  const slotKey=slot=>String(slot?.slotId??slot?.id??slot?.positionId??slot?.position??slot?.role??slot?.name??'').trim()
  const playerId=slot=>String(slot?.playerId??slot?.player?.id??slot?.athleteId??slot?.assignedPlayerId??'').trim()
  const playerName=slot=>String(slot?.playerName??slot?.player?.name??slot?.name??slot?.label??'Player').trim()
  const isBench=slot=>/bench|interchange|emergency|reserve|substitute|sub\b/i.test([slotKey(slot),slot?.group,slot?.zone,slot?.type].join(' '))
  function slotMap(slots){const map=new Map();(Array.isArray(slots)?slots:[]).forEach(slot=>{const id=playerId(slot);if(id)map.set(id,{bench:isBench(slot),name:playerName(slot)})});return map}
  async function inspectSlots(){
    if(!live()||!sheetId||!token())return
    try{
      const response=await fetch('/api/club-portal/match-day/clubs/'+encodeURIComponent(clubId)+'/sheets/'+encodeURIComponent(sheetId)+'?relay='+Date.now(),{cache:'no-store',headers:{authorization:'Bearer '+token(),'cache-control':'no-cache'}})
      const payload=await response.json();if(!response.ok)return
      const state=payload?.data?.state||{},next=slotMap(state.slots)
      if(previousSlots){
        for(const [id,current] of next){const before=previousSlots.get(id);if(!before||before.bench===current.bench)continue
          const label=current.bench?`${current.name} moved to bench`:`${current.name} moved on field`
          lastEvent=label;send(label,true)
        }
      }
      previousSlots=next
    }catch{}
  }
  function bind(){
    const d=doc();if(!d)return false
    const targets=['homeScore','awayScore','clock','quarter','latest'].map(id=>d.getElementById(id)).filter(Boolean)
    if(!targets.length)return false
    const observer=new MutationObserver(()=>{const event=text(d,'latest');if(event&&event!==lastEvent){lastEvent=event;send(event,true)}else send(null,true)})
    targets.forEach(node=>observer.observe(node,{childList:true,characterData:true,subtree:true}))
    send(null,true)
    return true
  }
  function install(){if(!bind())setTimeout(install,250)}
  frame.addEventListener('load',install);install()
  tickTimer=setInterval(()=>send(null,false),500)
  slotTimer=setInterval(inspectSlots,500)
  window.addEventListener('beforeunload',()=>{clearInterval(tickTimer);clearInterval(slotTimer);clearTimeout(sendTimer);if(live()){pending=snapshot();flush()}})
  window.PlayFootyRealtimeStateRelay=true
})()
