import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { Clock3, Dumbbell, Home, Users } from 'lucide-react'
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
 const toolsVisible=visible&&section!=='users'&&section!=='whiteboard'

 useEffect(()=>{if(!overlay)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[overlay])
 useEffect(()=>{document.getElementById('playfooty-coaching-tabs')?.remove()},[pathname,search])

 const globalLayers=<><TeamSelectionAvailabilityWarnings/><MatchDayLiveSync/><PublicLiveMatchPortal/><WhiteboardAppMode/></>
 const toolNav=toolsVisible?<CoachingToolNav clubId={clubId} section={section} view={view}/>:null

 if(overlay)return <>{globalLayers}{createPortal(<div className="coach-workspace-layer">{toolNav}<div className="coach-workspace-content"><Routes><Route path="/club-portal/:clubId/coaching" element={
  home?<CoachingAppHome/>:
  teamHub?<CoachingTeamHub/>:
  matchDay?<><ClubPortalMatchDay/><PostMatchReviewPanel clubId={clubId}/><MatchDayGamePlanPanel clubId={clubId}/><LiveMatchReportPanel clubId={clubId}/></>:
  opposition?<ClubPortalOpposition/>:
  playerDevelopment?<ClubPortalPlayerDevelopment/>:
  <><ClubPortalTraining/><TrainingRecordsPanel clubId={clubId}/></>
 }/></Routes></div></div>,document.body)}<style>{workspaceStyles}</style></>

 if(!visible)return globalLayers
 return <>{globalLayers}{toolNav&&createPortal(<div className="coach-page-tools">{toolNav}</div>,document.body)}<style>{workspaceStyles}</style></>
}

function CoachingToolNav({clubId,section,view}:{clubId:string;section:string;view:string|null}){
 const teamActive=section==='availability'||section==='team-selection'||['team','opposition','player-development'].includes(view||'')
 const items=[
  {label:'Coaching Home',detail:'Overview and next actions',href:`/club-portal/${clubId}/coaching`,icon:Home,active:section==='coaching'&&!view},
  {label:'Team',detail:'Availability, selection and development',href:`/club-portal/${clubId}/coaching?view=team`,icon:Users,active:teamActive},
  {label:'Training',detail:'Attendance, plans and records',href:`/club-portal/${clubId}/coaching?view=training`,icon:Dumbbell,active:view==='training'},
  {label:'Match Day',detail:'Game plan, live match and review',href:`/club-portal/${clubId}/coaching?view=match-day`,icon:Clock3,active:view==='match-day'},
 ]
 return <nav className="coach-tool-nav" aria-label="Coaching tools">{items.map(item=><Link key={item.label} to={item.href} className={item.active?'active':''} aria-current={item.active?'page':undefined}><item.icon size={20}/><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>)}</nav>
}

const workspaceStyles=`
.coach-workspace-layer{position:fixed;inset:0;z-index:100000;overflow:auto;background:#eef3f7}.coach-workspace-content{min-height:100%;box-sizing:border-box;padding:22px clamp(10px,3vw,34px) 70px}.coach-tool-nav,.coach-page-tools{display:none}.coach-tool-nav{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:10px;border-bottom:1px solid #dfe4e8;background:rgba(250,251,252,.97);box-shadow:0 8px 22px rgba(15,23,42,.05);backdrop-filter:blur(18px)}.coach-tool-nav a{display:grid;grid-template-columns:36px 1fr;align-items:center;gap:8px;min-width:0;padding:10px 12px;border-radius:13px;color:#6f7983;text-decoration:none}.coach-tool-nav a>svg{justify-self:center}.coach-tool-nav a>span{display:grid;min-width:0}.coach-tool-nav strong{font-size:12px}.coach-tool-nav small{overflow:hidden;color:#8a949d;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.coach-tool-nav a.active{background:#e6f5fe;color:#087bbf}.coach-tool-nav a.active small{color:#4c8eaf}@media(max-width:760px){.coach-workspace-content{padding:14px 8px 105px}.coach-tool-nav{position:sticky;top:0;z-index:4;display:grid;grid-template-columns:repeat(4,142px);padding:8px;overflow-x:auto}.coach-tool-nav a{grid-template-columns:30px 1fr;padding:9px}.coach-page-tools{position:fixed;left:0;right:0;top:0;z-index:100250;display:block}.coach-page-tools .coach-tool-nav{position:relative}body:has(.coach-page-tools) .club-portal-page,body:has(.coach-page-tools) .club-portal-page-wrap{padding-top:82px!important}}
`
