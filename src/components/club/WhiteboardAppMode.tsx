import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Circle, CircleDot, Eraser, Maximize2, MousePointer2, Pause, Pencil, Play, Radio, Redo2, RotateCcw, Save, Shapes, Square, Undo2, Users, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

type Tray='players'|'opposition'|'ball'|'shapes'|'media'|null
type ActiveTool='move'|'line'|'arrow'|'zone'|'erase'
type MediaState='idle'|'recording'|'playing'|'paused'

export default function WhiteboardAppMode(){
 const{pathname}=useLocation()
 const navigate=useNavigate()
 const active=/^\/club-portal\/[^/]+\/whiteboard(?:\/|$)/.test(pathname)
 const[tray,setTray]=useState<Tray>(null)
 const[activeTool,setActiveTool]=useState<ActiveTool>('move')
 const[mediaState,setMediaState]=useState<MediaState>('idle')
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
  if(tray&&['players','opposition','ball'].includes(tray))document.body.setAttribute('data-wb-tray',tray)
  else document.body.removeAttribute('data-wb-tray')
 },[active,tray])

 if(!active)return null

 const click=(scope:string,label:string)=>{
  const buttons=[...document.querySelectorAll<HTMLButtonElement>(`${scope} button`)]
  buttons.find(button=>(button.textContent||'').trim().toLowerCase().startsWith(label.toLowerCase()))?.click()
 }
 const selectTool=(tool:ActiveTool)=>{setActiveTool(tool);setTray(null);click('.wb .tools',tool)}
 const toggle=(next:Exclude<Tray,null>)=>setTray(current=>current===next?null:next)
 const save=()=>document.querySelector<HTMLButtonElement>('.wb .meta .save')?.click()
 const fullscreen=async()=>{try{await document.documentElement.requestFullscreen?.()}catch{}}
 const startRecording=()=>{click('.wb .playbar','record');setMediaState('recording');setTray(null)}
 const stopMedia=()=>{click('.wb .playbar','stop');setMediaState('idle')}
 const startPlay=()=>{click('.wb .playbar','play');setMediaState('playing');setTray(null)}
 const pausePlay=()=>{click('.wb .playbar','pause');setMediaState('paused')}
 const resumePlay=()=>{click('.wb .playbar','play');setMediaState('playing')}
 const restart=()=>{click('.wb .playbar','restart');setMediaState('idle');setTray(null)}
 const clearMotion=()=>{click('.wb .playbar','clear motion');setMediaState('idle');setTray(null)}
 const shapesActive=['line','arrow','zone'].includes(activeTool)

 const ui=<>
  <button className="wb-app-back" onClick={()=>navigate(-1)} aria-label="Back to Team"><ArrowLeft/></button>
  <button className="wb-app-full" onClick={()=>void fullscreen()} aria-label="Full screen"><Maximize2/></button>

  <nav className="wb-app-rail" aria-label="Whiteboard tools">
   <button className={activeTool==='move'?'active':''} onClick={()=>selectTool('move')}><MousePointer2/><span>Move</span></button>
   <button className={shapesActive||tray==='shapes'?'active':''} onClick={()=>toggle('shapes')}><Shapes/><span>Shapes</span></button>
   <button className={activeTool==='erase'?'active':''} onClick={()=>selectTool('erase')}><Eraser/><span>Erase</span></button>
   <button onClick={()=>click('.wb .tools','undo')}><Undo2/><span>Undo</span></button>
   <button onClick={()=>click('.wb .tools','redo')}><Redo2/><span>Redo</span></button>
   <button className={tray==='players'?'active':''} onClick={()=>toggle('players')}><Users/><span>Players</span></button>
   <button className={tray==='opposition'?'active':''} onClick={()=>toggle('opposition')}><CircleDot/><span>Opposition</span></button>
   <button className={tray==='ball'?'active':''} onClick={()=>toggle('ball')}><span className="ball-icon">●</span><span>Ball</span></button>
   <button className={tray==='media'||mediaState!=='idle'?'active media':''} onClick={()=>toggle('media')}><Radio/><span>Record<br/>& Play</span></button>
   <button className="save" onClick={save}><Save/><span>Save</span></button>
  </nav>

  {tray==='shapes'&&<div className="wb-popup wb-shape-tray" role="dialog" aria-label="Choose drawing shape">
   <button className={activeTool==='line'?'active':''} onClick={()=>selectTool('line')}><Pencil/><span>Line</span></button>
   <button className={activeTool==='arrow'?'active':''} onClick={()=>selectTool('arrow')}><ArrowLeft/><span>Arrow</span></button>
   <button className={activeTool==='zone'?'active':''} onClick={()=>selectTool('zone')}><Circle/><span>Circle / Zone</span></button>
  </div>}

  {tray==='media'&&<div className="wb-popup wb-media-tray" role="dialog" aria-label="Record and playback controls">
   <button className="record" onClick={startRecording}><Radio/><span>Record play</span></button>
   <button onClick={startPlay}><Play/><span>Play recording</span></button>
   <button onClick={restart}><RotateCcw/><span>Restart</span></button>
   <button onClick={clearMotion}><X/><span>Clear motion</span></button>
  </div>}

  {mediaState!=='idle'&&<div className="wb-live-controls" aria-label="Active recording controls">
   <span className={mediaState==='recording'?'recording':'playing'}>{mediaState==='recording'?'Recording':mediaState==='paused'?'Paused':'Playing'}</span>
   {mediaState==='playing'&&<button onClick={pausePlay}><Pause/><b>Pause</b></button>}
   {mediaState==='paused'&&<button onClick={resumePlay}><Play/><b>Resume</b></button>}
   <button onClick={stopMedia}><Square/><b>Stop</b></button>
  </div>}

  {tray&&['players','opposition','ball'].includes(tray)&&<button className="wb-tray-close" onClick={()=>setTray(null)} aria-label="Close tray"><X/></button>}
  {portrait&&<div className="wb-rotate"><RotateCcw/><strong>Rotate your device</strong><span>The whiteboard works in landscape.</span></div>}
  <style>{styles}</style>
 </>
 return createPortal(ui,document.body)
}

const styles=`
body.pf-whiteboard-app{overflow:hidden!important;background:#0b1219!important}.pf-whiteboard-app .pf-nav,.pf-whiteboard-app footer,.pf-whiteboard-app .coach-app-bottom{display:none!important}.pf-whiteboard-app .wb{position:fixed!important;inset:0!important;z-index:100500!important;margin:0!important;padding:0!important;min-height:0!important;background:#0b1219!important;overflow:hidden!important}.pf-whiteboard-app .wb>header{display:none!important}.pf-whiteboard-app .wb>.meta{position:absolute!important;z-index:30!important;top:0!important;left:154px!important;right:60px!important;height:68px!important;max-width:none!important;margin:0!important;padding:10px 8px 8px!important;display:grid!important;grid-template-columns:1.05fr 1fr .62fr .9fr 52px!important;gap:7px!important;align-items:end!important;border:0!important;border-radius:0!important;background:#0b1219!important;box-sizing:border-box!important}.pf-whiteboard-app .wb>.meta label{display:flex!important;min-width:0!important;flex-direction:column!important;gap:3px!important;font-size:9px!important;line-height:1!important;color:#91a0ad!important;text-transform:uppercase!important;font-weight:900!important}.pf-whiteboard-app .wb>.meta input,.pf-whiteboard-app .wb>.meta select{height:43px!important;margin:0!important;padding:0 10px!important;border:1px solid #344452!important;border-radius:10px!important;background:#17242f!important;color:#fff!important;font-size:12px!important}.pf-whiteboard-app .wb>.meta .save{width:52px!important;height:43px!important;padding:0!important;font-size:0!important;background:#42b8ff!important}.pf-whiteboard-app .wb>.meta .delete{display:none!important}.pf-whiteboard-app .workspace{position:absolute!important;inset:68px 0 0 150px!important;max-width:none!important;margin:0!important;padding:8px!important;display:block!important;overflow:hidden!important;box-sizing:border-box!important}.pf-whiteboard-app .board-shell{position:absolute!important;inset:8px!important;margin:0!important;padding:0!important;border:0!important;border-radius:16px!important;background:#f7f9fb!important;overflow:hidden!important}.pf-whiteboard-app .board-shell>.tools,.pf-whiteboard-app .board-shell>.playbar,.pf-whiteboard-app .board-shell>.choreo{display:none!important}.pf-whiteboard-app .oval{position:absolute!important;inset:14px 18px 54px!important;width:auto!important;height:auto!important;aspect-ratio:auto!important;border-radius:50% / 46%!important;box-sizing:border-box!important}.pf-whiteboard-app .legend{position:absolute!important;z-index:20!important;left:18px!important;bottom:18px!important;right:18px!important;margin:0!important;background:rgba(247,249,251,.92)!important}.pf-whiteboard-app .workspace>aside{display:none!important}.pf-whiteboard-app[data-wb-tray] .workspace>aside{display:block!important;position:fixed!important;z-index:100850!important;left:158px!important;top:78px!important;bottom:auto!important;width:min(520px,calc(100vw - 176px))!important;max-height:230px!important;padding:10px!important;border-radius:16px!important;background:#101820!important;box-shadow:0 14px 40px rgba(0,0,0,.38)!important;overflow:auto!important}.pf-whiteboard-app[data-wb-tray] .workspace>aside>section{display:none!important;margin:0!important;padding:12px!important;border:0!important;background:#fff!important}.pf-whiteboard-app[data-wb-tray="players"] .workspace>aside>section:nth-child(1),.pf-whiteboard-app[data-wb-tray="opposition"] .workspace>aside>section:nth-child(2),.pf-whiteboard-app[data-wb-tray="ball"] .workspace>aside>section:nth-child(3){display:block!important}.pf-whiteboard-app[data-wb-tray] .player-bank{display:flex!important;gap:8px!important;max-height:160px!important;overflow-x:auto!important}.pf-whiteboard-app[data-wb-tray] .player-bank button{flex:0 0 150px!important}.wb-app-back,.wb-app-full{position:fixed;z-index:100950;top:10px;width:48px;height:48px;border:0;border-radius:12px;display:grid;place-items:center;background:#17242f;color:#fff}.wb-app-back{left:7px}.wb-app-full{right:7px;background:#42b8ff;color:#061018}.wb-app-back svg,.wb-app-full svg{width:21px}.wb-app-rail{position:fixed;z-index:100920;left:0;top:68px;bottom:0;width:150px;padding:8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:64px;align-content:start;gap:7px;background:#0b1219;border-right:1px solid #2a3946;box-sizing:border-box;overflow-y:auto;scrollbar-width:none}.wb-app-rail::-webkit-scrollbar{display:none}.wb-app-rail button{min-width:0;height:64px;border:1px solid #31414f;border-radius:12px;background:#182630;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:9px;line-height:1.05;font-weight:900;text-align:center}.wb-app-rail button svg{width:20px;height:20px}.wb-app-rail button.active,.wb-app-rail button.save{background:#42b8ff!important;color:#061018!important;border-color:#42b8ff!important;box-shadow:0 0 0 2px rgba(66,184,255,.25) inset}.wb-app-rail button.media.active{background:#982b2b!important;color:#fff!important;border-color:#c04444!important}.ball-icon{font-size:22px;color:#a46628;line-height:1}.wb-popup{position:fixed;z-index:100940;left:158px;top:78px;display:grid;gap:8px;padding:9px;border:1px solid #31414f;border-radius:15px;background:#101820;box-shadow:0 14px 38px rgba(0,0,0,.38);box-sizing:border-box}.wb-popup button{height:58px;border:1px solid #31414f;border-radius:11px;background:#182630;color:#fff;display:flex;align-items:center;gap:9px;padding:0 14px;font-size:11px;font-weight:900}.wb-popup button svg{width:21px;height:21px}.wb-popup button.active{background:#42b8ff;color:#061018;border-color:#42b8ff}.wb-shape-tray{grid-template-columns:repeat(3,140px)}.wb-media-tray{grid-template-columns:repeat(2,160px)}.wb-media-tray button.record{background:#982b2b;border-color:#c04444}.wb-live-controls{position:fixed;z-index:100945;right:24px;top:86px;display:flex;align-items:center;gap:7px;padding:7px;border-radius:14px;background:rgba(11,18,25,.94);box-shadow:0 10px 28px rgba(0,0,0,.3)}.wb-live-controls>span{padding:0 8px;font-size:10px;font-weight:900;text-transform:uppercase;color:#fff}.wb-live-controls>span.recording:before{content:'';display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:50%;background:#f04444;box-shadow:0 0 0 4px rgba(240,68,68,.17)}.wb-live-controls button{height:42px;border:1px solid #3b4b58;border-radius:10px;background:#182630;color:#fff;display:flex;align-items:center;gap:6px;padding:0 12px;font-size:10px}.wb-live-controls button svg{width:18px;height:18px}.wb-tray-close{position:fixed;z-index:100930;left:min(650px,calc(100vw - 54px));top:84px;width:38px;height:38px;border:0;border-radius:50%;background:#42b8ff;display:grid;place-items:center}.wb-rotate{position:fixed;inset:0;z-index:101000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#0b1219;color:#fff}.wb-rotate svg{width:42px;height:42px}.wb-rotate strong{font-size:25px}.wb-rotate span{color:#aebbc6}@media(max-height:500px){.pf-whiteboard-app .wb>.meta{height:58px!important;left:134px!important;padding-top:6px!important}.pf-whiteboard-app .workspace{inset:58px 0 0 130px!important}.wb-app-rail{top:58px;width:130px;grid-auto-rows:56px;padding:6px;gap:5px}.wb-app-rail button{height:56px}.pf-whiteboard-app .oval{inset:8px 12px 46px!important}.pf-whiteboard-app[data-wb-tray] .workspace>aside,.wb-popup{left:138px!important;top:68px!important}.wb-live-controls{top:70px}.wb-shape-tray{grid-template-columns:repeat(3,120px)}.wb-media-tray{grid-template-columns:repeat(2,145px)}}
`
