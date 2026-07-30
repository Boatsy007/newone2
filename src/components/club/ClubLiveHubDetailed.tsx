import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ClubProfile } from '../../lib/rankings'
import ClubLiveHub from './ClubLiveHub'

type MatchRow = {
  id: string
  sourceId?: string
  matchDate?: string | null
  round?: string | number | null
  homePoints?: number
  awayPoints?: number
  homeScore?: number
  awayScore?: number
  homeClubName?: string
  awayClubName?: string
  homeName?: string
  awayName?: string
}

type PlayerLink = { playerName: string; playerId?: string | null }
type GoalKicker = PlayerLink & { goals: number }
type MatchDetail = {
  homeQuarterScores?: Array<string | null>
  awayQuarterScores?: Array<string | null>
  homeBestPlayerLinks?: PlayerLink[]
  awayBestPlayerLinks?: PlayerLink[]
  homeBestPlayers?: string[]
  awayBestPlayers?: string[]
  homeGoalKickers?: GoalKicker[]
  awayGoalKickers?: GoalKicker[]
}

export default function ClubLiveHubDetailed({ club }: { club: ClubProfile }) {
  const [rows, setRows] = useState<MatchRow[]>([])
  const [detail, setDetail] = useState<MatchDetail | null>(null)

  useEffect(() => {
    let active = true
    const season = club.season ? `?season=${encodeURIComponent(club.season)}` : ''
    fetch(`/api/clubs/${encodeURIComponent(club.clubId)}/results${season}`)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => { if (active) setRows(Array.isArray(payload?.data) ? payload.data : []) })
      .catch(() => { if (active) setRows([]) })
    return () => { active = false }
  }, [club.clubId, club.season])

  const lastMatch = useMemo(() => [...rows]
    .filter(row => Number.isFinite(Number(row.homePoints ?? row.homeScore)) && Number.isFinite(Number(row.awayPoints ?? row.awayScore)))
    .sort((a, b) => dateValue(b.matchDate) - dateValue(a.matchDate))[0] ?? null, [rows])

  useEffect(() => {
    let active = true
    setDetail(null)
    if (!lastMatch) return () => { active = false }
    const resultId = lastMatch.sourceId ?? lastMatch.id.replace(/^football:/, '')
    fetch(`/api/match-details/football/${encodeURIComponent(resultId)}`)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => { if (active) setDetail(payload?.data ?? null) })
      .catch(() => { if (active) setDetail(null) })
    return () => { active = false }
  }, [lastMatch])

  return <div className="club-live-hub-detailed">
    <ClubLiveHub club={club} />
    {lastMatch && detail && hasDetails(detail) && <MatchDetailsExtension row={lastMatch} detail={detail} />}
    <style>{styles}</style>
  </div>
}

function MatchDetailsExtension({ row, detail }: { row: MatchRow; detail: MatchDetail }) {
  const homeName = row.homeClubName ?? row.homeName ?? 'Home'
  const awayName = row.awayClubName ?? row.awayName ?? 'Away'
  const homeBest = detail.homeBestPlayerLinks?.length ? detail.homeBestPlayerLinks : (detail.homeBestPlayers ?? []).map(playerName => ({ playerName }))
  const awayBest = detail.awayBestPlayerLinks?.length ? detail.awayBestPlayerLinks : (detail.awayBestPlayers ?? []).map(playerName => ({ playerName }))
  const homeKickers = detail.homeGoalKickers ?? []
  const awayKickers = detail.awayGoalKickers ?? []

  return <section className="club-last-match-details-extension" aria-label="Last match details">
    {hasQuarterScores(detail) && <div className="club-detail-block">
      <h3>Quarter scores</h3>
      <div className="club-quarter-grid club-quarter-head"><span>Team</span><span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span></div>
      <QuarterRow name={homeName} scores={detail.homeQuarterScores ?? []} />
      <QuarterRow name={awayName} scores={detail.awayQuarterScores ?? []} />
    </div>}
    {(homeBest.length > 0 || awayBest.length > 0) && <div className="club-detail-block">
      <h3>Best players</h3>
      <PlayerGroup label={homeName} players={homeBest} />
      <PlayerGroup label={awayName} players={awayBest} />
    </div>}
    {(homeKickers.length > 0 || awayKickers.length > 0) && <div className="club-detail-block">
      <h3>Goal kickers</h3>
      <KickerGroup label={homeName} players={homeKickers} />
      <KickerGroup label={awayName} players={awayKickers} />
    </div>}
  </section>
}

function QuarterRow({ name, scores }: { name: string; scores: Array<string | null> }) {
  return <div className="club-quarter-grid"><strong>{name}</strong>{[0, 1, 2, 3].map(index => <span key={index}>{scores[index] || '—'}</span>)}</div>
}

function PlayerGroup({ label, players }: { label: string; players: PlayerLink[] }) {
  if (!players.length) return null
  return <div className="club-player-group"><span>{label}</span><p>{players.map((player, index) => <span key={`${player.playerName}-${index}`}>{player.playerId ? <Link to={`/player/${player.playerId}`}>{player.playerName}</Link> : player.playerName}</span>)}</p></div>
}

function KickerGroup({ label, players }: { label: string; players: GoalKicker[] }) {
  if (!players.length) return null
  return <div className="club-player-group"><span>{label}</span><p>{players.map((player, index) => <span key={`${player.playerName}-${index}`}>{player.playerId ? <Link to={`/player/${player.playerId}`}>{player.playerName}</Link> : player.playerName}{player.goals > 1 ? ` (${player.goals})` : ''}</span>)}</p></div>
}

function hasQuarterScores(detail: MatchDetail) {
  return [...(detail.homeQuarterScores ?? []), ...(detail.awayQuarterScores ?? [])].some(Boolean)
}

function hasDetails(detail: MatchDetail) {
  return hasQuarterScores(detail)
    || Boolean(detail.homeBestPlayerLinks?.length || detail.awayBestPlayerLinks?.length || detail.homeBestPlayers?.length || detail.awayBestPlayers?.length)
    || Boolean(detail.homeGoalKickers?.length || detail.awayGoalKickers?.length)
}

function dateValue(value?: string | null) {
  if (!value) return 0
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const styles = `
.club-last-match-details-extension{display:none;margin-top:-18px;padding:0 17px 17px;border:1px solid #e0e5ea;border-top:0;border-radius:0 0 12px 12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055)}
.club-tab-match-centre .club-last-match-details-extension{display:grid;gap:14px}
.club-detail-block{padding:16px;border:1px solid #dfe5eb;border-radius:12px;background:#fff}.club-detail-block h3{margin:0 0 12px;color:var(--club-primary,#b49a60);font-size:11px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}
.club-quarter-grid{display:grid;grid-template-columns:minmax(110px,1.5fr) repeat(4,minmax(45px,1fr));gap:8px;align-items:center;margin-top:8px}.club-quarter-grid>span{padding:9px 5px;border:1px solid #e1e6eb;border-radius:8px;background:#f8fafb;text-align:center;font-weight:850}.club-quarter-grid>strong{font-size:12px;line-height:1.2}.club-quarter-head{margin-top:0;color:#687385;font-size:9px;font-weight:900;text-transform:uppercase}.club-quarter-head>span{padding:0;border:0;background:transparent}.club-quarter-head>span:first-child{text-align:left}
.club-player-group+.club-player-group{margin-top:12px;padding-top:12px;border-top:1px solid #e8edf1}.club-player-group>span{display:block;margin-bottom:7px;color:#687385;font-size:9px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.club-player-group p{display:flex;flex-wrap:wrap;gap:5px 11px;margin:0}.club-player-group p>span{font-size:12px;font-weight:800}.club-player-group a{color:#111318;text-decoration:none}.club-player-group a:hover{color:var(--club-primary,#b49a60)}
@media(max-width:440px){.club-quarter-grid{grid-template-columns:minmax(82px,1.25fr) repeat(4,minmax(38px,1fr));gap:5px}.club-quarter-grid>span{padding:8px 3px;font-size:11px}}
`