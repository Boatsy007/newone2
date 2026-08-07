import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, RefreshCw, SkipForward, Wifi, WifiOff } from 'lucide-react'

type Player = { id: string; clubPlayerId: string; playerName: string; jumperNumber: number | null; positionCode: string }
type Sheet = { id: string; roundLabel: string; opponentName: string | null; matchDate: string | null; status: string; players: Player[] }
type Slot = { clubPlayerId: string; playerName: string; jumperNumber: number | null; positionCode: string; onGround: boolean; plusMinus: number; goals: number; behinds: number }
type MatchEvent = { id: string; quarter: number; seconds: number; kind: 'SCORE' | 'SWAP' | 'QUARTER'; label: string }
type MatchState = { sheetId: string; quarter: number; elapsed: number; runningSince: number | null; homeGoals: number; homeBehinds: number; awayGoals: number; awayBehinds: number; slots: Slot[]; events: MatchEvent[] }

type Props = {
  clubId: string
  sheetId: string
  token: string
  onBack: () => void
}

const FIELD_POSITIONS = new Set(['BP_LEFT','FB','BP_RIGHT','HBF_LEFT','CHB','HBF_RIGHT','WING_LEFT','CENTRE','WING_RIGHT','RUCK','RUCK_ROVER','ROVER','HFF_LEFT','CHF','HFF_RIGHT','FP_LEFT','FF','FP_RIGHT'])
const FIELD_ROWS = [['BP_LEFT','FB','BP_RIGHT'],['HBF_LEFT','CHB','HBF_RIGHT'],['WING_LEFT','CENTRE','WING_RIGHT'],['RUCK','RUCK_ROVER','ROVER'],['HFF_LEFT','CHF','HFF_RIGHT'],['FP_LEFT','FF','FP_RIGHT']]
const BENCH = ['INTERCHANGE_1','INTERCHANGE_2','INTERCHANGE_3','INTERCHANGE_4','EMERGENCY_1','EMERGENCY_2','EMERGENCY_3']
const LABELS: Record<string,string> = { BP_LEFT:'RBP',FB:'FB',BP_RIGHT:'LBP',HBF_LEFT:'RHB',CHB:'CHB',HBF_RIGHT:'LHB',WING_LEFT:'RW',CENTRE:'C',WING_RIGHT:'LW',RUCK:'R',RUCK_ROVER:'RR',ROVER:'ROV',HFF_LEFT:'RHF',CHF:'CHF',HFF_RIGHT:'LHF',FP_LEFT:'RFP',FF:'FF',FP_RIGHT:'LFP',INTERCHANGE_1:'INT 1',INTERCHANGE_2:'INT 2',INTERCHANGE_3:'INT 3',INTERCHANGE_4:'INT 4',EMERGENCY_1:'EMG 1',EMERGENCY_2:'EMG 2',EMERGENCY_3:'EMG 3' }

function formatTime(seconds:number){const value=Math.max(0,Math.floor(seconds));return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`}
function total(goals:number,behinds:number){return goals*6+behinds}
function normalise(state:MatchState):MatchState{return {...state,slots:state.slots.map(slot=>({...slot,goals:Number(slot.goals)||0,behinds:Number(slot.behinds)||0,plusMinus:Number(slot.plusMinus)||0}))}}

export default function CoachAppMatchDay({clubId,sheetId,token,onBack}:Props){
  const[sheet,setSheet]=useState<Sheet|null>(null)
  const[state,setState]=useState<MatchState|null>(null)
  const[selected,setSelected]=useState('')
  const[scorer,setScorer]=useState('')
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  const[sync,setSync]=useState<'saved'|'saving'|'error'>('saved')
  const[online,setOnline]=useState(navigator.onLine)
  const[,setTick]=useState(0)
  const headers=useMemo<Record<string,string>>(()=>({authorization:`Bearer ${token}`}),[token])
  const jsonHeaders=useMemo<Record<string,string>>(()=>({...headers,'content-type':'application/json'}),[headers])

  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[])

  useEffect(()=>{
    let live=true
    setLoading(true);setError('')
    Promise.all([
      fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`,{headers}),
      fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{headers}),
    ]).then(async([sheetResponse,stateResponse])=>{
      const sheetPayload=await sheetResponse.json().catch(()=>({}))
      const statePayload=await stateResponse.json().catch(()=>({}))
      if(!sheetResponse.ok)throw new Error(sheetPayload.error||'Unable to load selected side')
      if(!stateResponse.ok)throw new Error(statePayload.error||'Unable to load Match Day')
      const current=(Array.isArray(sheetPayload.data)?sheetPayload.data:[]).find((item:Sheet)=>item.id===sheetId) as Sheet|undefined
      if(!current)throw new Error('The active team sheet could not be found')
      const existing=statePayload.data?.state as MatchState|undefined
      const next=existing?normalise(existing):{
        sheetId,quarter:1,elapsed:0,runningSince:null,homeGoals:0,homeBehinds:0,awayGoals:0,awayBehinds:0,
        slots:current.players.map(player=>({...player,onGround:FIELD_POSITIONS.has(player.positionCode),plusMinus:0,goals:0,behinds:0})),events:[],
      }
      if(live){setSheet(current);setState(next)}
    }).catch(value=>{if(live)setError(value instanceof Error?value.message:'Unable to load Match Day')}).finally(()=>{if(live)setLoading(false)})
    return()=>{live=false}
  },[clubId,sheetId,headers])

  useEffect(()=>{if(!state?.runningSince)return;const timer=window.setInterval(()=>setTick(value=>value+1),1000);return()=>window.clearInterval(timer)},[state?.runningSince])

  useEffect(()=>{
    if(!state||!sheet)return
    setSync('saving')
    const timer=window.setTimeout(()=>{
      fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{method:'PUT',headers:jsonHeaders,body:JSON.stringify({state})})
        .then(async response=>{const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'Unable to save Match Day');setSync('saved')})
        .catch(()=>setSync('error'))
    },350)
    return()=>window.clearTimeout(timer)
  },[state,sheet,clubId,sheetId,jsonHeaders])

  useEffect(()=>{
    if(!state||!sheet)return
    const elapsedSeconds=state.elapsed+(state.runningSince?Math.floor((Date.now()-state.runningSince)/1000):0)
    const publicLive=Boolean(state.runningSince||state.elapsed||state.events.length||state.homeGoals||state.homeBehinds||state.awayGoals||state.awayBehinds)
    const timer=window.setTimeout(()=>{
      fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}`,{method:'PUT',headers:jsonHeaders,body:JSON.stringify({teamSheetId:sheetId,roundLabel:sheet.roundLabel,opponentName:sheet.opponentName,matchDate:sheet.matchDate,quarter:state.quarter,elapsedSeconds,clockRunning:Boolean(state.runningSince),homeGoals:state.homeGoals,homeBehinds:state.homeBehinds,awayGoals:state.awayGoals,awayBehinds:state.awayBehinds,status:publicLive?'LIVE':'HIDDEN',lastEvent:state.events[0]?.label||null})}).catch(()=>undefined)
    },500)
    return()=>window.clearTimeout(timer)
  },[state,sheet,clubId,sheetId,jsonHeaders])

  function update(mutator:(current:MatchState)=>MatchState){setState(current=>current?mutator(current):current)}
  function now(current:MatchState){return current.elapsed+(current.runningSince?Math.floor((Date.now()-current.runningSince)/1000):0)}
  function toggleTimer(){update(current=>current.runningSince?{...current,elapsed:now(current),runningSince:null}:{...current,runningSince:Date.now()})}
  function nextQuarter(){update(current=>{const quarter=Math.min(4,current.quarter+1);const event:MatchEvent={id:crypto.randomUUID(),quarter,seconds:0,kind:'QUARTER',label:`Quarter ${quarter} started`};return {...current,quarter,elapsed:0,runningSince:null,events:[event,...current.events]}})}
  function addScore(side:'HOME'|'AWAY',points:1|6,scorerId=''){
    update(current=>{
      const delta=side==='HOME'?points:-points
      const scoringPlayer=current.slots.find(slot=>slot.clubPlayerId===scorerId)
      const slots=current.slots.map(slot=>{
        const plusMinus=slot.onGround?slot.plusMinus+delta:slot.plusMinus
        if(side==='HOME'&&slot.clubPlayerId===scorerId)return {...slot,plusMinus,goals:slot.goals+(points===6?1:0),behinds:slot.behinds+(points===1?1:0)}
        return {...slot,plusMinus}
      })
      const label=side==='HOME'&&scoringPlayer?`${scoringPlayer.playerName} ${points===6?'goal':'behind'}`:`${side==='HOME'?'Your team':'Opposition'} ${points===6?'goal':'behind'}`
      const event:MatchEvent={id:crypto.randomUUID(),quarter:current.quarter,seconds:now(current),kind:'SCORE',label}
      return {...current,homeGoals:current.homeGoals+(side==='HOME'&&points===6?1:0),homeBehinds:current.homeBehinds+(side==='HOME'&&points===1?1:0),awayGoals:current.awayGoals+(side==='AWAY'&&points===6?1:0),awayBehinds:current.awayBehinds+(side==='AWAY'&&points===1?1:0),slots,events:[event,...current.events]}
    })
    setScorer('')
  }
  function choosePlayer(id:string){
    if(!selected){setSelected(id);return}
    if(selected===id){setSelected('');return}
    update(current=>{
      const first=current.slots.find(slot=>slot.clubPlayerId===selected)
      const second=current.slots.find(slot=>slot.clubPlayerId===id)
      if(!first||!second)return current
      const slots=current.slots.map(slot=>slot.clubPlayerId===first.clubPlayerId?{...slot,clubPlayerId:second.clubPlayerId,playerName:second.playerName,jumperNumber:second.jumperNumber,plusMinus:second.plusMinus,goals:second.goals,behinds:second.behinds}:slot.clubPlayerId===second.clubPlayerId?{...slot,clubPlayerId:first.clubPlayerId,playerName:first.playerName,jumperNumber:first.jumperNumber,plusMinus:first.plusMinus,goals:first.goals,behinds:first.behinds}:slot)
      const event:MatchEvent={id:crypto.randomUUID(),quarter:current.quarter,seconds:now(current),kind:'SWAP',label:`${first.playerName} swapped with ${second.playerName}`}
      return {...current,slots,events:[event,...current.events]}
    })
    setSelected('')
  }

  if(loading)return <section className="camd-state"><style>{styles}</style><RefreshCw className="spin"/><b>Loading Match Day…</b></section>
  if(error||!state||!sheet)return <section className="camd-state"><style>{styles}</style><b>{error||'Match Day unavailable'}</b><button onClick={onBack}>Return to Select Side</button></section>
  const seconds=now(state)
  const playerOptions=state.slots.filter(slot=>slot.onGround)

  return <section className="camd"><style>{styles}</style>
    <div className={`camd-sync ${sync}`}>{online?<Wifi size={15}/>:<WifiOff size={15}/>} {online?(sync==='saving'?'Saving…':sync==='error'?'Save failed':'Saved'):'Offline'}</div>
    <header className="camd-scoreboard">
      <div className="camd-team"><span>Your team</span><strong>{state.homeGoals}.{state.homeBehinds}</strong><b>{total(state.homeGoals,state.homeBehinds)}</b></div>
      <div className="camd-clock"><span>Q{state.quarter}</span><strong>{formatTime(seconds)}</strong><button onClick={toggleTimer}>{state.runningSince?<Pause/>:<Play/>}{state.runningSince?'Pause':'Start'}</button></div>
      <div className="camd-team away"><span>{sheet.opponentName||'Opposition'}</span><strong>{state.awayGoals}.{state.awayBehinds}</strong><b>{total(state.awayGoals,state.awayBehinds)}</b></div>
    </header>

    <div className="camd-main">
      <section className="camd-scoring">
        <h2>Score</h2>
        <label>Goal scorer<select value={scorer} onChange={event=>setScorer(event.target.value)}><option value="">Team score only</option>{playerOptions.map(player=><option key={player.clubPlayerId} value={player.clubPlayerId}>{player.jumperNumber?`${player.jumperNumber}. `:''}{player.playerName}</option>)}</select></label>
        <div className="camd-score-buttons"><button className="goal" onClick={()=>addScore('HOME',6,scorer)}>Your Goal</button><button onClick={()=>addScore('HOME',1,scorer)}>Your Behind</button><button className="opp" onClick={()=>addScore('AWAY',6)}>Opp Goal</button><button className="opp" onClick={()=>addScore('AWAY',1)}>Opp Behind</button></div>
        <button className="camd-quarter" disabled={state.quarter>=4} onClick={nextQuarter}><SkipForward size={18}/> Next Quarter</button>
      </section>

      <section className="camd-ground">
        <div className="camd-ground-head"><div><h2>Interchange</h2><p>Tap two players to swap them.</p></div>{selected&&<b>Choose replacement</b>}</div>
        <div className="camd-oval">{FIELD_ROWS.map((row,index)=><div className="camd-row" key={index}>{row.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} onClick={choosePlayer}/>)}</div>)}</div>
        <div className="camd-bench">{BENCH.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} onClick={choosePlayer}/>)}</div>
      </section>

      <aside className="camd-events"><h2>Match Feed</h2>{state.events.length?<div>{state.events.slice(0,14).map(event=><article key={event.id}><b>Q{event.quarter} · {formatTime(event.seconds)}</b><span>{event.label}</span></article>)}</div>:<p>No match events yet.</p>}</aside>
    </div>
    <footer><button onClick={onBack}>Return to Select Side</button></footer>
  </section>
}

function PlayerTile({code,slot,selected,onClick}:{code:string;slot:Slot|undefined;selected:string;onClick:(id:string)=>void}){
  return <button className={`camd-player ${slot&&selected===slot.clubPlayerId?'selected':''}`} disabled={!slot} onClick={()=>slot&&onClick(slot.clubPlayerId)}><small>{LABELS[code]||code}</small>{slot?<><strong>{slot.jumperNumber||'—'}</strong><span>{slot.playerName}</span><em>{slot.plusMinus>0?'+':''}{slot.plusMinus} · {slot.goals}.{slot.behinds}</em></>:<span>Empty</span>}</button>
}

const styles=`
.camd{min-height:calc(100vh - 76px);padding:16px 16px calc(82px + env(safe-area-inset-bottom));background:#e9eff4;color:#101419;font-family:Barlow,Inter,Arial,sans-serif}.camd h2{margin:0;font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;text-transform:uppercase}.camd-sync{position:fixed;z-index:1450;right:18px;bottom:18px;display:flex;align-items:center;gap:6px;padding:8px 11px;border-radius:999px;background:#153524;color:#d9ffe8;font-size:12px;font-weight:900}.camd-sync.saving{background:#57430d}.camd-sync.error{background:#7c211d}.camd-scoreboard{position:sticky;z-index:1000;top:76px;display:grid;grid-template-columns:1fr minmax(180px,.7fr) 1fr;max-width:1500px;margin:0 auto 14px;overflow:hidden;border-radius:18px;background:#07121b;color:#fff;box-shadow:0 10px 28px rgba(0,0,0,.18)}.camd-team{display:grid;grid-template-columns:1fr auto;align-items:center;padding:15px 20px}.camd-team span{grid-column:1/-1;color:#9fb0bc;font-size:12px;font-weight:900;text-transform:uppercase}.camd-team strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:48px;line-height:1}.camd-team b{font-size:34px}.camd-team.away{text-align:right}.camd-clock{display:grid;place-items:center;padding:12px;border-right:1px solid #253641;border-left:1px solid #253641}.camd-clock span{color:#39b8ff;font-weight:950}.camd-clock strong{font-variant-numeric:tabular-nums;font-size:38px}.camd-clock button{display:flex;align-items:center;gap:6px;border:0;border-radius:10px;background:#39b8ff;padding:9px 14px;font-weight:950;text-transform:uppercase}.camd-clock svg{width:17px}.camd-main{display:grid;grid-template-columns:260px minmax(480px,1fr) 280px;gap:14px;max-width:1500px;margin:auto}.camd-scoring,.camd-ground,.camd-events{border:1px solid #d3dde5;border-radius:17px;background:#fff;box-shadow:0 7px 20px rgba(20,35,50,.05)}.camd-scoring,.camd-events{padding:17px;height:max-content;position:sticky;top:216px}.camd-scoring label{display:grid;gap:6px;margin-top:14px;color:#637181;font-size:11px;font-weight:900;text-transform:uppercase}.camd-scoring select{width:100%;padding:11px;border:1px solid #cbd6df;border-radius:9px;background:#fff}.camd-score-buttons{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.camd-score-buttons button,.camd-quarter{min-height:52px;border:0;border-radius:11px;background:#e7edf2;font-weight:950;text-transform:uppercase}.camd-score-buttons .goal{background:#22c77a}.camd-score-buttons .opp{background:#17232d;color:#fff}.camd-quarter{width:100%;display:flex;align-items:center;justify-content:center;gap:7px;margin-top:10px;background:#39b8ff}.camd-ground{padding:17px}.camd-ground-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.camd-ground-head p{margin:2px 0;color:#6c7883}.camd-ground-head>b{padding:7px 10px;border-radius:999px;background:#fff2c8;color:#6c4e00;font-size:12px}.camd-oval{width:min(700px,100%);aspect-ratio:4/5;box-sizing:border-box;margin:15px auto;padding:9% 5%;border:4px solid #16212a;border-radius:48%/16%;background:repeating-linear-gradient(0deg,#b8dc91 0 8.33%,#9fce78 8.33% 16.66%)}.camd-row{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:7%}.camd-player{min-width:0;min-height:70px;display:grid;place-items:center;align-content:center;padding:6px;border:2px solid transparent;border-radius:10px;background:rgba(255,255,255,.92);box-shadow:0 3px 9px rgba(0,0,0,.13)}.camd-player.selected{border-color:#ff9f1c;background:#fff4d8}.camd-player:disabled{opacity:.55}.camd-player small{color:#4a5863;font-size:9px;font-weight:950}.camd-player strong{font-size:20px;line-height:1}.camd-player span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:900}.camd-player em{font-size:9px;color:#52616c;font-style:normal}.camd-bench{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.camd-events>p{color:#71808c}.camd-events article{display:grid;gap:3px;padding:10px 0;border-bottom:1px solid #e5eaee}.camd-events article b{color:#1786c5;font-size:10px}.camd-events article span{font-size:13px;font-weight:800}.camd footer{position:fixed;z-index:1400;right:0;bottom:0;left:0;padding:10px 18px max(10px,env(safe-area-inset-bottom));border-top:1px solid #d2dbe2;background:rgba(255,255,255,.97)}.camd footer button,.camd-state button{min-height:46px;border:0;border-radius:10px;background:#e3eaf0;padding:10px 16px;font-weight:950;text-transform:uppercase}.camd-state{min-height:70vh;display:grid;place-items:center;align-content:center;gap:12px;background:#e9eff4;text-align:center}.spin{animation:camd-spin 1s linear infinite}@keyframes camd-spin{to{transform:rotate(360deg)}}
@media(max-width:1100px){.camd-main{grid-template-columns:230px 1fr}.camd-events{grid-column:1/-1;position:static}.camd-events>div{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.camd-events article{border:1px solid #e1e7ec;border-radius:10px;padding:10px}}
@media(max-width:780px){.camd{padding:10px 10px 84px}.camd-scoreboard{top:105px;grid-template-columns:1fr 130px 1fr;border-radius:13px}.camd-team{padding:10px}.camd-team strong{font-size:34px}.camd-team b{font-size:24px}.camd-clock strong{font-size:27px}.camd-clock button{padding:7px 9px;font-size:10px}.camd-main{display:block}.camd-scoring,.camd-ground,.camd-events{position:static;margin-bottom:11px}.camd-score-buttons{grid-template-columns:1fr 1fr}.camd-bench{grid-template-columns:repeat(2,1fr)}.camd-events>div{display:block}}
@media(orientation:landscape) and (max-height:800px){.camd-scoreboard{position:relative;top:0}.camd-main{grid-template-columns:240px minmax(500px,1fr)}.camd-scoring{position:static}.camd-events{display:none}.camd-oval{width:min(560px,100%)}}
`
