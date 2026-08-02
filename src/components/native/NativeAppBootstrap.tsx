import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

type CapacitorBridge={isNativePlatform?:()=>boolean;getPlatform?:()=>string}
declare global{interface Window{Capacitor?:CapacitorBridge}}

const LAST_CLUB_KEY='playfooty.native.lastClub.v1'

export default function NativeAppBootstrap(){
 const{pathname}=useLocation();const navigate=useNavigate()
 useEffect(()=>{
  const bridge=window.Capacitor
  const native=Boolean(bridge?.isNativePlatform?.())
  const platform=bridge?.getPlatform?.()
  document.documentElement.classList.toggle('pf-native-app',native)
  document.documentElement.classList.toggle('pf-native-ios',native&&platform==='ios')
  if(!native)return
  const clubMatch=pathname.match(/^\/club-portal\/([^/]+)/)
  if(clubMatch){try{localStorage.setItem(LAST_CLUB_KEY,clubMatch[1])}catch{};return}
  if(pathname==='/'||pathname==='/club-portal'){
   let lastClub='';try{lastClub=localStorage.getItem(LAST_CLUB_KEY)||''}catch{}
   navigate(lastClub?`/club-portal/${encodeURIComponent(lastClub)}`:'/club-portal',{replace:true})
  }
 },[navigate,pathname])
 useEffect(()=>()=>{document.documentElement.classList.remove('pf-native-app','pf-native-ios')},[])
 return null
}
