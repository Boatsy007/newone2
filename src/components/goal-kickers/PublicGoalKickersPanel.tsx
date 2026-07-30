import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LastMatchDetailPanel from '../club/LastMatchDetailPanel'

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
    const query = new URLSearchParams({ season: String(new Date().getFullYear()), limit: clubId ? '3' : '8' })
    if (leagueId) query.set('leagueId', leagueId)
    if (clubId) query.set('clubId', clubId)
    setLoading(true)
    fetch(`/api/goal-kickers/context?${query}`)
      .then(async response => {
        const payload = await response.json() as { data?: PublicGoalKicker[] }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return Array.isArray(payload.data) ? payload.data : []
      })
      .then(data => { if (active) setRows(clubId ? data.slice(0, 3) : data) })
      .catch(() => { if (active) setRows([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [leagueId, clubId])

  const details = clubId ? <LastMatchDetailPanel clubId={clubId} /> : null
  if (!loading && rows.length === 0) return details

  const clubMode = Boolean(clubId)
  const leader = rows[0]
  const listRows = clubMode ? rows.slice(1) : rows
  const allGoalKickersUrl = clubId ? `/goal-kickers?clubId=${encodeURIComponent(clubId)}` : '/goal-kickers'

  return <>
    {details}
    <section className={`public-gk-panel${clubMode ? ' public-gk-club' : ''}`}>
      <header><div><span>{eyebrow}</span><h2 className={clubMode ? 'public-gk-club-title' : undefined}>{title}</h2></div><Link to={allGoalKickersUrl}>{clubMode ? 'See all →' : 'View full ladder'}</Link></header>
      {loading ? <div className="public-gk-loading">Loading goal kickers…</div> : <>
        {clubMode && leader && <Link className="public-gk-leader" to={leader.playerUrl}>
          <i className="public-gk-leader-rank">1</i>
          <div><span>Goal kicking leader</span><strong>{leader.playerName}</strong></div>
          <div className="public-gk-leader-score"><b>{leader.goals}</b><small>Goals</small>{leader.goalsPerGame != null && <em>{leader.goalsPerGame.toFixed(2)} GPG</em>}</div>
        </Link>}
        <div className="public-gk-list">
          {listRows.map(row => <article key={row.id}>
            <strong className="public-gk-rank">{clubMode ? row.rank : `#${row.rank}`}</strong>
            {clubMode && <span className="public-gk-logo">{row.clubLogoUrl ? <img src={row.clubLogoUrl} alt="" loading="lazy"/> : <b>{row.clubName.slice(0, 2).toUpperCase()}</b>}</span>}
            <Link className="public-gk-player" to={row.playerUrl}>
              <span>{row.playerName}</span>
              <small>{clubMode ? row.leagueName : `${row.clubName}${row.grade ? ` · ${row.grade}` : ''}`}</small>
            </Link>
            <div className="public-gk-numbers"><b>{row.goals}</b><small>goals</small>{row.goalsPerGame != null && <em>{row.goalsPerGame.toFixed(2)} GPG</em>}</div>
            {!clubMode && <div className="public-gk-links">
              {row.clubUrl && <Link to={row.clubUrl}>Club</Link>}
              {row.leagueUrl && !leagueId && <Link to={row.leagueUrl}>League</Link>}
            </div>}
          </article>)}
        </div>
      </>}
      <style>{`
        .public-gk-panel{width:100%;max-width:100%;box-sizing:border-box;overflow:hidden;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055);padding:22px;font-family:Barlow,Inter,Arial,sans-serif}.public-gk-panel>header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:15px}.public-gk-panel>header span{color:#2daaf5;font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.public-gk-panel>header h2{margin:4px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;line-height:.9;text-transform:uppercase}.public-gk-club>header .public-gk-club-title{display:inline-block;margin:4px 0 0!important;font-family:'Bebas Neue',Impact,sans-serif!important;font-size:38px!important;font-weight:400!important;line-height:.9!important;letter-spacing:normal!important;text-transform:uppercase!important;transform:scaleX(.8);transform-origin:left center}.public-gk-panel>header>a{color:#169fe9;font-size:11px;font-weight:950;text-decoration:none;text-transform:uppercase}.public-gk-loading{padding:22px;color:#687385;font-weight:850}.public-gk-list{display:grid}.public-gk-list article{display:grid;grid-template-columns:48px minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:13px 0;border-top:1px solid #e8ecf0}.public-gk-rank{font-family:'Bebas Neue',Impact,sans-serif;font-size:25px;color:#2daaf5}.public-gk-player{text-decoration:none;min-width:0}.public-gk-player span,.public-gk-player small{display:block}.public-gk-player span{color:#111318;font-weight:950}.public-gk-player small{margin-top:3px;color:#687385;font-size:12px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.public-gk-numbers{text-align:right}.public-gk-numbers b,.public-gk-numbers small,.public-gk-numbers em{display:block}.public-gk-numbers b{font-family:'Bebas Neue',Impact,sans-serif;font-size:29px;line-height:.85}.public-gk-numbers small{color:#687385;font-size:8px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.public-gk-numbers em{margin-top:3px;color:#169fe9;font-size:10px;font-style:normal;font-weight:900}.public-gk-links{display:flex;gap:5px}.public-gk-links a{padding:7px 9px;border-radius:999px;background:#eef7fc;color:#167fb8;font-size:9px;font-weight:950;text-decoration:none;text-transform:uppercase}
        .public-gk-club>header span,.public-gk-club>header>a{color:var(--club-primary,#2daaf5)}.public-gk-leader{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:3px 12px;align-items:center;padding:15px 17px;margin-bottom:11px;border-radius:10px;background:#050505;color:#fff;text-decoration:none}.public-gk-leader-rank{grid-row:1/3;display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,.12);color:var(--club-primary,#2daaf5);font-family:'Bebas Neue',Impact,sans-serif;font-size:21px;font-style:normal}.public-gk-leader>div:first-of-type{grid-column:2}.public-gk-leader>div:first-of-type span{display:block;color:var(--club-primary,#2daaf5);font-size:10px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.public-gk-leader>div:first-of-type strong{display:block;margin-top:3px;font-family:'Bebas Neue',Impact,sans-serif;font-size:27px;line-height:1;text-transform:uppercase}.public-gk-leader-score{grid-column:3;grid-row:1/3;display:grid;justify-items:end}.public-gk-leader-score b{grid-row:1/3;font-family:'Bebas Neue',Impact,sans-serif;font-size:43px;line-height:1;color:var(--club-primary,#2daaf5)}.public-gk-leader-score small{color:#aab4bf;font-size:8px;font-weight:900;text-transform:uppercase}.public-gk-leader-score em{color:var(--club-primary,#2daaf5);font-size:9px;font-style:normal;font-weight:900}.public-gk-club .public-gk-list{display:grid;gap:8px}.public-gk-club .public-gk-list article{display:grid;grid-template-columns:40px 46px minmax(0,1fr) 82px;gap:10px;align-items:center;padding:10px;border:1px solid #e3e7ec;border-radius:9px;background:#fff}.public-gk-club .public-gk-rank{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:#edf2f6;color:#111318;font-size:21px}.public-gk-logo{display:grid;place-items:center;width:42px;height:42px}.public-gk-logo img{display:block;width:100%;height:100%;object-fit:contain}.public-gk-logo b{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#eef2f5;color:#111318;font-size:12px}.public-gk-club .public-gk-player span{font-family:'Bebas Neue',Impact,sans-serif;font-size:21px;line-height:1;text-transform:uppercase}.public-gk-club .public-gk-player small{margin-top:3px;font-size:11px;font-weight:500}.public-gk-club .public-gk-numbers{width:82px;text-align:right}.public-gk-club .public-gk-numbers b{font-size:30px;color:var(--club-primary,#2daaf5)}.public-gk-club .public-gk-numbers small{font-size:8px}.public-gk-club .public-gk-numbers em{color:var(--club-primary,#2daaf5)}
        @media(max-width:620px){.public-gk-panel{padding:16px}.public-gk-panel.public-gk-club{padding-left:16px!important;padding-right:16px!important}.public-gk-panel>header{align-items:flex-start}.public-gk-panel>header h2,.public-gk-club>header .public-gk-club-title{font-size:31px!important;transform:none}.public-gk-panel>header>a{max-width:90px;text-align:right}.public-gk-list article{grid-template-columns:38px minmax(0,1fr) auto}.public-gk-links{display:none}.public-gk-player small{white-space:normal}.public-gk-numbers b{font-size:25px}.public-gk-club .public-gk-list article{grid-template-columns:36px 42px minmax(0,1fr) 68px;gap:7px}.public-gk-club .public-gk-rank{width:36px;height:36px;font-size:21px}.public-gk-logo{width:38px;height:38px}.public-gk-club .public-gk-player span{font-size:18px}.public-gk-club .public-gk-player small{font-size:10px}.public-gk-club .public-gk-numbers{width:68px}.public-gk-club .public-gk-numbers b{font-size:27px}.public-gk-leader{grid-template-columns:36px minmax(0,1fr) auto;gap:3px 8px}.public-gk-leader-rank{width:32px;height:32px}}
      `}</style>
    </section>
  </>
}