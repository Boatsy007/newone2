import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { ArrowDown, Clock3, Radio, RefreshCw } from 'lucide-react'

type LiveMatch={clubId:string;clubName:string|null;roundLabel:string|null;opponentName:string|null;matchDate:string|null;quarter:number;elapsedSeconds:number;clockRunning:boolean;homeGoals:number;homeBehinds:number;awayGoals:number;awayBehinds:number;lastEvent:string|null;updatedAt:string}
function points(goals:number,behinds:number){return goals*6+behinds}
function time(seconds:number){const value=Math.max(0,Math.floor(seconds));return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`}

export default function PublicLiveMatchPortal(){
 const{pathname}=useLocation();const[data,setData]=useState<LiveMatch|null>(null);const[host,setHost]=useState<HTMLElement|null>(null);const[heroHost,setHeroHost]=useState<HTMLElement|null>(null)
 const match=pathname.match(/^\/team\/([^/]+)$/),clubId=match?.[1]||''
 useLayoutEffect(()=>{
  setHost(null);setHeroHost(null);document.getElementById('playfooty-public-live-match')?.remove();document.getElementById('playfooty-live-match-hero-button')?.remove();if(!clubId)return
  let liveElement:HTMLDivElement|null=null,heroElement:HTMLDivElement|null=null
  const connect=()=>{
   const tabs=document.querySelector<HTMLElement>('.club-profile-tabs')
   const hero=document.querySelector<HTMLElement>('#main-content > header')
   if(!liveElement&&tabs?.parentElement){liveElement=document.createElement('div');liveElement.id='playfooty-public-live-match';tabs.insertAdjacentElement('afterend',liveElement);setHost(liveElement)}
   if(!heroElement&&hero){heroElement=document.createElement('div');heroElement.id='playfooty-live-match-hero-button';hero.appendChild(heroElement);setHeroHost(heroElement)}
  }
  connect()
  const observer=new MutationObserver(connect)
  observer.observe(document.body,{childList:true,subtree:true})
  return()=>{observer.disconnect();liveElement?.remove();heroElement?.remove();setHost(null);setHeroHost(null)}
 },[clubId,pathname])
 useEffect(()=>{
  if(!clubId){setData(null);return}
  let active=true
  const load=()=>void fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}?t=${Date.now()}`,{cache:'no-store'}).then(async response=>{const payload=await response.json().catch(()=>({}));if(active)setData(response.ok?payload.data??null:null)}).catch(()=>{if(active)setData(null)})
  load();const timer=window.setInterval(load,1000);const onFocus=()=>load();window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onFocus);return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus)}
 },[clubId])
 if(!data)return null
 const homeTotal=points(data.homeGoals,data.homeBehinds),awayTotal=points(data.awayGoals,data.awayBehinds)
 const jumpToLive=()=>document.getElementById('playfooty-public-live-match')?.scrollIntoView({behavior:'smooth',block:'start'})
 return <>
  {heroHost&&createPortal(<button type="button" className="plm-hero-button" onClick={jumpToLive} aria-label="Open live match scores"><span className="plm-live-dot"/><b>Match live</b><small>Q{data.quarter} · {homeTotal}-{awayTotal}</small><ArrowDown size={16}/></button>,heroHost)}
  {host&&createPortal(<section className="public-live-match" aria-live="polite"><div className="plm-top"><div><span><Radio size={14}/> Live match</span><h2>{data.roundLabel||'Match Day'}</h2><p>{data.clockRunning?`Q${data.quarter} · ${time(data.elapsedSeconds)}`:`Q${data.quarter} · Quarter paused`}</p></div><div className="plm-updated"><RefreshCw size={13}/>Updates automatically</div></div><div className="plm-score"><div><strong>{data.clubName||'Home'}</strong><span>{data.homeGoals}.{data.homeBehinds}</span><b>{homeTotal}</b></div><em>—</em><div><strong>{data.opponentName||'Opposition'}</strong><span>{data.awayGoals}.{data.awayBehinds}</span><b>{awayTotal}</b></div></div>{data.lastEvent&&<div className="plm-event"><Clock3 size={15}/><span>Latest: {data.lastEvent}</span></div>}</section>,host)}
  <style>{styles}</style>
 </>
}

const styles=`
#playfooty-public-live-match{scroll-margin-top:145px;background:#f4f7f9;border-bottom:1px solid #dfe5ea;padding:14px clamp(12px,4vw,40px)}
#playfooty-live-match-hero-button{position:absolute;z-index:12;right:max(20px,calc((100vw - 1120px)/2 + 20px));bottom:22px}
.plm-hero-button{display:grid;grid-template-columns:auto auto auto;grid-template-rows:auto auto;align-items:center;column-gap:8px;min-width:170px;padding:11px 14px;border:1px solid rgba(255,255,255,.72);border-radius:999px;background:#e51f2a;color:#fff;box-shadow:0 0 0 0 rgba(229,31,42,.62),0 10px 26px rgba(0,0,0,.34);cursor:pointer;text-align:left;animation:plmPulse 1.45s infinite}
.plm-hero-button .plm-live-dot{grid-row:1/3;width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 0 4px rgba(255,255,255,.2);animation:plmBlink .85s infinite}
.plm-hero-button b{font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;line-height:1}.plm-hero-button small{grid-column:2;font-family:'Barlow Condensed',Arial,sans-serif;font-size:10px;font-weight:800;color:rgba(255,255,255,.82);line-height:1.2}.plm-hero-button svg{grid-column:3;grid-row:1/3}
@keyframes plmPulse{0%{box-shadow:0 0 0 0 rgba(229,31,42,.62),0 10px 26px rgba(0,0,0,.34)}70%{box-shadow:0 0 0 12px rgba(229,31,42,0),0 10px 26px rgba(0,0,0,.34)}100%{box-shadow:0 0 0 0 rgba(229,31,42,0),0 10px 26px rgba(0,0,0,.34)}}@keyframes plmBlink{0%,45%{opacity:1}46%,100%{opacity:.28}}
.public-live-match{max-width:1200px;margin:0 auto;padding:18px 20px;border-radius:16px;background:linear-gradient(115deg,#071018,#152330);color:#fff;box-shadow:0 12px 28px rgba(15,23,42,.14)}
.plm-top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.plm-top span{display:flex;align-items:center;gap:6px;color:#ff5a5a;font-size:10px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.plm-top h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:32px;line-height:1;margin:5px 0 3px;text-transform:uppercase}.plm-top p{margin:0;color:#b9c7d2;font-size:12px;font-weight:800}.plm-updated{display:flex;align-items:center;gap:5px;color:#91a2b0;font-size:10px;font-weight:800}.plm-score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px;margin-top:15px;padding-top:15px;border-top:1px solid rgba(255,255,255,.13)}.plm-score>div{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px}.plm-score>div:last-child{text-align:right}.plm-score strong{font-size:15px}.plm-score span{color:#9fc9e5;font-family:'Barlow Condensed',Arial,sans-serif;font-size:20px;font-weight:900}.plm-score b{font-family:'Bebas Neue',Impact,sans-serif;font-size:46px;line-height:1}.plm-score em{font-style:normal;color:#6f8290;font-size:25px}.plm-event{display:flex;align-items:center;gap:7px;margin-top:12px;padding-top:11px;border-top:1px solid rgba(255,255,255,.1);color:#c3d0da;font-size:11px;font-weight:800}
@media(prefers-reduced-motion:reduce){.plm-hero-button,.plm-live-dot{animation:none!important}}
@media(max-width:720px){#playfooty-live-match-hero-button{right:14px;bottom:18px}.plm-hero-button{min-width:152px;padding:10px 12px}.plm-hero-button b{font-size:12px}}
@media(max-width:650px){#playfooty-public-live-match{padding:10px;scroll-margin-top:125px}.public-live-match{padding:15px}.plm-updated{display:none}.plm-score{gap:8px}.plm-score>div{grid-template-columns:1fr auto;gap:6px}.plm-score strong{grid-column:1/-1;font-size:12px}.plm-score b{font-size:38px}.plm-score span{font-size:16px}.plm-top h2{font-size:28px}}
`
