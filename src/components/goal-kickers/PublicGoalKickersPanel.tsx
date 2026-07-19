import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export type PublicGoalKicker = {
  rank: number
  id: string
  playerId: string
  playerName: string
  clubId: string | null
  clubName: string
  clubLogoUrl: string | null
  leagueId: string | null
  leagueName: string
  season: string
  grade: string | null
  goals: number
  matches: number | null
  goalsPerGame: number | null
  playerUrl: string
  clubUrl: string | null
  leagueUrl: string | null
}

export default function PublicGoalKickersPanel({ leagueId, clubId, title, eyebrow }: {
  leagueId?: string
  clubId?: string
  title: string
  eyebrow: string
}) {
  const [rows, setRows] = useState<PublicGoalKicker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({ season: String(new Date().getFullYear()), limit: '8' })
    if (leagueId) query.set('leagueId', leagueId)
    if (clubId) query.set('clubId', clubId)
    setLoading(true)
    fetch(`/api/goal-kickers/context?${query}`)
      .then(async response => {
        const payload = await response.json() as { data?: PublicGoalKicker[] }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return Array.isArray(payload.data) ? payload.data : []
      })
      .then(data => { if (active) setRows(data) })
      .catch(() => { if (active) setRows([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [leagueId, clubId])

  if (!loading && rows.length === 0) return null

  return <section className="public-gk-panel">
    <header><div><span>{eyebrow}</span><h2>{title}</h2></div><Link to="/goal-kickers">View full ladder</Link></header>
    {loading ? <div className="public-gk-loading">Loading goal kickers…</div> : <div className="public-gk-list">
      {rows.map(row => <article key={row.id}>
        <strong className="public-gk-rank">#{row.rank}</strong>
        <Link className="public-gk-player" to={row.playerUrl}>
          <span>{row.playerName}</span>
          <small>{row.clubName}{clubId ? ` · ${row.leagueName}` : ''}{row.grade ? ` · ${row.grade}` : ''}</small>
        </Link>
        <div className="public-gk-numbers"><b>{row.goals}</b><small>goals</small>{row.goalsPerGame != null && <em>{row.goalsPerGame.toFixed(2)} GPG</em>}</div>
        <div className="public-gk-links">
          {row.clubUrl && !clubId && <Link to={row.clubUrl}>Club</Link>}
          {row.leagueUrl && !leagueId && <Link to={row.leagueUrl}>League</Link>}
        </div>
      </article>)}
    </div>}
    <style>{`
      .public-gk-panel{overflow:hidden;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055);padding:22px}.public-gk-panel>header{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:14px}.public-gk-panel>header span{color:#2daaf5;font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.public-gk-panel>header h2{margin:5px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;line-height:.9;text-transform:uppercase}.public-gk-panel>header>a{color:#169fe9;font-size:11px;font-weight:950;text-decoration:none;text-transform:uppercase}.public-gk-loading{padding:28px 0;color:#687385;font-weight:850}.public-gk-list{display:grid}.public-gk-list article{display:grid;grid-template-columns:48px minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:13px 0;border-top:1px solid #e8ecf0}.public-gk-rank{font-family:'Bebas Neue',Impact,sans-serif;font-size:25px;color:#2daaf5}.public-gk-player{text-decoration:none;min-width:0}.public-gk-player span,.public-gk-player small{display:block}.public-gk-player span{color:#111318;font-weight:950}.public-gk-player small{margin-top:3px;color:#687385;font-size:12px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.public-gk-numbers{text-align:right}.public-gk-numbers b,.public-gk-numbers small,.public-gk-numbers em{display:block}.public-gk-numbers b{font-family:'Bebas Neue',Impact,sans-serif;font-size:29px;line-height:.85}.public-gk-numbers small{color:#687385;font-size:8px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.public-gk-numbers em{margin-top:3px;color:#169fe9;font-size:10px;font-style:normal;font-weight:900}.public-gk-links{display:flex;gap:5px}.public-gk-links a{padding:7px 9px;border-radius:999px;background:#eef7fc;color:#167fb8;font-size:9px;font-weight:950;text-decoration:none;text-transform:uppercase}
      @media(max-width:620px){.public-gk-panel{padding:17px}.public-gk-panel>header{align-items:flex-start}.public-gk-panel>header h2{font-size:32px}.public-gk-list article{grid-template-columns:38px minmax(0,1fr) auto}.public-gk-links{display:none}.public-gk-player small{white-space:normal}.public-gk-numbers b{font-size:25px}}
    `}</style>
  </section>
}
