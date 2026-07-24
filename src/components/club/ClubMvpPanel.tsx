import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Medal } from 'lucide-react'
import { TeamLogo } from '../rankings/bits'
import type { MvpEntry } from '../../pages/MvpLeaderboard'

export default function ClubMvpPanel({ clubId, clubName }: { clubId: string; clubName: string }) {
  const [rows, setRows] = useState<MvpEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch('/api/mvp?limit=500', { signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ data?: MvpEntry[] }> : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(payload => {
        if (controller.signal.aborted) return
        const all = Array.isArray(payload.data) ? payload.data : []
        setRows(all.filter(row => row.clubId === clubId).slice(0, 5))
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setRows([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [clubId])

  return <section className="club-mvp-panel" aria-label={`${clubName} MVP leaders`}>
    <header>
      <div><span>Club award leaders</span><h2>Club MVP</h2></div>
      <Link to="/mvp">View national leaderboard →</Link>
    </header>
    {loading && <div className="club-mvp-empty">Loading club MVP…</div>}
    {!loading && rows.length === 0 && <div className="club-mvp-empty">Club MVP votes will appear after the first approved MVP import.</div>}
    {!loading && rows.length > 0 && <div className="club-mvp-list">
      {rows.map((row, index) => <article key={row.id}>
        <div className={`club-mvp-rank rank-${index + 1}`}>{index < 3 && <Medal size={17} aria-hidden />}<strong>{index + 1}</strong></div>
        <TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={48}/>
        <div className="club-mvp-player">
          <strong>{row.playerId ? <Link to={`/player/${row.playerId}`}>{row.playerName}</Link> : row.playerName}</strong>
          <span>{row.leagueId ? <Link to={`/league/${row.leagueId}`}>{row.leagueName}</Link> : row.leagueName}</span>
        </div>
        <div className="club-mvp-points"><small>MVP votes</small><b>{row.mvpPoints}</b></div>
      </article>)}
    </div>}
    <style>{`
      .club-mvp-panel{overflow:hidden;border:1px solid #dfe5ea;border-radius:14px;background:#fff;padding:24px;box-shadow:0 8px 24px rgba(17,24,39,.06);font-family:Barlow,Inter,Arial,sans-serif}.club-mvp-panel>header{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:16px}.club-mvp-panel>header span{display:block;color:#0783c9;font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.club-mvp-panel h2{margin:5px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;line-height:.95;text-transform:uppercase;color:#111318}.club-mvp-panel>header>a{color:#0783c9;text-decoration:none;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.club-mvp-list{display:grid;gap:9px}.club-mvp-list article{display:grid;grid-template-columns:48px 52px minmax(0,1fr) 88px;align-items:center;gap:12px;border:1px solid #e1e7ec;border-radius:12px;padding:11px;background:#fff}.club-mvp-rank{position:relative;width:42px;height:42px;border-radius:10px;background:#edf2f6;display:grid;place-items:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:23px}.club-mvp-rank svg{position:absolute;opacity:.22}.club-mvp-rank.rank-1{background:#f6d36a}.club-mvp-rank.rank-2{background:#dce3e9}.club-mvp-rank.rank-3{background:#d9a36a}.club-mvp-player{min-width:0}.club-mvp-player strong,.club-mvp-player span{display:block}.club-mvp-player strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:24px;text-transform:uppercase}.club-mvp-player a{color:inherit;text-decoration:none}.club-mvp-player a:hover{color:#0783c9}.club-mvp-player span{margin-top:3px;color:#687385;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.club-mvp-points{text-align:center;background:#42b8ff;border-radius:10px;padding:8px 5px;color:#101318}.club-mvp-points small{display:block;font-size:8px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.club-mvp-points b{display:block;margin-top:3px;font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;line-height:1}.club-mvp-empty{min-height:100px;display:grid;place-items:center;border:1px dashed #bad4e5;border-radius:12px;color:#687385;text-align:center;padding:18px}@media(max-width:620px){.club-mvp-panel{padding:18px}.club-mvp-panel h2{font-size:33px}.club-mvp-panel>header{align-items:start}.club-mvp-panel>header>a{max-width:110px;text-align:right}.club-mvp-list article{grid-template-columns:42px 46px minmax(0,1fr) 72px;gap:8px;padding:10px 8px}.club-mvp-player strong{font-size:20px}.club-mvp-player span{font-size:10px}.club-mvp-points b{font-size:27px}}
    `}</style>
  </section>
}
