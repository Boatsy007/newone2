import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ClubProfile } from '../../lib/rankings'
import { TeamLogo } from '../rankings/bits'

type RankingRow = {
  rank: number
  clubId: string
  clubName: string
  logoUrl?: string | null
  leagueId: string
  powerRating: number
}

export default function ClubUploadedLadder({ club }: { club: ClubProfile }) {
  const [rows, setRows] = useState<RankingRow[] | null>(null)

  useEffect(() => {
    let active = true
    setRows(null)
    void fetch('/api/rankings')
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: RankingRow[] }) => {
        if (!active) return
        const leagueRows = Array.isArray(payload.data)
          ? payload.data
              .filter(row => row.leagueId === club.leagueId)
              .sort((a, b) => a.rank - b.rank)
          : []
        setRows(leagueRows)
      })
      .catch(() => { if (active) setRows([]) })
    return () => { active = false }
  }, [club.leagueId])

  if (!club.leagueId || rows?.length === 0) return null

  const leagueName = club.leagueName?.replace(/\s*-\s*a grade.*/i, '') ?? 'League'

  return <section className="club-uploaded-ladder">
    <header>
      <div><small>{club.season ?? new Date().getFullYear()}</small><h2>{leagueName} ladder</h2></div>
      <Link to={`/league/${encodeURIComponent(club.leagueId)}`}>See full ladder →</Link>
    </header>
    <div className="club-uploaded-ladder-head"><span>Pos</span><span>Club</span><span>Nat rank</span><span>Rating</span></div>
    <div className="club-uploaded-ladder-list">
      {rows == null
        ? <div className="club-uploaded-ladder-loading">Loading current rankings…</div>
        : rows.map((row, index) => <Link key={row.clubId} to={`/team/${encodeURIComponent(row.clubId)}`} className={row.clubId === club.clubId ? 'is-current' : ''}>
            <b className="club-uploaded-ladder-rank">{index + 1}</b>
            <span className="club-uploaded-ladder-club"><TeamLogo name={row.clubName} src={row.logoUrl ?? undefined} size={42}/><strong>{row.clubName}</strong></span>
            <span className="club-uploaded-ladder-national">#{row.rank}</span>
            <b className="club-uploaded-ladder-rating">{Number(row.powerRating).toFixed(1)}</b>
          </Link>)}
    </div>
    <style>{styles}</style>
  </section>
}

const styles = `
.club-uploaded-ladder.club-uploaded-ladder{width:100%;max-width:100%;box-sizing:border-box;background:#fff;border:1px solid #e0e5ea;border-radius:12px;padding:22px!important;box-shadow:0 5px 18px rgba(17,24,39,.055);font-family:Barlow,Inter,Arial,sans-serif;overflow:hidden}
.club-uploaded-ladder>header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:15px}.club-uploaded-ladder header small{display:block;color:var(--club-primary,#2daaf5);font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.club-uploaded-ladder h2{margin:4px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;line-height:.9;text-transform:uppercase}.club-uploaded-ladder header>a{color:var(--club-primary,#159fe9);text-decoration:none;font-size:11px;font-weight:900;text-transform:uppercase;text-align:right}
.club-uploaded-ladder-head,.club-uploaded-ladder-list>a{display:grid;grid-template-columns:40px minmax(0,1fr) 74px 62px;gap:10px;align-items:center}.club-uploaded-ladder-head{padding:9px 10px;border-bottom:2px solid #111318;color:#929ba8;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.club-uploaded-ladder-head span:nth-child(n+3){text-align:right}
.club-uploaded-ladder-list{display:grid;gap:8px;margin-top:8px}.club-uploaded-ladder-list>a{min-height:64px;padding:10px;border:1px solid #e3e7ec;border-radius:9px;color:#111318;text-decoration:none;background:#fff}.club-uploaded-ladder-list>a.is-current{border-color:var(--club-primary,#2daaf5);background:#f8fafb}
.club-uploaded-ladder-rank{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:#edf2f6;font-family:'Bebas Neue',Impact,sans-serif;font-size:21px;color:#111318}.club-uploaded-ladder-list>a.is-current .club-uploaded-ladder-rank,.club-uploaded-ladder-list>a.is-current .club-uploaded-ladder-rating{color:var(--club-primary,#159fe9)}
.club-uploaded-ladder-club{display:flex;align-items:center;gap:10px;min-width:0}.club-uploaded-ladder-club strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Bebas Neue',Impact,sans-serif;font-size:21px;text-transform:uppercase}.club-uploaded-ladder-national,.club-uploaded-ladder-rating{text-align:right}.club-uploaded-ladder-national{font-family:'Bebas Neue',Impact,sans-serif;font-size:18px}.club-uploaded-ladder-rating{font-family:'Bebas Neue',Impact,sans-serif;font-size:25px}.club-uploaded-ladder-loading{padding:22px 10px;color:#687385;font-size:13px;font-weight:700}
@media(max-width:620px){.club-uploaded-ladder.club-uploaded-ladder{padding:16px!important}.club-uploaded-ladder h2{font-size:31px}.club-uploaded-ladder header>a{max-width:105px}.club-uploaded-ladder-head,.club-uploaded-ladder-list>a{grid-template-columns:36px minmax(0,1fr) 56px 48px;gap:7px}.club-uploaded-ladder-club strong{font-size:18px}.club-uploaded-ladder-national{font-size:16px}.club-uploaded-ladder-rating{font-size:22px}}
`