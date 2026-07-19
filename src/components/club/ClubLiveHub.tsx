import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Trophy, Video, Activity, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ClubProfile } from '../../lib/rankings'
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
  homePoints?: number
  awayPoints?: number
  homeScore?: number
  awayScore?: number
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
  highlights: Highlight[]
  activity: FeedItem[]
}

export default function ClubLiveHub({ club }: { club: ClubProfile }) {
  const [data, setData] = useState<LoadState>({ fixtures: [], results: [], highlights: [], activity: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const season = club.season ? `&season=${encodeURIComponent(club.season)}` : ''
    const calls = [
      fetch(`/api/clubs/${encodeURIComponent(club.clubId)}/fixtures?upcoming=true${season}`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`/api/clubs/${encodeURIComponent(club.clubId)}/results?${season.slice(1)}`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/highlights').then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`/api/follows/feed?supporterId=${encodeURIComponent(supporterId())}`).then(r => r.ok ? r.json() : Promise.reject()),
    ]
    setLoading(true)
    Promise.allSettled(calls).then(results => {
      if (!active) return
      const payload = <T,>(index: number): T[] => results[index]?.status === 'fulfilled' && Array.isArray((results[index] as PromiseFulfilledResult<{ data?: T[] }>).value?.data) ? (results[index] as PromiseFulfilledResult<{ data: T[] }>).value.data : []
      setData({
        fixtures: payload<MatchRow>(0).slice(0, 5),
        results: payload<MatchRow>(1).slice(0, 5),
        highlights: payload<Highlight>(2).filter(row => row.clubId === club.clubId || row.clubName.toLowerCase() === club.clubName.toLowerCase()).slice(0, 4),
        activity: payload<FeedItem>(3).filter(row => row.entityType === 'CLUB' && row.entityId === club.clubId).slice(0, 6),
      })
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [club.clubId, club.clubName, club.season])

  const records = useMemo(() => deriveRecords(data.results, club.clubId, club.clubName), [data.results, club.clubId, club.clubName])

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

    <div className="club-live-columns">
      <MatchCard title="Upcoming fixtures" icon={<CalendarDays size={17}/>} rows={data.fixtures} type="fixture" clubId={club.clubId} loading={loading} />
      <MatchCard title="Recent results" icon={<Trophy size={17}/>} rows={data.results} type="result" clubId={club.clubId} loading={loading} />
    </div>

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

function MatchCard({ title, icon, rows, type, clubId, loading }: { title: string; icon: React.ReactNode; rows: MatchRow[]; type: 'fixture' | 'result'; clubId: string; loading: boolean }) {
  return <section className="club-live-card"><header><div><span>Match centre</span><h2>{title}</h2></div>{icon}</header>{loading ? <Empty text="Loading match data…"/> : rows.length ? <div className="club-match-list">{rows.map(row => {
    const home = row.homeClubName ?? row.homeName ?? 'Home'
    const away = row.awayClubName ?? row.awayName ?? 'Away'
    const isHome = row.homeClubId === clubId
    const id = row.sourceId ?? row.id.replace(/^football:/, '')
    const homeScore = row.homePoints ?? row.homeScore
    const awayScore = row.awayPoints ?? row.awayScore
    return <Link key={row.id} to={`/match/${type}/${id}?source=football`}><span className={isHome ? 'this-club' : ''}>{home}</span>{type === 'result' && <b>{homeScore ?? 0}</b>}<span className={!isHome ? 'this-club' : ''}>{away}</span>{type === 'result' && <b>{awayScore ?? 0}</b>}<small>{[row.round, row.matchDate ? formatDate(row.matchDate) : null, row.venue].filter(Boolean).join(' · ')}</small></Link>
  })}</div> : <Empty text={type === 'fixture' ? 'No upcoming fixtures published.' : 'No recent results published.'}/>}</section>
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

function Empty({ text }: { text: string }) { return <p className="club-live-empty">{text}</p> }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(date) }

const styles = `.club-live-hub{display:grid;gap:18px}.club-live-summary,.club-live-card{overflow:hidden;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055);padding:22px}.club-live-summary>header,.club-live-card>header{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:15px}.club-live-summary header span,.club-live-card header span{display:block;color:#209fe9;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.club-live-summary h2,.club-live-card h2{margin:5px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:36px;line-height:.9;text-transform:uppercase}.club-live-summary header a,.club-live-card header a{display:inline-flex;align-items:center;gap:5px;color:#1687c5;font-size:10px;font-weight:950;text-decoration:none;text-transform:uppercase}.club-live-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.club-live-metrics article{padding:15px;border:1px solid #e6ebef;border-radius:10px;background:#f8fafb}.club-live-metrics span,.club-live-metrics small{display:block}.club-live-metrics span{color:#687385;font-size:9px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.club-live-metrics strong{display:block;margin:5px 0 3px;font-family:'Bebas Neue',Impact,sans-serif;font-size:31px}.club-live-metrics small{color:#687385;font-size:11px}.club-live-columns{display:grid;grid-template-columns:1fr 1fr;gap:18px}.club-match-list,.club-activity-list,.club-record-list{display:grid}.club-match-list>a{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;padding:11px 0;border-top:1px solid #edf1f4;color:#111318;text-decoration:none}.club-match-list>a>span{font-size:13px;font-weight:800}.club-match-list>a>span.this-club{font-weight:950}.club-match-list>a>b{font-family:'Bebas Neue',Impact,sans-serif;font-size:20px;color:#168fd2}.club-match-list>a>small{grid-column:1/3;color:#687385;font-size:10px}.club-record-list{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.club-record-list article{padding:13px;border:1px solid #e7ebef;border-radius:9px}.club-record-list span,.club-record-list small{display:block}.club-record-list span{color:#687385;font-size:9px;font-weight:950;text-transform:uppercase}.club-record-list strong{display:block;margin:5px 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:29px}.club-record-list small{color:#687385;font-size:10px}.club-activity-list a{padding:12px 0;border-top:1px solid #edf1f4;color:#111318;text-decoration:none}.club-activity-list strong,.club-activity-list span,.club-activity-list small{display:block}.club-activity-list span{margin-top:3px;color:#687385;font-size:12px}.club-activity-list small{margin-top:5px;color:#168fd2;font-size:9px;font-weight:900;text-transform:uppercase}.club-highlight-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.club-highlight-grid>a{overflow:hidden;border:1px solid #e3e8ed;border-radius:10px;color:#111318;text-decoration:none}.club-highlight-grid>a>div{height:115px;display:grid;place-items:center;background:#eef5f9;color:#168fd2}.club-highlight-grid img{width:100%;height:100%;object-fit:cover}.club-highlight-grid>a>span,.club-highlight-grid>a>strong,.club-highlight-grid>a>small{display:block;margin-left:12px;margin-right:12px}.club-highlight-grid>a>span{margin-top:10px;color:#168fd2;font-size:9px;font-weight:950;text-transform:uppercase}.club-highlight-grid>a>strong{margin-top:3px}.club-highlight-grid>a>small{margin-top:4px;margin-bottom:12px;color:#687385;font-size:11px}.club-live-empty{margin:0;padding:22px 0;color:#687385;font-size:13px}@media(max-width:760px){.club-live-summary,.club-live-card{padding:17px}.club-live-metrics{grid-template-columns:1fr 1fr}.club-live-columns{grid-template-columns:1fr}.club-record-list{grid-template-columns:1fr}.club-highlight-grid{grid-template-columns:1fr 1fr}.club-live-summary h2,.club-live-card h2{font-size:31px}}@media(max-width:440px){.club-highlight-grid{grid-template-columns:1fr}}`
