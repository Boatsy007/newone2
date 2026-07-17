import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Nav from './components/layout/Nav'
import Footer from './components/layout/Footer'
import { useHomeData } from './components/home/useHomeData'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { teamPath, type RankingEntry } from './lib/rankings'
import { TeamLogo } from './components/rankings/bits'

const BLUE = '#42b8ff'
const BLACK = '#050505'
const TEXT = '#111318'
const MUTED = '#687385'
const LINE = '#e3e7ec'

type GoalKicker = {
  rank: number
  playerName: string
  goals: number
  clubName: string
  leagueName: string
  clubLogoUrl?: string | null
}

export default function App() {
  const home = useHomeData()
  const [goalKickers, setGoalKickers] = useState<GoalKicker[]>([])

  useEffect(() => {
    fetch('/api/goal-kickers?mode=raw&limit=5')
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: GoalKicker[] }) => setGoalKickers(Array.isArray(payload.data) ? payload.data : []))
      .catch(() => setGoalKickers([]))
  }, [])

  const top = home.entries.slice(0, 5)

  return <ErrorBoundary>
    <Nav />
    <main className="pf-home">
      <Hero top={top[0]} updatedAt={home.generatedAt} />
      <TopClubs entries={top} loading={home.loading} />

      <section className="pf-feature-grid pf-shell">
        <Link to="/news" className="pf-feature-panel pf-news-panel">
          <div className="pf-feature-content"><h2>Follow every<br /><em>big moment</em></h2><p>News, match reports and community football stories in one place.</p><span>View latest news <ArrowRight size={17} /></span></div>
        </Link>
        <Link to="/leagues" className="pf-feature-panel pf-fixtures-panel">
          <div className="pf-feature-content"><h2>Live scores &<br /><em>fixtures</em></h2><p>Find leagues, ladders, clubs and the latest available match information.</p><span>Explore leagues <ArrowRight size={17} /></span></div>
        </Link>
      </section>

      <section className="pf-data-grid pf-shell">
        <GoalLeaders rows={goalKickers} />
        <article className="pf-list-card pf-news-list">
          <div className="pf-section-head"><h2>Latest news</h2><Link to="/news">View all <ArrowRight size={17} /></Link></div>
          <div className="pf-list-body">
            <Link to="/news" className="pf-promo-row"><span>Match reports</span><strong>Stories from community football around Australia</strong></Link>
            <Link to="/rankings" className="pf-promo-row"><span>Rankings</span><strong>Follow every movement in the national top 20</strong></Link>
            <Link to="/leagues" className="pf-promo-row"><span>Leagues</span><strong>Explore ladders, clubs and competition pages</strong></Link>
          </div>
        </article>
      </section>

      <section className="pf-band"><div className="pf-shell pf-band-inner"><div><strong>Every game. Every player. Every club.</strong><span>Australia's home of community football.</span></div><Link to="/directory">Explore PlayFooty <ArrowRight size={18} /></Link></div></section>
    </main>
    <Footer />
    <HomeStyles />
  </ErrorBoundary>
}

function Hero({ top, updatedAt }: { top?: RankingEntry; updatedAt: string | null }) {
  return <section className="pf-hero"><div className="pf-shell pf-hero-inner">
    <div className="pf-hero-copy"><span className="pf-kicker">Community football, ranked</span><h1>Australia's<br /><em>strongest</em><br />community<br />clubs</h1><p>Real rankings. Real clubs. Real football.</p><Link to="/rankings" className="pf-blue-button">View national top 20 <ArrowRight size={18} /></Link><small><i /> Rankings updated {updatedAt ? formatShortDate(updatedAt) : 'live'}</small></div>
    <div className="pf-hero-art" aria-hidden="true"><div className="pf-speed-lines" /><div className="pf-player-shape"><span className="pf-player-head" /><span className="pf-player-body" /><span className="pf-ball">PF</span></div>{top && <Link to={teamPath(top.clubId)} className="pf-number-one"><span className="pf-number-badge">1</span><TeamLogo name={top.clubName} src={top.logoUrl ?? undefined} size={64} /><span className="pf-number-copy"><strong>{top.clubName}</strong><small>{top.leagueName} · {top.state}</small></span><b>{top.powerRating.toFixed(1)}</b></Link>}</div>
  </div></section>
}

function TopClubs({ entries, loading }: { entries: RankingEntry[]; loading: boolean }) {
  return <section className="pf-top pf-shell"><div className="pf-section-head"><h2>National top 20</h2><Link to="/rankings">View full table <ArrowRight size={17} /></Link></div><div className="pf-club-strip">
    {loading && Array.from({ length: 5 }).map((_, index) => <div key={index} className="pf-club-card loading" />)}
    {!loading && entries.map(entry => <Link key={entry.clubId} to={teamPath(entry.clubId)} className="pf-club-card"><span className="pf-rank-chip">{entry.rank}</span><TeamLogo name={entry.clubName} src={entry.logoUrl ?? undefined} size={76} /><strong>{entry.clubName}</strong><small>{entry.leagueName} · {entry.state}</small><em>{entry.record.wins}-{entry.record.losses}{entry.record.draws ? `-${entry.record.draws}` : ''}</em><b>{entry.powerRating.toFixed(1)}</b></Link>)}
  </div></section>
}

function GoalLeaders({ rows }: { rows: GoalKicker[] }) {
  return <article className="pf-list-card"><div className="pf-section-head"><h2>Goal kicking leaders</h2><Link to="/goal-kickers">View all <ArrowRight size={17} /></Link></div><div className="pf-list-body">
    {rows.length === 0 && <p className="pf-empty">Goal kicking data will appear here when available.</p>}
    {rows.map(row => <Link to="/goal-kickers" key={`${row.rank}-${row.playerName}`} className="pf-goal-row"><b>{row.rank}</b><span className="pf-plain-logo"><TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={42} /></span><span><strong>{row.playerName}</strong><small>{row.clubName} · {row.leagueName}</small></span><em>{row.goals}</em></Link>)}
  </div></article>
}

function formatShortDate(value: string) { return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) }

function HomeStyles() { return <style>{`
  .pf-home{background:#fff;color:${TEXT};font-family:Inter,Arial,sans-serif}.pf-shell{width:min(1440px,calc(100% - 48px));margin:0 auto}.pf-hero{overflow:hidden;border-bottom:1px solid ${LINE}}.pf-hero-inner{min-height:680px;display:grid;grid-template-columns:minmax(430px,.85fr) minmax(500px,1.15fr);align-items:center}.pf-hero-copy{padding:70px 0 64px;position:relative;z-index:2}.pf-kicker{text-transform:uppercase;font-size:12px;font-weight:900;letter-spacing:.18em;color:${BLUE}}.pf-hero h1,.pf-section-head h2,.pf-feature-content h2,.pf-band strong{font-family:Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase}.pf-hero h1{font-size:clamp(4.8rem,8.5vw,9.2rem);line-height:.77;letter-spacing:-.035em;margin:18px 0 22px;color:${BLACK}}.pf-hero h1 em,.pf-feature-content h2 em{font-style:normal;color:${BLUE}}.pf-hero-copy>p{font-size:20px;margin:0 0 26px;color:#474d56}.pf-blue-button{display:inline-flex;align-items:center;gap:12px;background:${BLUE};color:${BLACK};padding:16px 22px;text-decoration:none;text-transform:uppercase;font-size:13px;font-weight:900;border:2px solid ${BLACK};box-shadow:5px 5px 0 ${BLACK}}.pf-hero-copy>small{display:flex;align-items:center;gap:9px;margin-top:24px;font-weight:900;text-transform:uppercase;font-size:11px}.pf-hero-copy>small i{width:10px;height:10px;background:${BLUE};border-radius:50%}.pf-hero-art{position:relative;height:100%;min-height:680px}.pf-speed-lines{position:absolute;inset:9% -18% 2% 4%;background:radial-gradient(circle at 57% 42%,rgba(66,184,255,.72),transparent 23%),repeating-linear-gradient(160deg,transparent 0 26px,rgba(66,184,255,.11) 27px 31px);clip-path:polygon(10% 7%,100% 0,90% 86%,0 100%)}.pf-player-shape{position:absolute;right:8%;top:10%;width:55%;height:68%;filter:drop-shadow(0 24px 18px rgba(0,0,0,.18))}.pf-player-head{position:absolute;top:0;left:43%;width:86px;height:94px;border-radius:50%;background:#151515}.pf-player-body{position:absolute;left:15%;top:76px;width:75%;height:75%;background:linear-gradient(135deg,#171717 0 49%,${BLUE} 50% 62%,#171717 63%);clip-path:polygon(34% 0,70% 4%,100% 28%,79% 52%,93% 100%,56% 90%,30% 100%,17% 58%,0 36%,20% 17%)}.pf-ball{position:absolute;left:6%;top:43%;width:132px;height:83px;border-radius:50%;transform:rotate(-18deg);background:${BLUE};border:5px solid ${BLACK};display:grid;place-items:center;font-family:Impact,sans-serif;font-size:26px;color:${BLACK}}.pf-number-one{position:absolute;left:0;right:2%;bottom:34px;display:grid;grid-template-columns:50px 72px minmax(0,1fr) auto;align-items:center;gap:13px;padding:16px 20px;background:#fff;border:2px solid ${BLACK};box-shadow:8px 8px 0 ${BLUE};color:${TEXT};text-decoration:none}.pf-number-badge{display:grid;place-items:center;width:44px;height:44px;background:${BLUE};font-family:Impact,sans-serif;font-size:28px}.pf-number-copy strong,.pf-number-copy small{display:block}.pf-number-copy small{color:${MUTED};margin-top:3px}.pf-number-one>b{font-family:Impact,sans-serif;font-size:40px;color:${BLUE};-webkit-text-stroke:1px ${BLACK}}.pf-top{padding:50px 0}.pf-section-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.pf-section-head h2{margin:0;font-size:clamp(2.2rem,4vw,4.2rem);line-height:.85}.pf-section-head a{display:inline-flex;align-items:center;gap:8px;color:${BLUE};text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:900}.pf-club-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.pf-club-card{position:relative;display:flex;min-width:0;flex-direction:column;align-items:center;text-align:center;padding:24px 14px 20px;border:1px solid ${LINE};color:${TEXT};text-decoration:none;background:#fff}.pf-rank-chip{position:absolute;left:0;top:0;width:42px;height:42px;display:grid;place-items:center;background:${BLUE};font-family:Impact,sans-serif;font-size:24px}.pf-club-card strong{font-family:Impact,sans-serif;text-transform:uppercase;font-size:20px;line-height:.95;margin-top:13px}.pf-club-card small{color:${MUTED};font-size:11px;margin-top:7px}.pf-club-card em{font-style:normal;font-weight:900;margin-top:9px}.pf-club-card>b{font-family:Impact,sans-serif;font-size:34px;color:${BLUE};margin-top:6px}.pf-club-card.loading{height:245px;background:#f4f5f6}.pf-feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding-bottom:38px}.pf-feature-panel{position:relative;min-height:330px;overflow:hidden;background:${BLACK};color:#fff;text-decoration:none;border:2px solid ${BLACK}}.pf-news-panel{background:linear-gradient(135deg,#050505 0 55%,#1a1a1a)}.pf-fixtures-panel{background:linear-gradient(135deg,#050505 0 55%,#0e3952)}.pf-feature-panel:after{content:'';position:absolute;right:-10%;bottom:-45%;width:58%;aspect-ratio:1;border-radius:50%;background:${BLUE};opacity:.35}.pf-feature-content{position:relative;z-index:2;padding:30px;max-width:65%}.pf-feature-content h2{font-size:clamp(2.6rem,4.5vw,5rem);line-height:.82;margin:0 0 13px}.pf-feature-content p{color:#e9edf2;line-height:1.5}.pf-feature-content>span{display:inline-flex;align-items:center;gap:9px;margin-top:14px;background:${BLUE};color:${BLACK};padding:13px 16px;text-transform:uppercase;font-weight:900;font-size:11px;border:2px solid #fff}.pf-data-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding-bottom:50px}.pf-list-card{border:1px solid ${LINE};background:#fff}.pf-list-card>.pf-section-head{padding:22px 22px 15px;margin:0;border-bottom:2px solid ${BLACK}}.pf-list-card>.pf-section-head h2{font-size:clamp(2rem,3.5vw,3.5rem)}.pf-list-body{padding:0 22px}.pf-goal-row{display:grid;grid-template-columns:38px 50px minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid ${LINE};color:${TEXT};text-decoration:none}.pf-goal-row>b{font-family:Impact,sans-serif;font-size:24px;color:${BLUE}}.pf-goal-row span strong,.pf-goal-row span small{display:block}.pf-goal-row span small{color:${MUTED};font-size:11px;margin-top:3px}.pf-goal-row>em{font-family:Impact,sans-serif;font-style:normal;font-size:26px;color:${BLUE}}.pf-promo-row{display:block;padding:24px 0;border-bottom:1px solid ${LINE};color:${TEXT};text-decoration:none}.pf-promo-row span{display:block;color:${BLUE};text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.14em;margin-bottom:7px}.pf-promo-row strong{font-size:19px;line-height:1.2}.pf-empty{color:${MUTED};padding:24px 0}.pf-band{background:${BLUE};border-top:3px solid ${BLACK};border-bottom:3px solid ${BLACK}}.pf-band-inner{min-height:150px;display:flex;align-items:center;justify-content:space-between;gap:24px}.pf-band strong,.pf-band span{display:block}.pf-band strong{font-size:clamp(2rem,4.2vw,4.2rem);line-height:.9}.pf-band span{font-weight:850;margin-top:6px}.pf-band a{display:inline-flex;align-items:center;gap:10px;background:${BLACK};color:#fff;text-decoration:none;text-transform:uppercase;font-weight:900;padding:16px 20px;border:2px solid #fff}@media(max-width:980px){.pf-hero-inner{grid-template-columns:1fr}.pf-hero-copy{padding:54px 0 0}.pf-hero-art{min-height:530px}.pf-club-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.pf-feature-grid,.pf-data-grid{grid-template-columns:1fr}}@media(max-width:620px){.pf-shell{width:min(100% - 28px,1440px)}.pf-hero-copy{padding-top:36px}.pf-hero h1{font-size:clamp(3.6rem,18vw,5.3rem)}.pf-hero-art{min-height:450px}.pf-player-shape{right:-8%;width:75%;height:60%;top:7%}.pf-number-one{right:0;bottom:18px;grid-template-columns:40px 52px minmax(0,1fr) auto;padding:12px 11px;gap:8px;box-shadow:5px 5px 0 ${BLUE}}.pf-number-badge{width:36px;height:36px;font-size:23px}.pf-number-copy strong{font-size:14px}.pf-number-copy small{font-size:10px}.pf-number-one>b{font-size:28px}.pf-top{padding:36px 0}.pf-club-strip{display:flex;overflow-x:auto}.pf-club-card{min-width:76%}.pf-feature-panel{min-height:315px}.pf-feature-content{max-width:84%;padding:24px}.pf-feature-content h2{font-size:3rem}.pf-list-card>.pf-section-head{padding:18px 16px 13px}.pf-list-body{padding:0 16px}.pf-goal-row{grid-template-columns:30px 44px minmax(0,1fr) auto;gap:8px}.pf-band-inner{padding:27px 0;align-items:flex-start;flex-direction:column}.pf-band a{width:100%;justify-content:center}}
`}</style> }
