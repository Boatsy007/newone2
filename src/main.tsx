import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import './index.css'
import './carousel.css'
import './goal-kickers-mobile.css'
import './player-profile-photo.css'
import App from './App.tsx'
import PowerRankings from './pages/PowerRankings.tsx'
import Directory from './pages/Directory.tsx'
import FullRankings from './pages/FullRankings.tsx'
import GoalKickers from './pages/GoalKickers.tsx'
import MvpLeaderboard from './pages/MvpLeaderboard.tsx'
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
import AdminMvpImages from './pages/AdminMvpImages.tsx'
import AdminProfileImageImports from './pages/AdminProfileImageImports.tsx'
import AdminUniversalImports from './pages/AdminUniversalImports.tsx'
import AdminLadderImageImports from './pages/AdminLadderImageImports.tsx'
import AdminHighlights from './pages/AdminHighlights.tsx'
import AdminFeaturedGames from './pages/AdminFeaturedGames.tsx'
import AdminTeamSheets from './pages/AdminTeamSheets.tsx'
import AdminPlayerSponsors from './pages/AdminPlayerSponsors.tsx'
import Highlights from './pages/Highlights.tsx'
import HighlightDetail from './pages/HighlightDetail.tsx'
import ClubPortal from './pages/ClubPortal.tsx'
import ClubPortalDashboard from './pages/ClubPortalDashboard.tsx'
import ClubPortalTeamSelection from './pages/ClubPortalTeamSelection.tsx'
import ClubClaimsAdmin from './pages/ClubClaimsAdmin.tsx'
import AutoShareButtons from './components/sharing/AutoShareButtons.tsx'
import ProfileShareButton from './components/sharing/ProfileShareButton.tsx'
import ImportHandoffInjector from './components/admin/ImportHandoffInjector.tsx'
import UniversalBatchImportEnhancer from './components/admin/UniversalBatchImportEnhancer.tsx'
import UniversalBulkImportActions from './components/admin/UniversalBulkImportActions.tsx'
import AdminWorkflowMobileFix from './components/admin/AdminWorkflowMobileFix.tsx'
import AdminClubProfileFallback from './components/admin/AdminClubProfileFallback.tsx'
import AdminMvpLink from './components/admin/AdminMvpLink.tsx'
import AdminLogoManager from './components/admin/AdminLogoManager.tsx'
import AdminSponsorManager from './components/admin/AdminSponsorManager.tsx'
import AdminPlayerSponsorLinks from './components/admin/AdminPlayerSponsorLinks.tsx'
import AdminOperationsMenu from './components/admin/AdminOperationsMenu.tsx'
import AdminManualNewsCreator from './components/admin/AdminManualNewsCreator.tsx'
import GoalKickerReviewEnhancer from './components/admin/GoalKickerReviewEnhancer.tsx'
import GoalKickerPublicIntegration from './components/goal-kickers/GoalKickerPublicIntegration.tsx'
import GoalKickerAchievementsPortal from './components/goal-kickers/GoalKickerAchievementsPortal.tsx'
import HighlightPublicIntegration from './components/highlights/HighlightPublicIntegration.tsx'
import RankingHealthPortal from './components/rankings/RankingHealthPortal.tsx'
import UnifiedSearchExtras from './components/rankings/UnifiedSearchExtras.tsx'
import HomeRecordsPortal from './components/home/HomeRecordsPortal.tsx'
import HomePlayerRecordsPortal from './components/home/HomePlayerRecordsPortal.tsx'
import HomeMvpPortal from './components/home/HomeMvpPortal.tsx'
import HomeFeaturedHighlights from './components/home/HomeFeaturedHighlights.tsx'
import HomeFeaturedGames from './components/home/HomeFeaturedGames.tsx'
import HomeHeroCarouselConnected from './components/home/HomeHeroCarouselConnected.tsx'
import HomeFeatureCopy from './components/home/HomeFeatureCopy.tsx'
import HomeDesktopPolish from './components/home/HomeDesktopPolish.tsx'
import HomeMobilePolish from './components/home/HomeMobilePolish.tsx'
import PublicClaimRemoval from './components/club/PublicClaimRemoval.tsx'
import TeamSelectionDeepLink from './components/club/TeamSelectionDeepLink.tsx'
import ConnectedClubLadderPortal from './components/club/ConnectedClubLadderPortal.tsx'
import ClubPortalDashboardLink from './components/club/ClubPortalDashboardLink.tsx'
import DirectoryPublicFix from './components/directory/DirectoryPublicFix.tsx'
import LeaguesPublicFinder from './components/leagues/LeaguesPublicFinder.tsx'
import NewsChannelFilter from './components/news/NewsChannelFilter.tsx'
import NewsEditorialLayout from './components/news/NewsEditorialLayout.tsx'
import SponsorProfilePortal from './components/sponsors/SponsorProfilePortal.tsx'
import HomeSponsorLabels from './components/sponsors/HomeSponsorLabels.tsx'
import PlayerMvpRank from './components/players/PlayerMvpRank.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'

type HomeGoalKicker = { id: string }
function ScrollToTop(){const{pathname}=useLocation();useEffect(()=>{window.scrollTo(0,0)},[pathname]);return null}
function HomePlayerProfileLinks(){const navigate=useNavigate();const{pathname}=useLocation();const[players,setPlayers]=useState<HomeGoalKicker[]>([]);useEffect(()=>{if(pathname!=='/')return;let active=true;void fetch('/api/goal-kickers?mode=raw&limit=5').then(r=>r.ok?r.json():Promise.reject(new Error(`HTTP ${r.status}`))).then((p:{data?:HomeGoalKicker[]})=>{if(active)setPlayers(Array.isArray(p.data)?p.data:[])}).catch(()=>{if(active)setPlayers([])});return()=>{active=false}},[pathname]);useEffect(()=>{if(pathname!=='/'||players.length===0)return;const handleClick=(event:MouseEvent)=>{const element=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('.pf-goal-row'):null;if(!element)return;const rows=Array.from(document.querySelectorAll<HTMLAnchorElement>('.pf-goal-row'));const player=players[rows.indexOf(element)];if(!player?.id)return;event.preventDefault();navigate(`/player/${encodeURIComponent(player.id)}`)};document.addEventListener('click',handleClick);return()=>document.removeEventListener('click',handleClick)},[navigate,pathname,players]);return null}

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><ScrollToTop/><PublicClaimRemoval/><TeamSelectionDeepLink/><ConnectedClubLadderPortal/><ClubPortalDashboardLink/><ImportHandoffInjector/><UniversalBatchImportEnhancer/><UniversalBulkImportActions/><AdminWorkflowMobileFix/><AdminClubProfileFallback/><AdminMvpLink/><AdminOperationsMenu/><AdminLogoManager/><AdminSponsorManager/><AdminPlayerSponsorLinks/><AdminManualNewsCreator/><GoalKickerReviewEnhancer/><GoalKickerPublicIntegration/><GoalKickerAchievementsPortal/><HighlightPublicIntegration/><RankingHealthPortal/><UnifiedSearchExtras/><HomePlayerProfileLinks/><HomeHeroCarouselConnected/><HomeRecordsPortal/><HomePlayerRecordsPortal/><HomeMvpPortal/><HomeFeaturedHighlights/><HomeFeaturedGames/><HomeFeatureCopy/><HomeDesktopPolish/><HomeSponsorLabels/><DirectoryPublicFix/><LeaguesPublicFinder/><NewsChannelFilter/><NewsEditorialLayout/><SponsorProfilePortal/><AutoShareButtons/><ProfileShareButton/><PlayerMvpRank/><HomeMobilePolish/><ErrorBoundary><Routes>
    <Route path="/" element={<App/>}/>
    <Route path="/power-rankings" element={<PowerRankings/>}/>
    <Route path="/rankings" element={<FullRankings/>}/>
    <Route path="/records" element={<Records/>}/>
    <Route path="/goal-kickers" element={<GoalKickers/>}/>
    <Route path="/mvp" element={<MvpLeaderboard/>}/>
    <Route path="/player/:playerId" element={<PlayerProfile/>}/>
    <Route path="/matches" element={<MatchCentre/>}/>
    <Route path="/match/:kind/:matchId" element={<MatchDetail/>}/>
    <Route path="/feed" element={<SupporterFeed/>}/>
    <Route path="/notifications" element={<Notifications/>}/>
    <Route path="/highlights" element={<Highlights/>}/>
    <Route path="/highlights/:highlightId" element={<HighlightDetail/>}/>
    <Route path="/team/:clubId" element={<TeamProfile/>}/>
    <Route path="/club-portal" element={<ClubPortal/>}/>
    <Route path="/club-portal/:clubId/team-selection" element={<ClubPortalTeamSelection/>}/>
    <Route path="/club-portal/:clubId" element={<ClubPortalDashboard/>}/>
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
    <Route path="/admin/mvp-images" element={<AdminMvpImages/>}/>
    <Route path="/admin/profile-images" element={<AdminProfileImageImports/>}/>
    <Route path="/admin/highlights" element={<AdminHighlights/>}/>
    <Route path="/admin/featured-games" element={<AdminFeaturedGames/>}/>
    <Route path="/admin/team-sheets" element={<AdminTeamSheets/>}/>
    <Route path="/admin/player-sponsors/:playerId" element={<AdminPlayerSponsors/>}/>
    <Route path="/admin/claims" element={<ClubClaimsAdmin/>}/>
    <Route path="/championship" element={<Championship/>}/>
    <Route path="/club-packages" element={<Navigate to="/" replace/>}/>
    <Route path="*" element={<NotFound/>}/>
  </Routes></ErrorBoundary></BrowserRouter></StrictMode>,
)
