import { useEffect, useMemo, useState } from 'react'
import { Trophy, Video, Activity, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ClubProfile } from '../../lib/rankings'
import { TeamLogo } from '../rankings/bits'
import PublicGoalKickersPanel from '../goal-kickers/PublicGoalKickersPanel'

const supporterId = () => {
  const key = 'playfooty-supporter-id'
  let value = localStorage.getItem(key)
  if (!value) {
    value = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `pf-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(key, value)
  }
  return value
}

type MatchRow = {
  id: string
  sourceId?: string
  leagueId?: string | null
  leagueName?: string | null
  round?: string | number | null
  grade?: string | null
  matchDate?: string | null
  venue?: string | null
  homeClubId?: string | null
  awayClubId?: string | null
  homeClubName?: string
  awayClubName?: string
  homeName?: string
  awayName?: string
  homeClubLogoUrl?: string | null
  awayClubLogoUrl?: string | null
  homeLogoUrl?: string | null
  awayLogoUrl?: string | null
  homePoints?: number
  awayPoints?: number
  homeScore?: number
  awayScore?: number
}

type RankingRow = {
  rank: number
  clubId: string
  clubName: string
  logoUrl?: string | null
  leagueId: string
  leagueName?: string
  points: number
  goalsFor: number
  goalsAgainst: number
  percentage: number
  record: { wins: number; losses: number; draws: number; played: number }
}

type Highlight = {
  id: string
  playerName: string
  clubId: string | null
  clubName: string
  category: string
  videoUrl: string
  thumbnailUrl: string | null
  description: string | null
  votes: number
}

type FeedItem = { id: string; type: string; title: string; body: string; href: string; entityType: string; entityId: string; createdAt: string }

type LoadState = {
  fixtures: MatchRow[]
  results: MatchRow[]
  rankings: RankingRow[]
  highlights: Highlight[]
  activity: FeedItem[]
}

type TeamMetric = {
  clubId: string
  clubName: string
  logoUrl: string | null
  nationalRank: number | null
  ladderPosition: number | null
  attackRating: number
  defensiveRating: number
  wins: number
  losses: number
  draws: number
  percentage: number
}

export default function ClubLiveHub({ club }: { club: ClubProfile }) {
  const [data, setData] = useState<LoadState>({ fixtures: [], results: [], rankings: [], highlights: [], activity: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const season = club.season ? `&season=${encodeURIComponent(club.season)}` : ''
    const calls = [
      fetch(`/api/clubs/${encodeURIComponent(club.clubId)}/fixtures?upcoming=true${season}`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`/api/clubs/${encodeURIComponent(club.clubId)}/results?${season.slice(1)}`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/rankings').then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/highlights').then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`/api/follows/feed?supporterId=${encodeURIComponent(supporterId())}`).then(r => r.ok ? r.json() : Promise.reject()),
    ]
    setLoading(true)
    Promise.allSettled(calls).then(results => {
      if (!active) return
      const payload = <T,>(index: number): T[] => results[index]?.status === 'fulfilled' && Array.isArray((results[index] as PromiseFulfilledResult<{ data?: T[] }>).value?.data) ? (results[index] as PromiseFulfilledResult<{ data: T[] }>).value.data : []
      setData({
        fixtures: payload<MatchRow>(0).slice(0, 20),
        results: payload<MatchRow>(1).slice(0, 20),
        rankings: payload<RankingRow>(2),
        highlights: payload<Highlight>(3).filter(row => row.clubId === club.clubId || row.clubName.toLowerCase() === club.clubName.toLowerCase()).slice(0, 4),
        activity: payload<FeedItem>(4).filter(row => row.entityType === 'CLUB' && row.entityId === club.clubId).slice(0, 6),
      })
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [club.clubId, club.clubName, club.season])

  const records = useMemo(() => deriveRecords(data.results, club.clubId, club.clubName), [data.results, club.clubId, club.clubName])
  const nextFixture = useMemo(() => selectMondayFixture(data.fixtures), [data.fixtures])
  const nextMatch = useMemo(() => buildNextMatch(nextFixture, data.rankings, club), [nextFixture, data.rankings, club])
  const lastMatch = useMemo(() => selectLastResult(data.results), [data.results])

  return <div className="club-live-hub">
    <section className="club-live-summary">
      <header><div><span>Club overview</span><h2>Live football hub</h2></div>{club.leagueId && <Link to={`/league/${club.leagueId}`}>View league <ArrowRight size={14}/></Link>}</header>
      <div className="club-live-metrics">
        <Metric label="National rank" value={club.rank != null ? `#${club.rank}` : '—'} detail={club.rankMovement > 0 ? `Up ${club.rankMovement}` : club.rankMovement < 0 ? `Down ${Math.abs(club.rankMovement)}` : 'No movement'} />
        <Metric label="Ladder position" value={club.ladderPosition != null ? `#${club.ladderPosition}` : '—'} detail={`${club.record.wins}-${club.record.losses}${club.record.draws ? `-${club.record.draws}` : ''}`} />
        <Metric label="Power rating" value={club.powerRating != null ? club.powerRating.toFixed(1) : '—'} detail={club.weekLabel || club.season || 'Current'} />
        <Metric label="Percentage" value={club.percentage > 0 ? `${club.percentage.toFixed(1)}%` : '—'} detail={`${club.goalsFor} for · ${club.goalsAgainst} against`} />
      </div>
    </section>

    <NextMatchCard match={nextMatch} clubId={club.clubId} loading={loading} />
    <LastMatchCard row={lastMatch} clubId={club.clubId} clubName={club.clubName} loading={loading} />

    <PublicGoalKickersPanel clubId={club.clubId} eyebrow={`${club.season ?? new Date().getFullYear()} club leaders`} title={`${club.clubName} goal kickers`} />

    <div className="club-live-columns">
      <section className="club-live-card">
        <header><div><span>Season records</span><h2>Club records</h2></div><Trophy size={19}/></header>
        {records.length ? <div className="club-record-list">{records.map(record => <article key={record.label}><span>{record.label}</span><strong>{record.value}</strong><small>{record.detail}</small></article>)}</div> : <Empty text="Records will appear when published results are available." />}
      </section>
      <section className="club-live-card">
        <header><div><span>Supporter updates</span><h2>Recent activity</h2></div><Activity size={19}/></header>
        {data.activity.length ? <div className="club-activity-list">{data.activity.map(item => <Link key={item.id} to={item.href}><strong>{item.title}</strong><span>{item.body}</span><small>{formatDate(item.createdAt)}</small></Link>)}</div> : <Empty text="Follow this club to see its latest activity in your feed." />}
      </section>
    </div>

    <section className="club-live-card">
      <header><div><span>Approved videos</span><h2>Club highlights</h2></div><Link to="/highlights">View highlights</Link></header>
      {data.highlights.length ? <div className="club-highlight-grid">{data.highlights.map(item => <a key={item.id} href={item.videoUrl} target="_blank" rel="noreferrer"><div>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt=""/> : <Video size={28}/>}</div><span>{item.category}</span><strong>{item.playerName}</strong><small>{item.description || `${item.votes} vote${item.votes === 1 ? '' : 's'}`}</small></a>)}</div> : <Empty text="No approved club highlights are available this week." />}
    </section>

    <style>{styles}</style>
  </div>
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
}

function NextMatchCard({ match, clubId, loading }: { match: ReturnType<typeof buildNextMatch>; clubId: string; loading: boolean }) {
  if (loading) return <section className="club-live-card club-feature-match"><header><div><span>Match centre</span><h2>Next match</h2></div><Link to={`/matches?clubId=${encodeURIComponent(clubId)}`}>See all matches</Link></header><Empty text="Loading next match…" /></section>
  if (!match) return <section className="club-live-card club-feature-match"><header><div><span>Match centre</span><h2>Next match</h2></div><Link to={`/matches?clubId=${encodeURIComponent(clubId)}`}>See all matches</Link></header><Empty text="No further fixtures are published for this season." /></section>

  const [homeWins, awayWins] = relativeHigher(match.home.wins, match.away.wins)
  const [homeLosses, awayLosses] = relativeLower(match.home.losses, match.away.losses)
  const [homePercentage, awayPercentage] = relativeHigher(match.home.percentage, match.away.percentage)
  const [homeAttack, awayAttack] = relativeHigher(match.home.attackRating, match.away.attackRating)
  const [homeDefence, awayDefence] = relativeHigher(match.home.defensiveRating, match.away.defensiveRating)

  return <section className="club-live-card club-feature-match">
    <header><div><span>Match centre</span><h2>Next match</h2></div><Link to={`/matches?clubId=${encodeURIComponent(clubId)}`}>See all matches</Link></header>
    <article className="club-feature-game-card">
      <div className="club-feature-game-top">
        <small>{match.leagueName}</small>
        <div className="club-feature-game-context"><span>{match.round}</span>{match.date && <span>{match.date}</span>}{match.venue && <span>{match.venue}</span>}</div>
        <div className="club-feature-game-teams">
          <FeatureTeam team={match.home}/><b>VS</b><FeatureTeam team={match.away}/>
        </div>
      </div>
      <div className="club-feature-game-metrics">
        <GameMetric label="National ranking" home={rank(match.home.nationalRank)} away={rank(match.away.nationalRank)} homeWidth={relativeRank(match.home.nationalRank, match.away.nationalRank)[0]} awayWidth={relativeRank(match.home.nationalRank, match.away.nationalRank)[1]}/>
        <GameMetric label="League ladder" home={rank(match.home.ladderPosition)} away={rank(match.away.ladderPosition)} homeWidth={relativeRank(match.home.ladderPosition, match.away.ladderPosition)[0]} awayWidth={relativeRank(match.home.ladderPosition, match.away.ladderPosition)[1]}/>
        <GameMetric label="Attack rating" home={match.home.attackRating.toFixed(1)} away={match.away.attackRating.toFixed(1)} homeWidth={homeAttack} awayWidth={awayAttack}/>
        <GameMetric label="Defensive rating" home={match.home.defensiveRating.toFixed(1)} away={match.away.defensiveRating.toFixed(1)} homeWidth={homeDefence} awayWidth={awayDefence}/>
        <GameMetric label="Wins" home={String(match.home.wins)} away={String(match.away.wins)} homeWidth={homeWins} awayWidth={awayWins}/>
        <GameMetric label="Losses" home={String(match.home.losses)} away={String(match.away.losses)} homeWidth={homeLosses} awayWidth={awayLosses}/>
        <GameMetric label="Percentage" home={`${match.home.percentage.toFixed(1)}%`} away={`${match.away.percentage.toFixed(1)}%`} homeWidth={homePercentage} awayWidth={awayPercentage}/>
      </div>
      <p className="club-rating-note">Attack and defence ratings are league-normalised · 100 = league average</p>
      <footer><Link to={`/team/${match.home.clubId}`}>See {shortName(match.home.clubName)} team <ArrowRight size={16}/></Link><Link to={`/team/${match.away.clubId}`}>See {shortName(match.away.clubName)} team <ArrowRight size={16}/></Link></footer>
    </article>
  </section>
}

function LastMatchCard({ row, clubId, clubName, loading }: { row: MatchRow | null; clubId: string; clubName: string; loading: boolean }) {
  const allMatchesUrl = `/matches?clubId=${encodeURIComponent(clubId)}`
  if (loading) return <section className="club-live-card club-last-match"><header><div><span>Match centre</span><h2>Last match</h2></div><Link to={allMatchesUrl}>See all matches</Link></header><Empty text="Loading last match…" /></section>
  if (!row) return <section className="club-live-card club-last-match"><header><div><span>Match centre</span><h2>Last match</h2></div><Link to={allMatchesUrl}>See all matches</Link></header><Empty text="No completed match has been published yet." /></section>

  const homeName = row.homeClubName ?? row.homeName ?? 'Home'
  const awayName = row.awayClubName ?? row.awayName ?? 'Away'
  const homeScore = Number(row.homePoints ?? row.homeScore ?? 0)
  const awayScore = Number(row.awayPoints ?? row.awayScore ?? 0)
  const homeIsClub = row.homeClubId === clubId || homeName.toLowerCase() === clubName.toLowerCase()
  const awayIsClub = row.awayClubId === clubId || awayName.toLowerCase() === clubName.toLowerCase()
  const margin = Math.abs(homeScore - awayScore)
  const resultLabel = homeScore === awayScore ? 'Draw' : `${homeScore > awayScore ? homeName : awayName} won by ${margin} point${margin === 1 ? '' : 's'}`
  const id = row.sourceId ?? row.id.replace(/^football:/, '')
  const matchUrl = `/match/result/${id}?source=football`

  return <section className="club-live-card club-last-match">
    <header><div><span>Match centre</span><h2>Last match</h2></div><Link to={allMatchesUrl}>See all matches</Link></header>
    <article className="club-last-result-card">
      <div className="club-last-result-top">
        <small>Final result</small>
        <div className="club-last-result-context"><span>{normaliseRound(row.round)}</span>{row.matchDate && <span>{fixtureDate(row.matchDate)}</span>}{row.venue && <span>{row.venue}</span>}</div>
        <div className="club-last-result-scoreboard">
          <ResultTeam clubId={row.homeClubId} name={homeName} logo={row.homeClubLogoUrl ?? row.homeLogoUrl ?? null}/>
          <strong className={homeIsClub ? 'is-profile-club' : ''}>{homeScore}</strong>
          <b>FINAL</b>
          <strong className={awayIsClub ? 'is-profile-club' : ''}>{awayScore}</strong>
          <ResultTeam clubId={row.awayClubId} name={awayName} logo={row.awayClubLogoUrl ?? row.awayLogoUrl ?? null}/>
        </div>
        <p>{resultLabel}</p>
      </div>
      <Link className="club-last-result-link" to={matchUrl}>View full match details <ArrowRight size={16}/></Link>
    </article>
  </section>
}

function ResultTeam({ clubId, name, logo }: { clubId?: string | null; name: string; logo: string | null }) {
  const body = <><span className="club-last-result-logo"><TeamLogo name={name} src={logo ?? undefined} size={104}/></span><strong>{name}</strong></>
  return clubId ? <Link className="club-last-result-team" to={`/team/${clubId}`}>{body}</Link> : <div className="club-last-result-team">{body}</div>
}

function FeatureTeam({ team }: { team: TeamMetric }) {
  return <Link className="club-feature-team" to={`/team/${team.clubId}`}><span className="club-feature-game-logo"><TeamLogo name={team.clubName} src={team.logoUrl ?? undefined} size={112}/></span><strong>{team.clubName}</strong></Link>
}

function GameMetric({ label, home, away, homeWidth, awayWidth }: { label: string; home: string; away: string; homeWidth: number; awayWidth: number }) {
  return <div className="club-game-metric"><div><strong>{home}</strong><span>{label}</span><strong>{away}</strong></div><div className="club-game-bars"><i><b style={{ width: `${clampWidth(homeWidth)}%` }}/></i><i><b style={{ width: `${clampWidth(awayWidth)}%` }}/></i></div></div>
}

function buildNextMatch(row: MatchRow | null, rankings: RankingRow[], club: ClubProfile) {
  if (!row) return null
  const leagueId = row.leagueId ?? club.leagueId ?? rankings.find(item => item.clubId === club.clubId)?.leagueId ?? ''
  const leagueRows = rankings.filter(item => item.leagueId === leagueId).sort((a, b) => b.points - a.points || b.percentage - a.percentage || b.record.wins - a.record.wins || a.clubName.localeCompare(b.clubName))
  const homeName = row.homeClubName ?? row.homeName ?? 'Home'
  const awayName = row.awayClubName ?? row.awayName ?? 'Away'
  const home = buildTeam(row.homeClubId ?? '', homeName, row.homeClubLogoUrl ?? row.homeLogoUrl ?? null, rankings, leagueRows)
  const away = buildTeam(row.awayClubId ?? '', awayName, row.awayClubLogoUrl ?? row.awayLogoUrl ?? null, rankings, leagueRows)
  return {
    home,
    away,
    leagueName: row.leagueName ?? leagueRows[0]?.leagueName ?? club.leagueName ?? 'Senior football',
    round: normaliseRound(row.round),
    date: fixtureDate(row.matchDate),
    venue: row.venue ?? '',
  }
}

function buildTeam(clubId: string, fallbackName: string, fallbackLogo: string | null, rankings: RankingRow[], leagueRows: RankingRow[]): TeamMetric {
  const row = rankings.find(item => item.clubId === clubId)
  const played = row?.record.played ?? 0
  const scored = row && played > 0 ? row.goalsFor / played : 0
  const conceded = row && played > 0 ? row.goalsAgainst / played : 0
  const rates = leagueRows.filter(item => item.record.played > 0).map(item => ({ scored: item.goalsFor / item.record.played, conceded: item.goalsAgainst / item.record.played }))
  const avgScored = rates.length ? rates.reduce((sum, item) => sum + item.scored, 0) / rates.length : 0
  const avgConceded = rates.length ? rates.reduce((sum, item) => sum + item.conceded, 0) / rates.length : 0
  return {
    clubId,
    clubName: row?.clubName ?? fallbackName,
    logoUrl: row?.logoUrl ?? fallbackLogo,
    nationalRank: row?.rank ?? null,
    ladderPosition: row ? leagueRows.findIndex(item => item.clubId === clubId) + 1 || null : null,
    attackRating: avgScored > 0 && scored > 0 ? Math.min(200, Math.round((scored / avgScored) * 1000) / 10) : 0,
    defensiveRating: avgConceded > 0 ? Math.min(200, conceded === 0 ? 200 : Math.round((avgConceded / conceded) * 1000) / 10) : 0,
    wins: row?.record.wins ?? 0,
    losses: row?.record.losses ?? 0,
    draws: row?.record.draws ?? 0,
    percentage: row?.percentage ?? 0,
  }
}

function selectMondayFixture(rows: MatchRow[]) {
  if (!rows.length) return null
  const now = new Date()
  const monday = new Date(now)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return [...rows].filter(row => !row.matchDate || new Date(row.matchDate).getTime() >= monday.getTime()).sort((a, b) => dateValue(a.matchDate) - dateValue(b.matchDate))[0] ?? null
}

function selectLastResult(rows: MatchRow[]) {
  return [...rows]
    .filter(row => Number.isFinite(Number(row.homePoints ?? row.homeScore)) && Number.isFinite(Number(row.awayPoints ?? row.awayScore)))
    .sort((a, b) => resultDateValue(b.matchDate) - resultDateValue(a.matchDate))[0] ?? null
}

function dateValue(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime()
}

function resultDateValue(value?: string | null) {
  if (!value) return 0
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function normaliseRound(value?: string | number | null) {
  if (value == null || String(value).trim() === '') return 'Match'
  const text = String(value).trim()
  return /^round\b/i.test(text) ? text : `Round ${text}`
}

function fixtureDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
}

function deriveRecords(rows: MatchRow[], clubId: string, clubName: string) {
  const games = rows.flatMap(row => {
    const home = row.homeClubName ?? row.homeName ?? ''
    const away = row.awayClubName ?? row.awayName ?? ''
    const homeScore = Number(row.homePoints ?? row.homeScore)
    const awayScore = Number(row.awayPoints ?? row.awayScore)
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return []
    const isHome = row.homeClubId === clubId || home.toLowerCase() === clubName.toLowerCase()
    const scored = isHome ? homeScore : awayScore
    const conceded = isHome ? awayScore : homeScore
    return [{ row, scored, conceded, margin: scored - conceded, opponent: isHome ? away : home }]
  })
  if (!games.length) return []
  const biggestWin = games.reduce((best, game) => game.margin > best.margin ? game : best, games[0])
  const highestScore = games.reduce((best, game) => game.scored > best.scored ? game : best, games[0])
  const average = Math.round(games.reduce((sum, game) => sum + game.scored, 0) / games.length)
  return [
    { label: 'Biggest recent win', value: biggestWin.margin > 0 ? `+${biggestWin.margin}` : '—', detail: biggestWin.margin > 0 ? `v ${biggestWin.opponent}` : 'No win in recent results' },
    { label: 'Highest recent score', value: String(highestScore.scored), detail: `v ${highestScore.opponent}` },
    { label: 'Average recent score', value: String(average), detail: `Across ${games.length} result${games.length === 1 ? '' : 's'}` },
  ]
}

const rank = (value: number | null) => value ? `#${value}` : '—'
const clampWidth = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
const relativeHigher = (home: number, away: number): [number, number] => { const max = Math.max(home, away, 1); return [(home / max) * 100, (away / max) * 100] }
const relativeLower = (home: number, away: number): [number, number] => { const max = Math.max(home, away, 1); return [home === 0 ? 100 : ((max - home + 1) / max) * 100, away === 0 ? 100 : ((max - away + 1) / max) * 100] }
const relativeRank = (home: number | null, away: number | null): [number, number] => { if (!home && !away) return [0, 0]; const max = Math.max(home ?? 0, away ?? 0, 1); return [home ? ((max - home + 1) / max) * 100 : 0, away ? ((max - away + 1) / max) * 100 : 0] }
const shortName = (name: string) => name.replace(/\s+(football|netball|football netball)\s+club$/i, '').trim()
function Empty({ text }: { text: string }) { return <p className="club-live-empty">{text}</p> }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(date) }

const styles = `
.club-live-hub{display:grid;gap:18px}.club-live-summary,.club-live-card{overflow:hidden;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055);padding:22px}.club-live-summary>header,.club-live-card>header{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:15px}.club-live-summary header span,.club-live-card header span{display:block;color:#209fe9;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.club-live-summary h2,.club-live-card h2{margin:5px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:36px;line-height:.9;text-transform:uppercase}.club-live-summary header a,.club-live-card header a{display:inline-flex;align-items:center;gap:5px;color:#1687c5;font-size:10px;font-weight:950;text-decoration:none;text-transform:uppercase}.club-live-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.club-live-metrics article{padding:15px;border:1px solid #e6ebef;border-radius:10px;background:#f8fafb}.club-live-metrics span,.club-live-metrics small{display:block}.club-live-metrics span{color:#687385;font-size:9px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.club-live-metrics strong{display:block;margin:5px 0 3px;font-family:'Bebas Neue',Impact,sans-serif;font-size:31px}.club-live-metrics small{color:#687385;font-size:11px}.club-live-columns{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.club-feature-match>header,.club-last-match>header{align-items:flex-start}.club-feature-game-card,.club-last-result-card{overflow:hidden;border:1px solid #dce3eb;border-radius:18px;background:#fff;color:#111318;box-shadow:0 12px 30px rgba(17,24,39,.10)}.club-feature-game-top,.club-last-result-top{padding:18px 24px 12px;background:linear-gradient(135deg,#34104f,#0b1430 52%,#0a4970);color:#fff;border-bottom:5px solid var(--club-primary,#42b8ff)}.club-feature-game-top>small,.club-last-result-top>small{display:block;text-align:center;color:#d8e4ef;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.club-feature-game-context,.club-last-result-context{display:flex;justify-content:center;flex-wrap:wrap;gap:5px 12px;margin-top:7px;color:#fff;font-size:12px;font-weight:800}.club-feature-game-context span+span:before,.club-last-result-context span+span:before{content:'·';margin-right:12px;color:var(--club-primary,#42b8ff)}
.club-feature-game-teams{display:grid;grid-template-columns:minmax(0,1fr) 60px minmax(0,1fr);align-items:center;gap:12px;margin-top:18px}.club-feature-team{display:grid;justify-items:center;text-align:center;gap:8px;color:#fff;text-decoration:none}.club-feature-game-logo,.club-last-result-logo{display:grid;place-items:center;width:124px;height:124px;padding:4px;box-sizing:border-box;overflow:hidden;border:1px solid rgba(255,255,255,.5);border-radius:22px;background:#fff}.club-feature-game-logo>span,.club-last-result-logo>span{width:100%!important;height:100%!important}.club-feature-game-logo img,.club-last-result-logo img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important}.club-feature-team strong,.club-last-result-team>strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(1.65rem,3vw,2.5rem);line-height:.95;text-transform:uppercase}.club-feature-game-teams>b{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:rgba(255,255,255,.1);font-family:'Bebas Neue',Impact,sans-serif;font-size:31px;color:var(--club-primary,#42b8ff)}
.club-feature-game-metrics{padding:8px 22px;background:#fff}.club-game-metric{padding:13px 0;border-bottom:1px solid #e3e7ec}.club-game-metric:last-child{border-bottom:0}.club-game-metric>div:first-child{display:grid;grid-template-columns:1fr minmax(130px,1.3fr) 1fr;align-items:center;gap:10px}.club-game-metric strong{font-size:19px}.club-game-metric strong:last-child{text-align:right}.club-game-metric span{text-align:center;font-size:15px;font-weight:850}.club-game-bars{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}.club-game-bars i{height:8px;border-radius:999px;background:#eef1f4;overflow:hidden}.club-game-bars i:first-child{display:flex;justify-content:flex-end}.club-game-bars b{display:block;height:100%;border-radius:999px;background:#1d4ed8}.club-game-bars i:last-child b{background:#16a34a}.club-rating-note{margin:0;padding:0 22px 14px;color:#667085;font-size:11px;font-weight:750;text-align:center;background:#fff}.club-feature-game-card footer{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #dce3eb;background:#fff}.club-feature-game-card footer a{display:flex;align-items:center;justify-content:center;gap:8px;padding:17px 12px;color:#075ca8;text-decoration:none;font-weight:900;text-align:center}.club-feature-game-card footer a+a{border-left:1px solid #dce3eb}
.club-last-result-scoreboard{display:grid;grid-template-columns:minmax(0,1fr) auto 46px auto minmax(0,1fr);align-items:center;gap:14px;margin-top:20px}.club-last-result-team{display:grid;justify-items:center;gap:8px;color:#fff;text-align:center;text-decoration:none}.club-last-result-scoreboard>strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4rem,8vw,7rem);line-height:.8;color:#fff}.club-last-result-scoreboard>strong.is-profile-club{color:var(--club-primary,#42b8ff)}.club-last-result-scoreboard>b{font-size:9px;letter-spacing:.16em;color:#aeb9c6;text-align:center}.club-last-result-top>p{margin:20px 0 4px;text-align:center;color:#d8e4ef;font-size:12px;font-weight:800}.club-last-result-link{display:flex;align-items:center;justify-content:center;gap:8px;padding:17px;color:#075ca8;text-decoration:none;font-weight:900;background:#fff}
.club-record-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.club-record-list article{padding:13px;border:1px solid #e7ebef;border-radius:9px}.club-record-list span,.club-record-list small{display:block}.club-record-list span{color:#687385;font-size:9px;font-weight:950;text-transform:uppercase}.club-record-list strong{display:block;margin:5px 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:29px}.club-record-list small{color:#687385;font-size:10px}.club-activity-list{display:grid}.club-activity-list a{padding:12px 0;border-top:1px solid #edf1f4;color:#111318;text-decoration:none}.club-activity-list strong,.club-activity-list span,.club-activity-list small{display:block}.club-activity-list span{margin-top:3px;color:#687385;font-size:12px}.club-activity-list small{margin-top:5px;color:#168fd2;font-size:9px;font-weight:900;text-transform:uppercase}.club-highlight-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.club-highlight-grid>a{overflow:hidden;border:1px solid #e3e8ed;border-radius:10px;color:#111318;text-decoration:none}.club-highlight-grid>a>div{height:115px;display:grid;place-items:center;background:#eef5f9;color:#168fd2}.club-highlight-grid img{width:100%;height:100%;object-fit:cover}.club-highlight-grid>a>span,.club-highlight-grid>a>strong,.club-highlight-grid>a>small{display:block;margin-left:12px;margin-right:12px}.club-highlight-grid>a>span{margin-top:10px;color:#168fd2;font-size:9px;font-weight:950;text-transform:uppercase}.club-highlight-grid>a>strong{margin-top:3px}.club-highlight-grid>a>small{margin-top:4px;margin-bottom:12px;color:#687385;font-size:11px}.club-live-empty{margin:0;padding:22px 0;color:#687385;font-size:13px}
@media(max-width:760px){.club-live-summary,.club-live-card{padding:17px}.club-live-metrics{grid-template-columns:1fr 1fr}.club-live-columns{grid-template-columns:1fr}.club-record-list{grid-template-columns:1fr}.club-highlight-grid{grid-template-columns:1fr 1fr}.club-live-summary h2,.club-live-card h2{font-size:31px}.club-feature-game-top,.club-last-result-top{padding:16px 14px 10px}.club-feature-game-teams{grid-template-columns:minmax(0,1fr) 48px minmax(0,1fr);gap:7px}.club-feature-game-logo,.club-last-result-logo{width:100px;height:100px}.club-feature-game-teams>b{width:46px;height:46px;font-size:26px}.club-feature-team strong,.club-last-result-team>strong{font-size:1.6rem}.club-feature-game-metrics{padding:6px 16px}.club-game-metric>div:first-child{grid-template-columns:1fr minmax(112px,1.2fr) 1fr}.club-game-metric strong{font-size:17px}.club-game-metric span{font-size:13px}.club-feature-game-card footer a{padding:15px 8px;font-size:13px}.club-last-result-scoreboard{grid-template-columns:minmax(0,1fr) auto 34px auto minmax(0,1fr);gap:7px}.club-last-result-scoreboard>strong{font-size:4.2rem}}
@media(max-width:440px){.club-highlight-grid{grid-template-columns:1fr}.club-feature-game-logo,.club-last-result-logo{width:84px;height:84px}.club-feature-team strong,.club-last-result-team>strong{font-size:1.25rem}.club-feature-game-context,.club-last-result-context{font-size:10px}.club-game-metric>div:first-child{grid-template-columns:1fr 108px 1fr}.club-last-result-scoreboard{grid-template-columns:minmax(0,1fr) auto 24px auto minmax(0,1fr);gap:5px}.club-last-result-scoreboard>strong{font-size:3.25rem}}
`
