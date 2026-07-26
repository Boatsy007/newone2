import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { fetchLeague, leaguePath, teamPath, type ClubProfile, type LeagueDetail } from '../../lib/rankings'
import { TeamLogo } from '../rankings/bits'
import { clubIdentity } from './sections'

type LadderRow = LeagueDetail['ladder'][number]

function normaliseName(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(seniors?|senior men|a grade|football club|fc)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function rowKey(row: LadderRow) {
  return row.clubId || normaliseName(row.clubName)
}

function scoreRow(row: LadderRow) {
  return (Number(row.played) || 0) * 100000
    + (Number(row.points) || 0) * 1000
    + (Number(row.percentage) || 0)
    - (Number(row.position) || 999)
}

function cleanLadder(rows: LadderRow[]) {
  const byClub = new Map<string, LadderRow>()

  for (const row of rows) {
    const key = rowKey(row)
    if (!key) continue
    const current = byClub.get(key)
    if (!current || scoreRow(row) > scoreRow(current)) byClub.set(key, row)
  }

  const cleaned = [...byClub.values()]
  cleaned.sort((a, b) => {
    const aPos = Number(a.position)
    const bPos = Number(b.position)
    if (Number.isFinite(aPos) && aPos > 0 && Number.isFinite(bPos) && bPos > 0 && aPos !== bPos) return aPos - bPos
    if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0)
    if ((b.percentage ?? 0) !== (a.percentage ?? 0)) return (b.percentage ?? 0) - (a.percentage ?? 0)
    return a.clubName.localeCompare(b.clubName)
  })

  return cleaned.map((row, index) => ({ ...row, position: index + 1 }))
}

export default function ConnectedClubLadder({ club }: { club: ClubProfile }) {
  const [league, setLeague] = useState<LeagueDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const identity = clubIdentity(club)

  useEffect(() => {
    if (!club.leagueId) {
      setLeague(null)
      return
    }

    let active = true
    setLoading(true)
    setError(false)
    void fetchLeague(club.leagueId)
      .then(data => { if (active) setLeague(data) })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [club.leagueId])

  const ladder = useMemo(() => cleanLadder(Array.isArray(league?.ladder) ? league!.ladder : []), [league])
  if (!club.leagueId) return null

  const shortName = (league?.shortName || league?.name || club.leagueName || 'League').replace(/\s*-\s*a grade.*/i, '')
  const clubNameKey = normaliseName(club.clubName)
  const hasDraws = ladder.some(row => (row.draws ?? 0) > 0)

  return (
    <section className="connected-club-ladder">
      <div className="connected-club-ladder-head">
        <div>
          <span>{league?.currentSeason || club.season || new Date().getFullYear()}</span>
          <h2>{shortName} <em>Ladder</em></h2>
          <p>Current published ladder for {shortName}.</p>
        </div>
        <Link to={leaguePath(club.leagueId)}>Full league page <ArrowRight size={17} /></Link>
      </div>

      {loading && <div className="connected-club-ladder-state">Loading current ladder…</div>}
      {!loading && error && <div className="connected-club-ladder-state">The current ladder could not be loaded.</div>}
      {!loading && !error && ladder.length === 0 && <div className="connected-club-ladder-state">No published ladder is available yet.</div>}

      {!loading && !error && ladder.length > 0 && (
        <div className="connected-club-ladder-card">
          <div className="connected-club-ladder-grid connected-club-ladder-labels">
            <span>Pos</span><span>Club</span><span>W-L{hasDraws ? '-D' : ''}</span><span>%</span><span>Pts</span>
          </div>
          {ladder.map(row => {
            const isClub = row.clubId === club.clubId || normaliseName(row.clubName) === clubNameKey
            const topFour = (row.position ?? 999) <= 4
            return (
              <Link
                key={rowKey(row)}
                to={teamPath(row.clubId)}
                className={`connected-club-ladder-grid connected-club-ladder-row${isClub ? ' is-club' : ''}${topFour ? ' is-top-four' : ''}`}
                style={isClub ? { '--club-accent': identity.accent, '--club-wash': identity.wash } as React.CSSProperties : undefined}
              >
                <b>{row.position}</b>
                <span className="connected-club-ladder-team"><TeamLogo name={row.clubName} src={row.logoUrl ?? undefined} size={38} /><strong>{row.clubName}</strong>{isClub && <small>This club</small>}</span>
                <strong>{row.wins}-{row.losses}{(row.draws ?? 0) > 0 ? `-${row.draws}` : ''}</strong>
                <span>{row.percentage ? Math.round(row.percentage) : '·'}</span>
                <b>{row.points}</b>
              </Link>
            )
          })}
        </div>
      )}

      <style>{`
        .connected-club-ladder{overflow:hidden;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055);padding:clamp(22px,4vw,34px)}
        .connected-club-ladder-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}.connected-club-ladder-head>div{min-width:0}.connected-club-ladder-head span{display:block;color:#2daaf5;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.connected-club-ladder-head h2{margin:7px 0 8px;color:#111318;font-family:'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif;font-size:clamp(2.2rem,5vw,3.5rem);line-height:.92;text-transform:uppercase}.connected-club-ladder-head h2 em{color:#e32636;font-style:normal}.connected-club-ladder-head p{margin:0;color:#687385;font-size:15px;line-height:1.45}.connected-club-ladder-head>a{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;color:#111318;font-family:'Bebas Neue',Impact,sans-serif;font-size:17px;letter-spacing:.08em;text-decoration:none;text-transform:uppercase}
        .connected-club-ladder-card{overflow:hidden;border:1px solid #dde3e8;border-radius:12px;background:#fff}.connected-club-ladder-grid{display:grid;grid-template-columns:56px minmax(0,1fr) 86px 60px 60px;align-items:center;gap:10px}.connected-club-ladder-labels{padding:13px 20px;border-bottom:3px solid #111318;color:#939aa4;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.connected-club-ladder-labels span:nth-child(n+3){text-align:right}.connected-club-ladder-row{min-height:72px;padding:8px 20px;border-bottom:1px solid #e5e8eb;color:#111318;text-decoration:none;transition:background .15s ease}.connected-club-ladder-row:last-child{border-bottom:0}.connected-club-ladder-row:hover{background:#f7fafc}.connected-club-ladder-row.is-top-four{border-left:4px solid #2daaf5}.connected-club-ladder-row.is-club{border-left:4px solid var(--club-accent);background:var(--club-wash)}.connected-club-ladder-row>b:first-child{font-family:'Bebas Neue',Impact,sans-serif;font-size:28px;color:#9da3aa}.connected-club-ladder-row.is-top-four>b:first-child{color:#0783c9}.connected-club-ladder-row.is-club>b:first-child,.connected-club-ladder-row.is-club>b:last-child{color:var(--club-accent)}.connected-club-ladder-team{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;min-width:0}.connected-club-ladder-team strong{overflow:hidden;font-family:'Bebas Neue',Impact,sans-serif;font-size:19px;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap}.connected-club-ladder-team small{color:var(--club-accent);font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.connected-club-ladder-row>strong,.connected-club-ladder-row>span:not(.connected-club-ladder-team),.connected-club-ladder-row>b:last-child{text-align:right}.connected-club-ladder-row>strong,.connected-club-ladder-row>b:last-child{font-family:'Bebas Neue',Impact,sans-serif;font-size:21px}.connected-club-ladder-row>span:not(.connected-club-ladder-team){font-size:14px;font-weight:800}.connected-club-ladder-state{padding:28px;border:1px dashed #d8dee5;border-radius:12px;background:#f8fafb;color:#687385;text-align:center}
        @media(max-width:700px){.connected-club-ladder{padding:20px 0}.connected-club-ladder-head{align-items:flex-start;padding:0 18px}.connected-club-ladder-head h2{font-size:2.65rem}.connected-club-ladder-head p{font-size:14px}.connected-club-ladder-head>a{font-size:14px}.connected-club-ladder-card{border-left:0;border-right:0;border-radius:0}.connected-club-ladder-grid{grid-template-columns:42px minmax(0,1fr) 64px 48px 46px;gap:6px}.connected-club-ladder-labels{padding:11px 12px}.connected-club-ladder-row{min-height:72px;padding:7px 12px}.connected-club-ladder-team{grid-template-columns:40px minmax(0,1fr);gap:8px}.connected-club-ladder-team small{display:none}.connected-club-ladder-team strong{font-size:17px}.connected-club-ladder-row>strong,.connected-club-ladder-row>b:last-child{font-size:19px}.connected-club-ladder-row>span:not(.connected-club-ladder-team){font-size:12px}}
      `}</style>
    </section>
  )
}
