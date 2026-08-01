import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type LiveMatch={
 clubId:string
 clubName:string
 opponentName:string|null
 roundLabel:string|null
 quarter:number
 elapsedSeconds:number
 clockRunning:boolean
 homeGoals:number
 homeBehinds:number
 awayGoals:number
 awayBehinds:number
 lastEvent:string|null
}

export default function PublicClubLiveMatch({clubId}:{clubId:string}){
 const[match,setMatch]=useState<LiveMatch|null>(null)
 useEffect(()=>{
  let active=true
  const load=()=>fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}`,{cache:'no-store'})
   .then(async response=>response.ok?response.json():{data:null})
   .then(payload=>{if(active)setMatch(payload?.data??null)})
   .catch(()=>{if(active)setMatch(null)})
  void load()
  const timer=window.setInterval(()=>void load(),15000)
  return()=>{active=false;window.clearInterval(timer)}
 },[clubId])
 if(!match)return null
 const home=match.homeGoals*6+match.homeBehinds
 const away=match.awayGoals*6+match.awayBehinds
 return <section className="public-club-live" aria-label="Live match">
  <header><span><i/>Live now</span><b>{match.roundLabel||`Quarter ${match.quarter}`}</b></header>
  <div className="public-club-live-score">
   <div><strong>{match.clubName}</strong><small>{match.homeGoals}.{match.homeBehinds}</small></div><em>{home}</em>
   <span>Q{match.quarter}</span>
   <em>{away}</em><div><strong>{match.opponentName||'Opposition'}</strong><small>{match.awayGoals}.{match.awayBehinds}</small></div>
  </div>
  <footer><span>{match.clockRunning?'Clock running':'Live match'}{match.lastEvent?` · ${match.lastEvent}`:''}</span><Link to="/matches">Match Centre →</Link></footer>
  <style>{styles}</style>
 </section>
}
const styles=`.public-club-live{margin:0 0 14px;border:1px solid #f04b55;border-radius:14px;overflow:hidden;background:#0b1118;color:#fff;box-shadow:0 12px 28px rgba(15,23,42,.13)}.public-club-live header,.public-club-live footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:#121a23;font-size:10px;font-weight:950;text-transform:uppercase}.public-club-live header span{display:flex;align-items:center;gap:8px;color:#ff6872}.public-club-live header i{width:9px;height:9px;border-radius:50%;background:#ef3340;box-shadow:0 0 0 5px rgba(239,51,64,.17);animation:publicClubLivePulse 1.4s infinite}.public-club-live header b{color:#aeb9c4}.public-club-live-score{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto minmax(0,1fr);align-items:center;gap:12px;padding:18px 14px;text-align:center}.public-club-live-score div:first-child{text-align:right}.public-club-live-score div:last-child{text-align:left}.public-club-live-score strong,.public-club-live-score small{display:block}.public-club-live-score small{margin-top:3px;color:#aeb9c4}.public-club-live-score em{font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;font-style:normal}.public-club-live-score>span{border-radius:999px;padding:6px 8px;background:#ef3340;font-size:10px;font-weight:950}.public-club-live footer span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#b8c2cc}.public-club-live footer a{flex:0 0 auto;color:#8fd5ff;text-decoration:none}@keyframes publicClubLivePulse{50%{box-shadow:0 0 0 10px rgba(239,51,64,0)}}@media(max-width:620px){.public-club-live-score{grid-template-columns:minmax(0,1fr) auto auto auto minmax(0,1fr);gap:7px;padding:15px 9px}.public-club-live-score strong{font-size:12px}.public-club-live-score em{font-size:30px}.public-club-live footer span{display:none}}`
