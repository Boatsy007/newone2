import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ClubPortalSponsorLink(){
 const{pathname}=useLocation()
 useEffect(()=>{
  const match=pathname.match(/^\/club-portal\/([^/]+)$/)
  if(!match)return
  const connect=()=>{
   document.querySelectorAll<HTMLAnchorElement>('.cp-tools a').forEach(link=>{
    const label=link.querySelector('strong')?.textContent?.trim().toLowerCase()
    if(label==='sponsors')link.setAttribute('href',`/club-portal/${match[1]}/sponsors`)
   })
  }
  connect();const observer=new MutationObserver(connect);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()
 },[pathname])
 return null
}
