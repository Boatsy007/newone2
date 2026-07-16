import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Radio, Trophy } from 'lucide-react'
import Nav from './components/layout/Nav'
import Footer from './components/layout/Footer'
import { useHomeData, type LeagueRow } from './components/home/useHomeData'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { leaguePath, teamPath, strengthStars, type RankingEntry } from './lib/rankings'
import { TeamLogo, FormPips, StarStrength } from './components/rankings/bits'
import { loadPublished, featuredArticles, latestArticles, categoryOf, formatDate, newsPath, type Article } from './news/content'
import { EditorialImage } from './news/components'

const HomeSearch = lazy(() => import('./components/home/HomeSearch'))

const NAVY = '#062a5f'
const NAVY_2 = '#0b3f86'
const PINK = '#d71920'
const LINE = '#dbe3ee'
const TEXT = '#111827'
const MUTED = '#65758b'
const GREEN = '#16a34a'
const RED = '#dc2626'

const Blank = ({ h = 300 }: { h?: number }) => <div style={{ minHeight: `${h}px` }} aria-hidden />

/** Homepage-only sports front page using existing rankings, leagues and news data. */
export default function App() {
  const home = useHomeData()
  const goalKickers = useGoalKickerLeaders()
  const [newsTick, setNewsTick] = useState(0)
  const [activeMobileTab, setActiveMobileTab] = useState<MobileHomeTab>('news')

  useEffect(() => { loadPublished().then(() => setNewsTick(x => x + 1)) }, [])

  const feature = featuredArticles()[0] ?? latestArticles(1)[0]
  const secondary = latestArticles(6).filter(a => a.slug !== feature?.slug).slice(0, 5)
  const leagueRail = rankedLeagues(home.leagues)
  void newsTick

  return (
    <ErrorBoundary>
      <Nav />
      <main id="main-content" data-mobile-home-tab={activeMobileTab} style={{ background: '#fff', color: TEXT }}>
        <MobileHomeTabs active={activeMobileTab} onChange={setActiveMobileTab} />
        <LeagueRail leagues={leagueRail} loading={home.loading} />

        <section className="front-page" aria-label="Country football live homepage">
          <div className="front-grid">
            <aside className="rankings-column mobile-rankings-panel" aria-label="National rankings">
              <NationalRankings entries={home.entries} loading={home.loading} weekLabel={home.weekLabel} generatedAt={home.generatedAt} />
            </aside>

            <section className="editorial-column mobile-news-panel" aria-label="Featured community football stories">
              {feature ? <FeaturedStory article={feature} /> : <EmptyCard title="News loading" text="Latest community football stories will appear here." />}
              <SecondaryStories articles={secondary} />
            </section>

            <aside className="broadcast-sidebar mobile-goals-panel" aria-label="Live homepage desk">
              <GoalKickersCard rows={goalKickers.rows} loading={goalKickers.loading} />
              <ChampionshipCard />
              <RankingsUpdateCard generatedAt={home.generatedAt} weekLabel={home.weekLabel} total={home.entries.length} />
              <PrototypeCard />
              <LatestNewsCompact articles={secondary.slice(0, 3)} />
              <MoversCard risers={home.risers} fallers={home.fallers} loading={home.loading} />
              <StrongestLeagueCard league={home.strongestLeague} />
            </aside>
          </div>
        </section>

        <section className="mobile-extras" aria-label="Homepage mobile extras">
          <MobileStrongestLeagues leagues={leagueRail.slice(0, 6)} loading={home.loading} />
          <Suspense fallback={<Blank h={260} />}><HomeSearch entries={home.entries} leagues={home.leagues} /></Suspense>
        </section>
      </main>
      <Footer />
      <HomepageStyles />
    </ErrorBoundary>
  )
}

type MobileHomeTab = 'news' | 'rankings' | 'goals'

function MobileHomeTabs({ active, onChange }: { active: MobileHomeTab; onChange: (tab: MobileHomeTab) => void }) {
  const tabs: Array<{ id: MobileHomeTab; label: string }> = [
    { id: 'news', label: 'News' },
    { id: 'rankings', label: 'Rankings' },
    { id: 'goals', label: 'Goals' },
  ]
  return <nav className="mobile-home-tabs" aria-label="Homepage sections">{tabs.map(tab => <button key={tab.id} type="button" className={active === tab.id ? 'active' : ''} aria-pressed={active === tab.id} onClick={() => onChange(tab.id)}>{tab.label}</button>)}</nav>
}

function rankedLeagues(leagues: LeagueRow[]) {
  return [...leagues].sort((a, b) => b.strengthScore - a.strengthScore).map((league, index) => ({ ...league, nationalRank: index + 1 }))
}


type GoalKickerLeader = {
  rank: number
  playerName: string
  goals: number
  clubName: string
  leagueName: string
}

function useGoalKickerLeaders() {
  const [rows, setRows] = useState<GoalKickerLeader[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch('/api/goal-kickers?mode=raw&limit=10')
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then((json: { data?: GoalKickerLeader[] }) => { if (alive) setRows(Array.isArray(json.data) ? json.data : []) })
      .catch(() => { if (alive) setRows([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  return { rows, loading }
}

type RankedLeague = LeagueRow & { nationalRank: number }

function LeagueRail({ leagues, loading }: { leagues: RankedLeague[]; loading: boolean }) {
  if (!loading && leagues.length === 0) return null
  return (
    <nav className="league-rail" aria-label="Active league rail">
      <div className="rail-live"><Radio size={14} /><span>Live leagues</span></div>
      <div className="rail-scroll">
        {loading && Array.from({ length: 10 }).map((_, i) => <span className="rail-skel" key={i} />)}
        {!loading && (
          <div className="rail-track">
            {[...leagues.slice(0, 24), ...leagues.slice(0, 24)].map((l, i) => (
              <Link key={`${l.id}-${i}`} to={leaguePath(l.id)} className="league-tile" aria-hidden={i >= leagues.slice(0, 24).length} tabIndex={i >= leagues.slice(0, 24).length ? -1 : undefined}>
                <LeagueMark league={l} />
                <span className="tile-main"><strong>{l.name}</strong><small>{l.state} · Updated {updatedLabel(l.lastSyncedAt)}</small></span>
                <span className="tile-rank">#{l.nationalRank}</span>
                <Movement value={0} compact />
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

function NationalRankings({ entries, loading, weekLabel, generatedAt }: { entries: RankingEntry[]; loading: boolean; weekLabel: string | null; generatedAt: string | null }) {
  const top = entries.slice(0, 20)
  return <article className="ranking-board">
    <header className="board-head">
      <div><span className="live-pill"><span /> Rankings live</span><h1>National Top 20</h1><p>{weekLabel ?? 'Season rankings'}{generatedAt ? ` · updated ${shortDate(generatedAt)}` : ''}</p></div>
      <Trophy size={30} />
    </header>
    <div className="board-labels"><span>Club</span><span>Form</span><span>Rating</span></div>
    {loading && Array.from({ length: 12 }).map((_, i) => <div className="rank-row rank-loading" key={i} />)}
    {!loading && top.map(e => <Link key={e.clubId} to={teamPath(e.clubId)} className="rank-row">
      <span className="rank-no">{e.rank}</span>
      <TeamLogo name={e.clubName} src={e.logoUrl ?? undefined} size={e.rank <= 3 ? 42 : 34} />
      <span className="club-copy"><strong>{e.clubName}</strong><small>{e.leagueName} · {e.state} · {recordLabel(e)}</small></span>
      <Movement value={e.rankMovement} />
      <span className="form"><FormPips form={e.recentForm} /></span>
      <span className="rating">{e.powerRating.toFixed(1)}</span>
    </Link>)}
    {!loading && top.length === 0 && <p className="empty-copy">Rankings publish with the first round of the season.</p>}
    <Link to="/rankings" className="board-cta">Open full national rankings <ArrowRight size={15} /></Link>
  </article>
}

function FeaturedStory({ article }: { article: Article }) {
  const cat = categoryOf(article.category)
  return <Link to={newsPath(article.slug)} className="feature-story">
    <EditorialImage seed={article.heroSeed} ratio="16 / 9" rounded={0} label={cat.label} />
    <div className="feature-copy">
      <span className="tag" style={{ background: cat.accent === '#111111' ? PINK : cat.accent }}>{cat.label}</span>
      <h2>{article.title}</h2>
      <p>{article.summary}</p>
      <span className="feature-bottom"><Meta article={article} /><b>Read feature <ArrowRight size={15} /></b></span>
    </div>
  </Link>
}

function SecondaryStories({ articles }: { articles: Article[] }) {
  if (!articles.length) return null
  return <div className="secondary-grid">{articles.slice(0, 5).map(a => <Link key={a.slug} to={newsPath(a.slug)} className="secondary-story"><EditorialImage seed={a.heroSeed} ratio="4 / 3" rounded={12} /><span><b>{a.title}</b><Meta article={a} /></span></Link>)}</div>
}

function ChampionshipCard() { return <Link to="/championship" className="side-card championship-card"><CalendarDays /><span>Future PlayFooty Championship</span><strong>Coming soon, not live</strong><small>No dates, teams, fixtures or registrations are open.</small></Link> }
function PrototypeCard() { return <article className="side-card prototype-card"><span>Prototype ready</span><strong>Built for official data where available</strong><small>Supports manually managed leagues, ladders and results while integrations are pending.</small></article> }
function RankingsUpdateCard({ generatedAt, weekLabel, total }: { generatedAt: string | null; weekLabel: string | null; total: number }) { return <Link to="/rankings" className="side-card update-card"><span className="live-pill"><span /> Latest rankings update</span><strong>{weekLabel ?? 'Season live'}</strong><small>{total} ranked clubs{generatedAt ? ` · updated ${shortDate(generatedAt)}` : ''}</small></Link> }

function GoalKickersCard({ rows, loading }: { rows: GoalKickerLeader[]; loading: boolean }) {
  return <article className="side-card goal-kickers-card">
    <header className="goal-kickers-head">
      <div>
        <span className="live-pill"><span /> Goal kicking leaders</span>
        <h2>Top Goal Kickers</h2>
        <p>Country leaders by raw goals</p>
      </div>
      <Trophy size={28} />
    </header>
    <div className="goal-kickers-labels"><span>Player</span><span>Goals</span></div>
    {loading && <p className="empty-copy goal-kickers-empty">Loading goal kickers…</p>}
    {!loading && rows.length === 0 && <p className="empty-copy goal-kickers-empty">No goal kickers imported yet.</p>}
    {!loading && rows.map(row => <Link className="goal-kicker-line" key={`${row.rank}-${row.playerName}-${row.clubName}-${row.leagueName}`} to="/goal-kickers">
      <b>#{row.rank}</b>
      <span><strong>{row.playerName}</strong><small>{row.clubName} · {row.leagueName}</small></span>
      <em>{row.goals}</em>
    </Link>)}
    <Link to="/goal-kickers" className="board-cta goal-kickers-cta">Open goal kicking ladder <ArrowRight size={15} /></Link>
  </article>
}

function LatestNewsCompact({ articles }: { articles: Article[] }) { if (!articles.length) return null; return <article className="side-card"><CardTitle title="Latest News" to="/news" />{articles.map(a => <Link className="compact-news" key={a.slug} to={newsPath(a.slug)}><b>{a.title}</b><Meta article={a} /></Link>)}</article> }
function StrongestLeagueCard({ league }: { league: LeagueRow | null }) { if (!league) return null; return <Link to={leaguePath(league.id)} className="side-card strongest-card"><span>Strongest League</span><strong>{league.name}</strong><small>{league.state} · {league.clubCount} clubs</small><StarStrength stars={strengthStars(league.strengthScore)} size={12} /></Link> }

function MoversCard({ risers, fallers, loading }: { risers: RankingEntry[]; fallers: RankingEntry[]; loading: boolean }) {
  const movers = [...risers.slice(0, 3), ...fallers.slice(0, 2)]
  if (!loading && movers.length === 0) return null
  return <article className="side-card"><CardTitle title="Biggest Movers" to="/rankings" />{loading ? <p className="empty-copy">Loading movement…</p> : movers.map(e => <Link className="mover-line" key={e.clubId} to={teamPath(e.clubId)}><TeamLogo name={e.clubName} src={e.logoUrl ?? undefined} size={28} /><span>{e.clubName}</span><Movement value={e.rankMovement} compact /></Link>)}</article>
}

function MobileStrongestLeagues({ leagues, loading }: { leagues: RankedLeague[]; loading: boolean }) { if (!loading && !leagues.length) return null; return <section className="mobile-leagues"><h2>Strongest leagues</h2>{loading ? <p>Loading…</p> : leagues.map(l => <Link key={l.id} to={leaguePath(l.id)} className="mobile-league-row"><LeagueMark league={l} /><span><b>#{l.nationalRank} {l.name}</b><small>{l.state} · {l.clubCount} clubs</small></span><StarStrength stars={strengthStars(l.strengthScore)} size={10} /></Link>)}</section> }

function CardTitle({ title, to }: { title: string; to: string }) { return <header className="card-title"><h2>{title}</h2><Link to={to}>All</Link></header> }
function Meta({ article }: { article: Article }) { return <small className="meta">{formatDate(article.date)} · {article.readingTime} min read</small> }
function Movement({ value, compact = false }: { value: number; compact?: boolean }) { const up = value > 0; const down = value < 0; return <span className={`movement ${up ? 'up' : down ? 'down' : 'flat'} ${compact ? 'compact' : ''}`}>{up ? '▲' : down ? '▼' : '—'}{value !== 0 ? Math.abs(value) : compact ? '' : ' steady'}</span> }
function LeagueMark({ league }: { league: LeagueRow }) { return <span className="league-mark" aria-hidden>{league.state || league.name.slice(0, 2)}</span> }
function EmptyCard({ title, text }: { title: string; text: string }) { return <article className="side-card"><h2>{title}</h2><p>{text}</p></article> }
function recordLabel(e: RankingEntry) { return `${e.record.wins}-${e.record.losses}${e.record.draws ? `-${e.record.draws}` : ''}` }
function shortDate(iso: string) { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) }
function updatedLabel(iso?: string | null) { if (!iso) return 'live'; const days = Math.floor((Date.now() - +new Date(iso)) / 86400000); if (days <= 0) return 'today'; if (days === 1) return 'yesterday'; if (days < 7) return `${days}d ago`; return `${Math.floor(days / 7)}w ago` }

function HomepageStyles() { return <style>{`
  .mobile-home-tabs{display:none}
  .league-rail{display:flex;align-items:stretch;border-bottom:1px solid ${LINE};background:#fff;box-shadow:0 8px 24px rgba(6,42,95,.08);position:relative;z-index:10;overflow:hidden}.rail-live{display:flex;align-items:center;gap:8px;background:${NAVY};color:#fff;padding:0 18px;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.15em;white-space:nowrap;animation:gnLiveFade 1.8s ease-in-out infinite}.rail-scroll{display:flex;overflow:hidden;flex:1}.rail-track{display:flex;width:max-content;animation:gnLeagueRail 80s linear infinite}.rail-track:hover{animation-play-state:paused}.league-tile{display:grid;grid-template-columns:34px minmax(145px,1fr) auto auto;align-items:center;gap:9px;min-width:268px;padding:11px 14px;border-right:1px solid ${LINE};text-decoration:none;color:${TEXT};background:#fff}.league-tile:hover{background:#f4f8fd}.league-mark{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,${NAVY},${NAVY_2});color:#fff;font-size:10px;font-weight:950}.tile-main{min-width:0}.tile-main strong{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tile-main small{display:block;color:${MUTED};font-size:11px;font-weight:800}.tile-rank{font-weight:950;color:${NAVY};font-size:18px}.rail-skel{min-width:268px;border-right:1px solid ${LINE};background:linear-gradient(90deg,#f2f5f9,#fff,#f2f5f9)}@keyframes gnLeagueRail{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes gnLiveFade{0%,100%{opacity:1}50%{opacity:.42}}@media (prefers-reduced-motion:reduce){.rail-track,.rail-live{animation:none}}
  .front-page{max-width:1560px;margin:0 auto;padding:22px 18px 36px}.front-grid{display:grid;grid-template-columns:minmax(330px,25%) minmax(0,50%) minmax(300px,25%);gap:18px;align-items:start}.rankings-column{min-width:0}.ranking-board,.side-card,.feature-story,.secondary-story,.mobile-leagues{border:1px solid ${LINE};border-radius:16px;background:#fff;box-shadow:0 14px 34px rgba(6,42,95,.09);overflow:hidden}.board-head{display:flex;justify-content:space-between;gap:18px;background:linear-gradient(135deg,${NAVY},#071832);color:#fff;padding:20px}.board-head h1{font-size:clamp(2rem,3.2vw,3rem);line-height:.88;margin:10px 0 8px;text-transform:uppercase;letter-spacing:-.06em}.board-head p{margin:0;color:#bfd0e5;font-weight:800}.live-pill{display:inline-flex;align-items:center;gap:7px;border-radius:999px;background:rgba(215,25,32,.12);color:${PINK};padding:6px 9px;font-size:10px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.live-pill span{width:7px;height:7px;border-radius:50%;background:${PINK};box-shadow:0 0 0 5px rgba(215,25,32,.14)}.board-labels{display:grid;grid-template-columns:minmax(0,1fr) 72px 58px;gap:8px;padding:9px 14px;background:#f7f9fc;border-bottom:1px solid ${LINE};color:${MUTED};font-size:10px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.rank-row{display:grid;grid-template-columns:30px 42px minmax(0,1fr) 62px 72px 58px;gap:8px;align-items:center;padding:11px 14px;border-bottom:1px solid #edf1f6;text-decoration:none;color:${TEXT};transition:background .18s,transform .18s}.rank-row:hover{background:#f7fbff;transform:translateX(2px)}.rank-no{font-size:23px;font-weight:950;color:${NAVY};letter-spacing:-.07em}.club-copy{min-width:0}.club-copy strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.club-copy small{display:block;color:${MUTED};font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.movement{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:5px 7px;font-size:10px;font-weight:950;white-space:nowrap}.movement.up{background:#e8f8ee;color:${GREEN}}.movement.down{background:#fdecec;color:${RED}}.movement.flat{background:#eef2f7;color:${MUTED}}.movement.compact{min-width:30px;padding:4px 6px}.form{overflow:hidden}.rating{font-size:18px;font-weight:950;color:${PINK};text-align:right}.rank-loading{height:58px;background:linear-gradient(90deg,#f4f7fb,#fff,#f4f7fb)}.board-cta{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;color:#fff;background:${PINK};font-weight:950;text-decoration:none;text-transform:uppercase;letter-spacing:.08em;font-size:12px}
  .editorial-column{min-width:0}.feature-story{display:block;text-decoration:none;color:${TEXT};box-shadow:0 18px 46px rgba(6,42,95,.14)}.feature-copy{padding:26px 28px 30px}.tag{display:inline-block;color:#fff;border-radius:999px;padding:6px 11px;font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.12em}.feature-copy h2{font-size:clamp(2.6rem,5.7vw,6.4rem);line-height:.84;margin:18px 0 14px;text-transform:uppercase;letter-spacing:-.07em;color:${NAVY}}.feature-copy p{font-size:18px;line-height:1.58;color:#46576d;max-width:68ch;margin:0 0 18px}.feature-bottom{display:flex;justify-content:space-between;align-items:center;gap:16px}.feature-bottom b{display:inline-flex;align-items:center;gap:7px;color:${PINK};text-transform:uppercase;font-size:12px;letter-spacing:.12em}.meta{display:block;color:${MUTED};font-size:12px;font-weight:800}.secondary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}.secondary-story{display:grid;grid-template-columns:116px minmax(0,1fr);gap:12px;align-items:center;padding:10px;text-decoration:none;color:${TEXT};box-shadow:none}.secondary-story:first-child{grid-column:1/-1;grid-template-columns:180px minmax(0,1fr)}.secondary-story b{display:block;font-size:17px;line-height:1.15;margin-bottom:8px}.broadcast-sidebar{position:sticky;top:16px;display:flex;flex-direction:column;gap:14px}.side-card{display:block;padding:16px;text-decoration:none;color:${TEXT}}.championship-card{background:linear-gradient(135deg,#071832,${NAVY});color:#fff}.championship-card span,.strongest-card span,.sponsor-slot span,.prototype-card span{display:block;color:${PINK};font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.15em;margin:10px 0 8px}.championship-card strong,.update-card strong,.strongest-card strong,.sponsor-slot strong,.prototype-card strong{display:block;font-size:22px;line-height:1.02;color:inherit}.championship-card small,.update-card small,.strongest-card small,.sponsor-slot small,.prototype-card small{display:block;color:${MUTED};font-weight:800;margin-top:8px}.championship-card small{color:#bfd0e5}.card-title{display:flex;justify-content:space-between;align-items:center;margin:-16px -16px 10px;padding:13px 16px;border-bottom:1px solid ${LINE};background:#f8fafc}.card-title h2{font-size:18px;text-transform:uppercase;color:${NAVY};margin:0}.card-title a{color:${PINK};font-weight:950;text-decoration:none;font-size:12px}.compact-news,.mover-line{display:block;text-decoration:none;color:${TEXT};border-bottom:1px solid #edf1f6;padding:11px 0}.compact-news b{font-size:14px;line-height:1.22}.mover-line{display:flex;align-items:center;gap:9px}.mover-line span{min-width:0;flex:1;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.goal-kickers-card{padding:0}.goal-kickers-head{display:flex;justify-content:space-between;gap:16px;background:linear-gradient(135deg,${NAVY},#071832);color:#fff;padding:18px 16px}.goal-kickers-head h2{font-size:clamp(1.8rem,2.7vw,2.65rem);line-height:.88;margin:10px 0 8px;text-transform:uppercase;letter-spacing:-.06em}.goal-kickers-head p{margin:0;color:#bfd0e5;font-weight:800;font-size:12px}.goal-kickers-labels{display:grid;grid-template-columns:minmax(0,1fr) 54px;gap:8px;padding:9px 14px;background:#f7f9fc;border-bottom:1px solid ${LINE};color:${MUTED};font-size:10px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.goal-kickers-labels span:last-child{text-align:right}.goal-kicker-line{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;text-decoration:none;color:${TEXT};border-bottom:1px solid #edf1f6;padding:11px 14px;transition:background .18s,transform .18s}.goal-kicker-line:hover{background:#f7fbff;transform:translateX(2px)}.goal-kicker-line>b{color:${NAVY};font-size:23px;font-weight:950;letter-spacing:-.07em}.goal-kicker-line span{min-width:0}.goal-kicker-line strong,.goal-kicker-line small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.goal-kicker-line strong{font-size:14px}.goal-kicker-line small{color:${MUTED};font-size:11px;font-weight:800}.goal-kicker-line em{font-style:normal;color:${PINK};font-weight:950;font-size:18px}.goal-kickers-empty{padding:16px 14px;margin:0}.goal-kickers-cta{margin-top:0}.sponsor-slot{border-style:dashed;background:#fbfdff}.mobile-extras{display:none;max-width:1560px;margin:0 auto;padding:0 12px 34px}.mobile-leagues h2{margin:0;padding:15px 16px;background:${NAVY};color:#fff;text-transform:uppercase}.mobile-league-row{display:flex;align-items:center;gap:11px;padding:12px 16px;border-bottom:1px solid #edf1f6;color:${TEXT};text-decoration:none}.mobile-league-row span{min-width:0;flex:1}.mobile-league-row b,.mobile-league-row small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mobile-league-row small{color:${MUTED}}
  @media (max-width:1220px){.front-grid{grid-template-columns:minmax(300px,34%) minmax(0,66%)}.broadcast-sidebar{grid-column:1/-1;position:static;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.secondary-grid{grid-template-columns:1fr 1fr}}
  @media (max-width:820px){.mobile-home-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid ${LINE};background:#fff}.mobile-home-tabs button{min-width:0;border:0;border-right:1px solid ${LINE};background:#fff;color:${NAVY};font:inherit;font-size:12px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;padding:13px 8px}.mobile-home-tabs button:last-child{border-right:0}.mobile-home-tabs button.active{background:${NAVY};color:#fff}.league-rail{display:none}.front-page{padding:14px 12px 22px}.front-grid{display:block}.rankings-column,.editorial-column,.broadcast-sidebar{width:100%}#main-content[data-mobile-home-tab="news"] .rankings-column,#main-content[data-mobile-home-tab="news"] .broadcast-sidebar,#main-content[data-mobile-home-tab="rankings"] .editorial-column,#main-content[data-mobile-home-tab="rankings"] .broadcast-sidebar,#main-content[data-mobile-home-tab="goals"] .editorial-column,#main-content[data-mobile-home-tab="goals"] .rankings-column{display:none}#main-content[data-mobile-home-tab="goals"] .broadcast-sidebar{display:flex;position:static}#main-content[data-mobile-home-tab="goals"] .broadcast-sidebar>.side-card:not(.goal-kickers-card){display:none}.mobile-extras{display:none}.secondary-grid{grid-template-columns:1fr}.secondary-story,.secondary-story:first-child{grid-template-columns:112px minmax(0,1fr)}.rank-row{grid-template-columns:28px 38px minmax(0,1fr) 48px 54px}.rank-row .form{display:none}.board-labels{grid-template-columns:1fr 58px}.board-labels span:nth-child(2){display:none}.league-tile{min-width:246px}.feature-copy{padding:20px}.feature-copy h2{font-size:3rem}.feature-copy p{font-size:16px}.feature-bottom{align-items:flex-start;flex-direction:column}.rail-live{display:none}}
  @media (max-width:520px){.rank-row{grid-template-columns:26px 34px minmax(0,1fr) 42px}.rank-row .movement{display:none}.ranking-board .rank-row:nth-of-type(n+18){display:none}.secondary-story,.secondary-story:first-child{grid-template-columns:96px minmax(0,1fr)}.broadcast-sidebar .side-card:nth-of-type(3){display:none}.league-tile{min-width:232px}.tile-main strong{max-width:132px}.side-card,.feature-story,.ranking-board{border-radius:14px}.teaser strong,.championship-card strong,.update-card strong,.strongest-card strong,.sponsor-slot strong,.prototype-card strong,.prototype-card strong{overflow-wrap:anywhere}}
`}</style> }
