import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Minus, Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react'

type StatKey='inside50s'|'clearances'|'tackles'|'marks'|'rebound50s'|'onePercenters'|'freesAgainst'
type TeamStats=Record<StatKey,number>
type MatchState={quarter:number;teamStats?:Partial<TeamStats>;[key:string]:unknown}
type Props={clubId:string;sheetId?:string|null;fixtureId:string;token:string;onExit:()=>void}
type PendingChange={key:StatKey;delta:number}

const EMPTY_STATS:TeamStats={inside50s:0,clearances:0,tackles:0,marks:0,rebound50s:0,onePercenters:0,freesAgainst:0}
const STATS:Array<{key:StatKey;label:string;short:string}>=[
  {key:'inside50s',label:'Inside 50s',short:'I50'},
  {key:'clearances',label:'Clearances',short:'CLR'},
  {key:'tackles',label:'Tackles',short:'TKL'},
  {key:'marks',label:'Marks',short:'MRK'},
  {key:'rebound50s',label:'Rebound 50s',short:'R50'},
  {key:'onePercenters',label:'1 Percenters',short:'1%'},
  {key:'freesAgainst',label:'Frees Against',short:'FA'},
]

export default function CoachAppStats({clubId,sheetId,fixtureId,token,onExit}:Props){
  const[resolvedSheetId,setResolvedSheetId]=useState(sheetId||'')
  const[state,setState]=useState<MatchState|null>(null)
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  const[syncing,setSyncing]=useState(false)
  const[online,setOnline]=useState(navigator.onLine)
  const stateRef=useRef<MatchState|null>(null)
  const pendingRef=useRef<PendingChange[]>([])
  const flushingRef=useRef(false)
  const headers=useMemo<Record<string,string>>(()=>({authorization:`Bearer ${token}`}),[token])
  const jsonHeaders=useMemo<Record<string,string>>(()=>({...headers,'content-type':'application/json'}),[headers])

  function applyState(next:MatchState){stateRef.current=next;setState(next)}

  async function resolveSheet(){
    if(resolvedSheetId)return resolvedSheetId
    const createResponse=await fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`,{method:'POST',headers:jsonHeaders,body:JSON.stringify({fixtureId})})
    const createPayload=await createResponse.json().catch(()=>({}))
    if(!createResponse.ok&&createResponse.status!==409)throw new Error(createPayload.error||'Unable to connect to the live team sheet')
    const contextResponse=await fetch(`/api/club-portal/coach-app/context?clubId=${encodeURIComponent(clubId)}`,{headers,cache:'no-store'})
    const contextPayload=await contextResponse.json().catch(()=>({}))
    const id=contextPayload.data?.teamSheet?.id as string|undefined
    if(!contextResponse.ok||!id)throw new Error(contextPayload.error||'The live team sheet could not be found')
    setResolvedSheetId(id)
    return id
  }

  async function load(silent=false){
    if(!silent)setLoading(true)
    try{
      const activeSheetId=await resolveSheet()
      const endpoint=`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(activeSheetId)}`
      const response=await fetch(endpoint,{headers,cache:'no-store'})
      const payload=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(payload.error||'Unable to load live match stats')
      if(pendingRef.current.length===0&&!flushingRef.current)applyState(payload.data?.state||{quarter:1,teamStats:{...EMPTY_STATS}})
      setError('')
    }catch(value){if(!silent)setError(value instanceof Error?value.message:'Unable to load live match stats')}
    finally{if(!silent)setLoading(false)}
  }

  useEffect(()=>{setResolvedSheetId(sheetId||'');void load();const timer=window.setInterval(()=>void load(true),1000);return()=>window.clearInterval(timer)},[clubId,sheetId,fixtureId,token])
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[])

  async function flushChanges(){
    if(flushingRef.current||!online||pendingRef.current.length===0)return
    flushingRef.current=true;setSyncing(true)
    try{
      const activeSheetId=await resolveSheet()
      const endpoint=`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(activeSheetId)}`
      while(pendingRef.current.length){
        const batch=pendingRef.current.splice(0,pendingRef.current.length)
        const latestResponse=await fetch(endpoint,{headers,cache:'no-store'})
        const latestPayload=await latestResponse.json().catch(()=>({}))
        if(!latestResponse.ok)throw new Error(latestPayload.error||'Unable to refresh live match')
        const latest=(latestPayload.data?.state||stateRef.current||{quarter:1}) as MatchState
        const nextStats={...EMPTY_STATS,...(latest.teamStats||{})}
        for(const change of batch)nextStats[change.key]=Math.max(0,nextStats[change.key]+change.delta)
        const nextState={...latest,teamStats:nextStats}
        const response=await fetch(endpoint,{method:'PUT',headers:jsonHeaders,body:JSON.stringify({state:nextState})})
        const payload=await response.json().catch(()=>({}))
        if(!response.ok)throw new Error(payload.error||'Unable to save stat')
        if(pendingRef.current.length===0)applyState(nextState)
      }
      setError('')
    }catch(value){setError(value instanceof Error?value.message:'Unable to save stat')}
    finally{
      flushingRef.current=false;setSyncing(false)
      if(pendingRef.current.length&&online)void flushChanges()
    }
  }

  function changeStat(key:StatKey,delta:number){
    if(!online)return
    const current=stateRef.current||state||{quarter:1,teamStats:{...EMPTY_STATS}}
    const currentStats={...EMPTY_STATS,...(current.teamStats||{})}
    if(delta<0&&currentStats[key]===0)return
    const optimistic={...current,teamStats:{...currentStats,[key]:Math.max(0,currentStats[key]+delta)}}
    pendingRef.current.push({key,delta})
    applyState(optimistic)
    setError('')
    void flushChanges()
  }

  const stats={...EMPTY_STATS,...(state?.teamStats||{})}
  if(loading)return <main className="cast-state"><style>{styles}</style><RefreshCw className="spin"/><strong>Opening live stats…</strong></main>
  return <main className="cast"><style>{styles}</style>
    <header><div><span>Live match recorder</span><h1>Stats</h1><p>Tap as quickly as the game happens. Updates sync in the background.</p></div><div className={online?'online':'offline'}>{online?<Wifi/>:<WifiOff/>}{online?'Live':'Offline'}</div></header>
    <section className="cast-quarter"><span>Current quarter</span><strong>Q{state?.quarter||1}</strong><small>{syncing?'Syncing live…':'Ready for rapid entry'}</small></section>
    {error&&<div className="cast-error">{error}</div>}
    <section className="cast-grid">{STATS.map(item=><article key={item.key}>
      <div><small>{item.short}</small><strong>{item.label}</strong><b>{stats[item.key]}</b></div>
      <button className="add" disabled={!online} onClick={()=>changeStat(item.key,1)} aria-label={`Add ${item.label}`}><Plus/><span>Add one</span></button>
      <button className="remove" disabled={!online||stats[item.key]===0} onClick={()=>changeStat(item.key,-1)} aria-label={`Remove ${item.label}`}><Minus/></button>
    </article>)}</section>
    <footer><button onClick={onExit}>Return to Coach Tools</button><span><Check/> {syncing?'Syncing':'Auto-saved live'}</span></footer>
  </main>
}

const styles=`
.cast{min-height:calc(100vh - 76px);padding:16px 16px 92px;background:#07121b;color:#fff;font-family:Barlow,Inter,Arial,sans-serif}.cast *{box-sizing:border-box}.cast>header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;max-width:780px;margin:0 auto 14px}.cast header span{color:#38bfff;font-size:11px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.cast h1{margin:3px 0 2px;font-family:'Bebas Neue',Impact,sans-serif;font-size:54px;line-height:.9;text-transform:uppercase}.cast header p{margin:7px 0 0;color:#9fb0bb}.cast header>div:last-child{display:flex;align-items:center;gap:6px;padding:8px 11px;border-radius:999px;font-size:11px;font-weight:950;text-transform:uppercase}.cast header .online{background:#0d5038;color:#72f2b6}.cast header .offline{background:#6a1d28;color:#ffc5cc}.cast header svg{width:15px}.cast-quarter{max-width:780px;margin:0 auto 12px;display:grid;grid-template-columns:1fr auto;align-items:center;padding:12px 14px;border:1px solid #294252;border-radius:13px;background:#0d1e2a}.cast-quarter span{color:#a9b8c1;font-size:10px;font-weight:900;text-transform:uppercase}.cast-quarter strong{grid-row:1/3;grid-column:2;font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;color:#39cfff}.cast-quarter small{color:#55dd9a;font-weight:850}.cast-error{max-width:780px;margin:0 auto 12px;padding:11px;border:1px solid #ff4052;border-radius:10px;background:#621927;color:#fff}.cast-grid{max-width:780px;margin:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cast-grid article{position:relative;display:grid;grid-template-columns:1fr 54px;grid-template-rows:1fr 38px;min-height:150px;overflow:hidden;border:1px solid #294454;border-radius:15px;background:#0d1f2b}.cast-grid article>div{grid-column:1/3;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;padding:12px}.cast-grid small{display:grid;place-items:center;min-width:38px;height:30px;border-radius:8px;background:#173445;color:#3fc9ff;font-weight:1000}.cast-grid article strong{font-size:16px;text-transform:uppercase}.cast-grid article b{font-family:'Bebas Neue',Impact,sans-serif;font-size:48px;line-height:1}.cast-grid button{border:0;color:#fff;font-weight:950;text-transform:uppercase;touch-action:manipulation}.cast-grid button:active{transform:scale(.95)}.cast-grid button:disabled{opacity:.35}.cast-grid .add{display:flex;align-items:center;justify-content:center;gap:7px;background:#12b86d}.cast-grid .remove{display:grid;place-items:center;background:#263c49}.cast-grid button svg{width:21px}.cast footer{position:fixed;z-index:1000;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px max(10px,env(safe-area-inset-bottom));border-top:1px solid #263d4b;background:rgba(7,18,27,.97)}.cast footer button{min-height:42px;border:1px solid #355064;border-radius:10px;background:#102633;padding:0 15px;color:#fff;font-weight:950;text-transform:uppercase}.cast footer span{display:flex;align-items:center;gap:5px;color:#66e6a7;font-size:11px;font-weight:900}.cast footer svg{width:15px}.cast-state{min-height:65vh;display:grid;place-items:center;align-content:center;gap:12px;background:#07121b;color:#fff}.spin{animation:cast-spin 1s linear infinite}@keyframes cast-spin{to{transform:rotate(360deg)}}
@media(max-width:600px){.cast{padding:12px 10px 88px}.cast h1{font-size:46px}.cast header p{font-size:13px}.cast-grid{grid-template-columns:1fr}.cast-grid article{min-height:132px}.cast-grid article b{font-size:44px}}
`
