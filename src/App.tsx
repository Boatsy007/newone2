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
  .pf-home{background:#fff;color:${TEXT};font-family:Barlow,Inter,Arial,sans-serif}.pf-shell{width:min(1440px,calc(100% - 48px));margin:0 auto}.pf-hero{overflow:hidden;border-bottom:1px solid ${LINE}}.pf-hero-inner{min-height:640px;display:grid;grid-template-columns:minmax(430px,.88fr) minmax(500px,1.12fr);align-items:center}.pf-hero-copy{padding:62px 0 58px;position:relative;z-index:2}.pf-kicker{text-transform:uppercase;font-size:12px;font-weight:800;letter-spacing:.2em;color:${BLUE}}.pf-hero h1,.pf-section-head h2,.pf-feature-content h2,.pf-band strong{font-family:'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase}.pf-hero h1{font-size:clamp(4.6rem,8vw,8.8rem);line-height:.79;letter-spacing:-.025em;margin:17px 0 20px;color:${BLACK}}.pf-hero h1 em,.pf-feature-content h2 em{font-style:normal;color:${BLUE}}.pf-hero-copy>p{font-size:19px;margin:0 0 24px;color:#4d5560}.pf-blue-button,.pf-feature-content>span,.pf-band-inner>a{display:inline-flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:800;letter-spacing:.025em;border-radius:7px;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}.pf-blue-button{background:${BLUE};color:${BLACK};padding:14px 20px;border:1px solid rgba(5,5,5,.08);box-shadow:0 8px 20px rgba(45,170,245,.2)}.pf-blue-button:hover,.pf-feature-content>span:hover,.pf-band-inner>a:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(5,5,5,.14)}.pf-hero-copy>small{display:flex;align-items:center;gap:9px;margin-top:22px;font-weight:800;text-transform:uppercase;font-size:11px;letter-spacing:.025em}.pf-hero-copy>small i{width:9px;height:9px;background:${BLUE};border-radius:50%}.pf-hero-art{position:relative;height:100%;min-height:640px}.pf-speed-lines{position:absolute;inset:8% -12% 3% 3%;background:radial-gradient(circle at 58% 42%,rgba(66,184,255,.52),transparent 24%),repeating-linear-gradient(160deg,transparent 0 31px,rgba(66,184,255,.075) 32px 35px);clip-path:polygon(10% 7%,100% 0,91% 87%,0 100%)}.pf-player-shape{position:absolute;right:9%;top:9%;width:53%;height:68%;filter:drop-shadow(0 18px 24px rgba(0,0,0,.16));opacity:.94}.pf-player-head{position:absolute;top:0;left:43%;width:82px;height:90px;border-radius:50%;background:linear-gradient(145deg,#202020,#090909)}.pf-player-body{position:absolute;left:15%;top:72px;width:75%;height:75%;background:linear-gradient(135deg,#202020 0 50%,#101010 51% 61%,#191919 62%);clip-path:polygon(34% 0,70% 4%,100% 28%,79% 52%,93% 100%,56% 90%,30% 100%,17% 58%,0 36%,20% 17%)}.pf-ball{position:absolute;left:7%;top:44%;width:126px;height:78px;border-radius:50%;transform:rotate(-18deg);background:${BLUE};border:2px solid rgba(5,5,5,.9);display:grid;place-items:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:25px;color:${BLACK};box-shadow:0 8px 18px rgba(0,0,0,.14)}.pf-number-one{position:absolute;left:0;right:2%;bottom:30px;display:grid;grid-template-columns:46px 68px minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px 17px;background:rgba(255,255,255,.97);border:1px solid #d9e0e7;border-radius:10px;box-shadow:0 12px 28px rgba(14,28,45,.12);color:${TEXT};text-decoration:none}.pf-number-badge{display:grid;place-items:center;width:42px;height:42px;border-radius:6px;background:${BLUE};font-family:'Bebas Neue',Impact,sans-serif;font-size:27px}.pf-number-copy strong,.pf-number-copy small{display:block}.pf-number-copy small{color:${MUTED};margin-top:3px}.pf-number-one>b{font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;color:${BLUE}}.pf-top{padding:46px 0}.pf-section-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:17px}.pf-section-head h2{margin:0;font-size:clamp(2.2rem,4vw,4rem);line-height:.88}.pf-section-head a{display:inline-flex;align-items:center;gap:8px;color:${BLUE};text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:800}.pf-club-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.pf-club-card{position:relative;display:flex;min-width:0;flex-direction:column;align-items:center;text-align:center;padding:24px 14px 19px;border:1px solid ${LINE};border-radius:9px;color:${TEXT};text-decoration:none;background:#fff;box-shadow:0 5px 16px rgba(17,24,39,.045);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.pf-club-card:hover{transform:translateY(-2px);border-color:#cfd7e1;box-shadow:0 12px 28px rgba(17,24,39,.09)}.pf-rank-chip{position:absolute;left:0;top:0;width:40px;height:40px;display:grid;place-items:center;border-radius:8px 0 8px 0;background:${BLUE};font-family:'Bebas Neue',Impact,sans-serif;font-size:23px}.pf-club-card strong{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:20px;line-height:.97;margin-top:13px}.pf-club-card small{color:${MUTED};font-size:11px;margin-top:7px}.pf-club-card em{font-style:normal;font-weight:800;margin-top:9px}.pf-club-card>b{font-family:'Bebas Neue',Impact,sans-serif;font-size:33px;color:${BLUE};margin-top:5px}.pf-club-card.loading{height:245px;background:#f4f5f6}.pf-feature-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding-bottom:36px}.pf-feature-panel{position:relative;min-height:315px;overflow:hidden;background:${BLACK};color:#fff;text-decoration:none;border:1px solid #191919;border-radius:9px;box-shadow:0 8px 24px rgba(0,0,0,.1)}.pf-news-panel{background:linear-gradient(135deg,#050505 0 58%,#191919)}.pf-fixtures-panel{background:linear-gradient(135deg,#050505 0 57%,#0c2737)}.pf-feature-panel:after{content:'';position:absolute;right:-12%;bottom:-48%;width:56%;aspect-ratio:1;border-radius:50%;background:${BLUE};opacity:.28}.pf-feature-content{position:relative;z-index:2;padding:29px;max-width:67%}.pf-feature-content h2{font-size:clamp(2.55rem,4.3vw,4.8rem);line-height:.84;margin:0 0 13px}.pf-feature-content p{color:#e8edf2;line-height:1.5}.pf-feature-content>span{margin-top:13px;background:${BLUE};color:${BLACK};padding:12px 15px;border:1px solid rgba(255,255,255,.38);box-shadow:0 7px 18px rgba(0,0,0,.14)}.pf-data-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding-bottom:48px}.pf-list-card{border:1px solid ${LINE};border-radius:9px;background:#fff;box-shadow:0 5px 16px rgba(17,24,39,.04);overflow:hidden}.pf-list-card>.pf-section-head{padding:20px 21px 14px;margin:0;border-bottom:1px solid #d9e0e7}.pf-list-card>.pf-section-head h2{font-size:clamp(2rem,3.4vw,3.35rem)}.pf-list-body{padding:0 21px}.pf-goal-row{display:grid;grid-template-columns:36px 48px minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid ${LINE};color:${TEXT};text-decoration:none}.pf-goal-row>b{font-family:'Bebas Neue',Impact,sans-serif;font-size:23px;color:${BLUE}}.pf-goal-row span strong,.pf-goal-row span small{display:block}.pf-goal-row span small{color:${MUTED};font-size:11px;margin-top:3px}.pf-goal-row>em{font-family:'Bebas Neue',Impact,sans-serif;font-style:normal;font-size:25px;color:${BLUE}}.pf-promo-row{display:block;padding:22px 0;border-bottom:1px solid ${LINE};color:${TEXT};text-decoration:none}.pf-promo-row span{display:block;color:${BLUE};text-transform:uppercase;font-size:10px;font-weight:800;letter-spacing:.14em;margin-bottom:7px}.pf-promo-row strong{font-size:18px;line-height:1.25}.pf-empty{color:${MUTED};padding:24px 0}.pf-band{background:${BLUE};border-top:1px solid rgba(5,5,5,.12);border-bottom:1px solid rgba(5,5,5,.12)}.pf-band-inner{min-height:112px;display:flex;align-items:center;justify-content:space-between;gap:24px}.pf-band-inner div{display:flex;flex-direction:column}.pf-band-inner strong{font-size:clamp(2rem,4vw,3.6rem);line-height:.9}.pf-band-inner span{font-size:13px;margin-top:6px}.pf-band-inner>a{background:${BLACK};color:#fff;padding:13px 18px;box-shadow:0 8px 20px rgba(0,0,0,.16)}
  @media(max-width:1050px){.pf-shell{width:min(100% - 32px,1440px)}.pf-hero-inner{grid-template-columns:1fr;min-height:0}.pf-hero-copy{padding:52px 0 24px}.pf-hero-art{min-height:520px}.pf-club-strip{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;scrollbar-width:none}.pf-club-strip::-webkit-scrollbar{display:none}.pf-club-card{flex:0 0 min(280px,78vw);scroll-snap-align:start}.pf-feature-grid,.pf-data-grid{grid-template-columns:1fr}.pf-feature-content{max-width:72%}}
  @media(max-width:620px){.pf-shell{width:min(100% - 24px,1440px)}.pf-hero-copy{padding:40px 0 18px}.pf-kicker{font-size:10px;letter-spacing:.18em}.pf-hero h1{font-size:clamp(4.2rem,20vw,6rem);line-height:.77;margin:14px 0 18px}.pf-hero-copy>p{font-size:17px}.pf-blue-button{width:auto;padding:13px 17px}.pf-hero-art{min-height:500px}.pf-player-shape{right:-3%;top:12%;width:67%}.pf-number-one{left:0;right:0;bottom:18px;grid-template-columns:40px 56px minmax(0,1fr) auto;padding:12px;gap:9px}.pf-number-badge{width:38px;height:38px}.pf-number-one>b{font-size:31px}.pf-top{padding:38px 0}.pf-section-head{align-items:flex-end}.pf-section-head h2{font-size:2.8rem}.pf-section-head a{font-size:11px}.pf-club-card{flex-basis:78vw}.pf-feature-panel{min-height:300px}.pf-feature-content{max-width:88%;padding:25px}.pf-feature-content h2{font-size:3.7rem}.pf-data-grid{padding-bottom:38px}.pf-list-card>.pf-section-head{padding:18px 16px 12px}.pf-list-body{padding:0 16px}.pf-band-inner{min-height:150px;align-items:flex-start;justify-content:center;flex-direction:column;padding:24px 0}.pf-band-inner>a{width:100%}}
`}</style> }
