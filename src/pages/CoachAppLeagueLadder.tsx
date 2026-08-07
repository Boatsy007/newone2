import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import ConnectedClubLadder from '../components/club/ConnectedClubLadder'
import { fetchClub, type ClubProfile } from '../lib/rankings'

type Props = { clubId: string; onExit: () => void }

export default function CoachAppLeagueLadder({ clubId, onExit }: Props) {
  const [club, setClub] = useState<ClubProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setClub(await fetchClub(clubId))
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load the league ladder')
      setClub(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [clubId])

  return <section className="coach-ladder-page"><style>{styles}</style>
    <header>
      <div><span>Coach Tools</span><h1>League Ladder</h1><p>The same current published ladder used on the original PlayFooty club and league pages.</p></div>
      <button onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'spin' : ''}/>Refresh</button>
    </header>
    {loading && !club ? <div className="coach-ladder-state"><RefreshCw className="spin"/><b>Loading current ladder…</b></div> : null}
    {!loading && error ? <div className="coach-ladder-state error"><b>{error}</b><button onClick={() => void load()}>Try again</button></div> : null}
    {!loading && club && !club.leagueId ? <div className="coach-ladder-state"><b>No league is connected to this club.</b><span>Connect the club to its league on the original website to display its ladder here.</span></div> : null}
    {club?.leagueId ? <ConnectedClubLadder club={club}/> : null}
    <footer><button onClick={onExit}>Back to Coach Dashboard</button></footer>
  </section>
}

const styles = `
.coach-ladder-page,.coach-ladder-page *{box-sizing:border-box}.coach-ladder-page{min-height:calc(100vh - 78px);padding:18px 20px 92px;background:#eef3f7;color:#111820;font-family:Barlow,Inter,Arial,sans-serif}.coach-ladder-page>*{max-width:1180px;margin-left:auto;margin-right:auto}.coach-ladder-page>header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;padding:22px;border-radius:18px;background:#07121b;color:#fff}.coach-ladder-page>header span{color:#39b8ff;font-size:10px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.coach-ladder-page>header h1{margin:4px 0 2px;font:52px/.9 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.coach-ladder-page>header p{margin:8px 0 0;color:#afbec8}.coach-ladder-page>header button{display:flex;align-items:center;gap:7px;border:1px solid #29404f;border-radius:11px;background:#102532;padding:11px 14px;color:#fff;font-weight:900}.coach-ladder-page>header svg{width:17px}.coach-ladder-state{display:grid;justify-items:center;gap:9px;padding:48px;border:1px solid #d5e0e7;border-radius:14px;background:#fff;color:#657681;text-align:center}.coach-ladder-state svg{width:34px;height:34px;color:#159cdc}.coach-ladder-state span{max-width:560px}.coach-ladder-state button{border:0;border-radius:10px;background:#102532;padding:11px 15px;color:#fff;font-weight:900}.coach-ladder-state.error{color:#9f1f2d}.coach-ladder-page>footer{position:fixed;z-index:1200;right:0;bottom:0;left:0;display:flex;justify-content:flex-end;padding:10px max(18px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));border-top:1px solid #cad7df;background:rgba(255,255,255,.96)}.coach-ladder-page>footer button{min-height:43px;border:1px solid #cad7df;border-radius:10px;background:#fff;padding:0 15px;color:#111820;font-weight:950}.spin{animation:coach-ladder-spin 1s linear infinite}@keyframes coach-ladder-spin{to{transform:rotate(360deg)}}@media(max-width:700px){.coach-ladder-page{padding:12px 10px 88px}.coach-ladder-page>header{align-items:flex-start}.coach-ladder-page>header h1{font-size:40px}.coach-ladder-page>header p{font-size:13px}}
`
