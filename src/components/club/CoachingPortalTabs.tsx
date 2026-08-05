import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { ClipboardCheck, ClipboardList, Dumbbell, Home, ShieldCheck, Sparkles, Swords, Users, Wrench } from 'lucide-react'
import TeamSelectionAvailabilityWarnings from './TeamSelectionAvailabilityWarnings'
import TeamSelectionDeleteEnhancer from './TeamSelectionDeleteEnhancer'
import WhiteboardAppMode from './WhiteboardAppMode'
import CoachingAppHome from '../../pages/CoachingAppHome'
import CoachingTeamHub from '../../pages/CoachingTeamHub'
import ClubPortalMatchDay from '../../pages/ClubPortalMatchDay'
import ClubPortalTraining from '../../pages/ClubPortalTraining'
import ClubPortalTrainingPlanner from '../../pages/ClubPortalTrainingPlanner'
import ClubPortalOpposition from '../../pages/ClubPortalOpposition'
import ClubPortalPlayerDevelopment from '../../pages/ClubPortalPlayerDevelopment'
import TrainingRecordsPanel from './TrainingRecordsPanel'
import PostMatchReviewPanel from './PostMatchReviewPanel'
import MatchDayGamePlanPanel from './MatchDayGamePlanPanel'
import MatchDayWhiteboardDrawer from './MatchDayWhiteboardDrawer'
import LiveMatchReportPanel from './LiveMatchReportPanel'
import MatchDayLiveSync from './MatchDayLiveSync'
import PublicLiveMatchPortal from './PublicLiveMatchPortal'
import MatchDayGameSummaryOverlay from './MatchDayGameSummaryOverlay'
import MatchDayFullscreenControl from './MatchDayFullscreenControl'
import MatchDayFullscreenFitEnhancer from './MatchDayFullscreenFitEnhancer'

const COACHING_SECTIONS=new Set(['coaching','availability','team-selection','whiteboard','users'])

export default function CoachingPortalTabs(){
 const{pathname,search}=useLocation()
 const match=pathname.match(/^\/club-portal\/([^/]+)\/(coaching|availability|team-selection|whiteboard|users)(?:\/|$)/)
 const clubId=match?.[1]??''
 const section=match?.[2]??''
 const view=section==='coaching'?new URLSearchParams(search).get('view'):null
 const home=section==='coaching'&&!view
 const teamHub=view==='team'
 const matchDay=view==='match-day'
 const training=view==='training'
 const trainingPlan=view==='training-plan'
 const opposition=view==='opposition'
 const playerDevelopment=view==='player-development'
 const overlay=home||teamHub||matchDay||training||trainingPlan||opposition||playerDevelopment
 const visible=Boolean(clubId&&COACHING_SECTIONS.has(section))

 useEffect(()=>{if(!overlay)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[overlay])
 useEffect(()=>{document.getElementById('playfooty-coaching-tabs')?.remove()},[pathname,search])

 const globalLayers=<><TeamSelectionAvailabilityWarnings/><TeamSelectionDeleteEnhancer/><MatchDayLiveSync/><PublicLiveMatchPortal/><WhiteboardAppMode/></>
 const mobileMenu=visible&&section!=='whiteboard'?<CoachingMobileMenu clubId={clubId} section={section} view={view}/>:null

 if(overlay)return <>{globalLayers}{createPortal(<div className="coach-workspace-layer">{mobileMenu}<div className="coach-workspace-content"><Routes><Route path="/club-portal/:clubId/coaching" element={
  home?<CoachingAppHome/>:
  teamHub?<CoachingTeamHub/>:
  matchDay?<><ClubPortalMatchDay/><PostMatchReviewPanel clubId={clubId}/><MatchDayGamePlanPanel clubId={clubId}/><MatchDayWhiteboardDrawer clubId={clubId}/><LiveMatchReportPanel clubId={clubId}/><MatchDayCreativeReportOption/><MatchDayGameSummaryOverlay clubId={clubId}/><MatchDayFullscreenControl/><MatchDayFullscreenFitEnhancer/></>:
  trainingPlan?<ClubPortalTrainingPlanner/>:
  opposition?<ClubPortalOpposition/>:
  playerDevelopment?<ClubPortalPlayerDevelopment/>:
  <><ClubPortalTraining/><TrainingRecordsPanel clubId={clubId}/></>
 }/></Routes></div></div>,document.body)}<style>{workspaceStyles}</style></>

 if(!visible)return globalLayers
 return <>{globalLayers}{mobileMenu&&createPortal(<div className="coach-mobile-page-menu">{mobileMenu}</div>,document.body)}<style>{workspaceStyles}</style></>
}

function MatchDayCreativeReportOption(){
 const[host,setHost]=useState<HTMLElement|null>(null)
 useEffect(()=>{
  let active=true
  const attach=()=>{
   if(!active)return
   const aside=document.querySelector<HTMLElement>('.md-layout>aside')
   if(!aside)return
   let next=document.getElementById('pf-match-day-creative-host')
   if(!next){next=document.createElement('div');next.id='pf-match-day-creative-host';aside.appendChild(next)}
   setHost(next)
  }
  attach()
  const observer=new MutationObserver(attach)
  observer.observe(document.body,{childList:true,subtree:true})
  return()=>{active=false;observer.disconnect();document.getElementById('pf-match-day-creative-host')?.remove();setHost(null)}
 },[])
 if(!host)return null
 return createPortal(<section className="md-creative">
  <span>Creative</span>
  <h2>Live match report</h2>
  <p>Build and edit the quarter-by-quarter match story while the game is running.</p>
  <button type="button" onClick={()=>document.querySelector<HTMLButtonElement>('.lmr-launch')?.click()}><ClipboardList size={17}/>Open match report</button>
 </section>,host)
}

function CoachingMobileMenu({clubId,section,view}:{clubId:string;section:string;view:string|null}){
 const items=[
  {label:'Overview',href:`/club-portal/${clubId}/coaching`,icon:Home,active:section==='coaching'&&!view},
  {label:'Team',href:`/club-portal/${clubId}/coaching?view=team`,icon:Users,active:section==='coaching'&&view==='team'},
  {label:'Availability',href:`/club-portal/${clubId}/availability`,icon:ClipboardCheck,active:section==='availability'},
  {label:'Selection',href:`/club-portal/${clubId}/team-selection`,icon:ShieldCheck,active:section==='team-selection'},
  {label:'Plan Training',href:`/club-portal/${clubId}/coaching?view=training-plan`,icon:Dumbbell,active:section==='coaching'&&view==='training-plan'},
  {label:'Training Records',href:`/club-portal/${clubId}/coaching?view=training`,icon:ClipboardList,active:section==='coaching'&&view==='training'},
  {label:'Match Day',href:`/club-portal/${clubId}/coaching?view=match-day`,icon:Swords,active:section==='coaching'&&view==='match-day'},
  {label:'Opposition',href:`/club-portal/${clubId}/coaching?view=opposition`,icon:ClipboardList,active:section==='coaching'&&view==='opposition'},
  {label:'Development',href:`/club-portal/${clubId}/coaching?view=player-development`,icon:Sparkles,active:section==='coaching'&&view==='player-development'},
  {label:'Whiteboard',href:`/club-portal/${clubId}/whiteboard`,icon:Wrench,active:false},
 ]
 return <nav className="coach-mobile-menu" aria-label="Coaching navigation">{items.map(item=><Link key={item.label} to={item.href} className={item.active?'active':''}><item.icon size={18}/><span>{item.label}</span></Link>)}</nav>
}

const workspaceStyles=`
.coach-workspace-layer{position:fixed;inset:0;z-index:100000;overflow:auto;background:#eef3f7}.coach-workspace-content{min-height:100%;box-sizing:border-box;padding:22px clamp(10px,3vw,34px) 70px}.coach-workspace-layer .lmr-launch{display:none!important}#pf-match-day-creative-host{margin-top:14px}.md-creative{min-width:0;padding:15px;border:1px solid #233645;border-radius:15px;background:#0b1621;color:#edf5fb}.md-creative>span{display:block;color:#42b8ff;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.md-creative h2{margin:4px 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;text-transform:uppercase}.md-creative p{margin:0;color:#8799a7;font-size:11px;line-height:1.45}.md-creative button{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:13px;border:0;border-radius:9px;background:#147fbd;color:#fff;padding:11px 14px;font-weight:950;text-transform:uppercase;cursor:pointer}.cpts-delete-team{background:#d9363e!important;color:#fff!important}#pf-match-day-fullscreen-host{display:inline-flex}.md-fullscreen-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;border:1px solid #2a3b49!important;border-radius:9px!important;background:#159955!important;color:#fff!important;padding:11px 14px!important;font-weight:900!important;text-transform:uppercase!important}.md:fullscreen,.md:-webkit-full-screen{width:100vw!important;height:100vh!important;max-width:none!important;overflow:auto!important;padding:12px 14px 28px!important}.md:fullscreen>header,.md:-webkit-full-screen>header{position:sticky;top:0;z-index:50;background:#07111c;padding:5px 0 10px}.md:fullscreen+.club-footer,.md:-webkit-full-screen+.club-footer{display:none!important}body.pf-match-day-focus{overflow:hidden!important}body.pf-match-day-focus .coach-workspace-layer{inset:0!important;z-index:2147483000!important;background:#07111c!important}body.pf-match-day-focus .coach-mobile-menu,body.pf-match-day-focus .coach-mobile-page-menu,body.pf-match-day-focus .club-portal-app-nav{display:none!important}body.pf-match-day-focus .coach-workspace-content{position:fixed!important;inset:0!important;overflow:auto!important;padding:0!important;background:#07111c!important}body.pf-match-day-focus .md{min-height:100vh!important;padding:12px 14px 30px!important}body.pf-match-day-focus .md>header{position:sticky;top:0;z-index:50;background:#07111c;padding:5px 0 10px}.coach-mobile-menu,.coach-mobile-page-menu{display:none}@media(max-width:760px){.coach-workspace-content{padding:14px 8px 105px}.coach-mobile-menu{position:sticky;top:0;z-index:100220;display:flex;gap:6px;overflow-x:auto;padding:8px 9px;border-bottom:1px solid #dfe4e8;background:rgba(250,251,252,.97);box-shadow:0 7px 18px rgba(15,23,42,.05);backdrop-filter:blur(18px);scrollbar-width:none}.coach-mobile-menu a{display:flex;flex:0 0 auto;min-height:42px;align-items:center;gap:6px;padding:0 11px;border-radius:11px;color:#7f8992;text-decoration:none;font-size:9px;font-weight:900;white-space:nowrap}.coach-mobile-menu a.active{background:#e6f5fe;color:#087bbf}.coach-mobile-page-menu{position:fixed;left:0;right:0;top:0;z-index:100250;display:block}.coach-mobile-page-menu .coach-mobile-menu{position:relative}body:has(.coach-mobile-page-menu) .club-portal-page,body:has(.coach-mobile-page-menu) .club-portal-page-wrap{padding-top:82px!important}.md-fullscreen-button span{display:none}}
@media(orientation:landscape) and (max-height:900px){.md:fullscreen .md-layout,.md:-webkit-full-screen .md-layout,body.pf-match-day-focus .md-layout{grid-template-columns:minmax(0,1fr) 280px!important}.md:fullscreen .md-ground-wrap,.md:-webkit-full-screen .md-ground-wrap,body.pf-match-day-focus .md-ground-wrap{max-height:calc(100vh - 230px)!important}.md:fullscreen .md-ground,.md:-webkit-full-screen .md-ground,body.pf-match-day-focus .md-ground{height:calc(100vh - 250px)!important;min-height:520px!important}}
`
