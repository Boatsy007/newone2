import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Medal, Trophy } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { TeamLogo } from '../components/rankings/bits'

export type MvpEntry = {
  id: string
  rank: number
  playerId: string | null
  playerName: string
  clubId: string | null
  clubName: string
  clubLogoUrl: string | null
  leagueId: string
  leagueName: string
  state: string | null
  season: string
  grade: string
  bp: number
  gamesPlayed: number | null
  leagueStars: number
  strengthFactor: number
  mvpPoints: number
}

export default function MvpLeaderboard() {
  const [rows, setRows] = useState<MvpEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/mvp?limit=500')
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: MvpEntry[] }) => setRows(Array.isArray(payload.data) ? payload.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  return <><Nav/><main className="mvp-page"><section className="mvp-hero"><div className="mvp-shell"><Link to="/" className="mvp-back"><ArrowLeft size={16}/> Home</Link><span>PlayFooty national award</span><h1>Most Valuable<br/>Player</h1><p>Best-player points adjusted for league strength. Five-star competitions receive full value; lower-strength leagues receive a measured adjustment.</p></div></section><section className="mvp-shell mvp-board"><header><div><small>2026 NATIONAL LEADERBOARD</small><h2>Top MVP contenders</h2></div><div className="mvp-formula">BP × 3 × league factor<br/><b>rounded up</b></div></header>{loading && <div className="mvp-empty">Loading MVP standings…</div>}{!loading && rows.length === 0 && <div className="mvp-empty">MVP data will appear after the first BP screenshot is approved.</div>}{rows.map(row => <article className="mvp-row" key={row.id}><div className={`mvp-rank r${row.rank}`}>{row.rank <= 3 ? <Medal size={20}/> : null}<b>{row.rank}</b></div><TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={58}/><div className="mvp-player"><strong>{row.playerId ? <Link to={`/player/${row.playerId}`}>{row.playerName}</Link> : row.playerName}</strong><span>{row.clubId ? <Link to={`/team/${row.clubId}`}>{row.clubName}</Link> : row.clubName} · <Link to={`/league/${row.leagueId}`}>{row.leagueName}</Link>{row.state ? ` · ${row.state}` : ''}</span></div><div className="mvp-stat"><small>BP</small><b>{row.bp}</b></div><div className="mvp-stat"><small>LEAGUE</small><b>{'★'.repeat(row.leagueStars)}</b></div><div className="mvp-points"><small>MVP POINTS</small><b>{row.mvpPoints}</b></div></article>)}</section></main><Footer/><style>{styles}</style></>
}

const styles = `.mvp-page{background:#eef3f7;min-height:100vh;color:#101318;font-family:Barlow,Inter,Arial,sans-serif}.mvp-shell{width:min(1180px,calc(100% - 32px));margin:0 auto}.mvp-hero{background:#050505;color:#fff;padding:64px 0 74px;border-bottom:5px solid #42b8ff}.mvp-back{display:inline-flex;align-items:center;gap:7px;color:#42b8ff;text-decoration:none;font-weight:900;text-transform:uppercase;font-size:12px}.mvp-hero span{display:block;margin-top:34px;color:#42b8ff;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.mvp-hero h1,.mvp-board h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.mvp-hero h1{font-size:clamp(5rem,12vw,10rem);line-height:.78;margin:12px 0 24px}.mvp-hero p{max-width:760px;color:#cbd3dc;font-size:18px;line-height:1.55}.mvp-board{padding:42px 0 70px}.mvp-board>header{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:18px}.mvp-board header small{color:#148fd2;font-weight:900;letter-spacing:.15em}.mvp-board h2{font-size:clamp(3rem,6vw,5rem);margin:5px 0 0;line-height:.9}.mvp-formula{text-align:right;font-size:13px;color:#657180}.mvp-formula b{color:#111}.mvp-row{display:grid;grid-template-columns:70px 62px minmax(0,1fr) 80px 150px 120px;align-items:center;gap:14px;background:#fff;border:1px solid #dce3eb;border-radius:16px;padding:14px 18px;margin-bottom:10px;box-shadow:0 5px 15px rgba(17,24,39,.04)}.mvp-rank{width:54px;height:54px;border-radius:13px;background:#edf2f6;display:grid;place-items:center;position:relative;font-family:'Bebas Neue',Impact,sans-serif;font-size:27px}.mvp-rank svg{position:absolute;opacity:.22}.mvp-rank.r1{background:#f6d36a}.mvp-rank.r2{background:#dce3e9}.mvp-rank.r3{background:#d9a36a}.mvp-player strong,.mvp-player span{display:block}.mvp-player strong{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:25px}.mvp-player a{color:inherit;text-decoration:none}.mvp-player a:hover{color:#148fd2}.mvp-player span{color:#687385;margin-top:3px}.mvp-stat,.mvp-points{text-align:center}.mvp-stat small,.mvp-points small{display:block;color:#687385;font-size:10px;font-weight:900;letter-spacing:.1em}.mvp-stat b{display:block;margin-top:5px;font-size:20px}.mvp-stat:nth-last-child(2) b{font-size:13px;color:#dfaa17;letter-spacing:1px}.mvp-points{background:#42b8ff;border-radius:12px;padding:10px}.mvp-points b{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-size:34px;line-height:1;margin-top:4px}.mvp-empty{background:#fff;border:1px solid #dce3eb;border-radius:16px;padding:30px;color:#687385;text-align:center}@media(max-width:760px){.mvp-board>header{align-items:start}.mvp-formula{display:none}.mvp-row{grid-template-columns:50px 48px minmax(0,1fr) 75px;padding:12px 10px;gap:9px}.mvp-rank{width:44px;height:44px}.mvp-stat{display:none}.mvp-points{padding:8px 5px}.mvp-points small{font-size:8px}.mvp-points b{font-size:29px}.mvp-player strong{font-size:21px}.mvp-player span{font-size:11px}.mvp-row>div:nth-last-child(1){grid-column:4;grid-row:1}.mvp-hero{padding-top:38px}}`
