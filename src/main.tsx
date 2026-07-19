import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import './index.css'
import './carousel.css'
import './goal-kickers-mobile.css'
import App from './App.tsx'
import PowerRankings from './pages/PowerRankings.tsx'
import Directory from './pages/Directory.tsx'
import FullRankings from './pages/FullRankings.tsx'
import GoalKickers from './pages/GoalKickers.tsx'
import PlayerProfile from './pages/PlayerProfile.tsx'
import MatchCentre from './pages/MatchCentre.tsx'
import MatchDetail from './pages/MatchDetail.tsx'
import Notifications from './pages/Notifications.tsx'
import SupporterFeed from './pages/SupporterFeed.tsx'
import TeamProfile from './pages/TeamProfile.tsx'
import LeagueProfile from './pages/LeagueProfile.tsx'
import Leagues from './pages/Leagues.tsx'
import News from './pages/News.tsx'
import NewsArticle from './pages/NewsArticle.tsx'
import Championship from './pages/Championship.tsx'
import About from './pages/About.tsx'
import Records from './pages/Records.tsx'
import PublicInformation from './pages/PublicInformation.tsx'
import NotFound from './pages/NotFound.tsx'
import AdminWorkflow from './pages/AdminWorkflow.tsx'
import AdminHealth from './pages/AdminHealth.tsx'
import AdminLaunchReadiness from './pages/AdminLaunchReadiness.tsx'
import AdminNotificationDelivery from './pages/AdminNotificationDelivery.tsx'
import AdminLeagueCoverage from './pages/AdminLeagueCoverage.tsx'
import AdminMaintenanceQueue from './pages/AdminMaintenanceQueue.tsx'
import AdminMatchImageImports from './pages/AdminMatchImageImports.tsx'
import AdminGoalKickerImages from './pages/AdminGoalKickerImages.tsx'
import AdminProfileImageImports from './pages/AdminProfileImageImports.tsx'
import AdminUniversalImports from './pages/AdminUniversalImports.tsx'
import AdminLadderImageImports from './pages/AdminLadderImageImports.tsx'
import AdminHighlights from './pages/AdminHighlights.tsx'
import Highlights from './pages/Highlights.tsx'
import HighlightDetail from './pages/HighlightDetail.tsx'
import ClaimClub from './pages/ClaimClub.tsx'
import ClubPortal from './pages/ClubPortal.tsx'
import ClubClaimsAdmin from './pages/ClubClaimsAdmin.tsx'
import AutoShareButtons from './components/sharing/AutoShareButtons.tsx'
import ProfileShareButton from './components/sharing/ProfileShareButton.tsx'
import ImportHandoffInjector from './components/admin/ImportHandoffInjector.tsx'
import AdminWorkflowMobileFix from './components/admin/AdminWorkflowMobileFix.tsx'
import AdminClubProfileFallback from './components/admin/AdminClubProfileFallback.tsx'
import AdminHealthLink from './components/admin/AdminHealthLink.tsx'
import GoalKickerMistakeManager from './components/admin/GoalKickerMistakeManager.tsx'
import GoalKickerReviewEnhancer from './components/admin/GoalKickerReviewEnhancer.tsx'
import GoalKickerAchievementManager from './components/admin/GoalKickerAchievementManager.tsx'
import NewsroomManager from './components/admin/NewsroomManager.tsx'
import GoalKickerPublicIntegration from './components/goal-kickers/GoalKickerPublicIntegration.tsx'
import GoalKickerAchievementsPortal from './components/goal-kickers/GoalKickerAchievementsPortal.tsx'
import HighlightPublicIntegration from './components/highlights/HighlightPublicIntegration.tsx'
import RankingHealthPortal from './components/rankings/RankingHealthPortal.tsx'
import UnifiedSearchExtras from './components/rankings/UnifiedSearchExtras.tsx'
import HomeRecordsPortal from './components/home/HomeRecordsPortal.tsx'
import HomePlayerRecordsPortal from './components/home/HomePlayerRecordsPortal.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'

type HomeGoalKicker = { id: string }
function ScrollToTop(){const{pathname}=useLocation();useEffect(()=>{window.scrollTo(0,0)},[pathname]);return null}
function HomePlayerProfileLinks(){const navigate=useNavigate();const{pathname}=useLocation();const[players,setPlayers]=useState<HomeGoalKicker[]>([]);useEffect(()=>{if(pathname!=='/')return;let active=true;void fetch('/api/goal-kickers?mode=raw&limit=5').then(r=>r.ok?r.json():Promise.reject(new Error(`HTTP ${r.status}`))).then((p:{data?:HomeGoalKicker[]})=>{if(active)setPlayers(Array.isArray(p.data)?p.data:[])}).catch(()=>{if(active)setPlayers([])});return()=>{active=false}},[pathname]);useEffect(()=>{if(pathname!=='/'||players.length===0)return;const handleClick=(event:MouseEvent)=>{const element=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('.pf-goal-row'):null;if(!element)return;const rows=Array.from(document.querySelectorAll<HTMLAnchorElement>('.pf-goal-row'));const player=players[rows.indexOf(element)];if(!player?.id)return;event.preventDefault();navigate(`/player/${encodeURIComponent(player.id)}`)};document.addEventListener('click',handleClick);return()=>document.removeEventListener('click',handleClick)},[navigate,pathname,players]);return null}

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><ScrollToTop/><ImportHandoffInjector/><AdminWorkflowMobileFix/><AdminClubProfileFallback/><AdminHealthLink/><GoalKickerMistakeManager/><GoalKickerReviewEnhancer/><GoalKickerAchievementManager/><NewsroomManager/><GoalKickerPublicIntegration/><GoalKickerAchievementsPortal/><HighlightPublicIntegration/><RankingHealthPortal/><UnifiedSearchExtras/><HomePlayerProfileLinks/><HomeRecordsPortal/><HomePlayerRecordsPortal/><AutoShareButtons/><ProfileShareButton/><ErrorBoundary><Routes>
    <Route path="/" element={<App/>}/>
    <Route path="/power-rankings" element={<PowerRankings/>}/>
    <Route path="/rankings" element={<FullRankings/>}/>
    <Route path="/records" element={<Records/>}/>
    <Route path="/goal-kickers" element={<GoalKickers/>}/>
    <Route path="/player/:playerId" element={<PlayerProfile/>}/>
    <Route path="/matches" element={<MatchCentre/>}/>
    <Route path="/match/:kind/:matchId" element={<MatchDetail/>}/>
    <Route path="/feed" element={<SupporterFeed/>}/>
    <Route path="/notifications" element={<Notifications/>}/>
    <Route path="/highlights" element={<Highlights/>}/>
    <Route path="/highlights/:highlightId" element={<HighlightDetail/>}/>
    <Route path="/team/:clubId" element={<TeamProfile/>}/>
    <Route path="/claim-club/:clubId" element={<ClaimClub/>}/>
    <Route path="/club-portal" element={<ClubPortal/>}/>
    <Route path="/league/:leagueId" element={<LeagueProfile/>}/>
    <Route path="/leagues" element={<Leagues/>}/>
    <Route path="/news" element={<News/>}/>
    <Route path="/news/:slug" element={<NewsArticle/>}/>
    <Route path="/directory" element={<Directory/>}/>
    <Route path="/about" element={<About/>}/>
    <Route path="/privacy" element={<PublicInformation/>}/>
    <Route path="/terms" element={<PublicInformation/>}/>
    <Route path="/disclaimer" element={<PublicInformation/>}/>
    <Route path="/community-guidelines" element={<PublicInformation/>}/>
    <Route path="/support" element={<PublicInformation/>}/>
    <Route path="/admin" element={<AdminWorkflow/>}/>
    <Route path="/admin/health" element={<AdminHealth/>}/>
    <Route path="/admin/launch-readiness" element={<AdminLaunchReadiness/>}/>
    <Route path="/admin/notification-delivery" element={<AdminNotificationDelivery/>}/>
    <Route path="/admin/league-coverage" element={<AdminLeagueCoverage/>}/>
    <Route path="/admin/maintenance-queue" element={<AdminMaintenanceQueue/>}/>
    <Route path="/admin/universal-imports" element={<AdminUniversalImports/>}/>
    <Route path="/admin/ladder-images" element={<AdminLadderImageImports/>}/>
    <Route path="/admin/match-images" element={<AdminMatchImageImports/>}/>
    <Route path="/admin/goal-kicker-images" element={<AdminGoalKickerImages/>}/>
    <Route path="/admin/profile-images" element={<AdminProfileImageImports/>}/>
    <Route path="/admin/highlights" element={<AdminHighlights/>}/>
    <Route path="/admin/claims" element={<ClubClaimsAdmin/>}/>
    <Route path="/championship" element={<Championship/>}/>
    <Route path="/club-packages" element={<Navigate to="/" replace/>}/>
    <Route path="*" element={<NotFound/>}/>
  </Routes></ErrorBoundary></BrowserRouter></StrictMode>,
)
