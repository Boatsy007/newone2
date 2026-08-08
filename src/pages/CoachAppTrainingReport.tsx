import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, ClipboardCheck, Dumbbell, Save, ShieldAlert, Star, ThumbsDown, ThumbsUp, UserMinus, Users, X } from 'lucide-react'
import CoachAppLoading from '../components/CoachAppLoading'

type Status='ATTENDED'|'LATE'|'MODIFIED'|'EXCUSED'|'ABSENT'|'INJURED'
type Performance='STANDOUT'|'SOLID'|'NEEDS_WORK'|'NOT_RATED'
type DrillResult='WORKED'|'MIXED'|'DIDNT_WORK'|'NOT_RATED'
type Player={id:string;playerName:string;jumperNumber:number|null;active:boolean}
type Session={id:string;title:string;sessionDate:string;startTime:string|null;notes:string|null;finishedAt:string|null;overallRating?:number|null;whatWorked?:string|null;whatToImprove?:string|null;injurySummary?:string|null;reportCompletedAt?:string|null}
type Attendance={sessionId:string;clubPlayerId:string;status:Status;note:string|null;leftEarly:boolean;missedPercentage:number|null;earlyReason:string|null;performance?:Performance|null;injuryDetail?:string|null}
type Plan={id:string;planDate:string;title:string}
type PlanItem={id:string;planId?:string;title:string;sortOrder:number}
type DrillFeedback={trainingPlanItemId:string|null;drillTitle:string;result:DrillResult;note:string;sortOrder:number}
type PlayerEntry={clubPlayerId:string;status:Status;performance:Performance;note:string;injuryDetail:string;leftEarly:boolean;missedPercentage:number|null;earlyReason:string}

type Props={clubId:string;token:string;sessionNumber:1|2;fixtureDate?:string|null;onExit:()=>void;onContinue:()=>void}

const performanceGroups:Array<{key:Performance;label:string;help:string;icon:typeof Star}>=[
 {key:'STANDOUT',label:'Trained well',help:'Strong session',icon:Star},
 {key:'SOLID',label:'Solid',help:'Did the job',icon:ThumbsUp},
 {key:'NEEDS_WORK',label:'Needs work',help:'Follow up required',icon:ThumbsDown},
 {key:'NOT_RATED',label:'Not rated',help:'Absent, modified or not assessed',icon:UserMinus},
]
const drillGroups:Array<{key:DrillResult;label:string}>=[{key:'WORKED',label:'Worked'},{key:'MIXED',label:'Mixed'},{key:'DIDNT_WORK',label:"Didn't work"},{key:'NOT_RATED',label:'Not rated'}]

function isoDate(value:Date){return value.toISOString().slice(0,10)}
function trainingDate(fixtureDate:string|null|undefined,sessionNumber:1|2){
 const base=fixtureDate?new Date(fixtureDate):new Date()
 if(Number.isNaN(base.getTime()))return isoDate(new Date())
 const days=sessionNumber===1?5:2
 base.setDate(base.getDate()-days)
 return isoDate(base)
}
function dateLabel(value:string){const date=new Date(`${value}T12:00:00`);return Number.isNaN(date.getTime())?value:date.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'})}

export default function CoachAppTrainingReport({clubId,token,sessionNumber,fixtureDate,onExit,onContinue}:Props){
 const headers=useMemo<Record<string,string>>(()=>({authorization:`Bearer ${token}`}),[token])
 const expectedDate=useMemo(()=>trainingDate(fixtureDate,sessionNumber),[fixtureDate,sessionNumber])
 const[players,setPlayers]=useState<Player[]>([])
 const[sessions,setSessions]=useState<Session[]>([])
 const[sessionId,setSessionId]=useState('')
 const[date,setDate]=useState(expectedDate)
 const[entries,setEntries]=useState<Record<string,PlayerEntry>>({})
 const[drills,setDrills]=useState<DrillFeedback[]>([])
 const[overallRating,setOverallRating]=useState(3)
 const[whatWorked,setWhatWorked]=useState('')
 const[whatToImprove,setWhatToImprove]=useState('')
 const[injurySummary,setInjurySummary]=useState('')
 const[selectedPlayer,setSelectedPlayer]=useState('')
 const[dragPlayer,setDragPlayer]=useState('')
 const playerPointerDrag=useRef<{id:string;pointerId:number;startX:number;startY:number;dragging:boolean}|null>(null)
 const[dragDrill,setDragDrill]=useState<number|null>(null)
 const[openPlayer,setOpenPlayer]=useState('')
 const[loading,setLoading]=useState(true)
 const[saving,setSaving]=useState(false)
 const[message,setMessage]=useState('')
 const[error,setError]=useState('')

 function seedEntries(sourcePlayers:Player[],attendance:Attendance[],activeSessionId:string){
  const next:Record<string,PlayerEntry>={}
  for(const player of sourcePlayers){
   const saved=attendance.find(item=>item.sessionId===activeSessionId&&item.clubPlayerId===player.id)
   const status=saved?.status??'ATTENDED'
   next[player.id]={clubPlayerId:player.id,status,performance:saved?.performance??(status==='ATTENDED'?'SOLID':'NOT_RATED'),note:saved?.note??'',injuryDetail:saved?.injuryDetail??'',leftEarly:saved?.leftEarly??false,missedPercentage:saved?.missedPercentage??null,earlyReason:saved?.earlyReason??''}
  }
  setEntries(next)
 }

 async function load(preferredDate=date){
  setLoading(true);setError('')
  try{
   const [attendanceResponse,plansResponse]=await Promise.all([
    fetch(`/api/club-portal/training-attendance/clubs/${encodeURIComponent(clubId)}`,{headers}),
    fetch(`/api/club-portal/training-plans/clubs/${encodeURIComponent(clubId)}`,{headers}),
   ])
   const attendancePayload=await attendanceResponse.json().catch(()=>({}))
   const plansPayload=await plansResponse.json().catch(()=>({}))
   if(!attendanceResponse.ok)throw new Error(attendancePayload.error||'Unable to load training report')
   if(!plansResponse.ok)throw new Error(plansPayload.error||'Unable to load training plan')
   const nextPlayers:Player[]=Array.isArray(attendancePayload.data?.players)?attendancePayload.data.players:[]
   const nextSessions:Session[]=Array.isArray(attendancePayload.data?.sessions)?attendancePayload.data.sessions:[]
   const attendance:Attendance[]=Array.isArray(attendancePayload.data?.attendance)?attendancePayload.data.attendance:[]
   let active=nextSessions.find(item=>item.sessionDate===preferredDate)
   if(!active){
    const plan=(Array.isArray(plansPayload.data?.plans)?plansPayload.data.plans:[] as Plan[]).find((item:Plan)=>item.planDate===preferredDate)
    const createdResponse=await fetch(`/api/club-portal/training-attendance/clubs/${encodeURIComponent(clubId)}/sessions`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({sessionDate:preferredDate,title:plan?.title||`Training Session ${sessionNumber}`})})
    const createdPayload=await createdResponse.json().catch(()=>({}))
    if(!createdResponse.ok)throw new Error(createdPayload.error||'Unable to open training report')
    active=createdPayload.data as Session
    nextSessions.unshift(active)
   }
   const plans:Plan[]=Array.isArray(plansPayload.data?.plans)?plansPayload.data.plans:[]
   const items:PlanItem[]=Array.isArray(plansPayload.data?.items)?plansPayload.data.items:[]
   const plan=plans.find(item=>item.planDate===preferredDate)
   const reportFeedback:DrillFeedback[]=Array.isArray(attendancePayload.data?.drillFeedback)?attendancePayload.data.drillFeedback.filter((item:any)=>item.sessionId===active!.id):[]
   const planDrills=plan?items.filter(item=>item.planId===plan.id).sort((a,b)=>a.sortOrder-b.sortOrder):[]
   const nextDrills=planDrills.map((item,index)=>{const saved=reportFeedback.find(feedback=>feedback.trainingPlanItemId===item.id||feedback.drillTitle===item.title);return{trainingPlanItemId:item.id,drillTitle:item.title,result:saved?.result??'NOT_RATED',note:saved?.note??'',sortOrder:index}})
   setPlayers(nextPlayers);setSessions(nextSessions);setSessionId(active.id);setDate(preferredDate)
   seedEntries(nextPlayers,attendance,active.id)
   setDrills(nextDrills)
   setOverallRating(active.overallRating??3);setWhatWorked(active.whatWorked??'');setWhatToImprove(active.whatToImprove??'');setInjurySummary(active.injurySummary??'')
  }catch(value){setError(value instanceof Error?value.message:'Unable to load training report')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load(expectedDate)},[clubId,expectedDate])

 function patchPlayer(id:string,patch:Partial<PlayerEntry>){setEntries(current=>({...current,[id]:{...current[id]!,...patch}}))}
 function movePlayer(id:string,performance:Performance){
  const current=entries[id];if(!current)return
  let status=current.status
  if(performance==='NOT_RATED'&&status==='ATTENDED')status='ABSENT'
  if(performance!=='NOT_RATED'&&['ABSENT','EXCUSED','INJURED'].includes(status))status='ATTENDED'
  patchPlayer(id,{performance,status})
  setSelectedPlayer('')
 }
 function dropPlayer(performance:Performance,idOverride=''){const id=idOverride||dragPlayer||selectedPlayer;if(id)movePlayer(id,performance);setDragPlayer('')}
 function startPlayerPointer(event:any,id:string){
  if(event.pointerType==='mouse')return
  playerPointerDrag.current={id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,dragging:false}
  event.currentTarget.setPointerCapture?.(event.pointerId)
 }
 function movePlayerPointer(event:any){
  const active=playerPointerDrag.current
  if(!active||active.pointerId!==event.pointerId)return
  if(!active.dragging&&Math.hypot(event.clientX-active.startX,event.clientY-active.startY)>8){active.dragging=true;setDragPlayer(active.id)}
  if(active.dragging)event.preventDefault()
 }
 function finishPlayerPointer(event:any){
  const active=playerPointerDrag.current
  if(!active||active.pointerId!==event.pointerId)return
  if(active.dragging){
   event.preventDefault()
   const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-performance-group]') as HTMLElement|null
   const performance=target?.dataset.performanceGroup as Performance|undefined
   if(performance)dropPlayer(performance,active.id)
  }
  event.currentTarget.releasePointerCapture?.(event.pointerId)
  playerPointerDrag.current=null
  setDragPlayer('')
 }
 function cancelPlayerPointer(){playerPointerDrag.current=null;setDragPlayer('')}
 function setAttendance(id:string,status:Status){patchPlayer(id,{status,performance:['ABSENT','EXCUSED','INJURED'].includes(status)?'NOT_RATED':entries[id]?.performance==='NOT_RATED'?'SOLID':entries[id]?.performance??'SOLID'});if(status==='INJURED')setOpenPlayer(id)}
 function setDrillResult(index:number,result:DrillResult){setDrills(current=>current.map((item,i)=>i===index?{...item,result}:item));setDragDrill(null)}

 async function saveReport(complete=false){
  if(!sessionId)return false
  setSaving(true);setError('');setMessage('')
  try{
   const response=await fetch(`/api/club-portal/training-attendance/clubs/${encodeURIComponent(clubId)}/sessions/${encodeURIComponent(sessionId)}/report`,{method:'PUT',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({overallRating,whatWorked,whatToImprove,injurySummary,complete,entries:Object.values(entries),drills})})
   const payload=await response.json().catch(()=>({}))
   if(!response.ok)throw new Error(payload.error||'Unable to save training report')
   setMessage(complete?'Training report completed.':'Training report saved.')
   return true
  }catch(value){setError(value instanceof Error?value.message:'Unable to save training report');return false}
  finally{setSaving(false)}
 }
 async function saveAndContinue(){if(await saveReport(true))onContinue()}

 const totals={attended:Object.values(entries).filter(item=>!['ABSENT','EXCUSED'].includes(item.status)).length,missed:Object.values(entries).filter(item=>['ABSENT','EXCUSED'].includes(item.status)).length,injured:Object.values(entries).filter(item=>item.status==='INJURED'||item.injuryDetail).length,standouts:Object.values(entries).filter(item=>item.performance==='STANDOUT').length}
 const activePlayer=players.find(player=>player.id===openPlayer)
 const activeEntry=openPlayer?entries[openPlayer]:undefined
 if(loading)return <CoachAppLoading message="Opening training report…"/>
 return <section className="catr"><style>{styles}</style>
  <header className="catr-hero"><div><span>Match Flow · Step {sessionNumber===1?'2':'5'}</span><h1>Training Report</h1><p>Session {sessionNumber} · {dateLabel(date)}</p></div><label>Date<input type="date" value={date} onChange={event=>void load(event.target.value)}/></label></header>
  {message&&<div className="catr-notice ok">{message}</div>}{error&&<div className="catr-notice error">{error}</div>}
  <section className="catr-totals"><article><Users/><b>{totals.attended}</b><span>trained</span></article><article><UserMinus/><b>{totals.missed}</b><span>missed</span></article><article><ShieldAlert/><b>{totals.injured}</b><span>injuries</span></article><article><Star/><b>{totals.standouts}</b><span>stood out</span></article></section>
  <section className="catr-card"><div className="catr-heading"><div><span>Drag or tap</span><h2>How did everyone train?</h2></div><button onClick={()=>{const next:Record<string,PlayerEntry>={};for(const player of players)next[player.id]={...entries[player.id]!,status:'ATTENDED',performance:'SOLID'};setEntries(next)}}><Check/>Mark all solid</button></div>
   <div className="catr-groups">{performanceGroups.map(group=>{const Icon=group.icon;const groupPlayers=players.filter(player=>entries[player.id]?.performance===group.key);return <section key={group.key} data-performance-group={group.key} className={`catr-group ${group.key.toLowerCase()} ${dragPlayer?'drop-ready':''}`} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move'}} onDrop={event=>{event.preventDefault();dropPlayer(group.key,event.dataTransfer.getData('text/player-id'))}} onClick={()=>{if(selectedPlayer)dropPlayer(group.key)}}><header><Icon/><div><h3>{group.label}</h3><small>{group.help}</small></div><b>{groupPlayers.length}</b></header><div>{groupPlayers.map(player=>{const entry=entries[player.id]!;return <button key={player.id} draggable onDragStart={event=>{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/player-id',player.id);setDragPlayer(player.id)}} onDragEnd={()=>setDragPlayer('')} onPointerDown={event=>startPlayerPointer(event,player.id)} onPointerMove={movePlayerPointer} onPointerUp={finishPlayerPointer} onPointerCancel={cancelPlayerPointer} onClick={event=>{event.stopPropagation();if(playerPointerDrag.current?.dragging)return;setSelectedPlayer(current=>current===player.id?'':player.id)}} className={`${selectedPlayer===player.id?'selected':''} ${dragPlayer===player.id?'dragging':''} ${entry.status==='INJURED'?'injured':''}`}><i>{player.jumperNumber??'–'}</i><span><strong>{player.playerName}</strong><small>{entry.status.replace('_',' ')}{entry.injuryDetail?` · ${entry.injuryDetail}`:''}</small></span><em onClick={event=>{event.stopPropagation();setOpenPlayer(player.id)}}>Edit</em></button>})}</div></section>})}</div>
  </section>
  <section className="catr-card"><div className="catr-heading"><div><span>Training plan review</span><h2>What drills worked?</h2></div><small>{drills.length} drills</small></div>{drills.length?<div className="catr-drill-board">{drillGroups.map(group=><section key={group.key} onDragOver={event=>event.preventDefault()} onDrop={()=>{if(dragDrill!==null)setDrillResult(dragDrill,group.key)}}><header><h3>{group.label}</h3><b>{drills.filter(item=>item.result===group.key).length}</b></header>{drills.map((drill,index)=>drill.result===group.key?<article key={`${drill.trainingPlanItemId}-${index}`} draggable onDragStart={()=>setDragDrill(index)}><Dumbbell/><div><strong>{drill.drillTitle}</strong><textarea value={drill.note} onChange={event=>setDrills(current=>current.map((item,i)=>i===index?{...item,note:event.target.value}:item))} placeholder="Quick note (optional)"/></div><div className="catr-drill-actions"><button onClick={()=>setDrillResult(index,'WORKED')}>Worked</button><button onClick={()=>setDrillResult(index,'MIXED')}>Mixed</button><button onClick={()=>setDrillResult(index,'DIDNT_WORK')}>No</button></div></article>:null)}</section>)}</div>:<div className="catr-empty"><Dumbbell/><h3>No drills found</h3><p>Save the training plan for this date and its drills will appear here.</p></div>}</section>
  <section className="catr-card catr-overall"><div className="catr-heading"><div><span>Finish in a minute</span><h2>Overall session</h2></div></div><div className="catr-rating"><span>Session rating</span>{[1,2,3,4,5].map(value=><button key={value} className={overallRating===value?'active':''} onClick={()=>setOverallRating(value)}>{value}</button>)}</div><div className="catr-review-fields"><label>What worked<textarea value={whatWorked} onChange={event=>setWhatWorked(event.target.value)} placeholder="What should we keep?"/></label><label>What needs work<textarea value={whatToImprove} onChange={event=>setWhatToImprove(event.target.value)} placeholder="What changes next session?"/></label><label>Injury summary<textarea value={injurySummary} onChange={event=>setInjurySummary(event.target.value)} placeholder="Any follow-up for medical or selection?"/></label></div></section>
  {activePlayer&&activeEntry&&<div className="catr-modal" onClick={()=>setOpenPlayer('')}><section onClick={event=>event.stopPropagation()}><header><div><span>Player report</span><h2>{activePlayer.playerName}</h2></div><button onClick={()=>setOpenPlayer('')}><X/></button></header><label>Attendance<div className="catr-statuses">{(['ATTENDED','LATE','MODIFIED','EXCUSED','ABSENT','INJURED'] as Status[]).map(status=><button key={status} className={activeEntry.status===status?'active':''} onClick={()=>setAttendance(activePlayer.id,status)}>{status.replace('_',' ')}</button>)}</div></label><label>Performance<div className="catr-statuses performance">{performanceGroups.map(group=><button key={group.key} className={activeEntry.performance===group.key?'active':''} onClick={()=>movePlayer(activePlayer.id,group.key)}>{group.label}</button>)}</div></label>{activeEntry.status==='INJURED'&&<label>Injury details<textarea value={activeEntry.injuryDetail} onChange={event=>patchPlayer(activePlayer.id,{injuryDetail:event.target.value})} placeholder="What happened and what follow-up is needed?"/></label>}<label>Coach note<textarea value={activeEntry.note} onChange={event=>patchPlayer(activePlayer.id,{note:event.target.value})} placeholder="Optional player note"/></label><button className="catr-done" onClick={()=>setOpenPlayer('')}><Check/>Done</button></section></div>}
  <footer className="catr-footer"><button onClick={onExit}>Exit</button><button className="save" disabled={saving} onClick={()=>void saveReport(false)}><Save/>{saving?'Saving…':'Save Report'}</button><button className="continue" disabled={saving} onClick={()=>void saveAndContinue()}>Save & Continue</button></footer>
 </section>
}

const styles=`
.catr,.catr *{box-sizing:border-box}.catr{min-height:calc(100vh - 75px);padding:18px 18px 88px;background:#eef3f7;color:#111820;font-family:Barlow,Inter,Arial,sans-serif}.catr>*{max-width:1240px;margin-left:auto;margin-right:auto}.catr-hero{display:flex;align-items:end;justify-content:space-between;gap:20px;padding:20px;border-radius:18px;background:#07121b;color:#fff}.catr-hero span,.catr-heading span,.catr-modal header span{color:#39b8ff;font-size:10px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.catr h1,.catr h2,.catr h3{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.catr-hero h1{margin:4px 0 0;font-size:50px;line-height:.9}.catr-hero p{margin:8px 0 0;color:#aabac5}.catr-hero label{display:grid;gap:5px;color:#aabac5;font-size:9px;font-weight:900;text-transform:uppercase}.catr input,.catr textarea{width:100%;border:1px solid #cad7df;border-radius:9px;background:#fff;padding:10px;color:#111820;font:inherit}.catr-notice{margin-top:10px;padding:11px 14px;border-radius:11px;font-weight:850}.catr-notice.ok{background:#dcf7e8;color:#08733f}.catr-notice.error{background:#fee2e2;color:#9f1f2d}.catr-totals{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:10px}.catr-totals article{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:3px 10px;padding:13px;border:1px solid #d6e0e7;border-radius:14px;background:#fff}.catr-totals svg{grid-row:1/3;width:25px;color:#158fca}.catr-totals b{font:30px/1 'Bebas Neue',Impact,sans-serif}.catr-totals span{color:#72808a;font-size:9px;font-weight:900;text-transform:uppercase}.catr-card{margin-top:11px;padding:14px;border:1px solid #d5e0e7;border-radius:16px;background:#fff}.catr-heading{display:flex;align-items:center;justify-content:space-between;gap:15px}.catr-heading h2{margin:3px 0 0;font-size:30px}.catr-heading>button{display:flex;align-items:center;gap:6px;border:0;border-radius:10px;background:#102431;padding:10px 13px;color:#fff;font-weight:900}.catr-heading>button svg{width:17px}.catr-groups{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:11px}.catr-group{min-height:180px;padding:9px;border:1px solid #dbe4ea;border-radius:12px;background:#f7fafc}.catr-group>header{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px;padding:3px}.catr-group>header svg{width:20px}.catr-group h3{margin:0;font-size:20px}.catr-group header small{color:#788690}.catr-group header b{display:grid;place-items:center;width:25px;height:25px;border-radius:999px;background:#e3ebf0}.catr-group>div{display:grid;gap:6px;margin-top:8px}.catr-group.drop-ready{transition:border-color .15s,background .15s}.catr-group.drop-ready:hover{border-color:#39b8ff}.catr-group>div>button.dragging{opacity:.55;transform:scale(.98);box-shadow:0 0 0 3px rgba(57,184,255,.28)}
.catr-group>div>button{display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:7px;width:100%;border:1px solid #dce5ea;border-radius:9px;background:#fff;padding:7px;text-align:left}.catr-group>div>button.selected{outline:3px solid #35b8ff;transform:scale(.98)}.catr-group>div>button.injured{border-color:#ef4444;background:#fff1f1}.catr-group i{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#102431;color:#fff;font-style:normal;font-weight:950}.catr-group strong,.catr-group small{display:block}.catr-group small{margin-top:2px;color:#77858f;font-size:8px;text-transform:uppercase}.catr-group em{font-style:normal;color:#168fcb;font-size:10px;font-weight:900}.catr-group.standout{border-top:4px solid #16b96b}.catr-group.solid{border-top:4px solid #36a7e6}.catr-group.needs_work{border-top:4px solid #f59e0b}.catr-group.not_rated{border-top:4px solid #ef4444}.catr-drill-board{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.catr-drill-board>section{min-height:145px;padding:8px;border:1px solid #dbe4ea;border-radius:11px;background:#f7fafc}.catr-drill-board>section>header{display:flex;align-items:center;justify-content:space-between}.catr-drill-board h3{margin:0;font-size:19px}.catr-drill-board header b{display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:#e3ebf0}.catr-drill-board article{display:grid;grid-template-columns:auto 1fr;gap:7px;margin-top:7px;padding:8px;border:1px solid #dbe4ea;border-radius:9px;background:#fff}.catr-drill-board article>svg{width:18px;color:#168fcb}.catr-drill-board strong{display:block}.catr-drill-board textarea{min-height:48px;margin-top:5px;padding:7px;font-size:11px;resize:vertical}.catr-drill-actions{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:3px}.catr-drill-actions button{border:0;border-radius:6px;background:#e9f0f4;padding:6px 2px;font-size:8px;font-weight:900}.catr-empty{display:grid;justify-items:center;padding:30px;color:#6d7b85;text-align:center}.catr-empty svg{width:34px;height:34px}.catr-empty h3{margin:7px 0 0}.catr-rating{display:flex;align-items:center;gap:7px;margin-top:12px}.catr-rating>span{margin-right:8px;font-weight:900}.catr-rating button{width:43px;height:43px;border:1px solid #cad7df;border-radius:10px;background:#fff;font-weight:950}.catr-rating button.active{border-color:#14bd69;background:#18d579;color:#052414}.catr-review-fields{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:11px}.catr-review-fields label,.catr-modal label{display:grid;gap:5px;color:#667681;font-size:9px;font-weight:900;text-transform:uppercase}.catr-review-fields textarea{min-height:90px}.catr-footer{position:fixed;z-index:1200;right:0;bottom:0;left:0;display:flex;justify-content:flex-end;gap:8px;max-width:none;padding:9px max(18px,env(safe-area-inset-right)) max(9px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));border-top:1px solid #cad7df;background:rgba(255,255,255,.96);backdrop-filter:blur(12px)}.catr-footer button{min-height:43px;border:1px solid #cad7df;border-radius:10px;background:#fff;padding:0 16px;font-weight:950;text-transform:uppercase}.catr-footer .save{background:#102431;color:#fff}.catr-footer .continue{border-color:#12bd68;background:#18d579;color:#052414}.catr-footer svg{width:17px;vertical-align:middle;margin-right:5px}.catr-modal{position:fixed;z-index:1600;inset:0;display:grid;place-items:center;padding:20px;background:rgba(3,12,18,.72)}.catr-modal>section{width:min(560px,100%);max-height:90vh;overflow:auto;padding:18px;border-radius:17px;background:#fff}.catr-modal header{display:flex;justify-content:space-between;align-items:start}.catr-modal h2{margin:3px 0 12px;font-size:32px}.catr-modal header button{border:0;background:none}.catr-modal header svg{width:22px}.catr-statuses{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:12px}.catr-statuses button{min-height:38px;border:1px solid #d4dee5;border-radius:8px;background:#f7fafc;font-size:9px;font-weight:900}.catr-statuses button.active{border-color:#149fe9;background:#0e2a3a;color:#fff}.catr-modal textarea{min-height:75px;margin-bottom:12px}.catr-done{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:45px;border:0;border-radius:10px;background:#18d579;font-weight:950}.catr-done svg{width:18px}.catr-state{min-height:60vh;display:grid;place-items:center;align-content:center;gap:12px;background:#eef3f7}.catr-state svg{width:38px;height:38px;color:#159cdc}@media(max-width:900px){.catr-groups,.catr-drill-board{grid-template-columns:repeat(2,1fr)}.catr-review-fields{grid-template-columns:1fr}.catr-group{min-height:145px}}@media(max-width:600px){.catr{padding:10px 9px 90px}.catr-hero{align-items:start}.catr-hero h1{font-size:42px}.catr-totals{grid-template-columns:repeat(2,1fr)}.catr-groups,.catr-drill-board{grid-template-columns:1fr}.catr-footer{display:grid;grid-template-columns:1fr 1fr}.catr-footer button:first-child{display:none}}
`