import { useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ArrowRight, Radio } from 'lucide-react'
import './MatchDayFullscreenControlsOverride.css'

type OrientationLock={lock?:(orientation:string)=>Promise<void>}
type FullscreenElement=HTMLElement&{webkitRequestFullscreen?:()=>Promise<void>|void}
type Stage='ready'|'game-plan'|'kpi'|'live'
type PlanDraft={teamInstructions:string;quarterTimeReminders:string;overview:string;stoppagePlan:string;kickInPlan:string}
type KpiDraft={i50:number;clr:number;r50:number;one:number;tkl:number;opm:number;fa:number}

const LIVE_WIDTH=1024
const LIVE_HEIGHT=768
const blankPlan:PlanDraft={teamInstructions:'',quarterTimeReminders:'',overview:'',stoppagePlan:'',kickInPlan:''}
const blankKpis:KpiDraft={i50:0,clr:0,r50:0,one:0,tkl:0,opm:0,fa:0}
const KPI_ROWS:[keyof KpiDraft,string,string][]=[['i50','I50','Inside 50s'],['clr','CLR','Clearances'],['r50','R50','Rebound 50s'],['one','1%','One percenters'],['tkl','TKL','Tackles'],['opm','OPM','Opposition marks'],['fa','FA','Frees against']]

export default function MatchDayCommandCentre({children}:{children:ReactNode}){
 const[stage,setStage]=useState<Stage>('ready')
 const[plan,setPlan]=useState<PlanDraft>(()=>readJson('playfooty.matchday.prep.gameplan',blankPlan))
 const[kpis,setKpis]=useState<KpiDraft>(()=>readJson('playfooty.matchday.prep.kpis',blankKpis))
 const launched=stage==='live'

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
  const restoreAfterFullscreenChange=()=>{applyLiveLayout();window.setTimeout(applyLiveLayout,40);window.setTimeout(applyLiveLayout,160)}
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
   classObserver.disconnect();window.removeEventListener('resize',fitLiveCanvas);window.removeEventListener('orientationchange',fitLiveCanvas)
   window.visualViewport?.removeEventListener('resize',fitLiveCanvas);window.visualViewport?.removeEventListener('scroll',fitLiveCanvas)
   document.removeEventListener('fullscreenchange',restoreAfterFullscreenChange);document.removeEventListener('webkitfullscreenchange',restoreAfterFullscreenChange as EventListener)
  }
 },[launched])

 useEffect(()=>()=>{
  document.body.classList.remove('pf-match-day-live','pf-match-day-focus')
  document.documentElement.classList.remove('pf-match-day-focus-root')
  document.documentElement.style.removeProperty('--pf-md-live-scale')
 },[])

 function savePlanAndContinue(){
  localStorage.setItem('playfooty.matchday.prep.gameplan',JSON.stringify(plan))
  window.dispatchEvent(new CustomEvent('playfooty:matchday-gameplan',{detail:plan}))
  setStage('kpi')
 }

 async function startMatch(){
  localStorage.setItem('playfooty.matchday.prep.kpis',JSON.stringify(kpis))
  window.dispatchEvent(new CustomEvent('playfooty:matchday-kpis',{detail:kpis}))
  flushSync(()=>setStage('live'))
  document.body.classList.add('pf-match-day-live','pf-match-day-focus')
  document.documentElement.classList.add('pf-match-day-focus-root')
  document.dispatchEvent(new Event('fullscreenchange'))
  window.dispatchEvent(new CustomEvent('playfooty:matchday-focus',{detail:{active:true}}))
  const board=document.querySelector<HTMLElement>('.md')
  let nativeFullscreen=false
  if(board){
   try{
    if(board.requestFullscreen){await board.requestFullscreen({navigationUI:'hide'}).catch(()=>board.requestFullscreen());nativeFullscreen=true}
    else if((board as FullscreenElement).webkitRequestFullscreen){await Promise.resolve((board as FullscreenElement).webkitRequestFullscreen?.());nativeFullscreen=true}
   }catch{}
  }
  document.body.classList.add('pf-match-day-live','pf-match-day-focus')
  document.documentElement.classList.add('pf-match-day-focus-root')
  document.dispatchEvent(new Event('fullscreenchange'))
  window.dispatchEvent(new CustomEvent('playfooty:matchday-focus',{detail:{active:true,nativeFullscreen}}))
  window.requestAnimationFrame(()=>{document.dispatchEvent(new Event('fullscreenchange'));window.dispatchEvent(new Event('resize'));window.scrollTo(0,0)})
  window.setTimeout(()=>{document.body.classList.add('pf-match-day-live','pf-match-day-focus');document.documentElement.classList.add('pf-match-day-focus-root');document.dispatchEvent(new Event('fullscreenchange'));window.dispatchEvent(new Event('resize'))},120)
  try{await(screen.orientation as OrientationLock|undefined)?.lock?.('landscape')}catch{}
 }

 return <>
  <div className={launched?'md-command-live-layer launched':'md-command-live-layer'} aria-hidden={!launched}>{children}</div>
  {stage!=='live'&&<main className="md-prep-shell">
   <div className="md-prep-track" style={{transform:`translateX(-${stage==='ready'?0:stage==='game-plan'?100:200}%)`}}>
    <section className="md-prep-page md-ready-page">
     <div className="md-loading-card"><div className="md-ready-spinner"/><span>PlayFooty Coaching</span><h1>Ready in 2</h1><p>Set your game plan and match KPIs before opening Live Match.</p><button onClick={()=>setStage('game-plan')}>Next <ArrowRight size={18}/></button></div>
    </section>
    <section className="md-prep-page">
     <div className="md-form-card"><header><span>Step 1 of 2</span><h2>Game plan</h2><p>Build the plan the coaches will see in the Live Match Game Plan tab.</p></header><div className="md-plan-grid">
      <Field label="Team instructions" value={plan.teamInstructions} onChange={value=>setPlan({...plan,teamInstructions:value})}/>
      <Field label="Quarter-time reminders" value={plan.quarterTimeReminders} onChange={value=>setPlan({...plan,quarterTimeReminders:value})}/>
      <Field label="Opposition overview" value={plan.overview} onChange={value=>setPlan({...plan,overview:value})}/>
      <Field label="Stoppage plan" value={plan.stoppagePlan} onChange={value=>setPlan({...plan,stoppagePlan:value})}/>
      <Field label="Kick-in plan" value={plan.kickInPlan} onChange={value=>setPlan({...plan,kickInPlan:value})}/>
     </div><footer><button className="secondary" onClick={()=>setStage('ready')}>Back</button><button onClick={savePlanAndContinue}>Next: KPIs <ArrowRight size={17}/></button></footer></div>
    </section>
    <section className="md-prep-page">
     <div className="md-form-card"><header><span>Step 2 of 2</span><h2>KPIs</h2><p>Set the target for each live match statistic.</p></header><div className="md-kpi-grid">{KPI_ROWS.map(([key,short,label])=><article key={key}><div><strong>{short}</strong><span>{label}</span></div><div className="md-stepper"><button onClick={()=>setKpis({...kpis,[key]:Math.max(0,kpis[key]-1)})}>−</button><b>{kpis[key]}</b><button onClick={()=>setKpis({...kpis,[key]:kpis[key]+1})}>+</button></div></article>)}</div><footer><button className="secondary" onClick={()=>setStage('game-plan')}>Back</button><button onClick={()=>void startMatch()}><Radio size={16}/>Start match</button></footer></div>
    </section>
   </div>
  </main>}
  <style>{styles}</style>
 </>
}

function readJson<T>(key:string,fallback:T):T{try{return {...fallback,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{return fallback}}
function Field({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){return <label><span>{label}</span><textarea value={value} onChange={event=>onChange(event.target.value)} placeholder={`Add ${label.toLowerCase()}…`}/></label>}

const styles=`
.md-command-live-layer{position:fixed;inset:0;z-index:-1;visibility:hidden;pointer-events:none;overflow:hidden;background:#07111c}.md-command-live-layer.launched{z-index:20;visibility:visible;pointer-events:auto}.md-command-live-layer>.md{width:100%;height:100%}
.md-prep-shell{position:relative;min-height:calc(100vh - 150px);overflow:hidden;border-radius:22px;background:linear-gradient(145deg,#e9edf0,#dfe5e9)}.md-prep-track{display:flex;width:300%;min-height:inherit;transition:transform .32s cubic-bezier(.22,.8,.24,1)}.md-prep-page{width:33.333333%;min-height:inherit;display:grid;place-items:center;padding:22px;box-sizing:border-box}.md-loading-card,.md-form-card{width:min(900px,94vw);border-radius:24px;background:#fff;color:#101820;box-shadow:0 24px 60px rgba(14,29,40,.18)}.md-loading-card{width:min(420px,92vw);display:grid;justify-items:center;padding:44px 36px;text-align:center}.md-ready-spinner{width:44px;height:44px;margin-bottom:20px;border:4px solid #d8e6ef;border-top-color:#149ddd;border-radius:50%;animation:md-ready-spin .8s linear infinite}.md-loading-card>span,.md-form-card header>span{color:#087db9;font-size:11px;font-weight:950;letter-spacing:.18em;text-transform:uppercase}.md-loading-card h1{margin:8px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:68px;line-height:.95;text-transform:uppercase}.md-loading-card p{max-width:320px;margin:0;color:#5d6972;font-size:15px;line-height:1.5}.md-loading-card button,.md-form-card footer button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 20px;border:0;border-radius:11px;background:#159ddd;color:#fff;font-weight:950;text-transform:uppercase}.md-loading-card button{min-width:150px;margin-top:25px}.md-form-card{max-height:calc(100vh - 190px);display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}.md-form-card header{padding:22px 24px 14px;border-bottom:1px solid #e2e8ec}.md-form-card h2{margin:4px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:46px;line-height:1;text-transform:uppercase}.md-form-card header p{margin:4px 0 0;color:#67747e}.md-plan-grid,.md-kpi-grid{overflow:auto;padding:18px 24px}.md-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.md-plan-grid label{display:grid;gap:6px}.md-plan-grid label:last-child{grid-column:1/-1}.md-plan-grid label span{font-size:11px;font-weight:950;text-transform:uppercase}.md-plan-grid textarea{min-height:92px;resize:vertical;border:1px solid #ccd7de;border-radius:11px;padding:12px;font:inherit}.md-kpi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.md-kpi-grid article{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 15px;border:1px solid #d9e2e8;border-radius:12px}.md-kpi-grid article strong,.md-kpi-grid article span{display:block}.md-kpi-grid article strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:27px}.md-kpi-grid article span{color:#71808b;font-size:11px}.md-stepper{display:grid;grid-template-columns:38px 48px 38px;align-items:center;text-align:center}.md-stepper button{height:38px;border:0;border-radius:8px;background:#0caf68;color:#fff;font-size:22px;font-weight:950}.md-stepper button:first-child{background:#d52c35}.md-stepper b{font-size:20px}.md-form-card footer{display:flex;justify-content:space-between;gap:10px;padding:14px 24px;border-top:1px solid #e2e8ec}.md-form-card footer .secondary{background:#e5ebef;color:#26343e}
@keyframes md-ready-spin{to{transform:rotate(360deg)}}
html.pf-match-day-focus-root,html.pf-match-day-focus-root body{width:100%!important;height:100%!important;overflow:hidden!important;background:#07111c!important}.pf-match-day-focus-root .coach-workspace-layer{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;overflow:hidden!important}.pf-match-day-focus-root .coach-workspace-content{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;min-height:0!important;overflow:hidden!important;padding:0!important}.pf-match-day-focus-root .md-command-live-layer{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483001!important;visibility:visible!important;pointer-events:auto!important;overflow:hidden!important;background:#07111c!important}.pf-match-day-focus-root .md-command-live-layer>.md{position:absolute!important;top:0!important;left:50%!important;inset:auto!important;width:1024px!important;height:768px!important;min-width:1024px!important;min-height:768px!important;max-width:1024px!important;max-height:768px!important;margin:0!important;overflow:hidden!important;transform:translateX(-50%) scale(var(--pf-md-live-scale,1))!important;transform-origin:top center!important}.pf-match-day-focus-root .md-layout{width:1024px!important;height:768px!important}.pf-match-day-focus-root .md-field-panel{width:512px!important;height:768px!important}.pf-match-day-focus-root .md-ground-wrap{width:512px!important;height:768px!important}.pf-match-day-focus-root .md-ground{width:min(460px,553px)!important}.pf-match-day-focus-root .md-toolbar{left:256px!important;max-width:492px!important}.pf-match-day-focus-root .md-fs-score.md-fs-score-top{left:524px!important;right:auto!important;width:488px!important}.pf-match-day-focus-root .md-fs-stats{top:58px!important;right:12px!important;width:488px!important;height:318px!important;min-height:0!important}.pf-match-day-focus-root .club-section-sidebar,.pf-match-day-focus-root .club-section-mobile,.pf-match-day-focus-root .club-hq-bottom{display:none!important}
@media(max-width:700px){.md-prep-shell{min-height:calc(100vh - 110px)}.md-prep-page{padding:10px}.md-form-card{max-height:calc(100vh - 125px)}.md-plan-grid,.md-kpi-grid{grid-template-columns:1fr;padding:12px}.md-plan-grid label:last-child{grid-column:auto}.md-form-card header,.md-form-card footer{padding-left:14px;padding-right:14px}}
`
