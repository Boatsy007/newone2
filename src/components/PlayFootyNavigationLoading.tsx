import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PlayFootyLoadingScreen from './PlayFootyLoadingScreen'

const MIN_VISIBLE_MS=420

export default function PlayFootyNavigationLoading(){
 const location=useLocation()
 const[visible,setVisible]=useState(false)
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
   const target=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null
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

 return visible?<PlayFootyLoadingScreen message="Loading…"/>:null
}
