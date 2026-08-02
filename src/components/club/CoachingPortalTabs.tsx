import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Route, Routes, useLocation } from 'react-router-dom'
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

 if(overlay)return <>{globalLayers}{createPortal(<div className="coach-workspace-layer"><div className="coach-workspace-content"><Routes><Route path="/club-portal/:clubId/coaching" element={
  home?<CoachingAppHome/>:
  teamHub?<CoachingTeamHub/>:
  matchDay?<><ClubPortalMatchDay/><PostMatchReviewPanel clubId={clubId}/><MatchDayGamePlanPanel clubId={clubId}/><LiveMatchReportPanel clubId={clubId}/></>:
  opposition?<ClubPortalOpposition/>:
  playerDevelopment?<ClubPortalPlayerDevelopment/>:
  <><ClubPortalTraining/><TrainingRecordsPanel clubId={clubId}/></>
 }/></Routes></div></div>,document.body)}<style>{workspaceStyles}</style></>

 if(!visible)return globalLayers
 return globalLayers
}

const workspaceStyles=`
.coach-workspace-layer{position:fixed;inset:0;z-index:100000;overflow:auto;background:#eef3f7}.coach-workspace-content{min-height:100%;box-sizing:border-box;padding:22px clamp(10px,3vw,34px) 70px}@media(max-width:760px){.coach-workspace-content{padding:14px 8px 105px}}
`
