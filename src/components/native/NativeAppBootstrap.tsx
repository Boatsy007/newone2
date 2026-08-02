import { useEffect, useMemo, useState } from 'react'
import { Building2, Check, ChevronDown, LogOut, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ensureFreshPortalSession, type PortalAuthSession, type PortalClubAccount } from '../../lib/portalAuth'

type CapacitorBridge={isNativePlatform?:()=>boolean;getPlatform?:()=>string}
declare global{interface Window{Capacitor?:CapacitorBridge}}

const SESSION_KEY='playfooty.clubPortal.session.v1'
const LAST_CLUB_KEY='playfooty.native.lastClub.v1'

function readSession():PortalAuthSession|null{
 try{const raw=localStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw) as PortalAuthSession:null}catch{return null}
}
function saveSession(value:PortalAuthSession|null){
 try{if(value)localStorage.setItem(SESSION_KEY,JSON.stringify(value));else localStorage.removeItem(SESSION_KEY)}catch{}
}
function rememberClub(clubId:string){try{localStorage.setItem(LAST_CLUB_KEY,clubId)}catch{}}
function rememberedClub(){try{return localStorage.getItem(LAST_CLUB_KEY)||''}catch{return''}}

export default function NativeAppBootstrap(){
 const{pathname}=useLocation();const navigate=useNavigate()
 const[native,setNative]=useState(false);const[session,setSession]=useState<PortalAuthSession|null>(()=>readSession());const[switching,setSwitching]=useState(false);const[checking,setChecking]=useState(true)
 const accounts=useMemo(()=>session?.club_accounts??[],[session]);const clubMatch=pathname.match(/^\/club-portal\/([^/]+)/);const activeClubId=clubMatch?.[1]??'';const activeClub=accounts.find(item=>item.clubId===activeClubId)||null

 useEffect(()=>{
  const bridge=window.Capacitor
  const isNative=Boolean(bridge?.isNativePlatform?.())
  const platform=bridge?.getPlatform?.()
  setNative(isNative)
  document.documentElement.classList.toggle('pf-native-app',isNative)
  document.documentElement.classList.toggle('pf-native-ios',isNative&&platform==='ios')
  return()=>document.documentElement.classList.remove('pf-native-app','pf-native-ios')
 },[])

 useEffect(()=>{
  if(!native){setChecking(false);return}
  let active=true
  const current=readSession()
  if(!current){setSession(null);setChecking(false);if(pathname==='/'||pathname.startsWith('/club-portal/'))navigate('/club-portal',{replace:true});return}
  void ensureFreshPortalSession(current).then(fresh=>{
   if(!active)return
   if(!fresh?.access_token||!(fresh.club_accounts?.length)){saveSession(null);setSession(null);setChecking(false);navigate('/club-portal',{replace:true});return}
   saveSession(fresh);setSession(fresh);setChecking(false)
  }).catch(()=>{
   if(!active)return
   saveSession(null);setSession(null);setChecking(false);navigate('/club-portal',{replace:true})
  })
  return()=>{active=false}
 },[native])

 useEffect(()=>{
  if(!native||checking)return
  const authorised=session?.club_accounts??[]
  if(activeClubId){
   if(authorised.some(item=>item.clubId===activeClubId)){rememberClub(activeClubId);return}
   if(session){const fallback=authorised[0]?.clubId;navigate(fallback?`/club-portal/${encodeURIComponent(fallback)}`:'/club-portal',{replace:true})}
   return
  }
  if(pathname==='/'||pathname==='/club-portal'){
   if(!session)return void navigate('/club-portal',{replace:true})
   const last=rememberedClub();const target=authorised.find(item=>item.clubId===last)?.clubId||authorised[0]?.clubId
   if(target)navigate(`/club-portal/${encodeURIComponent(target)}`,{replace:true})
  }
 },[activeClubId,checking,native,navigate,pathname,session])

 useEffect(()=>{setSwitching(false)},[pathname])

 function chooseClub(account:PortalClubAccount){rememberClub(account.clubId);setSwitching(false);navigate(`/club-portal/${encodeURIComponent(account.clubId)}`)}
 function signOut(){saveSession(null);try{localStorage.removeItem(LAST_CLUB_KEY)}catch{};setSession(null);setSwitching(false);navigate('/club-portal',{replace:true})}

 if(!native||checking||!session||!activeClub)return null
 return createPortal(<>
  <div className="native-club-bar">
   <button type="button" className="native-club-current" onClick={()=>setSwitching(true)} aria-expanded={switching}>
    <ClubMark account={activeClub}/><span><small>Current club</small><strong>{activeClub.clubName}</strong></span>{accounts.length>1&&<ChevronDown size={17}/>} 
   </button>
  </div>
  {switching&&<div className="native-club-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setSwitching(false)}}>
   <section className="native-club-sheet" role="dialog" aria-modal="true" aria-label="Switch club">
    <header><div><small>PLAYFOOTY CLUB</small><h2>Choose club</h2></div><button type="button" onClick={()=>setSwitching(false)} aria-label="Close club switcher"><X size={21}/></button></header>
    <div className="native-club-list">{accounts.map(account=><button type="button" key={account.clubId} onClick={()=>chooseClub(account)} className={account.clubId===activeClubId?'active':''}><ClubMark account={account}/><span><strong>{account.clubName}</strong><small>{account.role.replaceAll('_',' ')}</small></span>{account.clubId===activeClubId&&<Check size={19}/>}</button>)}</div>
    <button type="button" className="native-signout" onClick={signOut}><LogOut size={17}/>Sign out</button>
   </section>
  </div>}
  <style>{styles}</style>
 </>,document.body)
}

function ClubMark({account}:{account:PortalClubAccount}){return account.logoUrl?<img src={account.logoUrl} alt=""/>:<i><Building2 size={20}/></i>}

const styles=`
.native-club-bar,.native-club-overlay{display:none}
.pf-native-app body{padding-top:calc(64px + env(safe-area-inset-top))}
.pf-native-app .native-club-bar{position:fixed;z-index:100500;left:0;right:0;top:0;display:flex;align-items:flex-end;height:calc(58px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 16px 6px;background:rgba(250,251,252,.97);border-bottom:1px solid #dce4ea;backdrop-filter:blur(18px);box-sizing:border-box}
.native-club-current{width:min(480px,100%);margin:0 auto;display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;border:0;background:transparent;color:#111;text-align:left;padding:0}
.native-club-current img,.native-club-list img,.native-club-current i,.native-club-list i{width:38px;height:38px;border-radius:11px;object-fit:contain;background:#eef3f7;display:grid;place-items:center;font-style:normal}
.native-club-current span,.native-club-current small,.native-club-current strong,.native-club-list span,.native-club-list small,.native-club-list strong{display:block;min-width:0}.native-club-current small{font-size:8px;color:#74808c;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.native-club-current strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}
.pf-native-app .native-club-overlay{position:fixed;z-index:100650;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:rgba(5,8,12,.48);backdrop-filter:blur(5px)}
.native-club-sheet{width:min(620px,100%);max-height:82vh;overflow:auto;border-radius:24px;background:#fff;padding:20px;box-shadow:0 30px 90px rgba(0,0,0,.32)}.native-club-sheet header{display:flex;justify-content:space-between;align-items:center;gap:14px}.native-club-sheet header small{color:#0783c9;font-size:9px;font-weight:950;letter-spacing:.16em}.native-club-sheet h2{margin:4px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;line-height:.9;text-transform:uppercase}.native-club-sheet header button{width:42px;height:42px;border:0;border-radius:50%;background:#eef2f5;display:grid;place-items:center}.native-club-list{display:grid;gap:9px;margin-top:18px}.native-club-list>button{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:11px;width:100%;padding:12px;border:1px solid #e0e6eb;border-radius:15px;background:#fff;text-align:left}.native-club-list>button.active{border-color:#2daaf5;background:#edf8ff}.native-club-list img,.native-club-list i{width:44px;height:44px}.native-club-list strong{font-size:15px}.native-club-list small{margin-top:3px;color:#71808d;font-size:9px;font-weight:900;text-transform:uppercase}.native-club-list svg{color:#0783c9}.native-signout{width:100%;margin-top:14px;display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:12px;padding:13px;background:#111318;color:#fff;font-weight:950;text-transform:uppercase}
@media(min-width:760px){.pf-native-app .native-club-overlay{align-items:center}.native-club-sheet{border-radius:26px}}
`
