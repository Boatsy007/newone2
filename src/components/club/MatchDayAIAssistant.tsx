import { useEffect, useRef, useState } from 'react'
import { BrainCircuit, LoaderCircle, MessageSquareText } from 'lucide-react'

type Analysis={headline?:string;recommendation?:string;reason?:string;watch?:string;summary?:string;doingWell?:string[];improve?:string[];playerNotes?:string[];nextQuarter?:string[]}
type FeedItem={id:string;time:string;tone:'normal'|'warning'|'summary';title:string;body:string}
type Player={name:string;position:string;number:number;plusMinus:number;goals:number;behinds:number;onField:boolean}
type Workload=Record<string,{name:string;position:string;onFieldSeconds:number;midfieldSeconds:number;continuousMidfieldSeconds:number;lastAlertMinute:number}>

function numberFrom(value:string){const match=value.match(/-?\d+/);return match?Number(match[0]):0}
function currentQuarter(){const parsed=numberFrom(document.querySelector<HTMLElement>('.md-clock>span')?.textContent||'Q1');return parsed>=1&&parsed<=4?parsed:1}
function currentSheetId(){return document.querySelector<HTMLSelectElement>('.md-picker select')?.value||'current'}
function currentClubId(){return location.pathname.match(/^\/club-portal\/([^/]+)/)?.[1]||''}
function currentStats(sheetId:string){try{return JSON.parse(localStorage.getItem(`playfooty.matchday.stats.v1.${location.pathname}.${sheetId}`)||'{}')}catch{return{}}}
function collectPlayers():Player[]{return [...document.querySelectorAll<HTMLElement>('.md-player')].map(card=>({name:card.querySelector('strong')?.textContent?.trim()||'',position:card.querySelector('small')?.textContent?.trim()||'',number:numberFrom(card.querySelector('.number')?.textContent||''),plusMinus:numberFrom(card.querySelector('em')?.textContent||''),goals:numberFrom(card.querySelectorAll('button')[0]?.textContent||''),behinds:numberFrom(card.querySelectorAll('button')[1]?.textContent||''),onField:card.classList.contains('on-field')})).filter(player=>player.name)}
function isMidfield(position:string){return /^(R|RR|C|M[1-3]|LW|RW|MID|WING)$/i.test(position.trim())}
function collectSnapshot(quarter=currentQuarter(),workload?:Workload){
 const scoreboard=document.querySelector<HTMLElement>('.md-scoreboard')
 const sides=scoreboard?[...scoreboard.querySelectorAll<HTMLElement>('div')]:[]
 const sheetId=currentSheetId()
 const players=collectPlayers()
 return{clubId:currentClubId(),sheetId,quarter,clock:document.querySelector<HTMLElement>('.md-clock strong')?.textContent?.trim()||'',score:{home:{name:sides[0]?.querySelector('small')?.textContent?.trim()||'Your team',total:numberFrom(sides[0]?.querySelector('strong')?.textContent||''),detail:sides[0]?.querySelector('span')?.textContent?.trim()||''},away:{name:sides.at(-1)?.querySelector('small')?.textContent?.trim()||'Opposition',total:numberFrom(sides.at(-1)?.querySelector('strong')?.textContent||''),detail:sides.at(-1)?.querySelector('span')?.textContent?.trim()||''}},stats:currentStats(sheetId),players:players.map(player=>({...player,onFieldMinutes:Math.floor((workload?.[player.name]?.onFieldSeconds||0)/60),midfieldMinutes:Math.floor((workload?.[player.name]?.midfieldSeconds||0)/60),continuousMidfieldMinutes:Math.floor((workload?.[player.name]?.continuousMidfieldSeconds||0)/60)})),capturedAt:new Date().toISOString()}
}
function localRecommendation(snapshot:any):Analysis{
 const home=Number(snapshot.score?.home?.total||0),away=Number(snapshot.score?.away?.total||0),margin=home-away
 const q=String(snapshot.quarter||1),stats=snapshot.stats?.[q]||{home:{},away:{}}
 const differences=[['inside 50s','i50'],['clearances','clr'],['rebound 50s','r50'],['tackles','tkl'],['one percenters','one']].map(([label,key])=>({label,key,home:Number(stats.home?.[key]||0),away:Number(stats.away?.[key]||0)}))
 const gap=differences.sort((a,b)=>(a.home-a.away)-(b.home-b.away))[0]
 const tired=[...(snapshot.players||[])].filter((p:any)=>p.continuousMidfieldMinutes>=10).sort((a:any,b:any)=>b.continuousMidfieldMinutes-a.continuousMidfieldMinutes)[0]
 if(tired)return{headline:'Rotation recommended',recommendation:`Give ${tired.name} a short break after ${tired.continuousMidfieldMinutes} continuous minutes in the midfield.`,reason:'The current midfield stint has reached the workload alert threshold.',watch:'Use the next stoppage for the rotation and monitor the replacement’s plus/minus.'}
 if(gap&&gap.home<gap.away)return{headline:`Lift ${gap.label}`,recommendation:`Focus the next five minutes on improving ${gap.label}.`,reason:`The current count is ${gap.home}–${gap.away}.`,watch:'Check whether the next rotation changes territory and scoreboard pressure.'}
 return{headline:margin>=0?'Protect the advantage':'Create the next momentum swing',recommendation:margin>=0?'Keep the current structure and prioritise clean exits after turnovers.':'Add pressure around the contest and create the next two scoring opportunities.',reason:`The score margin is ${Math.abs(margin)} point${Math.abs(margin)===1?'':'s'}.`,watch:'Watch player plus/minus and midfield workload through the next passage.'}
}
function now(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}

export default function MatchDayAIAssistant(){
 const[feed,setFeed]=useState<FeedItem[]>([{id:'welcome',time:now(),tone:'normal',title:'Assistant ready',body:'Live match data, player impact and rotation workload are being monitored.'}])
 const[loading,setLoading]=useState(false)
 const previousQuarter=useRef(currentQuarter())
 const workload=useRef<Workload>({})
 const lastSignature=useRef('')
 const feedEnd=useRef<HTMLDivElement|null>(null)

 function add(item:Omit<FeedItem,'id'|'time'>){setFeed(previous=>[...previous.slice(-19),{...item,id:`${Date.now()}-${Math.random()}`,time:now()}])}
 async function ask(mode:'live'|'quarter',quarter=currentQuarter()){
  const snapshot=collectSnapshot(quarter,workload.current)
  const signature=JSON.stringify(snapshot)
  if(mode==='live'&&signature===lastSignature.current)return
  setLoading(true)
  try{
   const response=await fetch('/api/ai-assistant-coach',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode,clubId:snapshot.clubId,quarter,snapshot})})
   const payload=await response.json().catch(()=>({}))
   const analysis:Analysis=response.ok&&payload.analysis?payload.analysis:localRecommendation(snapshot)
   if(mode==='quarter')add({tone:'summary',title:analysis.headline||`Quarter ${quarter} report`,body:[analysis.summary,...(analysis.doingWell||[]).map(x=>`Doing well: ${x}`),...(analysis.improve||[]).map(x=>`Improve: ${x}`),...(analysis.nextQuarter||[]).map(x=>`Next: ${x}`)].filter(Boolean).join('\n')})
   else add({tone:'normal',title:analysis.headline||'Live recommendation',body:[analysis.recommendation,analysis.reason&&`Why: ${analysis.reason}`,analysis.watch&&`Watch: ${analysis.watch}`].filter(Boolean).join('\n')})
   lastSignature.current=signature
  }catch{const analysis=localRecommendation(snapshot);add({tone:'normal',title:analysis.headline||'Live recommendation',body:[analysis.recommendation,analysis.reason&&`Why: ${analysis.reason}`,analysis.watch&&`Watch: ${analysis.watch}`].filter(Boolean).join('\n')})}finally{setLoading(false)}
 }

 useEffect(()=>{
  const tick=window.setInterval(()=>{
   for(const player of collectPlayers()){
    const existing=workload.current[player.name]||{name:player.name,position:player.position,onFieldSeconds:0,midfieldSeconds:0,continuousMidfieldSeconds:0,lastAlertMinute:0}
    existing.position=player.position
    if(player.onField){existing.onFieldSeconds+=1;if(isMidfield(player.position)){existing.midfieldSeconds+=1;existing.continuousMidfieldSeconds+=1}else existing.continuousMidfieldSeconds=0}else existing.continuousMidfieldSeconds=0
    const minutes=Math.floor(existing.continuousMidfieldSeconds/60)
    if(minutes>=10&&minutes%5===0&&minutes!==existing.lastAlertMinute){existing.lastAlertMinute=minutes;add({tone:'warning',title:'Rotation alert',body:`${player.name} has spent ${minutes} continuous minutes in the midfield. Recommend a short break at the next suitable stoppage.`})}
    workload.current[player.name]=existing
   }
  },1000)
  const analyse=window.setInterval(()=>void ask('live'),120000)
  const checkQuarter=()=>{const next=currentQuarter();if(previousQuarter.current!==next){const ended=previousQuarter.current;previousQuarter.current=next;void ask('quarter',ended)}}
  const observer=new MutationObserver(checkQuarter);observer.observe(document.body,{childList:true,subtree:true,characterData:true})
  return()=>{window.clearInterval(tick);window.clearInterval(analyse);observer.disconnect()}
 },[])
 useEffect(()=>{feedEnd.current?.scrollIntoView({block:'nearest'})},[feed])

 const q=currentQuarter(),summaryLabel=q>=4?'Summary':'QTR report'
 return <div className="md-ai-live">
  <div className="md-ai-title"><BrainCircuit size={25}/><div><strong>AI Assistant Coach</strong><span>Live coaching feed</span></div><i className={loading?'busy':''}/></div>
  <div className="md-ai-feed">{feed.map(item=><article key={item.id} className={`md-ai-message ${item.tone}`}><header><MessageSquareText size={12}/><b>{item.title}</b><time>{item.time}</time></header>{item.body.split('\n').map((line,index)=><p key={index}>{line}</p>)}</article>)}<div ref={feedEnd}/></div>
  <div className="md-ai-actions"><button type="button" onClick={()=>void ask('live')} disabled={loading}>{loading?<LoaderCircle className="spin" size={15}/>:<BrainCircuit size={15}/>}Analyse</button><button type="button" onClick={()=>void ask('quarter',q)} disabled={loading}>{summaryLabel}</button></div>
  <style>{`.md-ai-live{width:100%;height:100%;display:grid;grid-template-rows:auto 1fr auto;gap:8px;padding:11px;color:#edf5fb;text-align:left;overflow:hidden}.md-ai-title{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px}.md-ai-title>svg{color:#42b8ff}.md-ai-title strong,.md-ai-title span{display:block}.md-ai-title strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:22px;letter-spacing:.04em;text-transform:uppercase}.md-ai-title span{color:#8193a0;font-size:8px}.md-ai-title i{width:8px;height:8px;border-radius:50%;background:#25d87d}.md-ai-title i.busy{animation:pulse 1s infinite}.md-ai-feed{min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:7px;padding-right:3px}.md-ai-message{padding:8px 9px;border:1px solid #243945;border-radius:9px;background:#091620}.md-ai-message header{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:5px;margin-bottom:4px}.md-ai-message header svg{color:#42b8ff}.md-ai-message b{font-size:10px;text-transform:uppercase}.md-ai-message time{color:#70818e;font-size:7px}.md-ai-message p{margin:2px 0;color:#d1dbe1;font-size:9px;line-height:1.35}.md-ai-message.warning{border-color:#d9434d;background:rgba(104,18,26,.34)}.md-ai-message.warning header svg,.md-ai-message.warning b,.md-ai-message.warning p{color:#ff7c84}.md-ai-message.summary{border-color:#228b62;background:rgba(12,63,46,.32)}.md-ai-message.summary b{color:#55d98b}.md-ai-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding-top:7px;border-top:1px solid #243945}.md-ai-actions button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:36px;border:1px solid #2b4352;border-radius:8px;background:#147fbd;color:#fff;font-size:9px;font-weight:950;text-transform:uppercase}.md-ai-actions button:last-child{background:#102331}.md-ai-actions button:disabled{opacity:.6}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.25}}`}</style>
 </div>
}
