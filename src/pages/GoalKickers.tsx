import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { useSeo } from '../lib/seo'

const NAVY = '#062a5f'
const PINK = '#d71920'
const LINE = '#dbe3ee'
const TEXT = '#111827'
const MUTED = '#64748b'

type Mode = 'raw' | 'adjusted'

interface GoalKickerRow {
  id: string
  rank: number
  playerName: string
  clubName: string
  clubId: string | null
  clubLogoUrl: string | null
  leagueName: string
  leagueId: string | null
  season: string
  grade: string | null
  goals: number
  matches: number | null
  leagueStrength: number
  adjustedGoals: number
}

interface GoalKickersResponse { data: GoalKickerRow[]; meta: { total: number; mode: Mode; limit: number } }

async function fetchGoalKickers(mode: Mode): Promise<GoalKickersResponse> {
  const res = await fetch(`/api/goal-kickers?mode=${mode}&limit=100`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<GoalKickersResponse>
}

function ClubLogo({ row, size = 34 }: { row: GoalKickerRow; size?: number }) {
  const initials = row.clubName.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()
  return <span className="gk-club-logo" style={{ width: size, height: size }} aria-hidden="true">
    {row.clubLogoUrl ? <img src={row.clubLogoUrl} alt="" /> : initials}
  </span>
}

export default function GoalKickers() {
  const [mode, setMode] = useState<Mode>('raw')
  const [data, setData] = useState<GoalKickersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useSeo({
    title: 'Country Goal Kicking Ladder | PlayFooty',
    description: 'Australia-wide community football goal kicking ladder with raw goals and strength-adjusted scoring.',
    path: '/goal-kickers',
  })

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetchGoalKickers(mode)
      .then(next => { if (alive) setData(next) })
      .catch(err => { if (alive) setError(String(err)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [mode])

  const rows = data?.data ?? []
  const leader = useMemo(() => rows[0] ?? null, [rows])

  return <div style={{ background: '#fff', minHeight: '100vh', color: TEXT }}>
    <Nav />
    <main className="gk-page">
      <header className="gk-hero">
        <span className="live-pill"><span /> Goal kicking ladder</span>
        <h1>Country Goal Kicking Ladder</h1>
        <p>Track community football&rsquo;s leading goal kickers by raw goals or a simple league-strength adjusted score.</p>
        <div className="mode-toggle" role="group" aria-label="Goal kicking ranking mode">
          <button className={mode === 'raw' ? 'active' : ''} onClick={() => setMode('raw')}>Raw Goals</button>
          <button className={mode === 'adjusted' ? 'active' : ''} onClick={() => setMode('adjusted')}>Strength Adjusted</button>
        </div>
      </header>

      {leader && <section className="leader-card">
        <ClubLogo row={leader} size={54} />
        <div><span>Current leader</span><Link to={`/player/${leader.id}`}>#{leader.rank} {leader.playerName}</Link><small>{leader.clubName} · {leader.leagueName} · {leader.goals} goals</small></div>
      </section>}

      <section className="gk-board" aria-label="Country goal kicking ladder">
        <div className="board-head"><b>{rows.length}</b><span>players shown</span><em>{mode === 'adjusted' ? 'Adjusted score' : 'Raw goals'}</em></div>
        {loading && <div className="empty">Loading goal kickers…</div>}
        {error && !loading && <div className="empty error">Unable to load goal kickers.</div>}
        {!loading && !error && rows.length === 0 && <div className="empty">No goal kickers imported yet.</div>}
        {!loading && !error && rows.length > 0 && <div className="goal-table">
          <div className="goal-row labels"><span>Rank</span><span>Player</span><span>Club</span><span>League</span><span>Goals</span>{mode === 'adjusted' && <span>Adjusted</span>}</div>
          {rows.map(row => <div className="goal-row" key={row.id}>
            <b>#{row.rank}</b>
            <Link className="player-link" to={`/player/${row.id}`}>{row.playerName}</Link>
            <span className="club-cell"><ClubLogo row={row} /><span>{row.clubName}</span></span>
            <span>{row.leagueName}</span>
            <b>{row.goals}</b>
            {mode === 'adjusted' && <b>{row.adjustedGoals.toFixed(1)}</b>}
          </div>)}
        </div>}
      </section>
    </main>
    <Footer />
    <style>{`
      .gk-page{max-width:1180px;margin:0 auto;padding:24px 18px 58px}.gk-hero{border:1px solid ${LINE};border-radius:20px;background:linear-gradient(135deg,#fff,#f7faff);box-shadow:0 14px 34px rgba(6,42,95,.08);padding:28px;margin-bottom:18px}.live-pill{display:inline-flex;align-items:center;gap:7px;border-radius:999px;background:rgba(215,25,32,.12);color:${PINK};padding:6px 9px;font-size:10px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.live-pill span{width:7px;height:7px;border-radius:50%;background:${PINK};box-shadow:0 0 0 5px rgba(215,25,32,.14)}.gk-hero h1{font-size:clamp(3rem,8vw,6.5rem);line-height:.85;margin:14px 0 12px;text-transform:uppercase;letter-spacing:-.075em;color:${NAVY}}.gk-hero p{margin:0;color:#42526a;font-size:17px;max-width:780px}.mode-toggle{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.mode-toggle button{border:1px solid ${LINE};border-radius:999px;background:#fff;color:${NAVY};font-weight:950;padding:11px 16px;cursor:pointer}.mode-toggle button.active{background:${PINK};border-color:${PINK};color:#fff}.leader-card,.gk-board{border:1px solid ${LINE};border-radius:18px;background:#fff;box-shadow:0 14px 34px rgba(6,42,95,.08);overflow:hidden;margin-bottom:18px}.leader-card{padding:20px;display:flex;align-items:center;gap:14px}.leader-card span{display:block;color:${PINK};font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.15em}.leader-card a{display:block;color:${NAVY};font-size:30px;line-height:1;margin-top:8px;font-weight:950;text-decoration:none}.leader-card a:hover,.player-link:hover{color:${PINK}}.leader-card small{display:block;color:${MUTED};font-weight:800;margin-top:8px}.gk-club-logo{border-radius:10px;background:#f4f6fa;border:1px solid ${LINE};display:inline-grid;place-items:center;overflow:hidden;flex:0 0 auto;color:${PINK};font-size:11px;font-weight:950}.gk-club-logo img{width:100%;height:100%;object-fit:contain;padding:3px}.club-cell{display:flex!important;align-items:center;gap:9px;min-width:0}.club-cell>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.board-head{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid ${LINE};background:#f8fafc;color:${MUTED};font-weight:850}.board-head b{font-size:22px;color:${NAVY}}.board-head em{margin-left:auto;color:${PINK};font-style:normal;font-weight:950;text-transform:uppercase;font-size:12px}.goal-table{display:grid}.goal-row{display:grid;grid-template-columns:72px minmax(160px,1.2fr) minmax(170px,1fr) minmax(150px,1fr) 80px 100px;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid #edf1f6}.goal-row:not(:has(span:last-child:nth-child(6))){grid-template-columns:72px minmax(160px,1.2fr) minmax(170px,1fr) minmax(150px,1fr) 80px}.goal-row.labels{background:#fbfdff;color:${MUTED};font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.12em}.goal-row b{color:${NAVY};font-size:18px}.player-link{color:${TEXT};font-size:17px;font-weight:900;text-decoration:none}.goal-row span{color:${MUTED};font-weight:800}.empty{min-height:180px;display:grid;place-items:center;color:${MUTED};font-weight:950;text-transform:uppercase;letter-spacing:.12em;text-align:center}.empty.error{color:${PINK}}@media(max-width:760px){.gk-page{padding:14px 12px 42px}.gk-hero{padding:20px}.gk-hero h1{font-size:3.4rem}.goal-row,.goal-row:not(:has(span:last-child:nth-child(6))){grid-template-columns:52px minmax(0,1fr) 70px;gap:8px}.goal-row.labels span:nth-child(3),.goal-row.labels span:nth-child(4),.goal-row span:nth-child(3),.goal-row span:nth-child(4),.goal-row b:nth-child(6){display:none}.player-link{font-size:16px}.board-head em{display:none}}
    `}</style>
  </div>
}
