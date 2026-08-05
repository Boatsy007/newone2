import { useEffect, useMemo, useState } from 'react'

const STAT_ROWS=[
 {key:'i50',label:'I50',name:'Inside 50s'},
 {key:'clr',label:'CLR',name:'Clearances'},
 {key:'r50',label:'R50',name:'Rebound 50s'},
 {key:'one',label:'1%',name:'One percenters'},
 {key:'tkl',label:'TKL',name:'Tackles'},
 {key:'opm',label:'OPM',name:'Opposition marks'},
 {key:'fa',label:'FA',name:'Frees against'},
] as const

type StatKey=typeof STAT_ROWS[number]['key']
type Side='home'|'away'
type QuarterStats=Record<Side,Record<StatKey,number>>
type SavedStats=Record<string,QuarterStats>

function emptyQuarter():QuarterStats{
 return{home:{i50:0,clr:0,r50:0,one:0,tkl:0,opm:0,fa:0},away:{i50:0,clr:0,r50:0,one:0,tkl:0,opm:0,fa:0}}
}
function storageKey(clubId:string,sheetId:string){return`playfooty.matchday.stats.v1.${clubId}.${sheetId||'current'}`}
function readStats(key:string):SavedStats{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):{}}catch{return{}}}

export default function MatchDayFullscreenStats({clubId}:{clubId:string}){
 const[sheetId,setSheetId]=useState('')
 const[quarter,setQuarter]=useState(1)
 const[stats,setStats]=useState<SavedStats>({})
 const key=useMemo(()=>storageKey(clubId,sheetId),[clubId,sheetId])

 useEffect(()=>{
  const sync=()=>{
   const select=document.querySelector<HTMLSelectElement>('.md-picker select')
   const qText=document.querySelector<HTMLElement>('.md-clock>span')?.textContent||'Q1'
   setSheetId(select?.value||'')
   const parsed=Number(qText.replace(/\D/g,''))
   if(parsed>=1&&parsed<=4)setQuarter(parsed)
  }
  sync()
  const observer=new MutationObserver(sync)
  observer.observe(document.body,{childList:true,subtree:true,characterData:true})
  document.addEventListener('change',sync,true)
  return()=>{observer.disconnect();document.removeEventListener('change',sync,true)}
 },[])
 useEffect(()=>setStats(readStats(key)),[key])

 const current=stats[String(quarter)]||emptyQuarter()
 function change(side:Side,stat:StatKey,delta:number){
  setStats(previous=>{
   const next={...previous}
   const existing=next[String(quarter)]||emptyQuarter()
   next[String(quarter)]={...existing,[side]:{...existing[side],[stat]:Math.max(0,(existing[side][stat]||0)+delta)}}
   localStorage.setItem(key,JSON.stringify(next))
   window.dispatchEvent(new CustomEvent('playfooty:matchday-stats',{detail:{clubId,sheetId,quarter,stats:next}}))
   return next
  })
 }
 function click(selector:string,index=0){document.querySelectorAll<HTMLButtonElement>(selector)[index]?.click()}

 return <section className="md-fs-stats" aria-label="Live match statistics">
  <div className="md-fs-stat-tabs">{[1,2,3,4].map(item=><button key={item} className={quarter===item?'active':''} type="button" onClick={()=>setQuarter(item)}>Q{item}</button>)}</div>
  <div className="md-fs-stat-head"><span>Your team</span><span>Stat</span><span>Opposition</span></div>
  <div className="md-fs-stat-list">{STAT_ROWS.map(row=><div className="md-fs-stat-row" key={row.key}>
   <div className="md-fs-counter"><button type="button" onClick={()=>change('home',row.key,-1)}>−</button><strong>{current.home[row.key]}</strong><button type="button" onClick={()=>change('home',row.key,1)}>+</button></div>
   <div className="md-fs-stat-name"><b>{row.label}</b><small>{row.name}</small></div>
   <div className="md-fs-counter"><button type="button" onClick={()=>change('away',row.key,-1)}>−</button><strong>{current.away[row.key]}</strong><button type="button" onClick={()=>change('away',row.key,1)}>+</button></div>
  </div>)}</div>
  <div className="md-fs-score-controls">
   <button className="rushed" type="button" onClick={()=>click('.md-team-actions button',1)}>Rushed behind</button>
   <button className="opp-goal" type="button" onClick={()=>click('.md-opposition-actions button',0)}>Opp goal</button>
   <button className="opp-behind" type="button" onClick={()=>click('.md-opposition-actions button',1)}>Opp behind</button>
   <button className="undo" type="button" onClick={()=>click('.md-opposition-actions button',2)}>Undo</button>
  </div>
 </section>
}
