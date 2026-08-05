import { useEffect, useMemo, useRef, useState } from 'react'
import { BrainCircuit, LoaderCircle, RefreshCw } from 'lucide-react'

type Props={clubId:string;sheetId:string;quarter:number;stats:unknown}
type Analysis={headline?:string;recommendation?:string;reason?:string;watch?:string;summary?:string;doingWell?:string[];improve?:string[];playerNotes?:string[];nextQuarter?:string[]}

function text(selector:string){return document.querySelector<HTMLElement>(selector)?.textContent?.trim()||''}
function numberFrom(value:string){const match=value.match(/-?\d+/);return match?Number(match[0]):0}
function collectPlayers(){
 return [...document.querySelectorAll<HTMLElement>('.md-player')].map(card=>({
  name:card.querySelector('strong')?.textContent?.trim()||'',
  position:card.querySelector('small')?.textContent?.trim()||'',
  number:numberFrom(card.querySelector('.number')?.textContent||''),
  plusMinus:numberFrom(card.querySelector('em')?.textContent||''),
  goals:numberFrom(card.querySelectorAll('button')[0]?.textContent||''),
  behinds:numberFrom(card.querySelectorAll('button')[1]?.textContent||''),
  onField:card.classList.contains('on-field'),
 })).filter(player=>player.name)
}
function collectSnapshot(clubId:string,sheetId:string,quarter:number,stats:unknown){
 const scoreboard=document.querySelector<HTMLElement>('.md-scoreboard')
 const sides=scoreboard?[...scoreboard.querySelectorAll<HTMLElement>('div')]:[]
 return{
  clubId,sheetId,quarter,
  clock:text('.md-clock strong'),
  score:{
   home:{name:sides[0]?.querySelector('small')?.textContent?.trim()||'Your team',total:numberFrom(sides[0]?.querySelector('strong')?.textContent||''),detail:sides[0]?.querySelector('span')?.textContent?.trim()||''},
   away:{name:sides.at(-1)?.querySelector('small')?.textContent?.trim()||'Opposition',total:numberFrom(sides.at(-1)?.querySelector('strong')?.textContent||''),detail:sides.at(-1)?.querySelector('span')?.textContent?.trim()||''},
  },
  stats,
  players:collectPlayers(),
  capturedAt:new Date().toISOString(),
 }
}

export default function MatchDayAIAssistant({clubId,sheetId,quarter,stats}:Props){
 const[analysis,setAnalysis]=useState<Analysis|null>(null)
 const[quarterSummary,setQuarterSummary]=useState<Analysis|null>(null)
 const[loading,setLoading]=useState(false)
 const[error,setError]=useState('')
 const[lastUpdated,setLastUpdated]=useState('')
 const lastSignature=useRef('')
 const previousQuarter=useRef(quarter)
 const snapshot=useMemo(()=>collectSnapshot(clubId,sheetId,quarter,stats),[clubId,sheetId,quarter,stats])

 async function ask(mode:'live'|'quarter',q=quarter){
  const current=collectSnapshot(clubId,sheetId,q,stats)
  const signature=JSON.stringify(current)
  if(mode==='live'&&signature===lastSignature.current)return
  setLoading(true);setError('')
  try{
   const response=await fetch('/api/ai-assistant-coach',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode,clubId,quarter:q,snapshot:current})})
   const payload=await response.json().catch(()=>({}))
   if(!response.ok)throw new Error(payload.error||'Unable to load assistant coach')
   if(mode==='quarter')setQuarterSummary(payload.analysis||null);else{setAnalysis(payload.analysis||null);lastSignature.current=signature}
   setLastUpdated(new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))
  }catch(nextError){setError(nextError instanceof Error?nextError.message:'Unable to load assistant coach')}finally{setLoading(false)}
 }

 useEffect(()=>{
  const timer=window.setInterval(()=>void ask('live'),60000)
  return()=>window.clearInterval(timer)
 })
 useEffect(()=>{
  if(previousQuarter.current!==quarter){const ended=previousQuarter.current;previousQuarter.current=quarter;void ask('quarter',ended)}
 },[quarter])

 return <div className="md-ai-live">
  <div className="md-ai-title"><BrainCircuit size={28}/><div><strong>AI Assistant Coach</strong><span>{lastUpdated?`Updated ${lastUpdated}`:'Uses live match data'}</span></div><button type="button" onClick={()=>void ask('live')} disabled={loading} aria-label="Refresh recommendation">{loading?<LoaderCircle className="spin" size={17}/>:<RefreshCw size={17}/>}</button></div>
  {error?<p className="md-ai-error">{error}</p>:null}
  {quarterSummary?<section className="md-ai-quarter"><b>{quarterSummary.headline||'Quarter summary'}</b><p>{quarterSummary.summary}</p><div><strong>Doing well</strong>{quarterSummary.doingWell?.map(item=><span key={item}>• {item}</span>)}</div><div><strong>Improve</strong>{quarterSummary.improve?.map(item=><span key={item}>• {item}</span>)}</div></section>:null}
  {!quarterSummary&&analysis?<section className="md-ai-recommendation"><b>{analysis.headline||'Live recommendation'}</b><p>{analysis.recommendation}</p>{analysis.reason?<span><strong>Why:</strong> {analysis.reason}</span>:null}{analysis.watch?<span><strong>Watch:</strong> {analysis.watch}</span>:null}</section>:null}
  {!quarterSummary&&!analysis&&!loading?<button className="md-ai-start" type="button" onClick={()=>void ask('live')}>Analyse match now</button>:null}
 </div>
}
