import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function WhiteboardAppMode(){
 const{pathname}=useLocation()
 const active=/^\/club-portal\/[^/]+\/whiteboard(?:\/|$)/.test(pathname)
 useEffect(()=>{
  document.body.classList.remove('pf-whiteboard-app')
  return()=>document.body.classList.remove('pf-whiteboard-app')
 },[active])
 return null
}
