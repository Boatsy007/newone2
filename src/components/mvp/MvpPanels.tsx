import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TeamLogo } from '../rankings/bits'
import type { MvpEntry } from '../../pages/MvpLeaderboard'

function useRows(params: URLSearchParams) {
  const [rows, setRows] = useState<MvpEntry[]>([])
  const [loading, setLoading] = useState(true)
  const key = params.toString()
  useEffect(() => {
    setLoading(true)
    fetch(`/api/mvp?${key}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((p: { data?: MvpEntry[] }) => setRows(Array.isArray(p.data) ? p.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [key])
  return { rows, loading }
}

export function LeagueMvpPanel({ leagueId, leagueName }: { leagueId: string; leagueName: string }) {
  const params = new URLSearchParams({ leagueId, limit: '50' })
  const { rows, loading } = useRows(params)
  return <Panel title="League MVP ladder" eyebrow={leagueName} rows={rows} loading={loading} showClub />
}

export function ClubMvpPanel({ clubId, clubName }: { clubId: string; clubName: string }) {
  const params = new URLSearchParams({ clubId, limit: '20' })
  const { rows, loading } = useRows(params)
  return <Panel title="Club MVP leaders" eyebrow={clubName} rows={rows} loading={loading} showClub={false} />
}

function Panel({ title, eyebrow, rows, loading, showClub }: { title: string; eyebrow: string; rows: MvpEntry[]; loading: boolean; showClub: boolean }) {
  const leader = rows[0]
  return <section className="scope-mvp">
    <header><div><small>{eyebrow}</small><h2>{title}</h2></div><Link to="/mvp">National MVP →</Link></header>
    {leader && <div className="scope-mvp-leader"><span>MVP leader</span><strong>{leader.playerName}</strong><b>{leader.mvpPoints}</b><em>MVP votes</em></div>}
    {loading && <p className="scope-mvp-empty">Loading MVP standings…</p>}
    {!loading && rows.length === 0 && <p className="scope-mvp-empty">MVP votes will appear after the first approved screenshot.</p>}
    <div className="scope-mvp-list">{rows.map(row => <article key={row.id}>
      <b className="scope-mvp-rank">{row.rank}</b>
      <TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={42}/>
      <span><strong>{row.playerId ? <Link to={`/player/${row.playerId}`}>{row.playerName}</Link> : row.playerName}</strong><small>{showClub ? row.clubName : row.leagueName}</small></span>
      <em><b>{row.mvpPoints}</b><small>MVP votes</small></em>
    </article>)}</div>
    <style>{styles}</style>
  </section>
}

const styles = `.scope-mvp{background:#fff;border:1px solid #e0e5ea;border-radius:12px;padding:22px;box-shadow:0 5px 18px rgba(17,24,39,.055);font-family:Barlow,Inter,Arial,sans-serif}.scope-mvp>header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:15px}.scope-mvp header small{color:#0783c9;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.scope-mvp h2{margin:4px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;line-height:.9;text-transform:uppercase}.scope-mvp header>a{color:#159fe9;text-decoration:none;font-size:11px;font-weight:900;text-transform:uppercase}.scope-mvp-leader{display:grid;grid-template-columns:1fr auto;gap:3px 12px;padding:15px 17px;margin-bottom:11px;border-radius:10px;background:#050505;color:#fff}.scope-mvp-leader span{color:#42b8ff;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.scope-mvp-leader strong{grid-column:1;font-family:'Bebas Neue',Impact,sans-serif;font-size:27px;text-transform:uppercase}.scope-mvp-leader>b{grid-column:2;grid-row:1/3;font-family:'Bebas Neue',Impact,sans-serif;font-size:43px;line-height:1;color:#42b8ff}.scope-mvp-leader em{grid-column:2;font-style:normal;text-align:right;color:#aab4bf;font-size:8px;text-transform:uppercase}.scope-mvp-list{display:grid;gap:8px}.scope-mvp-list article{display:grid;grid-template-columns:40px 46px minmax(0,1fr) 82px;gap:10px;align-items:center;padding:10px;border:1px solid #e3e7ec;border-radius:9px}.scope-mvp-rank{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:#edf2f6;font-family:'Bebas Neue',Impact,sans-serif;font-size:21px}.scope-mvp-list span strong,.scope-mvp-list span small{display:block}.scope-mvp-list span strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:21px;text-transform:uppercase}.scope-mvp-list a{color:inherit;text-decoration:none}.scope-mvp-list span small{color:#687385;font-size:11px}.scope-mvp-list>article>em{font-style:normal;text-align:right}.scope-mvp-list>article>em>b{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;line-height:1;color:#159fe9}.scope-mvp-list>article>em>small{font-size:8px;color:#687385;text-transform:uppercase}.scope-mvp-empty{padding:22px;border:1px dashed #cfd7e1;border-radius:9px;color:#687385;text-align:center}@media(max-width:620px){.scope-mvp{padding:16px}.scope-mvp h2{font-size:31px}.scope-mvp-list article{grid-template-columns:36px 42px minmax(0,1fr) 68px;gap:7px}.scope-mvp-list span strong{font-size:18px}}`
