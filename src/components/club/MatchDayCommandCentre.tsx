import { useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ArrowRight, Radio } from 'lucide-react'
import './MatchDayFullscreenControlsOverride.css'

type OrientationLock={lock?:(orientation:string)=>Promise<void>}
type FullscreenElement=HTMLElement&{webkitRequestFullscreen?:()=>Promise<void>|void}
type Stage='ready'|'game-plan'|'kpi'|'live'

const LIVE_WIDTH=1024
const LIVE_HEIGHT=768

function buttonByText(text:string){
 return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button=>
  (button.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()===text.toLowerCase()
 )
}

export default function MatchDayCommandCentre({children}:{children:ReactNode}){
 const[stage,setStage]=useState<Stage>('ready')
 const launched=stage==='live'

 useEffect(()=>{
  if(stage!=='game-plan'&&stage!=='kpi')return
  const timer=window.setTimeout(()=>{
   if(stage==='game-plan'){
    document.querySelector<HTMLButtonElement>('.md-game-plan-button')?.click()
    return
   }
   const kpiButton=Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button=>{
    const label=(button.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()
    return label==="kpi's"||label==='kpis'||label==='kpi'
   })
   kpiButton?.click()
  },80)
  return()=>window.clearTimeout(timer)
 },[stage])

 useEffect(()=>{
  if(!launched)return
  let restoring=false
  const fitLiveCanvas=()=>{
   const viewport=window.visualViewport
   const width=viewport?.width||window.innerWidth
   const height=viewport?.height||window.innerHeight
   const scale=Math.min(width/LIVE_WIDTH,height/LIVE_HEIGHT)
   document.documentElement.style.setProperty('--pf-md-live-scale',String(Math.max(.1,scale)))
  }
  const applyLiveLayout=()=>{
   if(restoring)return
   restoring=true
   document.body.classList.add('pf-match-day-live','pf-match-day-focus')
   document.documentElement.classList.add('pf-match-day-focus-root')
   fitLiveCanvas()
   window.requestAnimationFrame(()=>{
    document.dispatchEvent(new Event('fullscreenchange'))
    window.dispatchEvent(new CustomEvent('playfooty:matchday-focus',{detail:{active:true}}))
    window.dispatchEvent(new Event('resize'))
    restoring=false
   })
  }
  const restoreAfterFullscreenChange=()=>{
   applyLiveLayout()
   window.setTimeout(applyLiveLayout,40)
   window.setTimeout(applyLiveLayout,160)
  }
  applyLiveLayout()
  const classObserver=new MutationObserver(()=>{
   if(!document.body.classList.contains('pf-match-day-focus')||!document.documentElement.classList.contains('pf-match-day-focus-root'))applyLiveLayout()
  })
  classObserver.observe(document.body,{attributes:true,attributeFilter:['class']})
  classObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']})
  window.addEventListener('resize',fitLiveCanvas)
  window.addEventListener('orientationchange',fitLiveCanvas)
  window.visualViewport?.addEventListener('resize',fitLiveCanvas)
  window.visualViewport?.addEventListener('scroll',fitLiveCanvas)
  document.addEventListener('fullscreenchange',restoreAfterFullscreenChange)
  document.addEventListener('webkitfullscreenchange',restoreAfterFullscreenChange as EventListener)
  return()=>{
   classObserver.disconnect()
   window.removeEventListener('resize',fitLiveCanvas)
   window.removeEventListener('orientationchange',fitLiveCanvas)
   window.visualViewport?.removeEventListener('resize',fitLiveCanvas)
   window.visualViewport?.removeEventListener('scroll',fitLiveCanvas)
   document.removeEventListener('fullscreenchange',restoreAfterFullscreenChange)
   document.removeEventListener('webkitfullscreenchange',restoreAfterFullscreenChange as EventListener)
  }
 },[launched])

 useEffect(()=>()=>{
  document.body.classList.remove('pf-match-day-live','pf-match-day-focus')
  document.documentElement.classList.remove('pf-match-day-focus-root')
  document.documentElement.style.removeProperty('--pf-md-live-scale')
 },[])

 function closePreparationDrawer(){
  document.querySelector<HTMLButtonElement>('.md-game-plan-panel header button')?.click()
  const close=Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button=>
   /close kpi/i.test(button.getAttribute('aria-label')||'')
  )
  close?.click()
 }

 function openGamePlan(){
  setStage('game-plan')
 }

 function openKpis(){
  closePreparationDrawer()
  window.setTimeout(()=>setStage('kpi'),30)
 }

 async function launch(){
  closePreparationDrawer()
  flushSync(()=>setStage('live'))
  document.body.classList.add('pf-match-day-live','pf-match-day-focus')
  document.documentElement.classList.add('pf-match-day-focus-root')
  document.dispatchEvent(new Event('fullscreenchange'))
  window.dispatchEvent(new CustomEvent('playfooty:matchday-focus',{detail:{active:true}}))

  const board=document.querySelector<HTMLElement>('.md')
  let nativeFullscreen=false
  if(board){
   try{
    if(board.requestFullscreen){
     await board.requestFullscreen({navigationUI:'hide'}).catch(()=>board.requestFullscreen())
     nativeFullscreen=true
    }else if((board as FullscreenElement).webkitRequestFullscreen){
     await Promise.resolve((board as FullscreenElement).webkitRequestFullscreen?.())
     nativeFullscreen=true
    }
   }catch{}
  }

  document.body.classList.add('pf-match-day-live','pf-match-day-focus')
  document.documentElement.classList.add('pf-match-day-focus-root')
  document.dispatchEvent(new Event('fullscreenchange'))
  window.dispatchEvent(new CustomEvent('playfooty:matchday-focus',{detail:{active:true,nativeFullscreen}}))
  window.requestAnimationFrame(()=>{
   document.dispatchEvent(new Event('fullscreenchange'))
   window.dispatchEvent(new Event('resize'))
   window.scrollTo(0,0)
  })
  window.setTimeout(()=>{
   document.body.classList.add('pf-match-day-live','pf-match-day-focus')
   document.documentElement.classList.add('pf-match-day-focus-root')
   document.dispatchEvent(new Event('fullscreenchange'))
   window.dispatchEvent(new Event('resize'))
  },120)
  try{await(screen.orientation as OrientationLock|undefined)?.lock?.('landscape')}catch{}
 }

 const preparing=stage==='game-plan'||stage==='kpi'

 return <>
  <div className={launched?'md-command-live-layer launched':preparing?'md-command-live-layer preparing':'md-command-live-layer'} aria-hidden={stage==='ready'}>{children}</div>

  {stage==='ready'&&<main className="md-ready-screen">
   <section className="md-ready-card">
    <div className="md-ready-spinner" aria-hidden="true"/>
    <span>PlayFooty Coaching</span>
    <h1>Ready in 2</h1>
    <p>Prepare your game plan and KPIs before opening the live match.</p>
    <button type="button" onClick={openGamePlan}>Next <ArrowRight size={18}/></button>
   </section>
  </main>}

  {stage==='game-plan'&&<div className="md-flow-next"><span>Step 1 of 2 · Game plan</span><button type="button" onClick={openKpis}>Next: KPIs <ArrowRight size={17}/></button></div>}
  {stage==='kpi'&&<div className="md-flow-next"><span>Step 2 of 2 · KPIs</span><button type="button" onClick={()=>void launch()}><Radio size={16}/>Next: Live match <ArrowRight size={17}/></button></div>}
  <style>{styles}</style>
 </>
}

const styles=`
.md-command-live-layer{position:fixed;inset:0;z-index:-1;visibility:hidden;pointer-events:none;overflow:hidden;background:#07111c}.md-command-live-layer.preparing,.md-command-live-layer.launched{z-index:20;visibility:visible;pointer-events:auto}.md-command-live-layer>.md{width:100%;height:100%}
.md-ready-screen{min-height:calc(100vh - 150px);display:grid;place-items:center;padding:24px;border-radius:22px;background:linear-gradient(145deg,#e9edf0,#dfe5e9)}.md-ready-card{width:min(420px,92vw);display:grid;justify-items:center;padding:44px 36px;border-radius:24px;background:#fff;color:#101820;text-align:center;box-shadow:0 24px 60px rgba(14,29,40,.18)}.md-ready-spinner{width:44px;height:44px;margin-bottom:20px;border:4px solid #d8e6ef;border-top-color:#149ddd;border-radius:50%;animation:md-ready-spin .8s linear infinite}.md-ready-card>span{color:#087db9;font-size:11px;font-weight:950;letter-spacing:.18em;text-transform:uppercase}.md-ready-card h1{margin:8px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:68px;line-height:.95;text-transform:uppercase}.md-ready-card p{max-width:320px;margin:0;color:#5d6972;font-size:15px;line-height:1.5}.md-ready-card button,.md-flow-next button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:11px;background:#159ddd;color:#fff;font-weight:950;text-transform:uppercase;cursor:pointer}.md-ready-card button{min-width:150px;min-height:48px;margin-top:25px}.md-flow-next{position:fixed;z-index:100200;right:22px;bottom:22px;display:flex;align-items:center;gap:14px;padding:10px 11px 10px 16px;border:1px solid #2d4656;border-radius:14px;background:rgba(5,14,22,.96);color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.42)}.md-flow-next span{color:#aab8c2;font-size:10px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.md-flow-next button{min-height:42px;padding:0 16px}.md-command-live-layer.preparing>.md{position:relative!important;min-height:calc(100vh - 150px)!important}
@keyframes md-ready-spin{to{transform:rotate(360deg)}}
html.pf-match-day-focus-root,html.pf-match-day-focus-root body{width:100%!important;height:100%!important;overflow:hidden!important;background:#07111c!important}.pf-match-day-focus-root .coach-workspace-layer{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;overflow:hidden!important}.pf-match-day-focus-root .coach-workspace-content{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;min-height:0!important;overflow:hidden!important;padding:0!important}.pf-match-day-focus-root .md-command-live-layer{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483001!important;visibility:visible!important;pointer-events:auto!important;overflow:hidden!important;background:#07111c!important}.pf-match-day-focus-root .md-command-live-layer>.md{position:absolute!important;top:0!important;left:50%!important;inset:auto!important;width:1024px!important;height:768px!important;min-width:1024px!important;min-height:768px!important;max-width:1024px!important;max-height:768px!important;margin:0!important;overflow:hidden!important;transform:translateX(-50%) scale(var(--pf-md-live-scale,1))!important;transform-origin:top center!important}.pf-match-day-focus-root .md-layout{width:1024px!important;height:768px!important}.pf-match-day-focus-root .md-field-panel{width:512px!important;height:768px!important}.pf-match-day-focus-root .md-ground-wrap{width:512px!important;height:768px!important}.pf-match-day-focus-root .md-ground{width:min(460px,553px)!important}.pf-match-day-focus-root .md-toolbar{left:256px!important;max-width:492px!important}.pf-match-day-focus-root .md-fs-score.md-fs-score-top{left:524px!important;right:auto!important;width:488px!important}.pf-match-day-focus-root .md-fs-stats{top:58px!important;right:12px!important;width:488px!important;height:318px!important;min-height:0!important}.pf-match-day-focus-root .club-section-sidebar,.pf-match-day-focus-root .club-section-mobile,.pf-match-day-focus-root .club-hq-bottom{display:none!important}
@media(max-width:650px){.md-ready-screen{min-height:calc(100vh - 110px);padding:14px}.md-ready-card{padding:34px 22px}.md-ready-card h1{font-size:58px}.md-flow-next{left:12px;right:12px;bottom:12px;justify-content:space-between}.md-flow-next span{font-size:8px}}
`
