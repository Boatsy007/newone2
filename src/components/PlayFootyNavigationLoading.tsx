import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PlayFootyLoadingScreen from './PlayFootyLoadingScreen'

const MIN_VISIBLE_MS=420
const INTERNAL_CARD_SELECTORS=['.flow-card','.tool-grid>button','.cacd-grid button.live']
const LOADING_WORDS=/\b(loading|opening|checking|preparing|fetching)\b/i

export default function PlayFootyNavigationLoading(){
 const location=useLocation()
 const[visible,setVisible]=useState(false)
 const[legacyLoading,setLegacyLoading]=useState(false)
 const startedAt=useRef(0)
 const timer=useRef<number|null>(null)

 function show(){
  if(timer.current!==null){window.clearTimeout(timer.current);timer.current=null}
  startedAt.current=Date.now()
  setVisible(true)
 }

 useEffect(()=>{
  const onClick=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return
   const element=event.target instanceof Element?event.target:null
   if(!element)return
   const internalCard=INTERNAL_CARD_SELECTORS.some(selector=>Boolean(element.closest(selector)))
   if(internalCard){show();return}
   const target=element.closest<HTMLAnchorElement>('a[href]')
   if(!target||target.target==='_blank'||target.hasAttribute('download'))return
   const href=target.getAttribute('href')||''
   if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:')||href.startsWith('javascript:'))return
   let destination:URL
   try{destination=new URL(target.href,window.location.href)}catch{return}
   if(destination.origin!==window.location.origin)return
   if(destination.pathname===window.location.pathname&&destination.search===window.location.search&&destination.hash===window.location.hash)return
   show()
  }
  document.addEventListener('click',onClick,true)
  return()=>document.removeEventListener('click',onClick,true)
 },[])

 useEffect(()=>{
  if(!visible)return
  const remaining=Math.max(0,MIN_VISIBLE_MS-(Date.now()-startedAt.current))
  timer.current=window.setTimeout(()=>{setVisible(false);timer.current=null},remaining)
  return()=>{if(timer.current!==null){window.clearTimeout(timer.current);timer.current=null}}
 },[location.pathname,location.search,location.hash,visible])

 useEffect(()=>{
  let queued=0
  const inspect=()=>{
   queued=0
   const candidates=Array.from(document.querySelectorAll<HTMLElement>('[class*="loading"],[class*="state"]'))
   const found=candidates.some(node=>{
    if(node.closest('.playfooty-loading-screen'))return false
    const style=window.getComputedStyle(node)
    if(style.display==='none'||style.visibility==='hidden')return false
    const text=(node.textContent||'').replace(/\s+/g,' ').trim()
    return LOADING_WORDS.test(text)
   })
   setLegacyLoading(current=>current===found?current:found)
  }
  const schedule=()=>{if(queued)return;queued=window.requestAnimationFrame(inspect)}
  inspect()
  const observer=new MutationObserver(schedule)
  observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','style']})
  return()=>{observer.disconnect();if(queued)window.cancelAnimationFrame(queued)}
 },[location.pathname,location.search])

 return visible||legacyLoading?<PlayFootyLoadingScreen message="Loading…"/>:null
}
