import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'

type MatchRow={id:string;sourceId?:string|null;leagueName?:string|null;round?:string|number|null;matchDate?:string|null;matchTime?:string|null;homeClubName?:string|null;homeName?:string|null;awayClubName?:string|null;awayName?:string|null;homeScore?:number|null;awayScore?:number|null;homePoints?:number|null;awayPoints?:number|null;status?:string|null;sourceType?:'generic'|'football'}

type Payload={data?:MatchRow[]}

async function load(url:string,sourceType:MatchRow['sourceType']){
 try{const response=await fetch(url);if(!response.ok)return[];const payload=await response.json() as Payload;return(Array.isArray(payload.data)?payload.data:[]).map(row=>({...row,sourceType}))}catch{return[]}
}

export default function MatchCentreLiveBanner(){
 const{pathname}=useLocation()
 const[host,setHost]=useState<HTMLElement|null>(null)
 const[rows,setRows]=useState<MatchRow[]>([])

 useEffect(()=>{
  if(pathname!=='/matches'){setHost(null);return}
  let active=true
  const attach=()=>{
   const hero=document.querySelector('.mc-hero')
   if(!hero)return false
   let node=document.getElementById('match-centre-live-banner-host')
   if(!node){node=document.createElement('div');node.id='match-centre-live-banner-host';hero.insertAdjacentElement('afterend',node)}
   if(active)setHost(node)
   return true
  }
  if(!attach()){
   const observer=new MutationObserver(()=>{if(attach())observer.disconnect()})
   observer.observe(document.body,{childList:true,subtree:true})
   return()=>{active=false;observer.disconnect();document.getElementById('match-centre-live-banner-host')?.remove()}
  }
  return()=>{active=false;document.getElementById('match-centre-live-banner-host')?.remove()}
 },[pathname])

 useEffect(()=>{
  if(pathname!=='/matches')return
  let active=true
  const refresh=()=>Promise.all([
   load('/api/fixtures','generic'),load('/api/fixtures/football?limit=1000','football'),
   load('/api/results?limit=1000','generic'),load('/api/results/football?limit=1000','football'),
  ]).then(groups=>{if(active)setRows(dedupe(groups.flat()).filter(isLive).sort((a,b)=>dateValue(a.matchDate)-dateValue(b.matchDate)).slice(0,12))})
  void refresh()
  const timer=window.setInterval(()=>void refresh(),30000)
  return()=>{active=false;window.clearInterval(timer)}
 },[pathname])

 const live=useMemo(()=>rows,[rows])
 if(!host||!live.length)return null
 return createPortal(<section className="mc-live-banner" aria-label="Live matches"><div className="mc-live-shell"><header><div><span className="mc-live-dot"/>Live now</div><small>{live.length} match{live.length===1?'':'es'}</small></header><div className="mc-live-track">{live.map(row=><LiveCard key={`${row.sourceType}:${row.id}`} row={row}/>)}</div></div><style>{styles}</style></section>,host)
}

function LiveCard({row}:{row:MatchRow}){
 const home=row.homeClubName??row.homeName??'Home'
 const away=row.awayClubName??row.awayName??'Away'
 const homeScore=row.homeScore??row.homePoints??0
 const awayScore=row.awayScore??row.awayPoints??0
 const football=row.sourceType==='football'||row.id.startsWith('football:')
 const rawId=row.id.startsWith('football:')?row.id:row.sourceId??row.id
 const href=`/match/result/${encodeURIComponent(rawId)}${football&&!String(rawId).startsWith('football:')?'?source=football':''}`
 return <Link to={href} className="mc-live-card"><div className="mc-live-meta"><span>{row.leagueName??'Community football'}</span><b>{roundLabel(row.round)}</b></div><div className="mc-live-score"><div><strong>{home}</strong><em>{homeScore}</em></div><div><strong>{away}</strong><em>{awayScore}</em></div></div><footer><span>{liveLabel(row)}</span><b>Open match →</b></footer></Link>
}

function isLive(row:MatchRow){
 const status=String(row.status??'').toUpperCase()
 if(['LIVE','IN_PROGRESS','IN PROGRESS','ACTIVE','PLAYING','HALF_TIME','HALFTIME'].includes(status))return true
 if(['COMPLETED','FINAL','CANCELLED','ABANDONED','POSTPONED'].includes(status))return false
 const hasScore=Number.isFinite(Number(row.homeScore??row.homePoints))&&Number.isFinite(Number(row.awayScore??row.awayPoints))
 if(!hasScore||!row.matchDate)return false
 const match=new Date(row.matchDate);if(Number.isNaN(match.getTime()))return false
 const now=Date.now();const start=match.getTime();return now>=start-15*60*1000&&now<=start+4*60*60*1000
}
function liveLabel(row:MatchRow){const status=String(row.status??'').replaceAll('_',' ').trim();return status&&status.toUpperCase()!=='ACTIVE'?status:'LIVE'}
function roundLabel(value?:string|number|null){if(value==null||value==='')return'Live match';const text=String(value);return/^round\b/i.test(text)?text:`Round ${text}`}
function dateValue(value?:string|null){if(!value)return 0;const n=Date.parse(value);return Number.isFinite(n)?n:0}
function key(row:MatchRow){return[normalise(row.leagueName),roundLabel(row.round),normalise(row.homeClubName??row.homeName),normalise(row.awayClubName??row.awayName)].join('|')}
function normalise(value?:string|null){return String(value??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function dedupe(rows:MatchRow[]){const map=new Map<string,MatchRow>();rows.forEach(row=>{const k=key(row)||`${row.sourceType}:${row.id}`;const current=map.get(k);if(!current||score(row)>score(current))map.set(k,row)});return[...map.values()]}
function score(row:MatchRow){return(row.sourceType==='football'?4:0)+(row.status?2:0)+(row.sourceId?1:0)}

const styles=`
.mc-live-banner{background:#080b10;color:#fff;border-bottom:1px solid rgba(255,255,255,.09)}.mc-live-shell{max-width:1240px;margin:0 auto;padding:12px 18px 14px}.mc-live-shell>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.1em}.mc-live-shell>header>div{display:flex;align-items:center;gap:8px}.mc-live-shell>header small{color:#aab4bf}.mc-live-dot{width:9px;height:9px;border-radius:50%;background:#ef3340;box-shadow:0 0 0 5px rgba(239,51,64,.16);animation:mcLivePulse 1.5s infinite}.mc-live-track{display:flex;gap:10px;overflow-x:auto;padding:2px 1px 5px;scroll-snap-type:x proximity;scrollbar-width:none}.mc-live-track::-webkit-scrollbar{display:none}.mc-live-card{flex:0 0 min(360px,84vw);scroll-snap-align:start;padding:13px 14px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:#121820;color:#fff;text-decoration:none}.mc-live-meta,.mc-live-card footer{display:flex;justify-content:space-between;gap:12px;align-items:center}.mc-live-meta span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8fd5ff;font-size:10px;font-weight:900;text-transform:uppercase}.mc-live-meta b{flex:0 0 auto;color:#aab4bf;font-size:10px}.mc-live-score{display:grid;gap:6px;margin:11px 0}.mc-live-score>div{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px}.mc-live-score strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.mc-live-score em{font-family:'Bebas Neue',Impact,sans-serif;font-size:28px;line-height:1;font-style:normal}.mc-live-card footer{padding-top:9px;border-top:1px solid rgba(255,255,255,.1);font-size:10px;font-weight:900;text-transform:uppercase}.mc-live-card footer span{color:#ff6570}.mc-live-card footer b{color:#8fd5ff}@keyframes mcLivePulse{50%{box-shadow:0 0 0 9px rgba(239,51,64,0)}}@media(min-width:900px){.mc-live-shell{padding-left:24px;padding-right:24px}.mc-live-card{flex-basis:370px}}
`
