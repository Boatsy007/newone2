import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { useSeo } from '../lib/seo'

type MatchRow = {
  id: string
  leagueId?: string | null
  leagueName?: string | null
  state?: string | null
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
type Tab = 'fixtures' | 'results'
const PAGE_SIZE = 24

async function loadRows(url: string): Promise<MatchRow[]> {
  try {
    const response = await fetch(url)
    if (!response.ok) return []
    const payload = await response.json() as MatchPayload
    return Array.isArray(payload.data) ? payload.data : []
  } catch {
    return []
  }
}

export default function MatchCentre() {
  const [fixtures, setFixtures] = useState<MatchRow[]>([])
  const [results, setResults] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('fixtures')
  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const [league, setLeague] = useState('')
  const [round, setRound] = useState('')
  const [page, setPage] = useState(1)

  useSeo({ title: 'Match Centre — Fixtures & Results | PlayFooty', description: 'Search upcoming community football fixtures and recent results by club, league, state and round.', path: '/matches' })

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      loadRows('/api/fixtures'),
      loadRows('/api/fixtures/football?limit=1000'),
      loadRows('/api/results?limit=1000'),
      loadRows('/api/results/football?limit=1000'),
    ]).then(([genericFixtures, footballFixtures, genericResults, footballResults]) => {
      if (!active) return
      setFixtures(dedupe([...genericFixtures, ...footballFixtures]))
      setResults(dedupe([...genericResults, ...footballResults]))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => { setPage(1) }, [tab, query, state, league, round])

  const all = tab === 'fixtures' ? fixtures : results
  const leagueOptions = useMemo(() => uniqueOptions([...fixtures, ...results], 'league'), [fixtures, results])
  const stateOptions = useMemo(() => uniqueOptions([...fixtures, ...results], 'state'), [fixtures, results])
  const roundOptions = useMemo(() => uniqueOptions(all, 'round'), [all])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return all
      .filter(row => tab === 'results' || !row.status || !['COMPLETED', 'CANCELLED'].includes(row.status.toUpperCase()))
      .filter(row => !state || (row.state ?? '').toUpperCase() === state)
      .filter(row => !league || row.leagueId === league)
      .filter(row => !round || String(row.round ?? '') === round)
      .filter(row => !needle || [homeName(row), awayName(row), row.leagueName, row.venue, row.grade].some(value => (value ?? '').toLowerCase().includes(needle)))
      .sort(tab === 'fixtures' ? sortDateAsc : sortDateDesc)
  }, [all, league, query, round, state, tab])

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const groups = useMemo(() => groupMatches(visible), [visible])
  const hasMore = visible.length < filtered.length

  return <div className="mc-page"><Nav /><main>
    <section className="mc-hero"><div className="mc-shell"><span>PlayFooty match data</span><h1>Match Centre</h1><p>Find fixtures and results by club, league, state or round. Every match opens its own permanent Match Centre page.</p></div></section>
    <section className="mc-shell mc-content">
      <div className="mc-tabs" role="tablist"><button className={tab === 'fixtures' ? 'active' : ''} onClick={() => setTab('fixtures')}>Upcoming fixtures</button><button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>Recent results</button></div>

      <div className="mc-filters">
        <label className="mc-search"><span>Search club or league</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. Cowwarr, QAFL or Round 15" /></label>
        <label><span>State</span><select value={state} onChange={event => setState(event.target.value)}><option value="">All states</option>{stateOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>League</span><select value={league} onChange={event => setLeague(event.target.value)}><option value="">All leagues</option>{leagueOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Round</span><select value={round} onChange={event => setRound(event.target.value)}><option value="">All rounds</option>{roundOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {(query || state || league || round) && <button className="mc-clear" type="button" onClick={() => { setQuery(''); setState(''); setLeague(''); setRound('') }}>Clear filters</button>}
      </div>

      <div className="mc-summary"><strong>{filtered.length}</strong><span>{tab === 'fixtures' ? 'fixtures found' : 'results found'}</span>{league && <em>{leagueOptions.find(option => option.value === league)?.label}</em>}</div>

      {loading && <div className="mc-state">Loading matches…</div>}
      {!loading && filtered.length === 0 && <div className="mc-state"><div><strong>No matching {tab}</strong><span>Try another club, league, state or round.</span></div></div>}
      {!loading && groups.map(group => <section className="mc-group" key={group.key}>
        <header><div><span>{group.state ?? 'Australia'}</span><h2>{group.leagueName}</h2></div><small>{group.roundLabel}</small></header>
        <div className="mc-list">{group.rows.map(row => <MatchCard key={row.id} row={row} kind={tab === 'fixtures' ? 'fixture' : 'result'} />)}</div>
      </section>)}
      {!loading && hasMore && <button className="mc-more" type="button" onClick={() => setPage(value => value + 1)}>Load more matches</button>}
    </section>
  </main><Footer /><style>{styles}</style></div>
}

function MatchCard({ row, kind }: { row: MatchRow; kind: 'fixture' | 'result' }) {
  const home = homeName(row)
  const away = awayName(row)
  const homeScore = row.homeScore ?? row.homePoints
  const awayScore = row.awayScore ?? row.awayPoints
  return <Link to={`/match/${kind}/${encodeURIComponent(row.id)}`} className="mc-card">
    <div className="mc-meta"><span>{formatDate(row.matchDate)}</span><small>{row.grade ?? 'Senior football'}{row.venue ? ` · ${row.venue}` : ''}</small></div>
    <div className="mc-teams"><Team name={home} /><div className="mc-score">{kind === 'result' ? <><strong>{homeScore ?? '—'}</strong><i>Final</i><strong>{awayScore ?? '—'}</strong></> : <><strong>VS</strong><i>{row.matchTime ?? 'Scheduled'}</i></>}</div><Team name={away} /></div>
    <div className="mc-foot"><span>{row.round != null ? `Round ${row.round}` : 'Round not provided'}</span><b>Open match centre →</b></div>
  </Link>
}

function Team({ name }: { name: string }) { const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase(); return <div className="mc-team"><span>{initials || 'FC'}</span><strong>{name}</strong></div> }
function homeName(row: MatchRow) { return row.homeClubName ?? row.homeName ?? 'Home team' }
function awayName(row: MatchRow) { return row.awayClubName ?? row.awayName ?? 'Away team' }
function sortDateAsc(a: MatchRow, b: MatchRow) { return dateValue(a.matchDate, true) - dateValue(b.matchDate, true) }
function sortDateDesc(a: MatchRow, b: MatchRow) { return dateValue(b.matchDate, false) - dateValue(a.matchDate, false) }
function dateValue(value?: string | null, futureFallback = false) { const n = value ? Date.parse(value) : (futureFallback ? Number.MAX_SAFE_INTEGER : 0); return Number.isFinite(n) ? n : (futureFallback ? Number.MAX_SAFE_INTEGER : 0) }
function formatDate(value?: string | null) { if (!value) return 'Date to be confirmed'; return new Date(value).toLocaleDateString('en-AU', { weekday:'short', day:'numeric', month:'short', year:'numeric' }) }
function dedupe(rows: MatchRow[]) { const seen = new Set<string>(); return rows.filter(row => { const key = `${row.id}:${row.leagueId ?? ''}`; if (seen.has(key)) return false; seen.add(key); return true }) }
function uniqueOptions(rows: MatchRow[], kind: 'league' | 'state' | 'round') {
  const map = new Map<string, string>()
  rows.forEach(row => {
    if (kind === 'league' && row.leagueId) map.set(row.leagueId, row.leagueName ?? 'Unnamed league')
    if (kind === 'state' && row.state) map.set(row.state.toUpperCase(), row.state.toUpperCase())
    if (kind === 'round' && row.round != null) map.set(String(row.round), `Round ${row.round}`)
  })
  return Array.from(map, ([value, label]) => ({ value, label })).sort((a,b) => kind === 'round' ? Number(a.value) - Number(b.value) : a.label.localeCompare(b.label))
}
function groupMatches(rows: MatchRow[]) {
  const groups = new Map<string, { key: string; leagueName: string; state?: string | null; roundLabel: string; rows: MatchRow[] }>()
  rows.forEach(row => {
    const roundLabel = row.round != null ? `Round ${row.round}` : 'Round not provided'
    const key = `${row.leagueId ?? row.leagueName ?? 'community'}:${roundLabel}`
    const group = groups.get(key) ?? { key, leagueName: row.leagueName ?? 'Community football', state: row.state, roundLabel, rows: [] }
    group.rows.push(row)
    groups.set(key, group)
  })
  return Array.from(groups.values())
}

const styles = `.mc-page{min-height:100vh;background:#f3f5f7;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.mc-shell{width:min(1180px,calc(100% - 36px));margin:0 auto}.mc-hero{background:#050505;color:#fff;border-bottom:5px solid #2daaf5;padding:54px 0}.mc-hero span{color:#2daaf5;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.16em}.mc-hero h1,.mc-group h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.mc-hero h1{font-size:clamp(4rem,10vw,8rem);line-height:.82;margin:10px 0}.mc-hero p{max-width:760px;color:#c8d0da;font-size:18px;margin:0}.mc-content{padding:28px 0 56px}.mc-tabs{display:flex;gap:8px;margin-bottom:18px}.mc-tabs button{border:1px solid #dce2e8;background:#fff;color:#111318;border-radius:999px;padding:13px 20px;font-weight:950;text-transform:uppercase;cursor:pointer}.mc-tabs button.active{background:#2daaf5;border-color:#2daaf5}.mc-filters{display:grid;grid-template-columns:1.7fr .7fr 1.2fr .75fr auto;gap:10px;align-items:end;background:#fff;border:1px solid #dfe5eb;border-radius:14px;padding:16px;margin-bottom:14px}.mc-filters label{display:grid;gap:6px}.mc-filters label>span{font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.12em;color:#687385}.mc-filters input,.mc-filters select{width:100%;box-sizing:border-box;border:1px solid #d9e0e7;border-radius:9px;background:#f8fafc;color:#111318;padding:12px;font:inherit;font-weight:750}.mc-clear{border:0;border-radius:9px;background:#050505;color:#fff;padding:13px 15px;font-weight:900;text-transform:uppercase;cursor:pointer}.mc-summary{display:flex;align-items:baseline;gap:8px;margin:18px 2px}.mc-summary strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:32px}.mc-summary span{font-weight:850;color:#687385}.mc-summary em{margin-left:auto;color:#2daaf5;font-style:normal;font-weight:950;text-transform:uppercase}.mc-group{margin-top:24px}.mc-group>header{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:11px;border-bottom:2px solid #111318;padding-bottom:9px}.mc-group>header span{color:#2daaf5;font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.14em}.mc-group h2{font-size:clamp(2rem,4vw,3.7rem);line-height:.9;margin:3px 0 0}.mc-group>header small{font-weight:950;text-transform:uppercase}.mc-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mc-card{display:block;background:#fff;color:#111318;text-decoration:none;border:1px solid #dfe5eb;border-radius:12px;padding:20px;box-shadow:0 7px 22px rgba(17,24,39,.06);transition:transform .18s,box-shadow .18s}.mc-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(17,24,39,.11)}.mc-meta,.mc-foot{display:flex;align-items:center;justify-content:space-between;gap:14px}.mc-meta span{color:#2daaf5;text-transform:uppercase;font-size:11px;font-weight:950}.mc-meta small,.mc-foot span{color:#687385;font-weight:750}.mc-teams{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px;padding:22px 0}.mc-team{display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0}.mc-team>span{width:52px;height:52px;border-radius:12px;background:#edf8ff;color:#050505;display:grid;place-items:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:22px}.mc-team strong{margin-top:10px;line-height:1.1}.mc-score{display:flex;align-items:center;gap:9px}.mc-score strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;color:#050505}.mc-score i{font-style:normal;color:#687385;font-size:10px;font-weight:950;text-transform:uppercase}.mc-foot{border-top:1px solid #e7ebef;padding-top:14px;font-size:12px}.mc-foot b{color:#2daaf5;text-transform:uppercase}.mc-state{min-height:260px;display:grid;place-items:center;background:#fff;border:1px solid #dfe5eb;border-radius:12px;text-align:center}.mc-state strong{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-size:36px;text-transform:uppercase}.mc-state span{display:block;color:#687385;margin-top:6px}.mc-more{display:block;margin:24px auto 0;border:0;border-radius:999px;background:#2daaf5;color:#050505;padding:14px 24px;font-weight:950;text-transform:uppercase;cursor:pointer}@media(max-width:900px){.mc-filters{grid-template-columns:1fr 1fr}.mc-search{grid-column:1/-1}.mc-clear{grid-column:1/-1}.mc-list{grid-template-columns:1fr}}@media(max-width:560px){.mc-shell{width:min(100% - 24px,1180px)}.mc-hero{padding:38px 0}.mc-tabs{overflow-x:auto}.mc-tabs button{white-space:nowrap}.mc-filters{grid-template-columns:1fr}.mc-search,.mc-clear{grid-column:auto}.mc-meta,.mc-foot{align-items:flex-start;flex-direction:column}.mc-teams{gap:8px}.mc-team>span{width:44px;height:44px}.mc-score strong{font-size:31px}.mc-summary em{display:none}}`