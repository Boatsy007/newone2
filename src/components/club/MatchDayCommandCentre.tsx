import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ArrowLeft, ArrowRight, Check, Radio } from 'lucide-react'
import './MatchDayFullscreenControlsOverride.css'

type OrientationLock={lock?:(orientation:string)=>Promise<void>}
type FullscreenElement=HTMLElement&{webkitRequestFullscreen?:()=>Promise<void>|void}
type Stage='ready'|'game-plan'|'kpi'|'live'
type PlanDraft={teamInstructions:string;quarterTimeReminders:string;overview:string;stoppagePlan:string;kickInPlan:string}
type PlanChoices={style:string;ball:string;contest:string;forward:string;defence:string}
type KpiDraft={i50:number;clr:number;r50:number;one:number;tkl:number;opm:number;fa:number}
type Choice={id:string;label:string;text:string}

const LIVE_WIDTH=1024
const LIVE_HEIGHT=768
const blankKpis:KpiDraft={i50:0,clr:0,r50:0,one:0,tkl:0,opm:0,fa:0}
const blankChoices:PlanChoices={style:'',ball:'',contest:'',forward:'',defence:''}
const KPI_ROWS:[keyof KpiDraft,string,string][]=[['i50','I50','Inside 50s'],['clr','CLR','Clearances'],['r50','R50','Rebound 50s'],['one','1%','One percenters'],['tkl','TKL','Tackles'],['opm','OPM','Opposition marks'],['fa','FA','Frees against']]

const PLAN_GROUPS:{key:keyof PlanChoices;title:string;help:string;choices:Choice[]}[]=[
 {key:'style',title:'How do we want to play?',help:'Choose the overall match style.',choices:[
  {id:'direct',label:'Direct and fast',text:'Play direct, take ground and move the ball forward early.'},
  {id:'controlled',label:'Control the footy',text:'Keep possession when it is there and make the opposition defend.'},
  {id:'contest',label:'Make it a contest',text:'Keep the game tight, strong around the ball and hard to play against.'}
 ]},
 {key:'ball',title:'Ball movement',help:'Set the first option with the footy.',choices:[
  {id:'forward',label:'First option forward',text:'Look forward first and avoid unnecessary sideways movement.'},
  {id:'switch',label:'Use the switch',text:'Use the switch when the open side is available, then move quickly.'},
  {id:'simple',label:'Simple and safe',text:'Use the easy option, support the ball carrier and avoid risky kicks.'}
 ]},
 {key:'contest',title:'Around the contest',help:'Choose the stoppage priority.',choices:[
  {id:'first-use',label:'Win first use',text:'Get in tight, win first possession and drive the ball forward.'},
  {id:'defensive-side',label:'Protect defensive side',text:'Keep one player defensive side and do not let the opposition exit cleanly.'},
  {id:'spread',label:'Spread from the contest',text:'Win it inside, then spread quickly to give the ball carrier an option.'}
 ]},
 {key:'forward',title:'Going inside 50',help:'Choose the forward-half focus.',choices:[
  {id:'lower-eyes',label:'Lower the eyes',text:'Lower the eyes going inside 50 and use the best available target.'},
  {id:'lock-it-in',label:'Lock it in',text:'Once it goes forward, hold our shape and keep the ball in the area.'},
  {id:'space',label:'Create space',text:'Keep the forward line open and lead into space rather than crowding the ball.'}
 ]},
 {key:'defence',title:'Without the ball',help:'Choose the defensive priority.',choices:[
  {id:'pressure',label:'Pressure the ball',text:'Pressure the ball carrier and make every opposition possession rushed.'},
  {id:'contest-kicks',label:'Force long kicks',text:'Close the easy options and make them kick long to a contest.'},
  {id:'shape',label:'Hold our shape',text:'Stay connected behind the ball and do not get pulled out of position.'}
 ]}
]

export default function MatchDayCommandCentre({children}:{children:ReactNode}){
 const[stage,setStage]=useState<Stage>('ready')
 const[choices,setChoices]=useState<PlanChoices>(()=>readJson('playfooty.matchday.prep.gameplan.choices',blankChoices))
 const[kpis,setKpis]=useState<KpiDraft>(()=>readJson('playfooty.matchday.prep.kpis',blankKpis))
 const launched=stage==='live'
 const plan=useMemo(()=>buildPlan(choices),[choices])
 const completed=Object.values(choices).filter(Boolean).length

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
  localStorage.setItem('playfooty.matchday.prep.gameplan.choices',JSON.stringify(choices))
  localStorage.setItem('playfooty.matchday.prep.gameplan',JSON.stringify(plan))
  window.dispatchEvent(new CustomEvent('playfooty:matchday-gameplan',{detail:plan}))
  setStage('kpi')
 }

 async function startMatch(){
  localStorage.setItem('playfooty.matchday.prep.gameplan.choices',JSON.stringify(choices))
  localStorage.setItem('playfooty.matchday.prep.gameplan',JSON.stringify(plan))
  localStorage.setItem('playfooty.matchday.prep.kpis',JSON.stringify(kpis))
  window.dispatchEvent(new CustomEvent('playfooty:matchday-gameplan',{detail:plan}))
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
     <div className="md-loading-card"><span>PlayFooty Coaching</span><h1>Ready in 2</h1><p>Build the game plan and set the match KPIs before opening Live Match.</p><button onClick={()=>setStage('game-plan')}>Next <ArrowRight size={18}/></button></div>
    </section>

    <section className="md-prep-page">
     <div className="md-form-card md-plan-builder">
      <header><div><span>Step 1 of 2</span><h2>Build the game plan</h2><p>Tap one option in each section. PlayFooty creates the plan for you.</p></div><b>{completed}/5 selected</b></header>
      <div className="md-choice-groups">{PLAN_GROUPS.map(group=><section className="md-choice-group" key={group.key}><div className="md-choice-copy"><h3>{group.title}</h3><p>{group.help}</p></div><div className="md-choice-options">{group.choices.map(choice=>{const selected=choices[group.key]===choice.id;return <button type="button" className={selected?'selected':''} key={choice.id} onClick={()=>setChoices({...choices,[group.key]:choice.id})}>{selected&&<Check size={15}/>}<span>{choice.label}</span></button>})}</div></section>)}</div>
      <footer><button className="secondary" onClick={()=>setStage('ready')}><ArrowLeft size={16}/>Back</button><button onClick={savePlanAndContinue}>Next: KPIs <ArrowRight size={17}/></button></footer>
     </div>
    </section>

    <section className="md-prep-page">
     <div className="md-form-card md-kpi-card"><header><div><span>Step 2 of 2</span><h2>Set the KPIs</h2><p>Use the simple controls to set each match target.</p></div></header><div className="md-kpi-grid">{KPI_ROWS.map(([key,short,label])=><article key={key}><div><strong>{short}</strong><span>{label}</span></div><div className="md-stepper"><button aria-label={`Lower ${label}`} onClick={()=>setKpis({...kpis,[key]:Math.max(0,kpis[key]-1)})}>−</button><b>{kpis[key]}</b><button aria-label={`Raise ${label}`} onClick={()=>setKpis({...kpis,[key]:kpis[key]+1})}>+</button></div></article>)}</div><footer><button className="secondary" onClick={()=>setStage('game-plan')}><ArrowLeft size={16}/>Back</button><button onClick={()=>void startMatch()}><Radio size={16}/>Start match</button></footer></div>
    </section>
   </div>
  </main>}
  <style>{styles}</style>
 </>
}

function readJson<T>(key:string,fallback:T):T{try{return {...fallback,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{return fallback}}
function choiceText(key:keyof PlanChoices,id:string){return PLAN_GROUPS.find(group=>group.key===key)?.choices.find(choice=>choice.id===id)?.text||''}
function buildPlan(choices:PlanChoices):PlanDraft{
 const selected=(Object.keys(choices) as (keyof PlanChoices)[]).map(key=>choiceText(key,choices[key])).filter(Boolean)
 return {
  teamInstructions:selected.length?selected.join(' '):'No game plan options selected.',
  quarterTimeReminders:[choiceText('style',choices.style),choiceText('defence',choices.defence)].filter(Boolean).join(' ')||'Review the scoreboard, territory and contest numbers at the break.',
  overview:choiceText('defence',choices.defence)||'No opposition focus selected.',
  stoppagePlan:choiceText('contest',choices.contest)||'No stoppage focus selected.',
  kickInPlan:choiceText('ball',choices.ball)||'No ball movement focus selected.'
 }
}

const styles=`
.md-command-live-layer{position:fixed;inset:0;z-index:-1;visibility:hidden;pointer-events:none;overflow:hidden;background:#07111c}.md-command-live-layer.launched{z-index:20;visibility:visible;pointer-events:auto}.md-command-live-layer>.md{width:100%;height:100%}
.md-prep-shell{position:fixed;z-index:2147482500;inset:0;width:100vw;height:100dvh;overflow:hidden;background:linear-gradient(145deg,#e9edf0,#dfe5e9)}.md-prep-track{display:flex;width:300%;height:100%;transition:transform .32s cubic-bezier(.22,.8,.24,1)}.md-prep-page{width:33.333333%;height:100%;display:grid;place-items:center;padding:18px;box-sizing:border-box}.md-loading-card,.md-form-card{border-radius:24px;background:#fff;color:#101820;box-shadow:0 24px 60px rgba(14,29,40,.18)}.md-loading-card{width:min(420px,90vw);display:grid;justify-items:center;padding:48px 38px;text-align:center}.md-loading-card>span,.md-form-card header span{color:#087db9;font-size:11px;font-weight:950;letter-spacing:.18em;text-transform:uppercase}.md-loading-card h1{margin:10px 0 5px;font-family:'Bebas Neue',Impact,sans-serif;font-size:72px;line-height:.92;text-transform:uppercase}.md-loading-card p{max-width:330px;margin:0;color:#5d6972;font-size:15px;line-height:1.5}.md-loading-card button,.md-form-card footer button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 20px;border:0;border-radius:11px;background:#159ddd;color:#fff;font-weight:950;text-transform:uppercase}.md-loading-card button{min-width:150px;margin-top:26px}.md-form-card{width:min(980px,96vw);height:min(690px,calc(100dvh - 28px));display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}.md-form-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:19px 22px 14px;border-bottom:1px solid #e2e8ec}.md-form-card header>b{flex:0 0 auto;padding:8px 11px;border-radius:999px;background:#e8f5fb;color:#087db9;font-size:11px}.md-form-card h2{margin:4px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:43px;line-height:1;text-transform:uppercase}.md-form-card header p{margin:4px 0 0;color:#67747e}.md-choice-groups,.md-kpi-grid{min-height:0;overflow:auto;padding:14px 20px}.md-choice-groups{display:grid;gap:9px}.md-choice-group{display:grid;grid-template-columns:190px minmax(0,1fr);align-items:center;gap:14px;padding:11px 12px;border:1px solid #dce5ea;border-radius:14px;background:#f9fbfc}.md-choice-copy h3{margin:0;font-size:14px;text-transform:uppercase}.md-choice-copy p{margin:3px 0 0;color:#73818b;font-size:11px}.md-choice-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.md-choice-options button{position:relative;min-height:54px;border:1px solid #ccd8df;border-radius:11px;background:#fff;color:#26343e;padding:8px 9px;font-weight:900}.md-choice-options button.selected{border-color:#159ddd;background:#e9f7fe;color:#087db9;box-shadow:inset 0 0 0 1px #159ddd}.md-choice-options button svg{position:absolute;top:6px;right:6px}.md-choice-options button span{display:block}.md-kpi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:10px}.md-kpi-grid article{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 15px;border:1px solid #d9e2e8;border-radius:12px;background:#f9fbfc}.md-kpi-grid article strong,.md-kpi-grid article span{display:block}.md-kpi-grid article strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:27px}.md-kpi-grid article span{color:#71808b;font-size:11px}.md-stepper{display:grid;grid-template-columns:38px 48px 38px;align-items:center;text-align:center}.md-stepper button{height:38px;border:0;border-radius:8px;background:#0caf68;color:#fff;font-size:22px;font-weight:950}.md-stepper button:first-child{background:#d52c35}.md-stepper b{font-size:20px}.md-form-card footer{display:flex;justify-content:space-between;gap:10px;padding:13px 20px;border-top:1px solid #e2e8ec;background:#fff}.md-form-card footer .secondary{background:#e5ebef;color:#26343e}
html.pf-match-day-focus-root,html.pf-match-day-focus-root body{width:100%!important;height:100%!important;overflow:hidden!important;background:#07111c!important}.pf-match-day-focus-root .coach-workspace-layer{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;overflow:hidden!important}.pf-match-day-focus-root .coach-workspace-content{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;min-height:0!important;overflow:hidden!important;padding:0!important}.pf-match-day-focus-root .md-command-live-layer{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483001!important;visibility:visible!important;pointer-events:auto!important;overflow:hidden!important;background:#07111c!important}.pf-match-day-focus-root .md-command-live-layer>.md{position:absolute!important;top:0!important;left:50%!important;inset:auto!important;width:1024px!important;height:768px!important;min-width:1024px!important;min-height:768px!important;max-width:1024px!important;max-height:768px!important;margin:0!important;overflow:hidden!important;transform:translateX(-50%) scale(var(--pf-md-live-scale,1))!important;transform-origin:top center!important}.pf-match-day-focus-root .md-layout{width:1024px!important;height:768px!important}.pf-match-day-focus-root .md-field-panel{width:512px!important;height:768px!important}.pf-match-day-focus-root .md-ground-wrap{width:512px!important;height:768px!important}.pf-match-day-focus-root .md-ground{width:min(460px,553px)!important}.pf-match-day-focus-root .md-toolbar{left:256px!important;max-width:492px!important}.pf-match-day-focus-root .md-fs-score.md-fs-score-top{left:524px!important;right:auto!important;width:488px!important}.pf-match-day-focus-root .md-fs-stats{top:58px!important;right:12px!important;width:488px!important;height:318px!important;min-height:0!important}.pf-match-day-focus-root .club-section-sidebar,.pf-match-day-focus-root .club-section-mobile,.pf-match-day-focus-root .club-hq-bottom{display:none!important}
@media(max-width:760px),(max-height:620px){.md-prep-page{padding:8px}.md-form-card{width:calc(100vw - 16px);height:calc(100dvh - 16px);border-radius:18px}.md-form-card header{padding:12px 14px 9px}.md-form-card h2{font-size:34px}.md-form-card header p{font-size:11px}.md-choice-groups,.md-kpi-grid{padding:9px 12px}.md-choice-group{grid-template-columns:145px minmax(0,1fr);gap:9px;padding:8px}.md-choice-options{gap:5px}.md-choice-options button{min-height:45px;padding:5px;font-size:10px}.md-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.md-kpi-grid article{padding:8px 10px}.md-form-card footer{padding:9px 12px}.md-form-card footer button{min-height:40px;padding:0 13px;font-size:10px}}
`
