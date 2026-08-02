import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { ClipboardCheck, ClipboardList, Dumbbell, Home, ShieldCheck, Sparkles, Swords, Users, Wrench } from 'lucide-react'
import TeamSelectionAvailabilityWarnings from './TeamSelectionAvailabilityWarnings'
import WhiteboardAppMode from './WhiteboardAppMode'
import CoachingAppHome from '../../pages/CoachingAppHome'
import CoachingTeamHub from '../../pages/CoachingTeamHub'
import ClubPortalMatchDay from '../../pages/ClubPortalMatchDay'
import ClubPortalTraining from '../../pages/ClubPortalTraining'
import ClubPortalOpposition from '../../pages/ClubPortalOpposition'
import ClubPortalPlayerDevelopment from '../../pages/ClubPortalPlayerDevelopment'
import TrainingRecordsPanel from './TrainingRecordsPanel'
import PostMatchReviewPanel from './PostMatchReviewPanel'
import MatchDayGamePlanPanel from './MatchDayGamePlanPanel'
import LiveMatchReportPanel from './LiveMatchReportPanel'
import MatchDayLiveSync from './MatchDayLiveSync'
import PublicLiveMatchPortal from './PublicLiveMatchPortal'

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
 const opposition=view==='opposition'
 const playerDevelopment=view==='player-development'
 const overlay=home||teamHub||matchDay||training||opposition||playerDevelopment
 const visible=Boolean(clubId&&COACHING_SECTIONS.has(section))

 useEffect(()=>{if(!overlay)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[overlay])
 useEffect(()=>{document.getElementById('playfooty-coaching-tabs')?.remove()},[pathname,search])

 const globalLayers=<><TeamSelectionAvailabilityWarnings/><MatchDayLiveSync/><PublicLiveMatchPortal/><WhiteboardAppMode/></>
 const mobileMenu=visible&&section!=='whiteboard'?<CoachingMobileMenu clubId={clubId} section={section} view={view}/>:null

 if(overlay)return <>{globalLayers}{createPortal(<div className="coach-workspace-layer">{mobileMenu}<div className="coach-workspace-content"><Routes><Route path="/club-portal/:clubId/coaching" element={
  home?<CoachingAppHome/>:
  teamHub?<CoachingTeamHub/>:
  matchDay?<><ClubPortalMatchDay/><PostMatchReviewPanel clubId={clubId}/><MatchDayGamePlanPanel clubId={clubId}/><LiveMatchReportPanel clubId={clubId}/></>:
  opposition?<ClubPortalOpposition/>:
  playerDevelopment?<ClubPortalPlayerDevelopment/>:
  <><ClubPortalTraining/><TrainingRecordsPanel clubId={clubId}/></>
 }/></Routes></div></div>,document.body)}<style>{workspaceStyles}</style></>

 if(!visible)return globalLayers
 return <>{globalLayers}{mobileMenu&&createPortal(<div className="coach-mobile-page-menu">{mobileMenu}</div>,document.body)}<style>{workspaceStyles}</style></>
}

function CoachingMobileMenu({clubId,section,view}:{clubId:string;section:string;view:string|null}){
 const items=[
  {label:'Overview',href:`/club-portal/${clubId}/coaching`,icon:Home,active:section==='coaching'&&!view},
  {label:'Team',href:`/club-portal/${clubId}/coaching?view=team`,icon:Users,active:section==='coaching'&&view==='team'},
  {label:'Availability',href:`/club-portal/${clubId}/availability`,icon:ClipboardCheck,active:section==='availability'},
  {label:'Selection',href:`/club-portal/${clubId}/team-selection`,icon:ShieldCheck,active:section==='team-selection'},
  {label:'Training',href:`/club-portal/${clubId}/coaching?view=training`,icon:Dumbbell,active:section==='coaching'&&view==='training'},
  {label:'Match Day',href:`/club-portal/${clubId}/coaching?view=match-day`,icon:Swords,active:section==='coaching'&&view==='match-day'},
  {label:'Opposition',href:`/club-portal/${clubId}/coaching?view=opposition`,icon:ClipboardList,active:section==='coaching'&&view==='opposition'},
  {label:'Development',href:`/club-portal/${clubId}/coaching?view=player-development`,icon:Sparkles,active:section==='coaching'&&view==='player-development'},
  {label:'Whiteboard',href:`/club-portal/${clubId}/whiteboard`,icon:Wrench,active:false},
 ]
 return <nav className="coach-mobile-menu" aria-label="Coaching navigation">{items.map(item=><Link key={item.label} to={item.href} className={item.active?'active':''}><item.icon size={18}/><span>{item.label}</span></Link>)}</nav>
}

const workspaceStyles=`
.coach-workspace-layer{position:fixed;inset:0;z-index:100000;overflow:auto;background:#eef3f7}.coach-workspace-content{min-height:100%;box-sizing:border-box;padding:22px clamp(10px,3vw,34px) 70px}.coach-mobile-menu,.coach-mobile-page-menu{display:none}@media(max-width:760px){.coach-workspace-content{padding:14px 8px 105px}.coach-mobile-menu{position:sticky;top:0;z-index:100220;display:flex;gap:6px;overflow-x:auto;padding:8px 9px;border-bottom:1px solid #dfe4e8;background:rgba(250,251,252,.97);box-shadow:0 7px 18px rgba(15,23,42,.05);backdrop-filter:blur(18px);scrollbar-width:none}.coach-mobile-menu a{display:flex;flex:0 0 auto;min-height:42px;align-items:center;gap:6px;padding:0 11px;border-radius:11px;color:#7f8992;text-decoration:none;font-size:9px;font-weight:900;white-space:nowrap}.coach-mobile-menu a.active{background:#e6f5fe;color:#087bbf}.coach-mobile-page-menu{position:fixed;left:0;right:0;top:0;z-index:100250;display:block}.coach-mobile-page-menu .coach-mobile-menu{position:relative}body:has(.coach-mobile-page-menu) .club-portal-page,body:has(.coach-mobile-page-menu) .club-portal-page-wrap{padding-top:82px!important}}
`
