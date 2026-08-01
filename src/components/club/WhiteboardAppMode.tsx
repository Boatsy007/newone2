import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CircleDot, Eraser, Maximize2, MousePointer2, Pause, Pencil, Play, Radio, Redo2, RotateCcw, Save, Square, Undo2, Users, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

type Tray='players'|'opposition'|'ball'|null

export default function WhiteboardAppMode(){
 const{pathname}=useLocation()
 const navigate=useNavigate()
 const active=/^\/club-portal\/[^/]+\/whiteboard(?:\/|$)/.test(pathname)
 const[tray,setTray]=useState<Tray>(null)
 const[portrait,setPortrait]=useState(false)

 useEffect(()=>{
  if(!active)return
  const update=()=>setPortrait(window.innerHeight>window.innerWidth&&window.innerWidth<1025)
  document.body.classList.add('pf-whiteboard-app')
  update()
  window.addEventListener('resize',update)
  window.addEventListener('orientationchange',update)
  return()=>{
   document.body.classList.remove('pf-whiteboard-app')
   document.body.removeAttribute('data-wb-tray')
   window.removeEventListener('resize',update)
   window.removeEventListener('orientationchange',update)
  }
 },[active])

 useEffect(()=>{
  if(!active)return
  if(tray)document.body.setAttribute('data-wb-tray',tray)
  else document.body.removeAttribute('data-wb-tray')
 },[active,tray])

 if(!active)return null

 const click=(scope:string,label:string)=>{
  const buttons=[...document.querySelectorAll<HTMLButtonElement>(`${scope} button`)]
  buttons.find(button=>(button.textContent||'').trim().toLowerCase().startsWith(label.toLowerCase()))?.click()
 }
 const save=()=>document.querySelector<HTMLButtonElement>('.wb .meta .save')?.click()
 const fullscreen=async()=>{try{await document.documentElement.requestFullscreen?.()}catch{}}
 const toggle=(next:Exclude<Tray,null>)=>setTray(current=>current===next?null:next)

 const dock=<>
  <button className="wb-app-back" onClick={()=>navigate(-1)} aria-label="Back to Team"><ArrowLeft/></button>
  <button className="wb-app-full" onClick={()=>void fullscreen()} aria-label="Full screen"><Maximize2/></button>
  <nav className="wb-app-dock" aria-label="Whiteboard tools">
   <div className="wb-dock-scroll">
    <button onClick={()=>click('.wb .tools','move')}><MousePointer2/><span>Move</span></button>
    <button onClick={()=>click('.wb .tools','line')}><Pencil/><span>Line</span></button>
    <button onClick={()=>click('.wb .tools','arrow')}><ArrowLeft/><span>Arrow</span></button>
    <button onClick={()=>click('.wb .tools','zone')}><CircleDot/><span>Zone</span></button>
    <button onClick={()=>click('.wb .tools','erase')}><Eraser/><span>Erase</span></button>
    <button onClick={()=>click('.wb .tools','undo')}><Undo2/><span>Undo</span></button>
    <button onClick={()=>click('.wb .tools','redo')}><Redo2/><span>Redo</span></button>
    <button className={tray==='players'?'active':''} onClick={()=>toggle('players')}><Users/><span>Players</span></button>
    <button className={tray==='opposition'?'active':''} onClick={()=>toggle('opposition')}><CircleDot/><span>Opposition</span></button>
    <button className={tray==='ball'?'active':''} onClick={()=>toggle('ball')}><span className="ball-icon">●</span><span>Ball</span></button>
    <button className="record" onClick={()=>click('.wb .playbar','record')}><Radio/><span>Record</span></button>
    <button onClick={()=>click('.wb .playbar','stop')}><Square/><span>Stop</span></button>
    <button onClick={()=>click('.wb .playbar','play')}><Play/><span>Play</span></button>
    <button onClick={()=>click('.wb .playbar','pause')}><Pause/><span>Pause</span></button>
    <button onClick={()=>click('.wb .playbar','restart')}><RotateCcw/><span>Restart</span></button>
    <button onClick={()=>click('.wb .playbar','clear motion')}><X/><span>Clear</span></button>
    <button className="save" onClick={save}><Save/><span>Save</span></button>
   </div>
  </nav>
  {tray&&<button className="wb-tray-close" onClick={()=>setTray(null)} aria-label="Close tray"><X/></button>}
  {portrait&&<div className="wb-rotate"><RotateCcw/><strong>Rotate your device</strong><span>The whiteboard works in landscape.</span></div>}
  <style>{styles}</style>
 </>
 return createPortal(dock,document.body)
}

const styles=`
body.pf-whiteboard-app{overflow:hidden!important;background:#0b1219!important}.pf-whiteboard-app .pf-nav,.pf-whiteboard-app footer,.pf-whiteboard-app .coach-app-bottom{display:none!important}.pf-whiteboard-app .wb{position:fixed!important;inset:0!important;z-index:100500!important;margin:0!important;padding:0!important;min-height:0!important;background:#0b1219!important;overflow:hidden!important}.pf-whiteboard-app .wb>header{display:none!important}.pf-whiteboard-app .wb>.meta{position:absolute!important;z-index:30!important;top:0!important;left:54px!important;right:54px!important;height:58px!important;max-width:none!important;margin:0!important;padding:6px!important;display:grid!important;grid-template-columns:1.05fr 1fr .62fr .9fr 48px!important;gap:6px!important;align-items:center!important;border:0!important;border-radius:0!important;background:#0b1219!important;box-sizing:border-box!important}.pf-whiteboard-app .wb>.meta label{font-size:0!important}.pf-whiteboard-app .wb>.meta input,.pf-whiteboard-app .wb>.meta select{height:44px!important;margin:0!important;padding:0 10px!important;border:1px solid #344452!important;border-radius:10px!important;background:#17242f!important;color:#fff!important;font-size:12px!important}.pf-whiteboard-app .wb>.meta .save{width:48px!important;height:44px!important;padding:0!important;font-size:0!important;background:#42b8ff!important}.pf-whiteboard-app .wb>.meta .delete{display:none!important}.pf-whiteboard-app .workspace{position:absolute!important;inset:58px 0 74px!important;max-width:none!important;margin:0!important;padding:8px!important;display:block!important;overflow:hidden!important;box-sizing:border-box!important}.pf-whiteboard-app .board-shell{position:absolute!important;inset:8px!important;margin:0!important;padding:0!important;border:0!important;border-radius:16px!important;background:#f7f9fb!important;overflow:hidden!important}.pf-whiteboard-app .board-shell>.tools,.pf-whiteboard-app .board-shell>.playbar,.pf-whiteboard-app .board-shell>.choreo{display:none!important}.pf-whiteboard-app .oval{position:absolute!important;inset:14px 18px 42px!important;width:auto!important;height:auto!important;aspect-ratio:auto!important;border-radius:50% / 46%!important;box-sizing:border-box!important}.pf-whiteboard-app .legend{position:absolute!important;left:18px!important;bottom:8px!important;right:18px!important;margin:0!important}.pf-whiteboard-app .workspace>aside{display:none!important}.pf-whiteboard-app[data-wb-tray] .workspace>aside{display:block!important;position:fixed!important;z-index:100850!important;left:12px!important;right:12px!important;bottom:82px!important;max-height:210px!important;padding:10px!important;border-radius:16px!important;background:#101820!important;box-shadow:0 14px 40px rgba(0,0,0,.38)!important;overflow:auto!important}.pf-whiteboard-app[data-wb-tray] .workspace>aside>section{display:none!important;margin:0!important;padding:12px!important;border:0!important;background:#fff!important}.pf-whiteboard-app[data-wb-tray="players"] .workspace>aside>section:nth-child(1),.pf-whiteboard-app[data-wb-tray="opposition"] .workspace>aside>section:nth-child(2),.pf-whiteboard-app[data-wb-tray="ball"] .workspace>aside>section:nth-child(3){display:block!important}.pf-whiteboard-app[data-wb-tray] .player-bank{display:flex!important;gap:8px!important;max-height:150px!important;overflow-x:auto!important}.pf-whiteboard-app[data-wb-tray] .player-bank button{flex:0 0 150px!important}.wb-app-back,.wb-app-full{position:fixed;z-index:100950;top:7px;width:44px;height:44px;border:0;border-radius:11px;display:grid;place-items:center;background:#17242f;color:#fff}.wb-app-back{left:6px}.wb-app-full{right:6px;background:#42b8ff;color:#061018}.wb-app-back svg,.wb-app-full svg{width:20px}.wb-app-dock{position:fixed;z-index:100920;left:0;right:0;bottom:0;height:74px;padding:7px max(8px,env(safe-area-inset-right)) calc(7px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));background:#0b1219;border-top:1px solid #2a3946;box-sizing:border-box}.wb-dock-scroll{height:100%;display:flex;gap:6px;align-items:center;overflow-x:auto;scrollbar-width:none}.wb-dock-scroll::-webkit-scrollbar{display:none}.wb-app-dock button{flex:0 0 58px;height:58px;border:1px solid #31414f;border-radius:11px;background:#182630;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:9px;font-weight:850}.wb-app-dock button svg{width:19px;height:19px}.wb-app-dock button.active,.wb-app-dock button.save{background:#42b8ff;color:#061018}.wb-app-dock button.record{background:#982b2b}.ball-icon{font-size:21px;color:#a46628;line-height:1}.wb-tray-close{position:fixed;z-index:100930;right:20px;bottom:286px;width:38px;height:38px;border:0;border-radius:50%;background:#42b8ff;display:grid;place-items:center}.wb-rotate{position:fixed;inset:0;z-index:101000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#0b1219;color:#fff}.wb-rotate svg{width:42px;height:42px}.wb-rotate strong{font-size:25px}.wb-rotate span{color:#aebbc6}@media(max-height:500px){.pf-whiteboard-app .wb>.meta{height:50px!important}.pf-whiteboard-app .workspace{inset:50px 0 66px!important}.wb-app-dock{height:66px}.wb-app-dock button{height:50px;flex-basis:52px}.pf-whiteboard-app .oval{inset:8px 12px 32px!important}.pf-whiteboard-app[data-wb-tray] .workspace>aside{max-height:160px!important;bottom:72px!important}.wb-tray-close{bottom:238px}}
`
