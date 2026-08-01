import { useEffect, useState } from 'react'
import { Bell, Building2, Home, ListFilter, Menu, Newspaper, Shield, Sparkles, Trophy, Users, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import MatchCentreLiveBanner from '../matches/MatchCentreLiveBanner'

const HIDDEN_PREFIXES=['/club-portal','/league-portal','/admin','/reset-password','/player-availability']

export default function PublicAppNav(){
 const{pathname}=useLocation()
 const[moreOpen,setMoreOpen]=useState(false)
 const hidden=HIDDEN_PREFIXES.some(prefix=>pathname.startsWith(prefix))
 const moreActive=['/news','/goal-kickers','/mvp','/highlights','/leagues','/notifications','/feed','/records'].some(prefix=>pathname.startsWith(prefix))

 useEffect(()=>{setMoreOpen(false)},[pathname])
 useEffect(()=>{
  document.body.classList.toggle('pf-public-more-open',moreOpen)
  const previous=document.body.style.overflow
  if(moreOpen)document.body.style.overflow='hidden'
  return()=>{document.body.classList.remove('pf-public-more-open');document.body.style.overflow=previous}
 },[moreOpen])

 if(hidden)return null
 const items=[
  {label:'Home',href:'/',icon:Home,active:pathname==='/'},
  {label:'Rankings',href:'/rankings',icon:Trophy,active:pathname.startsWith('/rankings')||pathname.startsWith('/power-rankings')},
  {label:'Matches',href:'/matches',icon:ListFilter,active:pathname.startsWith('/matches')||pathname.startsWith('/match/')},
  {label:'Clubs',href:'/directory',icon:Users,active:pathname.startsWith('/directory')||pathname.startsWith('/team/')},
 ]

 return <><MatchCentreLiveBanner/>{createPortal(<>
  <nav className="public-app-bottom" aria-label="PlayFooty app navigation"><div>
   {items.map(item=><Link key={item.label} to={item.href} className={item.active?'active':''} aria-current={item.active?'page':undefined}><item.icon size={22}/><span>{item.label}</span></Link>)}
   <button type="button" className={moreOpen||moreActive?'active':''} onClick={()=>setMoreOpen(value=>!value)} aria-expanded={moreOpen}><Menu size={22}/><span>More</span></button>
  </div></nav>
  {moreOpen&&<div className="public-more-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setMoreOpen(false)}}>
   <section className="public-more-sheet" role="dialog" aria-modal="true" aria-label="More PlayFooty sections">
    <header><div><span>Explore PlayFooty</span><h2>More</h2></div><button type="button" onClick={()=>setMoreOpen(false)} aria-label="Close more menu"><X size={22}/></button></header>
    <div className="public-more-grid">
     <MoreLink to="/news" icon={Newspaper} label="News" note="Stories and match reports"/>
     <MoreLink to="/goal-kickers" icon={Trophy} label="Goal kickers" note="National goal leaders"/>
     <MoreLink to="/mvp" icon={Sparkles} label="MVP" note="Player voting leaderboard"/>
     <MoreLink to="/highlights" icon={Shield} label="Highlights" note="Goals, marks and plays"/>
     <MoreLink to="/leagues" icon={Building2} label="Leagues" note="Competitions and ladders"/>
     <MoreLink to="/notifications" icon={Bell} label="Notifications" note="Your latest updates"/>
    </div>
   </section>
  </div>}
  <style>{styles}</style>
 </>,document.body)}</>
}

function MoreLink({to,icon:Icon,label,note}:{to:string;icon:typeof Home;label:string;note:string}){return <Link to={to}><i><Icon size={21}/></i><span><strong>{label}</strong><small>{note}</small></span></Link>}

const styles=`
.public-app-bottom{display:none}.public-more-backdrop{display:none}
@media(max-width:1024px){
 body:has(.public-app-bottom){padding-bottom:78px}.public-app-bottom{position:fixed;left:0;right:0;bottom:0;z-index:100180;display:block;padding:7px 8px calc(7px + env(safe-area-inset-bottom));background:rgba(250,251,252,.97);border-top:1px solid #dfe4e8;box-shadow:0 -8px 28px rgba(15,23,42,.09);backdrop-filter:blur(18px);transition:transform .2s ease,opacity .2s ease}.public-app-bottom>div{width:min(760px,100%);margin:0 auto;display:grid;grid-template-columns:repeat(5,1fr);gap:3px}.public-app-bottom a,.public-app-bottom button{min-width:0;min-height:56px;border:0;border-radius:13px;background:transparent;color:#92989f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-decoration:none;font:inherit;font-size:10px;font-weight:850}.public-app-bottom a.active,.public-app-bottom button.active{color:#087bbf;background:#e6f5fe}.public-app-bottom .active svg{stroke-width:2.8}
 .pf-menu-open .public-app-bottom,.pf-search-open .public-app-bottom,.pf-public-more-open .public-app-bottom{transform:translateY(calc(100% + 24px));opacity:0;pointer-events:none}
 .public-more-backdrop{position:fixed;inset:0;z-index:100260;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:rgba(5,5,5,.48);backdrop-filter:blur(5px)}.public-more-sheet{width:min(720px,100%);max-height:min(620px,82vh);overflow:auto;border-radius:24px;background:#fff;box-shadow:0 28px 80px rgba(0,0,0,.3);padding:20px}.public-more-sheet header{display:flex;align-items:center;justify-content:space-between;gap:16px}.public-more-sheet header span{color:#2daaf5;font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.public-more-sheet header h2{margin:3px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;line-height:.9;text-transform:uppercase}.public-more-sheet header button{width:42px;height:42px;border:0;border-radius:50%;background:#eef2f5;display:grid;place-items:center}.public-more-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}.public-more-grid>a{display:grid;grid-template-columns:44px minmax(0,1fr);align-items:center;gap:11px;padding:14px;border:1px solid #e0e6eb;border-radius:16px;color:#111;text-decoration:none;background:#fff}.public-more-grid i{width:44px;height:44px;border-radius:13px;background:#0d1117;color:#fff;display:grid;place-items:center;font-style:normal}.public-more-grid strong,.public-more-grid small{display:block}.public-more-grid small{margin-top:3px;color:#7a828b;font-size:10px;line-height:1.25}
}
@media(min-width:761px) and (max-width:1024px){.public-app-bottom{left:50%;right:auto;bottom:18px;width:min(760px,calc(100% - 36px));transform:translateX(-50%);border:1px solid #dfe4e8;border-radius:20px;padding:7px;box-shadow:0 12px 34px rgba(15,23,42,.15)}.pf-menu-open .public-app-bottom,.pf-search-open .public-app-bottom,.pf-public-more-open .public-app-bottom{transform:translate(-50%,calc(100% + 40px))}}
@media(max-width:520px){.public-more-backdrop{padding:10px}.public-more-sheet{border-radius:22px 22px 16px 16px;padding:17px}.public-more-grid{grid-template-columns:1fr}}
`
