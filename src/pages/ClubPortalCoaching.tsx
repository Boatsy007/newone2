import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CalendarCheck, Clock3, MapPin, ShieldCheck, Target, Trophy, Users, Workflow } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { TeamLogo } from '../components/rankings/bits'
import { fetchClub, type ClubProfile } from '../lib/rankings'
import type { MvpEntry } from './MvpLeaderboard'
import type { PublicGoalKicker } from '../components/goal-kickers/PublicGoalKickersPanel'

type CoachingDashboard = {
  club: { id: string; name: string; logoUrl: string | null; primaryColour: string | null; leagueId: string | null; leagueName: string | null; season: string | null; grade: string | null }
  membership: { role: string; permissions: { teamSelection: boolean; view: boolean } }
  teamSelection: { roundLabel: string; opponentName: string | null; matchDate: string | null; status: string; playerCount: number } | null
}

type Fixture = {
  id: string
  leagueId: string
  season: string
  grade: string
  round: number | null
  matchDate: string | null
  homeClubId: string
  homeClubName: string
  awayClubId: string
  awayClubName: string
  venue?: string | null
  venueName?: string | null
  groundName?: string | null
}

type AvailabilityPlayer = {
  id: string
  status: string | null
  reason: string | null
}

type AvailabilityOverview = {
  selectedSheetId: string | null
  players: AvailabilityPlayer[]
}

type TeamSheetPlayer = {
  playerId: string | null
  playerName: string
  jumperNumber: number | null
}

type PublicTeamSheet = {
  clubLogoUrl: string | null
  players: TeamSheetPlayer[]
}

type WatchPlayer = {
  key: string
  playerId: string | null
  playerName: string
  jumperNumber: number | null
  mvpPoints: number | null
  clubMvpRank: number | null
  leagueMvpRank: number | null
  goals: number | null
  clubGoalRank: number | null
  leagueGoalRank: number | null
}

type Session = { access_token: string }
const SESSION_KEY = 'playfooty.clubPortal.session.v1'

function session(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as Session : null
  } catch {
    return null
  }
}

function roleLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, character => character.toUpperCase())
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Date not scheduled'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date not scheduled' : date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
}

function playerKey(playerId: string | null | undefined, playerName: string) {
  return playerId || playerName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function formLabel(form: ClubProfile['recentForm']) {
  return form.length ? form.join(' ') : 'No recent form available'
}

async function getJson<T>(path: string, token?: string) {
  const response = await fetch(path, { headers: token ? { authorization: `Bearer ${token}` } : undefined })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
  return payload
}

export default function ClubPortalCoaching() {
  const { clubId = '' } = useParams()
  const [data, setData] = useState<CoachingDashboard | null>(null)
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [availability, setAvailability] = useState<AvailabilityOverview | null>(null)
  const [opponent, setOpponent] = useState<ClubProfile | null>(null)
  const [opponentLogo, setOpponentLogo] = useState<string | null>(null)
  const [watchPlayers, setWatchPlayers] = useState<WatchPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [opponentLoading, setOpponentLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const current = session()
    if (!current) {
      setError('Sign in through the Club Portal to continue.')
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    Promise.all([
      getJson<{ data?: CoachingDashboard }>(`/api/club-portal/clubs/${encodeURIComponent(clubId)}/dashboard`, current.access_token),
      getJson<{ data?: Fixture[] }>(`/api/fixtures/club/${encodeURIComponent(clubId)}?upcoming=true`).catch(() => ({ data: [] })),
      getJson<{ data?: AvailabilityOverview }>(`/api/club-portal/availability/clubs/${encodeURIComponent(clubId)}/overview`, current.access_token).catch(() => ({ data: undefined })),
    ]).then(([dashboardPayload, fixturePayload, availabilityPayload]) => {
      if (!active) return
      setData(dashboardPayload.data ?? null)
      setFixtures(Array.isArray(fixturePayload.data) ? fixturePayload.data : [])
      setAvailability(availabilityPayload.data ?? null)
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load coaching workspace')
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [clubId])

  const nextFixture = fixtures[0] ?? null
  const opponentId = nextFixture ? (nextFixture.homeClubId === clubId ? nextFixture.awayClubId : nextFixture.homeClubId) : null
  const opponentName = nextFixture
    ? (nextFixture.homeClubId === clubId ? nextFixture.awayClubName : nextFixture.homeClubName)
    : data?.teamSelection?.opponentName ?? null

  useEffect(() => {
    if (!opponentId || !nextFixture) {
      setOpponent(null)
      setOpponentLogo(null)
      setWatchPlayers([])
      return
    }

    let active = true
    setOpponentLoading(true)
    const leagueId = nextFixture.leagueId || data?.club.leagueId || ''
    const season = nextFixture.season || data?.club.season || String(new Date().getFullYear())
    const clubQuery = new URLSearchParams({ clubId: opponentId, season, limit: '50' })
    const leagueQuery = new URLSearchParams({ leagueId, season, limit: '200' })

    Promise.all([
      fetchClub(opponentId).catch(() => null),
      getJson<{ data?: MvpEntry[] }>(`/api/mvp?${clubQuery}`).catch(() => ({ data: [] })),
      getJson<{ data?: MvpEntry[] }>(`/api/mvp?${leagueQuery}`).catch(() => ({ data: [] })),
      getJson<{ data?: PublicGoalKicker[] }>(`/api/goal-kickers/context?${clubQuery}`).catch(() => ({ data: [] })),
      getJson<{ data?: PublicGoalKicker[] }>(`/api/goal-kickers/context?${leagueQuery}`).catch(() => ({ data: [] })),
      getJson<{ data?: PublicTeamSheet | null }>(`/api/team-sheets/club/${encodeURIComponent(opponentId)}`).catch(() => ({ data: null })),
    ]).then(([clubProfile, clubMvpPayload, leagueMvpPayload, clubGoalPayload, leagueGoalPayload, teamSheetPayload]) => {
      if (!active) return
      const clubMvp = Array.isArray(clubMvpPayload.data) ? clubMvpPayload.data : []
      const leagueMvp = Array.isArray(leagueMvpPayload.data) ? leagueMvpPayload.data : []
      const clubGoals = Array.isArray(clubGoalPayload.data) ? clubGoalPayload.data : []
      const leagueGoals = Array.isArray(leagueGoalPayload.data) ? leagueGoalPayload.data : []
      const numberByKey = new Map((teamSheetPayload.data?.players ?? []).map(player => [playerKey(player.playerId, player.playerName), player.jumperNumber]))
      const rows = new Map<string, WatchPlayer>()

      const ensure = (id: string | null, name: string) => {
        const key = playerKey(id, name)
        const existing = rows.get(key)
        if (existing) return existing
        const created: WatchPlayer = { key, playerId: id, playerName: name, jumperNumber: numberByKey.get(key) ?? null, mvpPoints: null, clubMvpRank: null, leagueMvpRank: null, goals: null, clubGoalRank: null, leagueGoalRank: null }
        rows.set(key, created)
        return created
      }

      clubMvp.forEach(row => {
        const item = ensure(row.playerId, row.playerName)
        item.mvpPoints = row.mvpPoints
        item.clubMvpRank = row.rank
      })
      leagueMvp.filter(row => row.clubId === opponentId).forEach(row => {
        const item = ensure(row.playerId, row.playerName)
        item.mvpPoints = item.mvpPoints ?? row.mvpPoints
        item.leagueMvpRank = row.rank
      })
      clubGoals.forEach(row => {
        const item = ensure(row.playerId, row.playerName)
        item.goals = row.goals
        item.clubGoalRank = row.rank
      })
      leagueGoals.filter(row => row.clubId === opponentId).forEach(row => {
        const item = ensure(row.playerId, row.playerName)
        item.goals = item.goals ?? row.goals
        item.leagueGoalRank = row.rank
      })

      const ranked = [...rows.values()].sort((left, right) => {
        const leftScore = (left.mvpPoints ?? 0) * 2 + (left.goals ?? 0) * 3 + (left.clubMvpRank === 1 ? 30 : 0) + (left.clubGoalRank === 1 ? 40 : 0)
        const rightScore = (right.mvpPoints ?? 0) * 2 + (right.goals ?? 0) * 3 + (right.clubMvpRank === 1 ? 30 : 0) + (right.clubGoalRank === 1 ? 40 : 0)
        return rightScore - leftScore
      }).slice(0, 5)

      setOpponent(clubProfile)
      setOpponentLogo(clubProfile?.logoUrl ?? teamSheetPayload.data?.clubLogoUrl ?? clubGoals[0]?.clubLogoUrl ?? null)
      setWatchPlayers(ranked)
    }).finally(() => {
      if (active) setOpponentLoading(false)
    })

    return () => { active = false }
  }, [opponentId, nextFixture?.id, data?.club.leagueId, data?.club.season])

  const availabilityCounts = useMemo(() => {
    const players = availability?.players ?? []
    const injured = players.filter(player => player.reason === 'INJURY').length
    return {
      available: players.filter(player => player.status === 'AVAILABLE' && player.reason !== 'INJURY').length,
      injured,
      unavailable: players.filter(player => player.status === 'UNAVAILABLE' && player.reason !== 'INJURY').length,
      test: players.filter(player => player.status === 'TEST').length,
      unsure: players.filter(player => player.status === 'UNSURE' || player.status === 'UNLIKELY').length,
      pending: players.filter(player => !player.status).length,
    }
  }, [availability])

  const accent = data?.club.primaryColour || '#2daaf5'
  const venue = nextFixture?.venue || nextFixture?.venueName || nextFixture?.groundName || null
  const roundLabel = nextFixture?.round == null ? data?.teamSelection?.roundLabel || 'Next match' : `Round ${nextFixture.round}`

  return <><Nav/><main className="coach-workspace">
    {loading ? <div className="coach-state">Loading coaching workspace…</div> : error || !data ? <section className="coach-error"><ShieldCheck size={40}/><h1>Club access required</h1><p>{error || 'This coaching workspace is unavailable.'}</p><Link to="/club-portal">Return to Club Portal <ArrowRight size={16}/></Link></section> : <>
      <header className="coach-hero" style={{ '--coach-accent': accent } as React.CSSProperties}>
        <div className="coach-club"><TeamLogo name={data.club.name} src={data.club.logoUrl ?? undefined} size={78}/><div><span>Senior men’s coaching</span><h1>{data.club.name}</h1><p>{[data.club.leagueName, data.club.season, data.club.grade, roleLabel(data.membership.role)].filter(Boolean).join(' · ')}</p></div></div>
        <div className="coach-hero-links"><Link to={`/club-portal/${data.club.id}`}>Club dashboard</Link><Link to={`/team/${data.club.id}`}>Public profile <ArrowRight size={15}/></Link></div>
      </header>

      <section className="coach-opponent">
        <div className="coach-opponent-main">
          <div className="coach-opponent-logo"><TeamLogo name={opponentName || 'Next opponent'} src={opponentLogo ?? undefined} size={92}/></div>
          <div><span>Next opposition</span><h2>{opponentName || 'Opponent not confirmed'}</h2><div className="coach-match-meta"><b><CalendarCheck size={16}/>{roundLabel} · {dateLabel(nextFixture?.matchDate || data.teamSelection?.matchDate)}</b>{venue && <b><MapPin size={16}/>{venue}</b>}</div></div>
        </div>
        <div className="coach-opponent-stats">
          <Stat label="Ladder" value={opponent?.ladderPosition ? `${opponent.ladderPosition}` : '—'} note="position"/>
          <Stat label="National" value={opponent?.rank ? `${opponent.rank}` : '—'} note="ranking"/>
          <Stat label="Rating" value={opponent?.powerRating != null ? opponent.powerRating.toFixed(1) : '—'} note="power"/>
          <Stat label="Recent form" value={opponent?.recentForm.length ? opponent.recentForm.join('') : '—'} note={opponent ? formLabel(opponent.recentForm) : 'not available'}/>
        </div>
      </section>

      <section className="coach-availability">
        <div className="coach-section-title"><div><span>Current responses</span><h2>Player availability</h2></div><Link to={`/club-portal/${data.club.id}/availability`}>Open availability <ArrowRight size={15}/></Link></div>
        <div className="coach-availability-grid">
          <AvailabilityStat label="Available" value={availabilityCounts.available}/>
          <AvailabilityStat label="Injured" value={availabilityCounts.injured}/>
          <AvailabilityStat label="Unavailable" value={availabilityCounts.unavailable}/>
          <AvailabilityStat label="Test" value={availabilityCounts.test}/>
          <AvailabilityStat label="Unsure" value={availabilityCounts.unsure}/>
          <AvailabilityStat label="No response" value={availabilityCounts.pending}/>
        </div>
      </section>

      <section className="coach-watch">
        <div className="coach-section-title"><div><span>Opposition intelligence</span><h2>Players to watch</h2></div>{opponentId && <Link to={`/team/${opponentId}`}>Opponent profile <ArrowRight size={15}/></Link>}</div>
        {opponentLoading ? <div className="coach-empty">Loading opponent MVP and goal-kicking data…</div> : watchPlayers.length ? <div className="coach-watch-grid">{watchPlayers.map(player => <article key={player.key}>
          <div className="coach-watch-number">{player.jumperNumber != null ? `#${player.jumperNumber}` : '—'}</div>
          <div className="coach-watch-name"><span>Danger player</span><strong>{player.playerId ? <Link to={`/player/${encodeURIComponent(player.playerId)}`}>{player.playerName}</Link> : player.playerName}</strong><small>{player.jumperNumber == null ? 'Number not stored in latest published team sheet' : 'Latest published jumper number'}</small></div>
          <div className="coach-watch-data">
            <WatchStat label="MVP votes" value={player.mvpPoints}/>
            <WatchStat label="Club MVP" value={player.clubMvpRank ? `#${player.clubMvpRank}` : null}/>
            <WatchStat label="League MVP" value={player.leagueMvpRank ? `#${player.leagueMvpRank}` : null}/>
            <WatchStat label="Goals" value={player.goals}/>
            <WatchStat label="Club goals" value={player.clubGoalRank ? `#${player.clubGoalRank}` : null}/>
            <WatchStat label="League goals" value={player.leagueGoalRank ? `#${player.leagueGoalRank}` : null}/>
          </div>
        </article>)}</div> : <div className="coach-empty"><Target size={28}/><strong>No opposition player rankings are available yet.</strong><span>Players will appear automatically when approved MVP or goal-kicking data is connected to the opponent.</span></div>}
      </section>

      <section className="coach-tools">
        <div className="coach-section-title"><div><span>Coach operations</span><h2>Weekly workflow</h2></div></div>
        <div className="coach-tool-grid">
          <Tool to={`/club-portal/${data.club.id}/availability`} icon={CalendarCheck} title="Player availability" copy="Review every response before selection." />
          <Tool to={`/club-portal/${data.club.id}/team-selection`} icon={Trophy} title="Team selection" copy={`${data.teamSelection?.playerCount ?? 0} players selected · ${data.teamSelection?.status ?? 'not started'}.`} />
          <Tool to={`/club-portal/${data.club.id}/whiteboard`} icon={Workflow} title="Coaching whiteboard" copy="Plan positions, structures and match-day movements." />
          <Tool to={`/club-portal/${data.club.id}/users`} icon={Users} title="Coaching access" copy="Manage coach and staff access through the club workspace." />
        </div>
      </section>
    </>}
  </main><Footer/><style>{styles}</style></>
}

function Tool({ to, icon: Icon, title, copy }: { to: string; icon: typeof Trophy; title: string; copy: string }) {
  return <Link to={to}><Icon size={25}/><div><strong>{title}</strong><span>{copy}</span></div><ArrowRight size={18}/></Link>
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>
}

function AvailabilityStat({ label, value }: { label: string; value: number }) {
  return <article><Clock3 size={18}/><span>{label}</span><strong>{value}</strong></article>
}

function WatchStat({ label, value }: { label: string; value: string | number | null }) {
  return <div><span>{label}</span><b>{value ?? '—'}</b></div>
}

const styles = `
.coach-workspace{min-height:75vh;background:#eef3f7;padding:28px clamp(14px,4vw,42px) 60px;color:#111318}.coach-workspace>*{max-width:1240px;margin-left:auto;margin-right:auto}.coach-state,.coach-error{min-height:55vh;display:grid;place-items:center;text-align:center}.coach-error{align-content:center}.coach-error h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:54px;margin:12px 0 0;text-transform:uppercase}.coach-error p{color:#687385}.coach-error a{display:inline-flex;align-items:center;gap:7px;color:#111;text-decoration:none;font-weight:900}.coach-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:28px;border-radius:20px;background:linear-gradient(115deg,#0c1118,#17212d);color:#fff;border-left:6px solid var(--coach-accent)}.coach-club{display:flex;align-items:center;gap:18px;min-width:0}.coach-club span,.coach-section-title span,.coach-opponent-main span,.coach-watch-name>span{color:#77cfff;font-size:11px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.coach-club h1{margin:5px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(3rem,7vw,5rem);line-height:.85;text-transform:uppercase}.coach-club p{margin:0;color:#b8c3cf}.coach-hero-links{display:flex;gap:9px;flex-wrap:wrap}.coach-hero-links a{padding:11px 14px;border:1px solid rgba(255,255,255,.22);border-radius:999px;color:#fff;text-decoration:none;font-size:12px;font-weight:900;display:flex;gap:7px;align-items:center}.coach-opponent,.coach-availability,.coach-watch{margin-top:16px;padding:22px;background:#fff;border:1px solid #dde4ea;border-radius:15px;box-shadow:0 8px 24px rgba(15,23,42,.045)}.coach-opponent{display:grid;grid-template-columns:minmax(0,1fr) minmax(440px,.85fr);align-items:center;gap:24px}.coach-opponent-main{display:flex;align-items:center;gap:18px;min-width:0}.coach-opponent-logo{flex:0 0 auto}.coach-opponent h2,.coach-section-title h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;line-height:.9}.coach-opponent h2{font-size:clamp(2.8rem,5vw,4.4rem);margin:5px 0 10px}.coach-match-meta{display:flex;flex-wrap:wrap;gap:8px 16px}.coach-match-meta b{display:flex;align-items:center;gap:6px;color:#687385;font-size:12px}.coach-opponent-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.coach-opponent-stats article{padding:13px;border-radius:11px;background:#f3f7fa;text-align:center}.coach-opponent-stats span,.coach-opponent-stats small{display:block}.coach-opponent-stats span{font-size:9px;font-weight:900;color:#687385;text-transform:uppercase}.coach-opponent-stats strong{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-size:34px;line-height:1;margin:7px 0 3px;color:var(--coach-accent)}.coach-opponent-stats small{font-size:9px;color:#78838e}.coach-section-title{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:15px}.coach-section-title span{color:#0783c9}.coach-section-title h2{font-size:38px;margin:5px 0 0}.coach-section-title>a{display:inline-flex;align-items:center;gap:6px;color:#087fbd;text-decoration:none;font-size:11px;font-weight:900;text-transform:uppercase}.coach-availability-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.coach-availability-grid article{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:3px 8px;padding:13px;border:1px solid #e0e6eb;border-radius:11px}.coach-availability-grid svg{grid-row:1/3;color:#0783c9}.coach-availability-grid span{font-size:9px;color:#687385;font-weight:900;text-transform:uppercase}.coach-availability-grid strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:31px;line-height:1}.coach-watch-grid{display:grid;gap:10px}.coach-watch-grid>article{display:grid;grid-template-columns:74px minmax(190px,.8fr) minmax(0,1.5fr);align-items:center;gap:15px;padding:14px;border:1px solid #e0e6eb;border-radius:12px}.coach-watch-number{display:grid;place-items:center;width:62px;height:62px;border-radius:12px;background:#071018;color:var(--coach-accent);font-family:'Bebas Neue',Impact,sans-serif;font-size:30px}.coach-watch-name strong,.coach-watch-name small{display:block}.coach-watch-name>span{color:#0783c9;font-size:9px}.coach-watch-name strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:27px;text-transform:uppercase;line-height:1;margin:4px 0}.coach-watch-name strong a{color:inherit;text-decoration:none}.coach-watch-name small{color:#7a8590;font-size:10px}.coach-watch-data{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}.coach-watch-data>div{padding:9px 7px;border-radius:9px;background:#f3f7fa;text-align:center}.coach-watch-data span,.coach-watch-data b{display:block}.coach-watch-data span{font-size:8px;color:#687385;font-weight:900;text-transform:uppercase}.coach-watch-data b{margin-top:5px;font-size:15px}.coach-empty{display:flex;align-items:center;justify-content:center;gap:10px;min-height:100px;padding:20px;border:1px dashed #cbd5dd;border-radius:11px;color:#687385;text-align:center}.coach-empty strong,.coach-empty span{display:block}.coach-tools{margin-top:22px}.coach-tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.coach-tool-grid>a{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;padding:20px;background:#fff;border:1px solid #dde4ea;border-radius:15px;box-shadow:0 8px 24px rgba(15,23,42,.045);color:#111;text-decoration:none}.coach-tool-grid>a:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(15,23,42,.08)}.coach-tool-grid strong,.coach-tool-grid span{display:block}.coach-tool-grid strong{font-size:17px}.coach-tool-grid span{margin-top:4px;color:#687385;font-size:13px;line-height:1.4}@media(max-width:980px){.coach-opponent{grid-template-columns:1fr}.coach-availability-grid{grid-template-columns:repeat(3,1fr)}.coach-watch-grid>article{grid-template-columns:64px minmax(0,1fr)}.coach-watch-data{grid-column:1/3;grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.coach-workspace{padding:16px 12px 40px}.coach-hero{align-items:flex-start;flex-direction:column;padding:20px;border-radius:15px}.coach-club{align-items:flex-start}.coach-club h1{font-size:42px}.coach-hero-links{width:100%}.coach-hero-links a{justify-content:center;flex:1}.coach-opponent,.coach-availability,.coach-watch{padding:17px}.coach-opponent-main{align-items:flex-start}.coach-opponent-logo{display:none}.coach-opponent-stats{grid-template-columns:repeat(2,1fr)}.coach-section-title{align-items:flex-start;flex-direction:column}.coach-section-title h2{font-size:32px}.coach-availability-grid{grid-template-columns:repeat(2,1fr)}.coach-watch-grid>article{grid-template-columns:56px minmax(0,1fr);padding:11px;gap:10px}.coach-watch-number{width:50px;height:50px;font-size:25px}.coach-watch-name strong{font-size:23px}.coach-watch-data{grid-template-columns:repeat(2,1fr)}.coach-tool-grid{grid-template-columns:1fr}.coach-tool-grid>a{padding:17px}}
`