import { useEffect, useRef, useState } from 'react'
import { BrainCircuit, LoaderCircle, RefreshCw } from 'lucide-react'

type Analysis={headline?:string;recommendation?:string;reason?:string;watch?:string;summary?:string;doingWell?:string[];improve?:string[];playerNotes?:string[];nextQuarter?:string[]}

function numberFrom(value:string){const match=value.match(/-?\d+/);return match?Number(match[0]):0}
function currentQuarter(){const parsed=numberFrom(document.querySelector<HTMLElement>('.md-clock>span')?.textContent||'Q1');return parsed>=1&&parsed<=4?parsed:1}
function currentSheetId(){return document.querySelector<HTMLSelectElement>('.md-picker select')?.value||'current'}
function currentClubId(){return location.pathname.match(/^\/club-portal\/([^/]+)/)?.[1]||''}
function currentStats(sheetId:string){try{return JSON.parse(localStorage.getItem(`playfooty.matchday.stats.v1.${location.pathname}.${sheetId}`)||'{}')}catch{return{}}}
function collectPlayers(){return [...document.querySelectorAll<HTMLElement>('.md-player')].map(card=>({name:card.querySelector('strong')?.textContent?.trim()||'',position:card.querySelector('small')?.textContent?.trim()||'',number:numberFrom(card.querySelector('.number')?.textContent||''),plusMinus:numberFrom(card.querySelector('em')?.textContent||''),goals:numberFrom(card.querySelectorAll('button')[0]?.textContent||''),behinds:numberFrom(card.querySelectorAll('button')[1]?.textContent||''),onField:card.classList.contains('on-field')})).filter(player=>player.name)}
function collectSnapshot(quarter=currentQuarter()){
 const scoreboard=document.querySelector<HTMLElement>('.md-scoreboard')
 const sides=scoreboard?[...scoreboard.querySelectorAll<HTMLElement>('div')]:[]
 const sheetId=currentSheetId()
 return{clubId:currentClubId(),sheetId,quarter,clock:document.querySelector<HTMLElement>('.md-clock strong')?.textContent?.trim()||'',score:{home:{name:sides[0]?.querySelector('small')?.textContent?.trim()||'Your team',total:numberFrom(sides[0]?.querySelector('strong')?.textContent||''),detail:sides[0]?.querySelector('span')?.textContent?.trim()||''},away:{name:sides.at(-1)?.querySelector('small')?.textContent?.trim()||'Opposition',total:numberFrom(sides.at(-1)?.querySelector('strong')?.textContent||''),detail:sides.at(-1)?.querySelector('span')?.textContent?.trim()||''}},stats:currentStats(sheetId),players:collectPlayers(),capturedAt:new Date().toISOString()}
}

export default function MatchDayAIAssistant(){
 const[analysis,setAnalysis]=useState<Analysis|null>(null)
 const[quarterSummary,setQuarterSummary]=useState<Analysis|null>(null)
 const[loading,setLoading]=useState(false)
 const[error,setError]=useState('')
 const[lastUpdated,setLastUpdated]=useState('')
 const lastSignature=useRef('')
 const previousQuarter=useRef(currentQuarter())

 async function ask(mode:'live'|'quarter',quarter=currentQuarter()){
  const snapshot=collectSnapshot(quarter)
  const signature=JSON.stringify(snapshot)
  if(mode==='live'&&signature===lastSignature.current)return
  setLoading(true);setError('')
  try{
   const response=await fetch('/api/ai-assistant-coach',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode,clubId:snapshot.clubId,quarter,snapshot})})
   const payload=await response.json().catch(()=>({}))
   if(!response.ok)throw new Error(payload.error||'Unable to load assistant coach')
   if(mode==='quarter'){setQuarterSummary(payload.analysis||null);setAnalysis(null)}else{setAnalysis(payload.analysis||null);setQuarterSummary(null);lastSignature.current=signature}
   setLastUpdated(new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))
  }catch(nextError){setError(nextError instanceof Error?nextError.message:'Unable to load assistant coach')}finally{setLoading(false)}
 }

 useEffect(()=>{
  const checkQuarter=()=>{const next=currentQuarter();if(previousQuarter.current!==next){const ended=previousQuarter.current;previousQuarter.current=next;void ask('quarter',ended)}}
  const observer=new MutationObserver(checkQuarter);observer.observe(document.body,{childList:true,subtree:true,characterData:true})
  const timer=window.setInterval(()=>void ask('live'),60000)
  return()=>{observer.disconnect();window.clearInterval(timer)}
 },[])

 return <div className="md-ai-live">
  <div className="md-ai-title"><BrainCircuit size={28}/><div><strong>AI Assistant Coach</strong><span>{lastUpdated?`Updated ${lastUpdated}`:'Uses every live match stat'}</span></div><button type="button" onClick={()=>void ask('live')} disabled={loading} aria-label="Refresh recommendation">{loading?<LoaderCircle className="spin" size={17}/>:<RefreshCw size={17}/>}</button></div>
  {error?<p className="md-ai-error">{error}</p>:null}
  {quarterSummary?<section className="md-ai-quarter"><b>{quarterSummary.headline||'Quarter summary'}</b><p>{quarterSummary.summary}</p><div className="md-ai-columns"><div><strong>Doing well</strong>{quarterSummary.doingWell?.map(item=><span key={item}>• {item}</span>)}</div><div><strong>Improve</strong>{quarterSummary.improve?.map(item=><span key={item}>• {item}</span>)}</div></div>{quarterSummary.nextQuarter?.length?<div className="md-ai-next"><strong>Next quarter</strong>{quarterSummary.nextQuarter.map(item=><span key={item}>• {item}</span>)}</div>:null}</section>:null}
  {!quarterSummary&&analysis?<section className="md-ai-recommendation"><b>{analysis.headline||'Live recommendation'}</b><p>{analysis.recommendation}</p>{analysis.reason?<span><strong>Why:</strong> {analysis.reason}</span>:null}{analysis.watch?<span><strong>Watch:</strong> {analysis.watch}</span>:null}</section>:null}
  {!quarterSummary&&!analysis&&!loading?<button className="md-ai-start" type="button" onClick={()=>void ask('live')}>Analyse match now</button>:null}
  <style>{`.md-ai-live{width:100%;height:100%;display:flex;flex-direction:column;gap:10px;padding:14px;color:#edf5fb;text-align:left;overflow:auto}.md-ai-title{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px}.md-ai-title>svg{color:#42b8ff}.md-ai-title strong,.md-ai-title span{display:block}.md-ai-title strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:25px;letter-spacing:.04em;text-transform:uppercase}.md-ai-title span{color:#8193a0;font-size:9px}.md-ai-title button,.md-ai-start{border:1px solid #2b4352;border-radius:9px;background:#102331;color:#fff;padding:9px;font-weight:900}.md-ai-start{margin:auto;padding:12px 18px;background:#147fbd;text-transform:uppercase}.md-ai-error{margin:0;color:#ff8a91;font-size:10px}.md-ai-recommendation,.md-ai-quarter{display:grid;gap:8px}.md-ai-recommendation>b,.md-ai-quarter>b{color:#42b8ff;font-family:'Bebas Neue',Impact,sans-serif;font-size:24px;text-transform:uppercase}.md-ai-recommendation p,.md-ai-quarter p{margin:0;color:#f5f8fa;font-size:12px;line-height:1.45}.md-ai-recommendation>span{color:#aebbc4;font-size:10px;line-height:1.4}.md-ai-columns{display:grid;grid-template-columns:1fr 1fr;gap:10px}.md-ai-columns>div,.md-ai-next{display:grid;gap:3px;padding:8px;border:1px solid #243945;border-radius:9px;background:#091620}.md-ai-columns strong,.md-ai-next strong{color:#55d98b;font-size:9px;text-transform:uppercase}.md-ai-columns span,.md-ai-next span{color:#d1dbe1;font-size:9px;line-height:1.35}.spin{animation:md-ai-spin 1s linear infinite}@keyframes md-ai-spin{to{transform:rotate(360deg)}}`}</style>
 </div>
}
