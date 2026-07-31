import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Clock3, Radio, RefreshCw } from 'lucide-react'

type LiveMatch={clubId:string;clubName:string|null;roundLabel:string|null;opponentName:string|null;matchDate:string|null;quarter:number;elapsedSeconds:number;clockRunning:boolean;homeGoals:number;homeBehinds:number;awayGoals:number;awayBehinds:number;lastEvent:string|null;updatedAt:string}
function points(goals:number,behinds:number){return goals*6+behinds}
function time(seconds:number){const value=Math.max(0,Math.floor(seconds));return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`}

export default function PublicLiveMatchPortal(){
 const{pathname}=useLocation();const[data,setData]=useState<LiveMatch|null>(null);const[host,setHost]=useState<HTMLElement|null>(null)
 const match=pathname.match(/^\/team\/([^/]+)$/),clubId=match?.[1]||''
 useLayoutEffect(()=>{
  setHost(null);document.getElementById('playfooty-public-live-match')?.remove();if(!clubId)return
  const tabs=document.querySelector<HTMLElement>('.club-profile-tabs'),main=document.querySelector<HTMLElement>('#main-content');const anchor=tabs||main
  if(!anchor?.parentElement)return
  const element=document.createElement('div');element.id='playfooty-public-live-match';anchor.insertAdjacentElement(tabs?'afterend':'afterbegin',element);setHost(element)
  return()=>{element.remove();setHost(null)}
 },[clubId,pathname])
 useEffect(()=>{
  if(!clubId){setData(null);return}
  let active=true
  const load=()=>void fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}`,{cache:'no-store'}).then(async response=>{const payload=await response.json().catch(()=>({}));if(active)setData(response.ok?payload.data??null:null)}).catch(()=>{if(active)setData(null)})
  load();const timer=window.setInterval(load,8000);return()=>{active=false;window.clearInterval(timer)}
 },[clubId])
 if(!host||!data)return null
 const homeTotal=points(data.homeGoals,data.homeBehinds),awayTotal=points(data.awayGoals,data.awayBehinds)
 return createPortal(<><section className="public-live-match" aria-live="polite"><div className="plm-top"><div><span><Radio size={14}/> Live match</span><h2>{data.roundLabel||'Match Day'}</h2><p>{data.clockRunning?`Q${data.quarter} · ${time(data.elapsedSeconds)}`:`Q${data.quarter} · Quarter paused`}</p></div><div className="plm-updated"><RefreshCw size={13}/>Updates automatically</div></div><div className="plm-score"><div><strong>{data.clubName||'Home'}</strong><span>{data.homeGoals}.{data.homeBehinds}</span><b>{homeTotal}</b></div><em>—</em><div><strong>{data.opponentName||'Opposition'}</strong><span>{data.awayGoals}.{data.awayBehinds}</span><b>{awayTotal}</b></div></div>{data.lastEvent&&<div className="plm-event"><Clock3 size={15}/><span>Latest: {data.lastEvent}</span></div>}</section><style>{styles}</style></>,host)
}

const styles=`
#playfooty-public-live-match{background:#f4f7f9;border-bottom:1px solid #dfe5ea;padding:14px clamp(12px,4vw,40px)}
.public-live-match{max-width:1200px;margin:0 auto;padding:18px 20px;border-radius:16px;background:linear-gradient(115deg,#071018,#152330);color:#fff;box-shadow:0 12px 28px rgba(15,23,42,.14)}
.plm-top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.plm-top span{display:flex;align-items:center;gap:6px;color:#ff5a5a;font-size:10px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.plm-top h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:32px;line-height:1;margin:5px 0 3px;text-transform:uppercase}.plm-top p{margin:0;color:#b9c7d2;font-size:12px;font-weight:800}.plm-updated{display:flex;align-items:center;gap:5px;color:#91a2b0;font-size:10px;font-weight:800}.plm-score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px;margin-top:15px;padding-top:15px;border-top:1px solid rgba(255,255,255,.13)}.plm-score>div{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px}.plm-score>div:last-child{text-align:right}.plm-score strong{font-size:15px}.plm-score span{color:#9fc9e5;font-family:'Barlow Condensed',Arial,sans-serif;font-size:20px;font-weight:900}.plm-score b{font-family:'Bebas Neue',Impact,sans-serif;font-size:46px;line-height:1}.plm-score em{font-style:normal;color:#6f8290;font-size:25px}.plm-event{display:flex;align-items:center;gap:7px;margin-top:12px;padding-top:11px;border-top:1px solid rgba(255,255,255,.1);color:#c3d0da;font-size:11px;font-weight:800}@media(max-width:650px){#playfooty-public-live-match{padding:10px}.public-live-match{padding:15px}.plm-updated{display:none}.plm-score{gap:8px}.plm-score>div{grid-template-columns:1fr auto;gap:6px}.plm-score strong{grid-column:1/-1;font-size:12px}.plm-score b{font-size:38px}.plm-score span{font-size:16px}.plm-top h2{font-size:28px}}
`
