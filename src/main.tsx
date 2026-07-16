import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import './index.css'
import './homepage-fixes.css'
import App from './App.tsx'
import PowerRankings from './pages/PowerRankings.tsx'
import Directory from './pages/Directory.tsx'
import FullRankings from './pages/FullRankings.tsx'
import GoalKickers from './pages/GoalKickers.tsx'
import TeamProfile from './pages/TeamProfile.tsx'
import LeagueProfile from './pages/LeagueProfile.tsx'
import Leagues from './pages/Leagues.tsx'
import News from './pages/News.tsx'
import NewsArticle from './pages/NewsArticle.tsx'
import Championship from './pages/Championship.tsx'
import About from './pages/About.tsx'
import Admin from './pages/Admin.tsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/power-rankings" element={<PowerRankings />} />
        <Route path="/rankings" element={<FullRankings />} />
        <Route path="/goal-kickers" element={<GoalKickers />} />
        <Route path="/team/:clubId" element={<TeamProfile />} />
        <Route path="/league/:leagueId" element={<LeagueProfile />} />
        <Route path="/leagues" element={<Leagues />} />
        <Route path="/news" element={<News />} />
        <Route path="/news/:slug" element={<NewsArticle />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/about" element={<About />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/championship" element={<Championship />} />
        <Route path="/club-packages" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
