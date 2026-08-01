import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { Clock3, Dumbbell, Home, Users } from 'lucide-react'
import TeamSelectionAvailabilityWarnings from './TeamSelectionAvailabilityWarnings'
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
 const appVisible=visible&&section!=='users'

 useEffect(()=>{if(!overlay)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[overlay])
 useEffect(()=>{document.getElementById('playfooty-coaching-tabs')?.remove()},[pathname,search])

 const globalLayers=<><TeamSelectionAvailabilityWarnings/><MatchDayLiveSync/><PublicLiveMatchPortal/></>
 const bottomNav=appVisible?<CoachingBottomNav clubId={clubId} section={section} view={view}/>:null

 if(overlay)return <>{globalLayers}{createPortal(<div className="coach-workspace-layer"><Routes><Route path="/club-portal/:clubId/coaching" element={
  home?<CoachingAppHome/>:
  teamHub?<CoachingTeamHub/>:
  matchDay?<><ClubPortalMatchDay/><PostMatchReviewPanel clubId={clubId}/><MatchDayGamePlanPanel clubId={clubId}/><LiveMatchReportPanel clubId={clubId}/></>:
  opposition?<ClubPortalOpposition/>:
  playerDevelopment?<ClubPortalPlayerDevelopment/>:
  <><ClubPortalTraining/><TrainingRecordsPanel clubId={clubId}/></>
 }/></Routes>{bottomNav}</div>,document.body)}<style>{workspaceStyles}</style></>

 if(!visible)return globalLayers
 return <>{globalLayers}{bottomNav&&createPortal(bottomNav,document.body)}<style>{workspaceStyles}</style></>
}

function CoachingBottomNav({clubId,section,view}:{clubId:string;section:string;view:string|null}){
 const teamActive=section==='availability'||section==='team-selection'||section==='whiteboard'||['team','opposition','player-development'].includes(view||'')
 const items=[
  {label:'Home',href:`/club-portal/${clubId}/coaching`,icon:Home,active:section==='coaching'&&!view},
  {label:'Team',href:`/club-portal/${clubId}/coaching?view=team`,icon:Users,active:teamActive},
  {label:'Training',href:`/club-portal/${clubId}/coaching?view=training`,icon:Dumbbell,active:view==='training'},
  {label:'Match',href:`/club-portal/${clubId}/coaching?view=match-day`,icon:Clock3,active:view==='match-day'},
 ]
 return <nav className="coach-app-bottom" aria-label="Coaching app navigation"><div>{items.map(item=><Link key={item.label} to={item.href} className={item.active?'active':''} aria-current={item.active?'page':undefined}><item.icon size={22}/><span>{item.label}</span></Link>)}</div></nav>
}

const workspaceStyles=`
.coach-workspace-layer{position:fixed;inset:0;z-index:100000;overflow:auto;background:#f7f8fa;padding-bottom:82px}.coach-app-bottom{position:fixed;left:0;right:0;bottom:0;z-index:100200;padding:7px 12px calc(7px + env(safe-area-inset-bottom));background:rgba(250,251,252,.96);border-top:1px solid #dfe4e8;box-shadow:0 -8px 28px rgba(15,23,42,.09);backdrop-filter:blur(18px)}.coach-app-bottom>div{width:min(620px,100%);margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr)}.coach-app-bottom a{display:flex;min-height:54px;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:13px;color:#92989f;text-decoration:none;font-size:10px;font-weight:850}.coach-app-bottom a.active{color:#5d2eb8;background:#f0eaff}.coach-app-bottom a.active svg{stroke-width:2.8}@media(min-width:761px){.coach-app-bottom{left:50%;right:auto;bottom:18px;width:min(620px,calc(100% - 36px));transform:translateX(-50%);border:1px solid #dfe4e8;border-radius:20px;padding:7px;box-shadow:0 12px 34px rgba(15,23,42,.15)}}
`
