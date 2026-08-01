import { useEffect, useState } from 'react'
import { Maximize2, RotateCw } from 'lucide-react'
import { useLocation } from 'react-router-dom'

export default function WhiteboardAppMode(){
 const{pathname}=useLocation()
 const active=/^\/club-portal\/[^/]+\/whiteboard(?:\/|$)/.test(pathname)
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
   window.removeEventListener('resize',update)
   window.removeEventListener('orientationchange',update)
  }
 },[active])

 async function enterLandscape(){
  try{await document.documentElement.requestFullscreen?.()}catch{}
  try{await (screen.orientation as ScreenOrientation&{lock?:(orientation:string)=>Promise<void>}).lock?.('landscape')}catch{}
 }

 if(!active)return null
 return <>
  <button className="wb-app-fullscreen" onClick={()=>void enterLandscape()}><Maximize2 size={17}/>Full screen</button>
  {portrait&&<div className="wb-rotate-gate"><RotateCw size={42}/><strong>Rotate your device</strong><span>The whiteboard is designed as a landscape coaching app.</span><button onClick={()=>void enterLandscape()}>Open landscape whiteboard</button></div>}
  <style>{styles}</style>
 </>
}

const styles=`
body.pf-whiteboard-app{overflow:hidden!important;background:#0b1219}
.pf-whiteboard-app .pf-nav,.pf-whiteboard-app footer,.pf-whiteboard-app .coach-app-bottom{display:none!important}
.pf-whiteboard-app .wb{position:fixed!important;inset:0!important;z-index:100500!important;padding:0!important;min-height:0!important;background:#0b1219!important;overflow:hidden!important}
.pf-whiteboard-app .wb>header{position:absolute!important;z-index:40!important;inset:0 0 auto 0!important;height:54px!important;max-width:none!important;margin:0!important;padding:6px 12px!important;border-radius:0!important;display:grid!important;grid-template-columns:42px minmax(0,1fr) 42px!important;align-items:center!important;gap:8px!important;background:#0b1219!important;border-bottom:1px solid #25313d!important;box-sizing:border-box!important}
.pf-whiteboard-app .wb>header>a{font-size:0!important;width:38px;height:38px;display:flex!important;align-items:center;justify-content:center;border-radius:10px;background:#18232e}
.pf-whiteboard-app .wb>header span,.pf-whiteboard-app .wb>header p,.pf-whiteboard-app .wb>header>button{display:none!important}
.pf-whiteboard-app .wb>header h1{margin:0!important;color:#fff!important;font:900 18px/1 Arial,sans-serif!important;text-transform:none!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pf-whiteboard-app .meta{position:absolute!important;z-index:50!important;top:6px!important;left:58px!important;right:58px!important;height:42px!important;max-width:none!important;margin:0!important;padding:0!important;display:grid!important;grid-template-columns:minmax(120px,1.15fr) minmax(110px,1fr) minmax(80px,.55fr) minmax(100px,.8fr) 42px!important;gap:6px!important;align-items:center!important;background:transparent!important;border:0!important}
.pf-whiteboard-app .meta label{font-size:0!important}
.pf-whiteboard-app .meta input,.pf-whiteboard-app .meta select{height:38px!important;margin:0!important;padding:0 9px!important;border:1px solid #334250!important;border-radius:9px!important;background:#17222c!important;color:#fff!important;font-size:12px!important}
.pf-whiteboard-app .meta .save{width:42px!important;height:38px!important;padding:0!important;font-size:0!important;background:#42b8ff!important;color:#061018!important}
.pf-whiteboard-app .meta .delete{display:none!important}
.pf-whiteboard-app .workspace{position:absolute!important;z-index:1!important;left:0!important;right:0!important;top:54px!important;bottom:132px!important;max-width:none!important;width:auto!important;height:auto!important;margin:0!important;padding:8px!important;display:block!important;box-sizing:border-box!important;overflow:hidden!important}
.pf-whiteboard-app .board-shell{position:absolute!important;inset:8px!important;width:auto!important;height:auto!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:14px!important;background:#111c25!important;overflow:hidden!important}
.pf-whiteboard-app .oval{position:absolute!important;left:18px!important;right:18px!important;top:10px!important;bottom:10px!important;width:auto!important;height:auto!important;max-width:none!important;max-height:none!important;aspect-ratio:auto!important;transform:none!important;border:3px solid #fff!important;border-radius:50%!important;background:radial-gradient(ellipse at center,#53a95d 0 52%,#489b52 53% 100%)!important;box-shadow:inset 0 0 0 2px rgba(0,0,0,.2),0 8px 22px rgba(0,0,0,.2)!important;box-sizing:border-box!important;display:block!important;visibility:visible!important;opacity:1!important}
.pf-whiteboard-app .legend{position:absolute!important;z-index:12!important;left:14px!important;top:12px!important;margin:0!important;padding:5px 8px!important;border-radius:9px!important;background:rgba(255,255,255,.92)!important}
.pf-whiteboard-app .legend em,.pf-whiteboard-app .choreo{display:none!important}
.pf-whiteboard-app .workspace>aside{position:fixed!important;z-index:100700!important;left:0!important;right:0!important;bottom:52px!important;height:80px!important;margin:0!important;padding:6px 8px!important;display:grid!important;grid-template-columns:minmax(260px,1.8fr) minmax(135px,.65fr) minmax(155px,.75fr)!important;gap:7px!important;background:#101820!important;border-top:1px solid #2a3743!important;box-sizing:border-box!important;overflow:hidden!important}
.pf-whiteboard-app .workspace>aside section{min-width:0!important;height:68px!important;padding:6px!important;border:1px solid #2c3945!important;border-radius:10px!important;background:#17222c!important;color:#fff!important;box-sizing:border-box!important;overflow:hidden!important}
.pf-whiteboard-app .workspace>aside h2{margin:0 0 4px!important;font:800 10px/1 Arial,sans-serif!important;text-transform:uppercase!important;color:#9fadb9!important}
.pf-whiteboard-app .player-bank{display:flex!important;gap:6px!important;max-height:none!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none}
.pf-whiteboard-app .player-bank::-webkit-scrollbar{display:none}
.pf-whiteboard-app .player-bank button{flex:0 0 112px!important;height:44px!important;display:grid!important;grid-template-columns:30px 1fr!important;align-items:center!important;padding:4px!important;background:#fff!important}
.pf-whiteboard-app .player-bank button svg{display:none!important}
.pf-whiteboard-app .player-bank button b{width:28px!important;height:28px!important}
.pf-whiteboard-app .player-bank button span{font-size:9px!important;line-height:1.05!important;white-space:normal!important}
.pf-whiteboard-app .add-opp,.pf-whiteboard-app .ball-toggle{height:43px!important;padding:6px!important;font-size:9px!important}
.pf-whiteboard-app .possession{display:none!important}
.pf-whiteboard-app .tools,.pf-whiteboard-app .playbar{position:fixed!important;z-index:100760!important;bottom:0!important;height:52px!important;margin:0!important;padding:5px!important;display:flex!important;align-items:center!important;flex-wrap:nowrap!important;gap:5px!important;background:#0b1219!important;border-top:1px solid #2a3743!important;box-sizing:border-box!important;overflow-x:auto!important;scrollbar-width:none}
.pf-whiteboard-app .tools{left:0!important;width:52%!important;padding-left:max(6px,env(safe-area-inset-left))!important}
.pf-whiteboard-app .playbar{right:0!important;width:48%!important;justify-content:flex-end!important;padding-right:max(6px,env(safe-area-inset-right))!important}
.pf-whiteboard-app .tools button,.pf-whiteboard-app .playbar button{flex:0 0 auto!important;height:40px!important;min-width:40px!important;padding:0 9px!important;border-radius:9px!important}
.pf-whiteboard-app .tools button{font-size:0!important}
.pf-whiteboard-app .tools button.active{background:#42b8ff!important;color:#061018!important}
.pf-whiteboard-app .tools>span{display:none!important}
.pf-whiteboard-app .tools label,.pf-whiteboard-app .playbar label{font-size:0!important;flex:0 0 auto!important}
.pf-whiteboard-app .tools select,.pf-whiteboard-app .playbar select{height:40px!important;margin:0!important;padding:0 8px!important;max-width:108px!important}
.pf-whiteboard-app .progress{flex:0 0 105px!important;height:34px!important}
.pf-whiteboard-app .marker>b{width:32px!important;height:32px!important}
.pf-whiteboard-app .marker span{font-size:8px!important}
.wb-app-fullscreen{position:fixed;z-index:100900;right:8px;top:8px;width:38px;height:38px;padding:0;border:0;border-radius:9px;background:#42b8ff;color:#061018;display:flex;align-items:center;justify-content:center;font-size:0;font-weight:900}
.wb-rotate-gate{position:fixed;inset:0;z-index:101000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:30px;text-align:center;background:#0b1219;color:#fff}
.wb-rotate-gate strong{font-size:28px}.wb-rotate-gate span{color:#aebbc6}.wb-rotate-gate button{margin-top:8px;padding:13px 17px;border:0;border-radius:11px;background:#42b8ff;font-weight:900}
@media(max-height:500px){.pf-whiteboard-app .workspace{bottom:114px!important}.pf-whiteboard-app .workspace>aside{height:64px!important}.pf-whiteboard-app .workspace>aside section{height:52px!important}.pf-whiteboard-app .player-bank button{height:29px!important}.pf-whiteboard-app .add-opp,.pf-whiteboard-app .ball-toggle{height:28px!important}.pf-whiteboard-app .oval{left:12px!important;right:12px!important;top:7px!important;bottom:7px!important}.pf-whiteboard-app .progress{display:none!important}}
@media(max-width:850px){.pf-whiteboard-app .meta{grid-template-columns:1.1fr 1fr .55fr .8fr 42px!important}.pf-whiteboard-app .tools{width:55%!important}.pf-whiteboard-app .playbar{width:45%!important}.pf-whiteboard-app .progress{display:none!important}}
`
