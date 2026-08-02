import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const VISITOR_KEY='playfooty.analytics.visitor.v1'
const SESSION_KEY='playfooty.analytics.session.v1'

function id(key:string){
 try{
  const existing=sessionStorage.getItem(key)||localStorage.getItem(key)
  if(existing)return existing
  const next=crypto.randomUUID()
  if(key===SESSION_KEY)sessionStorage.setItem(key,next);else localStorage.setItem(key,next)
  return next
 }catch{return undefined}
}

export function sendAnalyticsEvent(event:Record<string,unknown>){
 const payload=JSON.stringify({event:{...event,visitorId:id(VISITOR_KEY),sessionId:id(SESSION_KEY),referrer:document.referrer||undefined,path:window.location.pathname}})
 try{
  if(navigator.sendBeacon){navigator.sendBeacon('/api/analytics/event',new Blob([payload],{type:'application/json'}));return}
 }catch{}
 void fetch('/api/analytics/event',{method:'POST',headers:{'content-type':'application/json'},body:payload,keepalive:true}).catch(()=>{})
}

export default function PublicAnalyticsTracker(){
 const{pathname}=useLocation()
 useEffect(()=>{
  const match=pathname.match(/^\/team\/([^/?#]+)/)
  if(!match)return
  const clubId=decodeURIComponent(match[1])
  const key=`club:${clubId}:${pathname}`
  try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1')}catch{}
  sendAnalyticsEvent({eventType:'CLUB_VIEW',entityType:'CLUB',entityId:clubId})
 },[pathname])
 return null
}
