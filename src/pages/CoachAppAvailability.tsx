import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, CircleHelp, LogOut, MessageCircle, RefreshCw, Search, X } from 'lucide-react'

type Status='AVAILABLE'|'UNAVAILABLE'|'UNSURE'|'TEST'|'UNLIKELY'|null
type Player={id:string;playerName:string;jumperNumber:number|null;status:Status;reason:string|null;note:string|null;respondedAt:string|null;hasInvite:boolean}
type Sheet={id:string;roundLabel:string;opponentName:string|null;matchDate:string|null;availabilityLocked:boolean}
type Payload={sheets:Sheet[];selectedSheetId:string|null;players:Player[]}
type Props={clubId:string;sheetId:string;token:string;onContinue:()=>void;onExit:()=>void}

const reasons=[['INJURY','Injured'],['ILLNESS','Sick'],['WORK','Work'],['HOLIDAY','Away'],['FAMILY','Family'],['SUSPENSION','Suspended'],['OTHER','Other']] as const
const label=(status:Status)=>status==='AVAILABLE'?'Available':status==='UNAVAILABLE'?'Unavailable':status==='UNSURE'?'Unsure':status==='TEST'?'Test':status==='UNLIKELY'?'Unlikely':'No response'

export default function CoachAppAvailability({clubId,sheetId,token,onContinue,onExit}:Props){
  const[data,setData]=useState<Payload|null>(null)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState('')
  const[sharing,setSharing]=useState('')
  const[reasonFor,setReasonFor]=useState('')
  const[filter,setFilter]=useState<'ALL'|'NO_RESPONSE'|'UNAVAILABLE'>('ALL')
  const[search,setSearch]=useState('')
  const[error,setError]=useState('')
  const[message,setMessage]=useState('')
  const headers=useMemo(()=>({authorization:`Bearer ${token}`}),[token])
  const jsonHeaders=useMemo(()=>({...headers,'content-type':'application/json'}),[headers])

  async function load(){
    setLoading(true);setError('')
    try{
      const response=await fetch(`/api/club-portal/player-availability/clubs/${encodeURIComponent(clubId)}/overview?sheetId=${encodeURIComponent(sheetId)}`,{headers})
      const payload=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(payload.error||'Unable to load player availability')
      setData(payload.data)
    }catch(value){setError(value instanceof Error?value.message:'Unable to load player availability')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[clubId,sheetId,headers])

  async function setStatus(player:Player,status:Exclude<Status,null>,reason:string|null=null){
    setSaving(player.id);setError('');setMessage('')
    try{
      const response=await fetch(`/api/club-portal/player-availability/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}/players/${encodeURIComponent(player.id)}/override`,{method:'PUT',headers:jsonHeaders,body:JSON.stringify({status,reason,note:null,injuryGrade:reason==='INJURY'?'MEDIUM':null,overrideReason:'Updated in PlayFooty Coach app'})})
      const payload=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(payload.error||'Unable to update availability')
      setData(current=>current?{...current,players:current.players.map(item=>item.id===player.id?{...item,status,reason,respondedAt:new Date().toISOString()}:item)}:current)
      setReasonFor('')
      setMessage(`${player.playerName} marked ${label(status).toLowerCase()}.`)
    }catch(value){setError(value instanceof Error?value.message:'Unable to update availability')}
    finally{setSaving('')}
  }

  async function share(player:Player){
    setSharing(player.id);setError('');setMessage('')
    try{
      const response=await fetch(`/api/club-portal/player-availability/clubs/${encodeURIComponent(clubId)}/players/${encodeURIComponent(player.id)}/invite`,{method:'POST',headers:jsonHeaders})
      const payload=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(payload.error||'Unable to create availability link')
      const url=new URL(payload.data.invitePath,window.location.origin).toString()
      const sheet=data?.sheets.find(item=>item.id===sheetId)
      const text=`Hey ${player.playerName}, can you confirm your availability for ${sheet?.roundLabel||'this round'}${sheet?.opponentName?` v ${sheet.opponentName}`:''}? ${url}`
      if(navigator.share){await navigator.share({title:'Player availability',text})}
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer')
      setMessage(`Availability request ready for ${player.playerName}.`)
    }catch(value){if(value instanceof Error&&value.name!=='AbortError')setError(value.message||'Unable to share availability request')}
    finally{setSharing('')}
  }

  const players=data?.players??[]
  const counts={available:players.filter(player=>player.status==='AVAILABLE').length,unavailable:players.filter(player=>player.status==='UNAVAILABLE').length,waiting:players.filter(player=>!player.status).length}
  const shown=players.filter(player=>{
    if(filter==='NO_RESPONSE'&&player.status)return false
    if(filter==='UNAVAILABLE'&&player.status!=='UNAVAILABLE')return false
    return player.playerName.toLowerCase().includes(search.trim().toLowerCase())
  })
  const sheet=data?.sheets.find(item=>item.id===sheetId)

  if(loading)return <section className="caa-state"><RefreshCw className="spin"/><b>Loading availability…</b><style>{styles}</style></section>
  return <section className="caa-root">
    <div className="caa-summary">
      <div><span>This week</span><h1>Player Availability</h1><p>{sheet?.roundLabel||'Current round'}{sheet?.opponentName?` · v ${sheet.opponentName}`:''}</p></div>
      <div className="caa-counts"><button onClick={()=>setFilter('ALL')}><b>{counts.available}</b><span>Available</span></button><button onClick={()=>setFilter('UNAVAILABLE')}><b>{counts.unavailable}</b><span>Unavailable</span></button><button onClick={()=>setFilter('NO_RESPONSE')}><b>{counts.waiting}</b><span>Waiting</span></button></div>
    </div>
    {message&&<div className="caa-message ok"><Check/> {message}</div>}
    {error&&<div className="caa-message error"><X/> {error}</div>}
    <div className="caa-toolbar"><div className="caa-tabs"><button className={filter==='ALL'?'active':''} onClick={()=>setFilter('ALL')}>All</button><button className={filter==='NO_RESPONSE'?'active':''} onClick={()=>setFilter('NO_RESPONSE')}>Waiting</button><button className={filter==='UNAVAILABLE'?'active':''} onClick={()=>setFilter('UNAVAILABLE')}>Unavailable</button></div><label><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Find player"/></label></div>
    <div className="caa-list">{shown.map(player=>{
      const busy=saving===player.id
      return <article key={player.id} className={`caa-player ${player.status?.toLowerCase()||'waiting'}`}>
        <div className="caa-number">{player.jumperNumber??'—'}</div>
        <div className="caa-name"><b>{player.playerName}</b><span>{label(player.status)}{player.reason?` · ${reasons.find(item=>item[0]===player.reason)?.[1]||player.reason}`:''}</span></div>
        <div className="caa-actions">
          <button className={player.status==='AVAILABLE'?'selected available':''} disabled={busy} onClick={()=>void setStatus(player,'AVAILABLE')}><Check/>Available</button>
          <button className={player.status==='UNSURE'?'selected unsure':''} disabled={busy} onClick={()=>void setStatus(player,'UNSURE')}><CircleHelp/>Unsure</button>
          <button className={player.status==='UNAVAILABLE'?'selected unavailable':''} disabled={busy} onClick={()=>setReasonFor(reasonFor===player.id?'':player.id)}><X/>Unavailable</button>
          <button className="share" disabled={sharing===player.id} onClick={()=>void share(player)}><MessageCircle/>{sharing===player.id?'Opening…':'WhatsApp'}</button>
        </div>
        {reasonFor===player.id&&<div className="caa-reasons"><span>Why unavailable?</span>{reasons.map(([value,text])=><button key={value} disabled={busy} onClick={()=>void setStatus(player,'UNAVAILABLE',value)}>{text}</button>)}</div>}
      </article>
    })}{!shown.length&&<div className="caa-empty">No players in this view.</div>}</div>
    <nav className="caa-footer"><button className="quiet" onClick={onExit}><LogOut/>Save and Exit</button><button className="primary" onClick={onContinue}>Continue to Select Team <ChevronRight/></button></nav>
    <style>{styles}</style>
  </section>
}

const styles=`
.caa-root{min-height:calc(100vh - 74px);box-sizing:border-box;padding:18px max(16px,env(safe-area-inset-right)) 100px max(16px,env(safe-area-inset-left));background:#eef3f7;color:#101820;font-family:Barlow,Inter,Arial,sans-serif}.caa-state{min-height:65vh;display:grid;place-content:center;justify-items:center;gap:12px;background:#eef3f7}.caa-state svg{color:#22aef3}.spin{animation:caa-spin 1s linear infinite}@keyframes caa-spin{to{transform:rotate(360deg)}}.caa-summary{max-width:1180px;margin:auto;display:grid;grid-template-columns:1fr auto;align-items:end;gap:20px;padding:22px 24px;border-radius:20px;background:linear-gradient(125deg,#07121b,#12334a);color:#fff;box-shadow:0 16px 38px rgba(7,18,27,.18)}.caa-summary>div>span{color:#39b8ff;font-size:10px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.caa-summary h1{margin:4px 0 5px;font-family:'Bebas Neue',Impact,sans-serif;font-size:48px;line-height:.95;text-transform:uppercase}.caa-summary p{margin:0;color:#afc0cc}.caa-counts{display:grid;grid-template-columns:repeat(3,96px);gap:8px}.caa-counts button{border:1px solid #29475a;border-radius:13px;background:#102635;padding:11px;color:#fff}.caa-counts b,.caa-counts span{display:block}.caa-counts b{font-family:'Bebas Neue',Impact,sans-serif;font-size:30px}.caa-counts span{color:#a8bbc7;font-size:9px;font-weight:900;text-transform:uppercase}.caa-message{max-width:1180px;box-sizing:border-box;margin:10px auto 0;display:flex;align-items:center;gap:8px;padding:11px 13px;border-radius:10px;font-weight:850}.caa-message svg{width:18px}.caa-message.ok{background:#dcf7e8;color:#12613a}.caa-message.error{background:#ffe3e3;color:#9c1c25}.caa-toolbar{max-width:1180px;margin:12px auto;display:grid;grid-template-columns:auto minmax(180px,300px);gap:10px}.caa-tabs{display:flex;padding:4px;border-radius:11px;background:#dce5eb}.caa-tabs button{border:0;border-radius:8px;background:transparent;padding:10px 15px;font-weight:900}.caa-tabs button.active{background:#fff;box-shadow:0 3px 10px rgba(15,23,42,.08)}.caa-toolbar label{display:flex;align-items:center;gap:7px;border:1px solid #d0dae1;border-radius:11px;background:#fff;padding:0 11px}.caa-toolbar label svg{width:17px;color:#748591}.caa-toolbar input{width:100%;border:0;outline:0;padding:11px 0;font:inherit}.caa-list{max-width:1180px;margin:auto;display:grid;gap:8px}.caa-player{display:grid;grid-template-columns:46px minmax(150px,1fr) auto;align-items:center;gap:11px;padding:10px 12px;border:1px solid #d8e1e7;border-left:5px solid #9aaab5;border-radius:13px;background:#fff;box-shadow:0 5px 16px rgba(15,23,42,.045)}.caa-player.available{border-left-color:#20bd70}.caa-player.unavailable{border-left-color:#e0414b;background:linear-gradient(90deg,#fff3f3,#fff 28%)}.caa-player.unsure,.caa-player.test,.caa-player.unlikely{border-left-color:#e2a52b}.caa-number{width:40px;height:40px;display:grid;place-items:center;border-radius:10px;background:#0d1b26;color:#fff;font-weight:950}.caa-name b,.caa-name span{display:block}.caa-name b{font-size:14px}.caa-name span{margin-top:3px;color:#72828e;font-size:10px;font-weight:850;text-transform:uppercase}.caa-actions{display:flex;gap:6px}.caa-actions button{display:inline-flex;align-items:center;gap:5px;min-height:39px;border:1px solid #d4dde3;border-radius:9px;background:#f7fafb;padding:8px 10px;color:#42515c;font-size:10px;font-weight:950;text-transform:uppercase}.caa-actions svg{width:15px}.caa-actions button.selected.available{border-color:#20bd70;background:#dcf7e8;color:#12613a}.caa-actions button.selected.unsure{border-color:#e1a12a;background:#fff2d8;color:#8a5700}.caa-actions button.selected.unavailable{border-color:#df414b;background:#ffe3e3;color:#9c1c25}.caa-actions button.share{border-color:#27aa61;background:#e2f8eb;color:#12613a}.caa-actions button:disabled{opacity:.55}.caa-reasons{grid-column:2/-1;display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding-top:9px;border-top:1px solid #e6ecef}.caa-reasons span{margin-right:4px;color:#6d7d88;font-size:9px;font-weight:950;text-transform:uppercase}.caa-reasons button{border:1px solid #efb1b5;border-radius:999px;background:#fff5f5;padding:7px 10px;color:#9c1c25;font-size:9px;font-weight:950}.caa-empty{padding:38px;border:1px dashed #c6d2da;border-radius:14px;background:#fff;text-align:center;color:#71818c;font-weight:850}.caa-footer{position:fixed;z-index:1250;right:0;bottom:0;left:0;display:flex;justify-content:flex-end;gap:10px;padding:10px max(16px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));border-top:1px solid #d1dce3;background:rgba(255,255,255,.96);backdrop-filter:blur(14px)}.caa-footer button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:45px;border:1px solid #ced9df;border-radius:10px;background:#fff;padding:10px 15px;font-weight:950;text-transform:uppercase}.caa-footer svg{width:17px}.caa-footer .quiet{margin-right:auto}.caa-footer .primary{border-color:#22c77a;background:#22c77a;color:#07121b}
@media(max-width:850px){.caa-summary{grid-template-columns:1fr}.caa-counts{grid-template-columns:repeat(3,1fr)}.caa-player{grid-template-columns:42px 1fr}.caa-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr)}.caa-actions button{justify-content:center}.caa-reasons{grid-column:1/-1}}@media(max-width:580px){.caa-root{padding-left:8px;padding-right:8px;padding-bottom:154px}.caa-summary{padding:18px}.caa-summary h1{font-size:39px}.caa-toolbar{grid-template-columns:1fr}.caa-actions{grid-template-columns:1fr 1fr}.caa-player{padding:9px}.caa-footer{display:grid;grid-template-columns:1fr}.caa-footer .quiet{margin:0}.caa-footer button{width:100%}}
`