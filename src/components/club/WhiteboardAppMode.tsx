import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Circle, CircleDot, Eraser, Maximize2, MousePointer2, Pause, Pencil, Play, Radio, Redo2, RotateCcw, Save, Shapes, Square, Undo2, Users, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

type Tray='players'|'opposition'|'ball'|'shapes'|null
type ActiveTool='move'|'line'|'arrow'|'zone'|'erase'

export default function WhiteboardAppMode(){
 const{pathname}=useLocation()
 const navigate=useNavigate()
 const active=/^\/club-portal\/[^/]+\/whiteboard(?:\/|$)/.test(pathname)
 const[tray,setTray]=useState<Tray>(null)
 const[activeTool,setActiveTool]=useState<ActiveTool>('move')
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
  if(tray&&tray!=='shapes')document.body.setAttribute('data-wb-tray',tray)
  else document.body.removeAttribute('data-wb-tray')
 },[active,tray])

 if(!active)return null

 const click=(scope:string,label:string)=>{
  const buttons=[...document.querySelectorAll<HTMLButtonElement>(`${scope} button`)]
  buttons.find(button=>(button.textContent||'').trim().toLowerCase().startsWith(label.toLowerCase()))?.click()
 }
 const selectTool=(tool:ActiveTool)=>{setActiveTool(tool);setTray(null);click('.wb .tools',tool)}
 const save=()=>document.querySelector<HTMLButtonElement>('.wb .meta .save')?.click()
 const fullscreen=async()=>{try{await document.documentElement.requestFullscreen?.()}catch{}}
 const toggle=(next:Exclude<Tray,null>)=>setTray(current=>current===next?null:next)
 const shapesActive=['line','arrow','zone'].includes(activeTool)

 const dock=<>
  <button className="wb-app-back" onClick={()=>navigate(-1)} aria-label="Back to Team"><ArrowLeft/></button>
  <button className="wb-app-full" onClick={()=>void fullscreen()} aria-label="Full screen"><Maximize2/></button>
  <nav className="wb-app-dock" aria-label="Whiteboard tools">
   <div className="wb-dock-scroll">
    <button className={activeTool==='move'?'active':''} onClick={()=>selectTool('move')}><MousePointer2/><span>Move</span></button>
    <button className={shapesActive||tray==='shapes'?'active':''} onClick={()=>toggle('shapes')}><Shapes/><span>Shapes</span></button>
    <button className={activeTool==='erase'?'active':''} onClick={()=>selectTool('erase')}><Eraser/><span>Erase</span></button>
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
  {tray==='shapes'&&<div className="wb-shape-tray" role="dialog" aria-label="Choose drawing shape">
   <button className={activeTool==='line'?'active':''} onClick={()=>selectTool('line')}><Pencil/><span>Line</span></button>
   <button className={activeTool==='arrow'?'active':''} onClick={()=>selectTool('arrow')}><ArrowLeft/><span>Arrow</span></button>
   <button className={activeTool==='zone'?'active':''} onClick={()=>selectTool('zone')}><Circle/><span>Circle / Zone</span></button>
   <button className={activeTool==='zone'?'active':''} onClick={()=>selectTool('zone')}><CircleDot/><span>Free Zone</span></button>
  </div>}
  {tray&&tray!=='shapes'&&<button className="wb-tray-close" onClick={()=>setTray(null)} aria-label="Close tray"><X/></button>}
  {portrait&&<div className="wb-rotate"><RotateCcw/><strong>Rotate your device</strong><span>The whiteboard works in landscape.</span></div>}
  <style>{styles}</style>
 </>
 return createPortal(dock,document.body)
}

const styles=`
body.pf-whiteboard-app{overflow:hidden!important;background:#0b1219!important}.pf-whiteboard-app .pf-nav,.pf-whiteboard-app footer,.pf-whiteboard-app .coach-app-bottom{display:none!important}.pf-whiteboard-app .wb{position:fixed!important;inset:0!important;z-index:100500!important;margin:0!important;padding:0!important;min-height:0!important;background:#0b1219!important;overflow:hidden!important}.pf-whiteboard-app .wb>header{display:none!important}.pf-whiteboard-app .wb>.meta{position:absolute!important;z-index:30!important;top:0!important;left:60px!important;right:60px!important;height:68px!important;max-width:none!important;margin:0!important;padding:10px 8px 8px!important;display:grid!important;grid-template-columns:1.05fr 1fr .62fr .9fr 52px!important;gap:7px!important;align-items:end!important;border:0!important;border-radius:0!important;background:#0b1219!important;box-sizing:border-box!important}.pf-whiteboard-app .wb>.meta label{display:flex!important;min-width:0!important;flex-direction:column!important;gap:3px!important;font-size:9px!important;line-height:1!important;color:#91a0ad!important;text-transform:uppercase!important;font-weight:900!important;overflow:visible!important}.pf-whiteboard-app .wb>.meta input,.pf-whiteboard-app .wb>.meta select{height:43px!important;margin:0!important;padding:0 10px!important;border:1px solid #344452!important;border-radius:10px!important;background:#17242f!important;color:#fff!important;font-size:12px!important}.pf-whiteboard-app .wb>.meta .save{width:52px!important;height:43px!important;padding:0!important;font-size:0!important;background:#42b8ff!important}.pf-whiteboard-app .wb>.meta .delete{display:none!important}.pf-whiteboard-app .workspace{position:absolute!important;inset:68px 0 86px!important;max-width:none!important;margin:0!important;padding:8px!important;display:block!important;overflow:hidden!important;box-sizing:border-box!important}.pf-whiteboard-app .board-shell{position:absolute!important;inset:8px!important;margin:0!important;padding:0!important;border:0!important;border-radius:16px!important;background:#f7f9fb!important;overflow:hidden!important}.pf-whiteboard-app .board-shell>.tools,.pf-whiteboard-app .board-shell>.playbar,.pf-whiteboard-app .board-shell>.choreo{display:none!important}.pf-whiteboard-app .oval{position:absolute!important;inset:14px 18px 58px!important;width:auto!important;height:auto!important;aspect-ratio:auto!important;border-radius:50% / 46%!important;box-sizing:border-box!important}.pf-whiteboard-app .legend{position:absolute!important;z-index:20!important;left:18px!important;bottom:22px!important;right:18px!important;margin:0!important;padding-bottom:0!important;background:rgba(247,249,251,.92)!important}.pf-whiteboard-app .workspace>aside{display:none!important}.pf-whiteboard-app[data-wb-tray] .workspace>aside{display:block!important;position:fixed!important;z-index:100850!important;left:12px!important;right:12px!important;bottom:94px!important;max-height:210px!important;padding:10px!important;border-radius:16px!important;background:#101820!important;box-shadow:0 14px 40px rgba(0,0,0,.38)!important;overflow:auto!important}.pf-whiteboard-app[data-wb-tray] .workspace>aside>section{display:none!important;margin:0!important;padding:12px!important;border:0!important;background:#fff!important}.pf-whiteboard-app[data-wb-tray="players"] .workspace>aside>section:nth-child(1),.pf-whiteboard-app[data-wb-tray="opposition"] .workspace>aside>section:nth-child(2),.pf-whiteboard-app[data-wb-tray="ball"] .workspace>aside>section:nth-child(3){display:block!important}.pf-whiteboard-app[data-wb-tray] .player-bank{display:flex!important;gap:8px!important;max-height:150px!important;overflow-x:auto!important}.pf-whiteboard-app[data-wb-tray] .player-bank button{flex:0 0 150px!important}.wb-app-back,.wb-app-full{position:fixed;z-index:100950;top:10px;width:48px;height:48px;border:0;border-radius:12px;display:grid;place-items:center;background:#17242f;color:#fff}.wb-app-back{left:7px}.wb-app-full{right:7px;background:#42b8ff;color:#061018}.wb-app-back svg,.wb-app-full svg{width:21px}.wb-app-dock{position:fixed;z-index:100920;left:0;right:0;bottom:0;height:86px;padding:8px max(8px,env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));background:#0b1219;border-top:1px solid #2a3946;box-sizing:border-box}.wb-dock-scroll{height:100%;display:flex;gap:7px;align-items:center;overflow-x:auto;scrollbar-width:none}.wb-dock-scroll::-webkit-scrollbar{display:none}.wb-app-dock button{flex:0 0 66px;height:68px;border:1px solid #31414f;border-radius:12px;background:#182630;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:10px;font-weight:900;transition:background .15s ease,color .15s ease,border-color .15s ease,transform .15s ease}.wb-app-dock button svg{width:21px;height:21px}.wb-app-dock button.active,.wb-app-dock button.save{background:#42b8ff!important;color:#061018!important;border-color:#42b8ff!important;box-shadow:0 0 0 2px rgba(66,184,255,.25) inset}.wb-app-dock button:active{transform:scale(.97)}.wb-app-dock button.record{background:#982b2b}.ball-icon{font-size:23px;color:#a46628;line-height:1}.wb-shape-tray{position:fixed;z-index:100940;left:10px;bottom:94px;display:flex;gap:8px;padding:9px;border:1px solid #31414f;border-radius:15px;background:#101820;box-shadow:0 14px 38px rgba(0,0,0,.38);overflow-x:auto;max-width:calc(100vw - 20px);box-sizing:border-box}.wb-shape-tray button{flex:0 0 94px;height:66px;border:1px solid #31414f;border-radius:11px;background:#182630;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:10px;font-weight:900}.wb-shape-tray button svg{width:22px;height:22px}.wb-shape-tray button.active{background:#42b8ff;color:#061018;border-color:#42b8ff}.wb-tray-close{position:fixed;z-index:100930;right:20px;bottom:310px;width:40px;height:40px;border:0;border-radius:50%;background:#42b8ff;display:grid;place-items:center}.wb-rotate{position:fixed;inset:0;z-index:101000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#0b1219;color:#fff}.wb-rotate svg{width:42px;height:42px}.wb-rotate strong{font-size:25px}.wb-rotate span{color:#aebbc6}@media(max-height:500px){.pf-whiteboard-app .wb>.meta{height:58px!important;padding-top:6px!important}.pf-whiteboard-app .workspace{inset:58px 0 76px!important}.wb-app-dock{height:76px}.wb-app-dock button{height:60px;flex-basis:60px}.pf-whiteboard-app .oval{inset:8px 12px 48px!important}.pf-whiteboard-app .legend{bottom:17px!important}.pf-whiteboard-app[data-wb-tray] .workspace>aside{max-height:160px!important;bottom:82px!important}.wb-shape-tray{bottom:82px}.wb-shape-tray button{height:58px}.wb-tray-close{bottom:248px}}
`
