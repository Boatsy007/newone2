import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import './index.css'
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
import AdminWorkflow from './pages/AdminWorkflow.tsx'
import AdminMatchImageImports from './pages/AdminMatchImageImports.tsx'
import AdminGoalKickerImages from './pages/AdminGoalKickerImages.tsx'
import AdminProfileImageImports from './pages/AdminProfileImageImports.tsx'
import AdminUniversalImports from './pages/AdminUniversalImports.tsx'
import AdminHighlights from './pages/AdminHighlights.tsx'
import Highlights from './pages/Highlights.tsx'
import ClaimClub from './pages/ClaimClub.tsx'
import ClubPortal from './pages/ClubPortal.tsx'
import ClubClaimsAdmin from './pages/ClubClaimsAdmin.tsx'
import AutoShareButtons from './components/sharing/AutoShareButtons.tsx'
import ProfileShareButton from './components/sharing/ProfileShareButton.tsx'
import ImportHandoffInjector from './components/admin/ImportHandoffInjector.tsx'
import AdminWorkflowMobileFix from './components/admin/AdminWorkflowMobileFix.tsx'
import AdminClubProfileFallback from './components/admin/AdminClubProfileFallback.tsx'

type HomeGoalKicker = { id: string }
function ScrollToTop(){const{pathname}=useLocation();useEffect(()=>{window.scrollTo(0,0)},[pathname]);return null}
function HomePlayerProfileLinks(){const navigate=useNavigate();const{pathname}=useLocation();const[players,setPlayers]=useState<HomeGoalKicker[]>([]);useEffect(()=>{if(pathname!=='/')return;let active=true;void fetch('/api/goal-kickers?mode=raw&limit=5').then(r=>r.ok?r.json():Promise.reject(new Error(`HTTP ${r.status}`))).then((p:{data?:HomeGoalKicker[]})=>{if(active)setPlayers(Array.isArray(p.data)?p.data:[])}).catch(()=>{if(active)setPlayers([])});return()=>{active=false}},[pathname]);useEffect(()=>{if(pathname!=='/'||players.length===0)return;const handleClick=(event:MouseEvent)=>{const element=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('.pf-goal-row'):null;if(!element)return;const rows=Array.from(document.querySelectorAll<HTMLAnchorElement>('.pf-goal-row'));const player=players[rows.indexOf(element)];if(!player?.id)return;event.preventDefault();navigate(`/player/${encodeURIComponent(player.id)}`)};document.addEventListener('click',handleClick);return()=>document.removeEventListener('click',handleClick)},[navigate,pathname,players]);return null}

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><ScrollToTop/><ImportHandoffInjector/><AdminWorkflowMobileFix/><AdminClubProfileFallback/><HomePlayerProfileLinks/><AutoShareButtons/><ProfileShareButton/><Routes>
    <Route path="/" element={<App/>}/>
    <Route path="/power-rankings" element={<PowerRankings/>}/>
    <Route path="/rankings" element={<FullRankings/>}/>
    <Route path="/goal-kickers" element={<GoalKickers/>}/>
    <Route path="/player/:playerId" element={<PlayerProfile/>}/>
    <Route path="/matches" element={<MatchCentre/>}/>
    <Route path="/match/:kind/:matchId" element={<MatchDetail/>}/>
    <Route path="/feed" element={<SupporterFeed/>}/>
    <Route path="/notifications" element={<Notifications/>}/>
    <Route path="/highlights" element={<Highlights/>}/>
    <Route path="/team/:clubId" element={<TeamProfile/>}/>
    <Route path="/claim-club/:clubId" element={<ClaimClub/>}/>
    <Route path="/club-portal" element={<ClubPortal/>}/>
    <Route path="/league/:leagueId" element={<LeagueProfile/>}/>
    <Route path="/leagues" element={<Leagues/>}/>
    <Route path="/news" element={<News/>}/>
    <Route path="/news/:slug" element={<NewsArticle/>}/>
    <Route path="/directory" element={<Directory/>}/>
    <Route path="/about" element={<About/>}/>
    <Route path="/admin" element={<AdminWorkflow/>}/>
    <Route path="/admin/universal-imports" element={<AdminUniversalImports/>}/>
    <Route path="/admin/match-images" element={<AdminMatchImageImports/>}/>
    <Route path="/admin/goal-kicker-images" element={<AdminGoalKickerImages/>}/>
    <Route path="/admin/profile-images" element={<AdminProfileImageImports/>}/>
    <Route path="/admin/highlights" element={<AdminHighlights/>}/>
    <Route path="/admin/claims" element={<ClubClaimsAdmin/>}/>
    <Route path="/championship" element={<Championship/>}/>
    <Route path="/club-packages" element={<Navigate to="/" replace/>}/>
  </Routes></BrowserRouter></StrictMode>,
)
