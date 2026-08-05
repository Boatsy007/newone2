import { useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ArrowLeft, ArrowRight, ClipboardList, Expand, Gauge, Radio, ShieldCheck } from 'lucide-react'
import './MatchDayFullscreenControlsOverride.css'

type OrientationLock={lock?:(orientation:string)=>Promise<void>}
type FullscreenElement=HTMLElement&{webkitRequestFullscreen?:()=>Promise<void>|void}

const LIVE_WIDTH=1024
const LIVE_HEIGHT=768

export default function MatchDayCommandCentre({children}:{children:ReactNode}){
 const[launched,setLaunched]=useState(false)
 const[step,setStep]=useState<0|1|2>(0)

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

 function openPreparationTool(kind:'game-plan'|'kpi'){
  if(kind==='game-plan'){
   document.querySelector<HTMLButtonElement>('.md-game-plan-button')?.click()
   return
  }
  const button=Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(item=>(item.textContent||'').replace(/\s+/g,' ').trim().toLowerCase().includes('kpi'))
  button?.click()
 }

 async function launch(){
  flushSync(()=>setLaunched(true))
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

 return <>
  <div className={launched?'md-command-live-layer launched':step>0?'md-command-live-layer preparing':'md-command-live-layer'} aria-hidden={step===0&&!launched}>{children}</div>
  {!launched&&<main className="md-command-centre md-prepare">
   <header className="md-prepare-header">
    <div><span>Match Day</span><h1>Prepare in 2 steps</h1><p>Set the game plan and match KPIs, then open the live match.</p></div>
    <div className="md-prepare-progress" aria-label={`Preparation step ${Math.max(1,step)} of 2`}><span className={step>=1?'active':''}>1</span><i/><span className={step>=2?'active':''}>2</span></div>
   </header>
   <div className="md-prepare-viewport">
    <div className="md-prepare-track" style={{transform:`translateX(-${step*100}%)`}}>
     <section className="md-prepare-page md-prepare-intro">
      <div className="md-prepare-hero"><ShieldCheck size={36}/><span>Match Day</span><h2>Get ready for the game</h2><p>Two quick preparation steps before the live match opens.</p></div>
      <div className="md-prepare-summary"><article><b>1</b><div><strong>Game plan</strong><span>Review or update the plan for today.</span></div></article><article><b>2</b><div><strong>KPIs</strong><span>Set the targets the team will track live.</span></div></article></div>
      <footer><button className="primary" type="button" onClick={()=>setStep(1)}>Next <ArrowRight size={18}/></button></footer>
     </section>
     <section className="md-prepare-page">
      <div className="md-prepare-step-card"><div className="md-prepare-step-icon"><ClipboardList size={31}/></div><span>Step 1 of 2</span><h2>Game plan</h2><p>Open the existing game plan, review it and make any changes needed before the match.</p><button className="tool" type="button" onClick={()=>openPreparationTool('game-plan')}>Open game plan</button></div>
      <footer><button className="back" type="button" onClick={()=>setStep(0)}><ArrowLeft size={17}/>Back</button><button className="skip" type="button" onClick={()=>setStep(2)}>Skip</button><button className="primary" type="button" onClick={()=>setStep(2)}>Next <ArrowRight size={18}/></button></footer>
     </section>
     <section className="md-prepare-page">
      <div className="md-prepare-step-card"><div className="md-prepare-step-icon kpi"><Gauge size={31}/></div><span>Step 2 of 2</span><h2>KPIs</h2><p>Open the KPI setup and set the targets the live match will track.</p><button className="tool kpi" type="button" onClick={()=>openPreparationTool('kpi')}>Open KPIs</button></div>
      <footer><button className="back" type="button" onClick={()=>setStep(1)}><ArrowLeft size={17}/>Back</button><button className="skip" type="button" onClick={()=>void launch()}>Skip</button><button className="primary live" type="button" onClick={()=>void launch()}><Radio size={17}/>Open live match <Expand size={17}/></button></footer>
     </section>
    </div>
   </div>
  </main>}
  <style>{styles}</style>
 </>
}

const styles=`
.md-command-live-layer{position:fixed;inset:0;z-index:-1;visibility:hidden;pointer-events:none;overflow:hidden;background:#07111c}.md-command-live-layer.launched{z-index:auto;visibility:visible;pointer-events:auto}.md-command-live-layer>.md{width:100%;height:100%}
html.pf-match-day-focus-root,html.pf-match-day-focus-root body{width:100%!important;height:100%!important;overflow:hidden!important;background:#07111c!important}.pf-match-day-focus-root .coach-workspace-layer{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;overflow:hidden!important}.pf-match-day-focus-root .coach-workspace-content{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;min-height:0!important;overflow:hidden!important;padding:0!important}.pf-match-day-focus-root .md-command-live-layer{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483001!important;visibility:visible!important;pointer-events:auto!important;overflow:hidden!important;background:#07111c!important}.pf-match-day-focus-root .md-command-live-layer>.md{position:absolute!important;top:0!important;left:50%!important;inset:auto!important;width:1024px!important;height:768px!important;min-width:1024px!important;min-height:768px!important;max-width:1024px!important;max-height:768px!important;margin:0!important;overflow:hidden!important;transform:translateX(-50%) scale(var(--pf-md-live-scale,1))!important;transform-origin:top center!important}.pf-match-day-focus-root .md-layout{width:1024px!important;height:768px!important}.pf-match-day-focus-root .md-field-panel{width:512px!important;height:768px!important}.pf-match-day-focus-root .md-ground-wrap{width:512px!important;height:768px!important}.pf-match-day-focus-root .md-ground{width:min(460px,553px)!important}.pf-match-day-focus-root .md-toolbar{left:256px!important;max-width:492px!important}.pf-match-day-focus-root .md-fs-score.md-fs-score-top{left:524px!important;right:auto!important;width:488px!important}.pf-match-day-focus-root .md-fs-stats{top:58px!important;right:12px!important;width:488px!important;height:318px!important;min-height:0!important}.pf-match-day-focus-root .club-section-sidebar,.pf-match-day-focus-root .club-section-mobile,.pf-match-day-focus-root .club-hq-bottom{display:none!important}
.md-command-centre{position:relative;z-index:20;min-height:calc(100vh - 150px);overflow:hidden;border-radius:22px;background:linear-gradient(145deg,#07111c,#0d1c29);color:#fff}.md-prepare{padding:clamp(20px,4vw,48px)}.md-prepare-header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:24px}.md-prepare-header>div>span{color:#42b8ff;font-size:11px;font-weight:950;letter-spacing:.18em;text-transform:uppercase}.md-prepare h1{margin:7px 0 5px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(48px,7vw,78px);line-height:.9;text-transform:uppercase}.md-prepare-header p{margin:0;color:#91a1ad;font-size:14px}.md-prepare-progress{display:flex;align-items:center;gap:8px;padding-top:10px}.md-prepare-progress span{width:34px;height:34px;display:grid;place-items:center;border:1px solid #294052;border-radius:50%;background:#0b1721;color:#718391;font-weight:950}.md-prepare-progress span.active{border-color:#42b8ff;background:#0b79b6;color:#fff}.md-prepare-progress i{width:44px;height:2px;background:#294052}.md-prepare-viewport{overflow:hidden}.md-prepare-track{display:flex;width:100%;transition:transform .32s cubic-bezier(.22,.8,.25,1);will-change:transform}.md-prepare-page{flex:0 0 100%;min-width:0;display:grid;align-content:center;gap:24px;min-height:430px;padding:10px 2px}.md-prepare-hero,.md-prepare-step-card{max-width:760px}.md-prepare-hero svg{color:#37d481}.md-prepare-hero>span,.md-prepare-step-card>span{display:block;margin-top:12px;color:#42b8ff;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.md-prepare h2{margin:5px 0 8px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(42px,6vw,66px);line-height:.95;text-transform:uppercase}.md-prepare-hero p,.md-prepare-step-card p{max-width:620px;margin:0;color:#9aabb7;font-size:14px;line-height:1.55}.md-prepare-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;max-width:760px}.md-prepare-summary article{display:flex;align-items:center;gap:13px;padding:16px;border:1px solid #223747;border-radius:14px;background:#0b1721}.md-prepare-summary b{width:39px;height:39px;display:grid;place-items:center;border-radius:11px;background:#123149;color:#42b8ff;font-size:18px}.md-prepare-summary strong,.md-prepare-summary span{display:block}.md-prepare-summary strong{text-transform:uppercase}.md-prepare-summary span{margin-top:3px;color:#7f929f;font-size:11px}.md-prepare-step-icon{width:64px;height:64px;display:grid;place-items:center;border-radius:17px;background:#0b79b6;color:#fff}.md-prepare-step-icon.kpi{background:#e0a800;color:#111}.md-prepare-step-card .tool{margin-top:22px;border:1px solid #269fdf;border-radius:11px;background:#087db9;color:#fff;padding:13px 18px;font-weight:950;text-transform:uppercase;cursor:pointer}.md-prepare-step-card .tool.kpi{border-color:#f3c521;background:#dba900;color:#16120a}.md-prepare-page footer{display:flex;align-items:center;gap:10px;max-width:760px;padding-top:8px}.md-prepare-page footer button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;border-radius:10px;padding:0 18px;font-weight:950;text-transform:uppercase;cursor:pointer}.md-prepare-page footer .primary{margin-left:auto;border:0;background:#149ddd;color:#fff}.md-prepare-page footer .primary.live{background:#159955}.md-prepare-page footer .back,.md-prepare-page footer .skip{border:1px solid #2a3d4c;background:#0b1721;color:#a7b5bf}.md-command-live-layer.preparing{z-index:2;visibility:visible;pointer-events:none;background:transparent}.md-command-live-layer.preparing>.md>*{visibility:hidden!important}.md-command-live-layer.preparing>.md>.md-game-plan-backdrop,.md-command-live-layer.preparing>.md>.md-game-plan-backdrop *,.md-command-live-layer.preparing>.md>[class*="kpi"][class*="backdrop"],.md-command-live-layer.preparing>.md>[class*="kpi"][class*="backdrop"] *{visibility:visible!important;pointer-events:auto!important}
@media(max-width:650px){.md-prepare{padding:18px 14px}.md-prepare-header{display:block}.md-prepare-progress{margin-top:14px}.md-prepare-page{min-height:460px}.md-prepare-summary{grid-template-columns:1fr}.md-prepare-page footer{flex-wrap:wrap}.md-prepare-page footer .primary.live{width:100%;order:-1;margin-left:0}.md-prepare h2{font-size:48px}}
`
