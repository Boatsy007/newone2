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

function sponsorId(element:HTMLElement){
 const anchor=element.closest<HTMLAnchorElement>('a')
 return (anchor?.href||element.textContent||'sponsor').slice(0,180)
}

export default function PublicAnalyticsTracker(){
 const{pathname}=useLocation()
 useEffect(()=>{
  const match=pathname.match(/^\/team\/([^/?#]+)/)
  if(!match)return
  const clubId=decodeURIComponent(match[1])
  const viewKey=`club:${clubId}:${pathname}`
  try{if(!sessionStorage.getItem(viewKey)){sessionStorage.setItem(viewKey,'1');sendAnalyticsEvent({eventType:'CLUB_VIEW',entityType:'CLUB',entityId:clubId})}}catch{sendAnalyticsEvent({eventType:'CLUB_VIEW',entityType:'CLUB',entityId:clubId})}

  const tracked=new WeakSet<Element>()
  const scan=()=>document.querySelectorAll<HTMLElement>('.pf-sponsor-feature,.pf-sponsor-card').forEach(element=>{
    if(tracked.has(element))return
    tracked.add(element)
    sendAnalyticsEvent({eventType:'SPONSOR_IMPRESSION',entityType:'SPONSOR',entityId:sponsorId(element),meta:{clubId,placement:element.classList.contains('pf-sponsor-feature')?'featured':'profile'}})
  })
  const click=(event:MouseEvent)=>{
    const element=event.target instanceof Element?event.target.closest<HTMLElement>('.pf-sponsor-feature,.pf-sponsor-card'):null
    if(!element)return
    sendAnalyticsEvent({eventType:'SPONSOR_CLICK',entityType:'SPONSOR',entityId:sponsorId(element),meta:{clubId,placement:element.classList.contains('pf-sponsor-feature')?'featured':'profile'}})
  }
  scan()
  const observer=new MutationObserver(scan)
  observer.observe(document.body,{childList:true,subtree:true})
  document.addEventListener('click',click,true)
  return()=>{observer.disconnect();document.removeEventListener('click',click,true)}
 },[pathname])
 return null
}
