import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ClubPortalProfileLinks(){
 const{pathname}=useLocation()
 useEffect(()=>{
  const match=pathname.match(/^\/club-portal\/([^/]+)$/)
  if(!match)return
  const clubId=match[1]
  const connect=()=>document.querySelectorAll<HTMLAnchorElement>('.cp-tools a').forEach(link=>{
   const label=link.querySelector('strong')?.textContent?.trim().toLowerCase()
   if(label==='club profile'||label==='photos and media')link.setAttribute('href',`/club-portal/${clubId}/profile`)
  })
  connect();const observer=new MutationObserver(connect);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()
 },[pathname])
 return null
}
