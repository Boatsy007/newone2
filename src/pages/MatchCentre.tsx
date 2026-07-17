import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { useSeo } from '../lib/seo'

type MatchRow = {
  id: string
  leagueId?: string | null
  leagueName?: string | null
  season?: string | null
  grade?: string | null
  round?: number | string | null
  matchDate?: string | null
  matchTime?: string | null
  venue?: string | null
  homeClubId?: string | null
  homeClubName?: string | null
  homeName?: string | null
  awayClubId?: string | null
  awayClubName?: string | null
  awayName?: string | null
  homeScore?: number | null
  awayScore?: number | null
  homePoints?: number | null
  awayPoints?: number | null
  status?: string | null
}

type MatchPayload = { data?: MatchRow[] }

export default function MatchCentre() {
  const [fixtures, setFixtures] = useState<MatchRow[]>([])
  const [results, setResults] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'fixtures' | 'results'>('fixtures')

  useSeo({ title: 'Match Centre — Fixtures & Results | PlayFooty', description: 'Upcoming community football fixtures and recent results from leagues across Australia.', path: '/matches' })

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      fetch('/api/fixtures').then(async r => { if (!r.ok) throw new Error('Fixtures unavailable'); return r.json() as Promise<MatchPayload> }),
      fetch('/api/results?limit=200').then(async r => { if (!r.ok) throw new Error('Results unavailable'); return r.json() as Promise<MatchPayload> }),
    ]).then(([fixturePayload, resultPayload]) => {
      if (!active) return
      setFixtures(Array.isArray(fixturePayload.data) ? fixturePayload.data : [])
      setResults(Array.isArray(resultPayload.data) ? resultPayload.data : [])
    }).catch((reason: Error) => { if (active) setError(reason.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const upcoming = useMemo(() => [...fixtures].filter(row => !row.status || !['COMPLETED', 'CANCELLED'].includes(row.status.toUpperCase())).sort(sortDateAsc).slice(0, 60), [fixtures])
  const recent = useMemo(() => [...results].sort(sortDateDesc).slice(0, 60), [results])
  const rows = tab === 'fixtures' ? upcoming : recent

  return <div className="mc-page"><Nav /><main>
    <section className="mc-hero"><div className="mc-shell"><span>PlayFooty live data</span><h1>Match Centre</h1><p>Upcoming fixtures, recent results and individual match pages from community football around Australia.</p></div></section>
    <section className="mc-shell mc-content">
      <div className="mc-tabs" role="tablist"><button className={tab === 'fixtures' ? 'active' : ''} onClick={() => setTab('fixtures')}>Upcoming fixtures</button><button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>Recent results</button></div>
      {loading && <div className="mc-state">Loading matches…</div>}
      {!loading && error && <div className="mc-state error">{error}</div>}
      {!loading && !error && rows.length === 0 && <div className="mc-state">No {tab} are available yet.</div>}
      {!loading && !error && rows.length > 0 && <div className="mc-list">{rows.map(row => <MatchCard key={row.id} row={row} kind={tab === 'fixtures' ? 'fixture' : 'result'} />)}</div>}
    </section>
  </main><Footer /><style>{styles}</style></div>
}

function MatchCard({ row, kind }: { row: MatchRow; kind: 'fixture' | 'result' }) {
  const home = row.homeClubName ?? row.homeName ?? 'Home team'
  const away = row.awayClubName ?? row.awayName ?? 'Away team'
  const homeScore = row.homeScore ?? row.homePoints
  const awayScore = row.awayScore ?? row.awayPoints
  return <Link to={`/match/${kind}/${row.id}`} className="mc-card">
    <div className="mc-meta"><span>{row.leagueName ?? 'Community football'}</span><small>{formatDate(row.matchDate)}{row.round != null ? ` · Round ${row.round}` : ''}</small></div>
    <div className="mc-teams"><Team name={home} /><div className="mc-score">{kind === 'result' ? <><strong>{homeScore ?? '—'}</strong><i>Final</i><strong>{awayScore ?? '—'}</strong></> : <><strong>VS</strong><i>{row.matchTime ?? row.status ?? 'Scheduled'}</i></>}</div><Team name={away} /></div>
    <div className="mc-foot"><span>{row.venue ?? 'Venue to be confirmed'}</span><b>Open match centre →</b></div>
  </Link>
}

function Team({ name }: { name: string }) { const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase(); return <div className="mc-team"><span>{initials || 'FC'}</span><strong>{name}</strong></div> }
function sortDateAsc(a: MatchRow, b: MatchRow) { return dateValue(a.matchDate) - dateValue(b.matchDate) }
function sortDateDesc(a: MatchRow, b: MatchRow) { return dateValue(b.matchDate) - dateValue(a.matchDate) }
function dateValue(value?: string | null) { const n = value ? Date.parse(value) : Number.MAX_SAFE_INTEGER; return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER }
function formatDate(value?: string | null) { if (!value) return 'Date to be confirmed'; return new Date(value).toLocaleDateString('en-AU', { weekday:'short', day:'numeric', month:'short', year:'numeric' }) }

const styles = `.mc-page{min-height:100vh;background:#f3f5f7;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.mc-shell{width:min(1180px,calc(100% - 36px));margin:0 auto}.mc-hero{background:#050505;color:#fff;border-bottom:5px solid #2daaf5;padding:54px 0}.mc-hero span{color:#2daaf5;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.16em}.mc-hero h1{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(4rem,10vw,8rem);line-height:.82;margin:10px 0}.mc-hero p{max-width:720px;color:#c8d0da;font-size:18px;margin:0}.mc-content{padding:28px 0 56px}.mc-tabs{display:flex;gap:8px;margin-bottom:18px}.mc-tabs button{border:1px solid #dce2e8;background:#fff;color:#111318;border-radius:999px;padding:12px 18px;font-weight:950;text-transform:uppercase;cursor:pointer}.mc-tabs button.active{background:#2daaf5;border-color:#2daaf5}.mc-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mc-card{display:block;background:#fff;color:#111318;text-decoration:none;border:1px solid #dfe5eb;border-radius:12px;padding:20px;box-shadow:0 7px 22px rgba(17,24,39,.06);transition:transform .18s,box-shadow .18s}.mc-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(17,24,39,.11)}.mc-meta,.mc-foot{display:flex;align-items:center;justify-content:space-between;gap:14px}.mc-meta span{color:#2daaf5;text-transform:uppercase;font-size:11px;font-weight:950}.mc-meta small,.mc-foot span{color:#687385;font-weight:750}.mc-teams{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px;padding:22px 0}.mc-team{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0}.mc-team>span{width:52px;height:52px;border-radius:12px;background:#edf8ff;color:#050505;display:grid;place-items:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:22px}.mc-team strong{margin-top:10px;line-height:1.1}.mc-score{display:flex;align-items:center;gap:9px}.mc-score strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;color:#050505}.mc-score i{font-style:normal;color:#687385;font-size:10px;font-weight:950;text-transform:uppercase}.mc-foot{border-top:1px solid #e7ebef;padding-top:14px;font-size:12px}.mc-foot b{color:#2daaf5;text-transform:uppercase}.mc-state{min-height:260px;display:grid;place-items:center;background:#fff;border:1px solid #dfe5eb;border-radius:12px;font-weight:950;text-transform:uppercase;letter-spacing:.1em}.mc-state.error{color:#d71920}@media(max-width:760px){.mc-shell{width:min(100% - 24px,1180px)}.mc-hero{padding:38px 0}.mc-list{grid-template-columns:1fr}.mc-tabs{overflow-x:auto}.mc-tabs button{white-space:nowrap}.mc-meta,.mc-foot{align-items:flex-start;flex-direction:column}.mc-teams{gap:8px}.mc-team>span{width:44px;height:44px}.mc-score strong{font-size:31px}}`