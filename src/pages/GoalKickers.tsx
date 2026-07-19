import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowUp, Minus, Search, Share2, Trophy } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { useSeo } from '../lib/seo'
import { sharePlayFootyPath } from '../components/sharing/ShareButton'

type SortMode = 'goals' | 'gpg' | 'adjusted'
type Facet = { id: string; name: string }
type ClubFacet = Facet & { leagueId: string | null }

type GoalKickerRow = {
  id: string
  playerId: string
  rank: number
  previousRank: number
  rankMovement: number
  playerName: string
  clubName: string
  clubId: string | null
  clubLogoUrl: string | null
  leagueName: string
  leagueId: string | null
  season: string
  grade: string | null
  goals: number
  previousGoals: number
  matches: number | null
  goalsPerGame: number | null
  latestGoalsDelta: number
  latestUpdatedAt: string
  leagueStrength: number
  adjustedGoals: number
  milestone: 50 | 100 | null
}

type LeaderboardResponse = {
  data: GoalKickerRow[]
  facets: { seasons: string[]; leagues: Facet[]; clubs: ClubFacet[] }
  meta: { total: number; limit: number; sort: SortMode; lastUpdated: string | null; source: string }
}

async function loadLeaderboard(params: { sort: SortMode; season: string; leagueId: string; clubId: string }) {
  const query = new URLSearchParams({ sort: params.sort, limit: '1000' })
  if (params.season) query.set('season', params.season)
  if (params.leagueId) query.set('leagueId', params.leagueId)
  if (params.clubId) query.set('clubId', params.clubId)
  const response = await fetch(`/api/goal-kickers?${query}`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<LeaderboardResponse>
}

function Logo({ row }: { row: GoalKickerRow }) {
  const initials = row.clubName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  return <span className="gkl-logo">{row.clubLogoUrl ? <img src={row.clubLogoUrl} alt="" /> : initials}</span>
}

function Movement({ value }: { value: number }) {
  if (value > 0) return <span className="gkl-movement up"><ArrowUp size={14} />{value}</span>
  if (value < 0) return <span className="gkl-movement down"><ArrowDown size={14} />{Math.abs(value)}</span>
  return <span className="gkl-movement steady"><Minus size={14} />0</span>
}

function SharePlayer({ id, label = false }: { id: string; label?: boolean }) {
  const [busy, setBusy] = useState(false)
  const share = async () => {
    if (busy) return
    setBusy(true)
    try { await sharePlayFootyPath(`/player/${encodeURIComponent(id)}`) } finally { setBusy(false) }
  }
  return <button className="gkl-share" type="button" onClick={share} disabled={busy} aria-label="Share player"><Share2 size={17} />{label && <span>{busy ? 'Creating…' : 'Share'}</span>}</button>
}

export default function GoalKickers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sort, setSort] = useState<SortMode>((searchParams.get('sort') as SortMode) || 'goals')
  const [season, setSeason] = useState(searchParams.get('season') || '')
  const [leagueId, setLeagueId] = useState(searchParams.get('league') || '')
  const [clubId, setClubId] = useState(searchParams.get('club') || '')
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [payload, setPayload] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useSeo({
    title: 'Australian Community Football Goal Kickers | PlayFooty',
    description: 'Search and filter Australia’s community football goal-kicking leaderboard by season, league and club. View goals, goals per game, movement, milestones and player profiles.',
    path: '/goal-kickers',
  })

  useEffect(() => {
    const next = new URLSearchParams()
    if (sort !== 'goals') next.set('sort', sort)
    if (season) next.set('season', season)
    if (leagueId) next.set('league', leagueId)
    if (clubId) next.set('club', clubId)
    if (search.trim()) next.set('q', search.trim())
    setSearchParams(next, { replace: true })
  }, [sort, season, leagueId, clubId, search, setSearchParams])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    loadLeaderboard({ sort, season, leagueId, clubId })
      .then(result => { if (active) setPayload(result) })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [sort, season, leagueId, clubId])

  const clubs = useMemo(() => (payload?.facets.clubs ?? []).filter(club => !leagueId || club.leagueId === leagueId), [payload, leagueId])
  const rows = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return payload?.data ?? []
    return (payload?.data ?? []).filter(row => `${row.playerName} ${row.clubName} ${row.leagueName}`.toLowerCase().includes(normalized))
  }, [payload, search])
  const leader = rows[0] ?? null
  const selectedLeague = payload?.facets.leagues.find(item => item.id === leagueId)?.name
  const selectedClub = payload?.facets.clubs.find(item => item.id === clubId)?.name
  const title = [season, selectedLeague, selectedClub].filter(Boolean).join(' · ') || 'National leaderboard'

  const clear = () => { setSeason(''); setLeagueId(''); setClubId(''); setSearch(''); setSort('goals') }
  const shareBoard = () => sharePlayFootyPath(`/goal-kickers${searchParams.toString() ? `?${searchParams}` : ''}`)

  return <div className="gkl-page">
    <Nav />
    <main>
      <section className="gkl-hero">
        <div className="gkl-shell">
          <span className="gkl-kicker">Australia-wide player statistics</span>
          <h1>Goal Kickers</h1>
          <p>Approved community football totals, connected to player, club and league profiles.</p>
          <div className="gkl-hero-actions">
            <div className="gkl-sort" role="group" aria-label="Leaderboard view">
              <button className={sort === 'goals' ? 'active' : ''} onClick={() => setSort('goals')}>Goals</button>
              <button className={sort === 'gpg' ? 'active' : ''} onClick={() => setSort('gpg')}>Goals per game</button>
              <button className={sort === 'adjusted' ? 'active' : ''} onClick={() => setSort('adjusted')}>Strength adjusted</button>
            </div>
            <button className="gkl-board-share" type="button" onClick={() => void shareBoard()}><Share2 size={17} /> Share leaderboard</button>
          </div>
        </div>
      </section>

      <div className="gkl-shell gkl-content">
        <section className="gkl-filters" aria-label="Goal-kicker filters">
          <label className="gkl-search"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search player, club or league" /></label>
          <select value={season} onChange={event => setSeason(event.target.value)}><option value="">All seasons</option>{payload?.facets.seasons.map(item => <option key={item} value={item}>{item}</option>)}</select>
          <select value={leagueId} onChange={event => { setLeagueId(event.target.value); setClubId('') }}><option value="">All leagues</option>{payload?.facets.leagues.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={clubId} onChange={event => setClubId(event.target.value)}><option value="">All clubs</option>{clubs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <button type="button" onClick={clear}>Clear</button>
        </section>

        {leader && <section className="gkl-leader">
          <div className="gkl-leader-rank">#1</div><Logo row={leader} />
          <div><span>{title}</span><Link to={`/player/${leader.id}`}>{leader.playerName}</Link><small>{leader.clubName} · {leader.leagueName}</small></div>
          <div className="gkl-leader-score"><strong>{sort === 'gpg' ? leader.goalsPerGame?.toFixed(2) ?? '—' : sort === 'adjusted' ? leader.adjustedGoals.toFixed(1) : leader.goals}</strong><span>{sort === 'gpg' ? 'goals / game' : sort === 'adjusted' ? 'adjusted score' : 'goals'}</span></div>
          <SharePlayer id={leader.id} label />
        </section>}

        <section className="gkl-board">
          <header><div><span>{title}</span><h2>{rows.length} player{rows.length === 1 ? '' : 's'}</h2></div><div><strong>{payload?.meta.source ?? 'Approved screenshot imports'}</strong><small>{payload?.meta.lastUpdated ? `Updated ${formatDate(payload.meta.lastUpdated)}` : 'Waiting for first approved import'}</small></div></header>

          {loading && <State text="Loading leaderboard…" />}
          {!loading && error && <State text="The leaderboard could not be loaded. The rest of PlayFooty is still available." error />}
          {!loading && !error && rows.length === 0 && <State text="No players match these filters." />}

          {!loading && !error && rows.length > 0 && <>
            <div className="gkl-table-head"><span>Rank</span><span>Player</span><span>Club / league</span><span>Movement</span><span>Latest</span><span>{sort === 'gpg' ? 'GPG' : sort === 'adjusted' ? 'Adjusted' : 'Goals'}</span><span /></div>
            <div className="gkl-list">{rows.map(row => <article key={row.id} className="gkl-row">
              <strong className="gkl-rank">#{row.rank}</strong>
              <div className="gkl-player"><Logo row={row} /><div><Link to={`/player/${row.id}`}>{row.playerName}</Link><span>{row.grade ?? row.season}{row.milestone && <b><Trophy size={12} />{row.milestone} goals</b>}</span></div></div>
              <div className="gkl-club"><strong>{row.clubId ? <Link to={`/team/${row.clubId}`}>{row.clubName}</Link> : row.clubName}</strong><span>{row.leagueId ? <Link to={`/league/${row.leagueId}`}>{row.leagueName}</Link> : row.leagueName}</span></div>
              <Movement value={row.rankMovement} />
              <span className="gkl-latest">{row.latestGoalsDelta > 0 ? `+${row.latestGoalsDelta}` : '—'}<small>{formatShort(row.latestUpdatedAt)}</small></span>
              <span className="gkl-score"><strong>{sort === 'gpg' ? row.goalsPerGame?.toFixed(2) ?? '—' : sort === 'adjusted' ? row.adjustedGoals.toFixed(1) : row.goals}</strong><small>{row.matches == null ? 'matches —' : `${row.matches} matches`}</small></span>
              <SharePlayer id={row.id} />
            </article>)}</div>
          </>}
        </section>
      </div>
    </main>
    <Footer />
    <style>{styles}</style>
  </div>
}

function State({ text, error = false }: { text: string; error?: boolean }) { return <div className={`gkl-state${error ? ' error' : ''}`}>{text}</div> }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
function formatShort(value: string) { return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(new Date(value)) }

const styles = `
.gkl-page{min-height:100vh;background:#f3f5f7;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.gkl-shell{width:min(1180px,calc(100% - 32px));margin:0 auto}.gkl-hero{background:#050505;color:#fff;border-bottom:5px solid #2daaf5;padding:50px 0 42px}.gkl-kicker{color:#2daaf5;font-size:11px;font-weight:950;letter-spacing:.17em;text-transform:uppercase}.gkl-hero h1{margin:8px 0 8px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(5rem,12vw,10rem);line-height:.78;text-transform:uppercase}.gkl-hero p{margin:0;color:#c7d0da;font-size:17px}.gkl-hero-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:24px}.gkl-sort{display:flex;gap:8px;flex-wrap:wrap}.gkl-sort button,.gkl-board-share{min-height:44px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:transparent;color:#fff;padding:0 17px;font:inherit;font-weight:900;cursor:pointer}.gkl-sort button.active{background:#2daaf5;border-color:#2daaf5;color:#050505}.gkl-board-share{display:flex;align-items:center;gap:8px}.gkl-content{padding:24px 0 54px}.gkl-filters{display:grid;grid-template-columns:minmax(240px,1.5fr) repeat(3,minmax(140px,1fr)) auto;gap:9px;padding:14px;border:1px solid #dfe5eb;border-radius:12px;background:#fff;box-shadow:0 6px 20px rgba(17,24,39,.05)}.gkl-filters select,.gkl-filters>button,.gkl-search{min-height:45px;border:1px solid #dce2e8;border-radius:8px;background:#fff;font:inherit}.gkl-filters select{padding:0 11px;font-weight:800}.gkl-filters>button{padding:0 15px;background:#050505;color:#fff;font-weight:900;cursor:pointer}.gkl-search{display:flex;align-items:center;gap:9px;padding:0 12px}.gkl-search svg{color:#2daaf5}.gkl-search input{width:100%;min-width:0;border:0;outline:0;font:inherit;font-size:16px}.gkl-leader{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto auto;align-items:center;gap:15px;margin-top:16px;padding:20px;border-radius:12px;background:#2daaf5;color:#050505;box-shadow:0 10px 28px rgba(45,170,245,.22)}.gkl-leader-rank{font-family:'Bebas Neue',Impact,sans-serif;font-size:48px}.gkl-logo{width:50px;height:50px;display:grid;place-items:center;flex:0 0 auto;border:1px solid rgba(5,5,5,.12);border-radius:11px;background:#fff;color:#087fbf;font-weight:950;overflow:hidden}.gkl-logo img{width:100%;height:100%;object-fit:contain;padding:4px}.gkl-leader>div:nth-child(3)>span{display:block;font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.12em}.gkl-leader a{color:#050505;text-decoration:none;font-weight:950}.gkl-leader>div:nth-child(3)>a{display:block;margin-top:4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:36px;line-height:1}.gkl-leader small{display:block;margin-top:4px;font-weight:800}.gkl-leader-score{text-align:right}.gkl-leader-score strong,.gkl-leader-score span{display:block}.gkl-leader-score strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:46px;line-height:.8}.gkl-leader-score span{margin-top:7px;font-size:9px;font-weight:950;text-transform:uppercase}.gkl-share{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #dce2e8;border-radius:999px;background:#fff;color:#050505;cursor:pointer}.gkl-share span{font-size:11px;font-weight:950;text-transform:uppercase}.gkl-leader .gkl-share{width:auto;padding:0 14px;border-color:rgba(5,5,5,.14)}.gkl-board{margin-top:16px;overflow:hidden;border:1px solid #dfe5eb;border-radius:12px;background:#fff;box-shadow:0 6px 20px rgba(17,24,39,.05)}.gkl-board>header{display:flex;justify-content:space-between;gap:18px;padding:20px;border-bottom:1px solid #e4e8ed}.gkl-board header span,.gkl-board header strong,.gkl-board header small{display:block}.gkl-board header span{color:#2daaf5;font-size:10px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.gkl-board header h2{margin:4px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:40px;line-height:1}.gkl-board header>div:last-child{text-align:right}.gkl-board header strong{font-size:12px}.gkl-board header small{margin-top:5px;color:#687385}.gkl-table-head,.gkl-row{display:grid;grid-template-columns:60px minmax(190px,1.25fr) minmax(180px,1fr) 85px 80px 100px 44px;gap:12px;align-items:center}.gkl-table-head{padding:11px 16px;background:#f8fafb;color:#687385;font-size:10px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.gkl-row{min-height:78px;padding:12px 16px;border-top:1px solid #edf0f3}.gkl-rank{font-family:'Bebas Neue',Impact,sans-serif;font-size:25px}.gkl-player{display:flex;align-items:center;gap:11px;min-width:0}.gkl-player .gkl-logo{width:44px;height:44px}.gkl-player>div,.gkl-club{min-width:0}.gkl-player a,.gkl-club a{color:#111318;text-decoration:none}.gkl-player>div>a{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;font-weight:950}.gkl-player>div>span{display:flex;align-items:center;gap:7px;margin-top:4px;color:#687385;font-size:11px;font-weight:800}.gkl-player b{display:inline-flex;align-items:center;gap:3px;color:#9b6500;background:#fff3c4;border-radius:999px;padding:3px 6px;font-size:9px;text-transform:uppercase}.gkl-club strong,.gkl-club span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gkl-club strong{font-size:13px}.gkl-club span{margin-top:4px;color:#687385;font-size:11px;font-weight:800}.gkl-movement{display:inline-flex;align-items:center;gap:3px;width:max-content;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:950}.gkl-movement.up{background:#e7f8ed;color:#16733a}.gkl-movement.down{background:#fff0f0;color:#b42318}.gkl-movement.steady{background:#eef1f4;color:#687385}.gkl-latest,.gkl-score{display:block;text-align:right;font-weight:950}.gkl-latest{color:#16733a}.gkl-latest small,.gkl-score small{display:block;margin-top:4px;color:#7a8593;font-size:9px;font-weight:850;text-transform:uppercase}.gkl-score strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:29px}.gkl-state{min-height:220px;display:grid;place-items:center;padding:20px;color:#687385;font-weight:900;text-align:center}.gkl-state.error{color:#b42318}
@media(max-width:850px){.gkl-hero{padding:36px 0 32px}.gkl-hero-actions{align-items:stretch;flex-direction:column}.gkl-board-share{justify-content:center}.gkl-filters{grid-template-columns:1fr 1fr}.gkl-search{grid-column:1/-1}.gkl-leader{grid-template-columns:auto auto minmax(0,1fr) auto}.gkl-leader-score{grid-column:3;text-align:left}.gkl-leader>.gkl-share{grid-column:4;grid-row:1/3;width:42px;padding:0}.gkl-leader>.gkl-share span{display:none}.gkl-table-head{display:none}.gkl-list{display:grid;gap:10px;padding:10px;background:#eef2f5}.gkl-row{position:relative;display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;min-height:0;padding:14px;border:1px solid #dfe5eb;border-radius:11px;background:#fff}.gkl-rank{grid-row:1/3}.gkl-player{grid-column:2}.gkl-club{grid-column:2;margin-left:55px}.gkl-movement{position:absolute;right:58px;top:15px}.gkl-latest{grid-column:2;text-align:left;margin-left:55px}.gkl-score{grid-column:3;grid-row:1/4;align-self:center}.gkl-row>.gkl-share{grid-column:3;grid-row:4;justify-self:end}.gkl-player>div>a{padding-right:70px}}
@media(max-width:540px){.gkl-shell{width:min(100% - 22px,1180px)}.gkl-hero h1{font-size:5rem}.gkl-sort{display:grid;grid-template-columns:1fr}.gkl-sort button{width:100%}.gkl-filters{grid-template-columns:1fr}.gkl-search{grid-column:auto}.gkl-leader{grid-template-columns:auto minmax(0,1fr) auto}.gkl-leader-rank{display:none}.gkl-leader .gkl-logo{width:44px;height:44px}.gkl-leader>div:nth-child(3)>a{font-size:29px}.gkl-leader-score{grid-column:2}.gkl-leader>.gkl-share{grid-column:3}.gkl-board>header{display:block}.gkl-board header>div:last-child{margin-top:10px;text-align:left}.gkl-row{grid-template-columns:38px minmax(0,1fr) auto;padding:12px}.gkl-player .gkl-logo{width:40px;height:40px}.gkl-club,.gkl-latest{margin-left:51px}.gkl-score strong{font-size:26px}}
`
