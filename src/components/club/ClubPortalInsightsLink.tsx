import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ClubPortalInsightsLink(){
 const{pathname}=useLocation()
 useEffect(()=>{
  const match=pathname.match(/^\/club-portal\/([^/]+)$/)
  if(!match)return
  const clubId=match[1]
  const connect=()=>{
   const tools=document.querySelector('.cp-tools')
   if(!tools||tools.querySelector('[data-club-insights]'))return Boolean(tools)
   const link=document.createElement('a')
   link.href=`/club-portal/${clubId}/insights`
   link.dataset.clubInsights='true'
   link.innerHTML='<span aria-hidden="true" style="font-size:22px;line-height:1">↗</span><div><strong>Performance &amp; actions</strong><span>Views, notifications and work requiring attention</span></div><span aria-hidden="true">→</span>'
   tools.prepend(link)
   return true
  }
  if(connect())return
  const observer=new MutationObserver(()=>{if(connect())observer.disconnect()})
  observer.observe(document.body,{childList:true,subtree:true})
  const timeout=window.setTimeout(()=>observer.disconnect(),10000)
  return()=>{observer.disconnect();window.clearTimeout(timeout)}
 },[pathname])
 return null
}
