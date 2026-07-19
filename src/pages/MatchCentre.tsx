import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { useSeo } from '../lib/seo'

type MatchRow = {
  id: string; sourceId?: string | null; leagueId?: string | null; leagueName?: string | null; state?: string | null
  season?: string | null; grade?: string | null; round?: number | string | null; matchDate?: string | null; matchTime?: string | null
  venue?: string | null; homeClubId?: string | null; homeClubName?: string | null; homeName?: string | null
  awayClubId?: string | null; awayClubName?: string | null; awayName?: string | null; homeScore?: number | null
  awayScore?: number | null; homePoints?: number | null; awayPoints?: number | null; status?: string | null
  verified?: boolean | null; sourceType?: 'generic' | 'football'
}
type MatchPayload = { data?: MatchRow[] }
type Tab = 'fixtures' | 'results'
type SourceState = { fixtures: boolean; footballFixtures: boolean; results: boolean; footballResults: boolean }
const PAGE_SIZE = 24

async function loadRows(url: string, sourceType: MatchRow['sourceType']): Promise<{ ok: boolean; rows: MatchRow[] }> {
  try {
    const response = await fetch(url)
    if (!response.ok) return { ok: false, rows: [] }
    const payload = await response.json() as MatchPayload
    return { ok: true, rows: (Array.isArray(payload.data) ? payload.data : []).map(row => ({ ...row, sourceType })) }
  } catch { return { ok: false, rows: [] } }
}

export default function MatchCentre() {
  const [params, setParams] = useSearchParams()
  const initialTab = params.get('tab') === 'results' ? 'results' : 'fixtures'
  const [fixtures, setFixtures] = useState<MatchRow[]>([])
  const [results, setResults] = useState<MatchRow[]>([])
  const [sources, setSources] = useState<SourceState>({ fixtures: true, footballFixtures: true, results: true, footballResults: true })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>(initialTab)
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [state, setState] = useState(params.get('state') ?? '')
  const [league, setLeague] = useState(params.get('league') ?? '')
  const [round, setRound] = useState(params.get('round') ?? '')
  const [season, setSeason] = useState(params.get('season') ?? '')
  const [date, setDate] = useState(params.get('date') ?? '')
  const [page, setPage] = useState(1)

  useSeo({ title: 'Match Centre — Fixtures & Results | PlayFooty', description: 'Search upcoming community football fixtures and recent results by club, league, state, season, date and round.', path: `/matches${params.toString() ? `?${params}` : ''}` })

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      loadRows('/api/fixtures', 'generic'), loadRows('/api/fixtures/football?limit=1000', 'football'),
      loadRows('/api/results?limit=1000', 'generic'), loadRows('/api/results/football?limit=1000', 'football'),
    ]).then(([genericFixtures, footballFixtures, genericResults, footballResults]) => {
      if (!active) return
      setSources({ fixtures: genericFixtures.ok, footballFixtures: footballFixtures.ok, results: genericResults.ok, footballResults: footballResults.ok })
      setFixtures(semanticDedupe([...genericFixtures.rows, ...footballFixtures.rows]))
      setResults(semanticDedupe([...genericResults.rows, ...footballResults.rows]))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => { setPage(1) }, [tab, query, state, league, round, season, date])
  useEffect(() => {
    const next = new URLSearchParams()
    if (tab !== 'fixtures') next.set('tab', tab)
    if (query.trim()) next.set('q', query.trim())
    if (state) next.set('state', state)
    if (league) next.set('league', league)
    if (round) next.set('round', round)
    if (season) next.set('season', season)
    if (date) next.set('date', date)
    setParams(next, { replace: true })
  }, [tab, query, state, league, round, season, date, setParams])

  const allRows = useMemo(() => [...fixtures, ...results], [fixtures, results])
  const all = tab === 'fixtures' ? fixtures : results
  const leagueOptions = useMemo(() => uniqueOptions(allRows, 'league'), [allRows])
  const stateOptions = useMemo(() => uniqueOptions(allRows, 'state'), [allRows])
  const seasonOptions = useMemo(() => uniqueOptions(allRows, 'season'), [allRows])
  const roundOptions = useMemo(() => uniqueOptions(all, 'round'), [all])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return all
      .filter(row => tab === 'results' || !row.status || !['COMPLETED', 'CANCELLED'].includes(row.status.toUpperCase()))
      .filter(row => !state || (row.state ?? '').toUpperCase() === state)
      .filter(row => !league || row.leagueId === league)
      .filter(row => !round || normaliseRound(row.round) === normaliseRound(round))
      .filter(row => !season || String(row.season ?? '') === season)
      .filter(row => !date || localDateKey(row.matchDate) === date)
      .filter(row => !needle || [homeName(row), awayName(row), row.leagueName, row.venue, row.grade, String(row.round ?? '')].some(value => (value ?? '').toLowerCase().includes(needle)))
      .sort(tab === 'fixtures' ? sortDateAsc : sortDateDesc)
  }, [all, date, league, query, round, season, state, tab])

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const groups = useMemo(() => groupMatches(visible), [visible])
  const hasMore = visible.length < filtered.length
  const sourceAvailable = tab === 'fixtures' ? sources.fixtures || sources.footballFixtures : sources.results || sources.footballResults
  const partialFailure = tab === 'fixtures' ? !sources.fixtures || !sources.footballFixtures : !sources.results || !sources.footballResults

  const clearFilters = () => { setQuery(''); setState(''); setLeague(''); setRound(''); setSeason(''); setDate('') }

  return <div className="mc-page"><Nav /><main>
    <section className="mc-hero"><div className="mc-shell"><span>PlayFooty match data</span><h1>Match Centre</h1><p>Find fixtures and results by club, league, state, season, date or round. Every match opens its own permanent page.</p></div></section>
    <section className="mc-shell mc-content">
      <div className="mc-tabs" role="tablist"><button className={tab === 'fixtures' ? 'active' : ''} onClick={() => setTab('fixtures')}>Upcoming fixtures</button><button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>Recent results</button></div>
      <div className="mc-filters">
        <label className="mc-search"><span>Search club or league</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. Foster, QAFL or Round 15" /></label>
        <label><span>State</span><select value={state} onChange={event => setState(event.target.value)}><option value="">All states</option>{stateOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>League</span><select value={league} onChange={event => setLeague(event.target.value)}><option value="">All leagues</option>{leagueOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Season</span><select value={season} onChange={event => setSeason(event.target.value)}><option value="">All seasons</option>{seasonOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Round</span><select value={round} onChange={event => setRound(event.target.value)}><option value="">All rounds</option>{roundOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label><span>Date</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        {(query || state || league || round || season || date) && <button className="mc-clear" type="button" onClick={clearFilters}>Clear filters</button>}
      </div>

      <div className="mc-summary"><strong>{filtered.length}</strong><span>{tab === 'fixtures' ? 'fixtures found' : 'results found'}</span>{league && <em>{leagueOptions.find(option => option.value === league)?.label}</em>}</div>
      {!loading && partialFailure && sourceAvailable && <div className="mc-warning">Some match sources are temporarily unavailable. Available verified and imported matches are still shown.</div>}
      {loading && <div className="mc-state">Loading matches…</div>}
      {!loading && !sourceAvailable && <div className="mc-state error"><div><strong>Match data unavailable</strong><span>Neither match source could be loaded. Please try again shortly.</span></div></div>}
      {!loading && sourceAvailable && filtered.length === 0 && <div className="mc-state"><div><strong>No matching {tab}</strong><span>Try another club, league, state, season, date or round.</span></div></div>}
      {!loading && sourceAvailable && groups.map(group => <section className="mc-group" key={group.key}>
        <header><div><span>{group.state ?? 'Australia'}</span><h2>{group.leagueId ? <Link to={`/league/${group.leagueId}`}>{group.leagueName}</Link> : group.leagueName}</h2></div><small>{group.label}</small></header>
        <div className="mc-list">{group.rows.map(row => <MatchCard key={`${row.sourceType}:${row.id}`} row={row} kind={tab === 'fixtures' ? 'fixture' : 'result'} />)}</div>
      </section>)}
      {!loading && hasMore && <button className="mc-more" type="button" onClick={() => setPage(value => value + 1)}>Load more matches</button>}
    </section>
  </main><Footer /><style>{styles}</style></div>
}

function MatchCard({ row, kind }: { row: MatchRow; kind: 'fixture' | 'result' }) {
  const home = homeName(row), away = awayName(row), homeScore = row.homeScore ?? row.homePoints, awayScore = row.awayScore ?? row.awayPoints
  const football = row.sourceType === 'football' || row.id.startsWith('football:')
  const rawId = row.id.startsWith('football:') ? row.id : row.sourceId ?? row.id
  const href = `/match/${kind}/${encodeURIComponent(rawId)}${football && !String(rawId).startsWith('football:') ? '?source=football' : ''}`
  return <article className="mc-card">
    <Link to={href} className="mc-card-main">
      <div className="mc-meta"><span>{formatDate(row.matchDate)}</span><small>{row.grade ?? 'Senior football'}{row.venue ? ` · ${row.venue}` : ''}</small></div>
      <div className="mc-teams"><Team name={home} id={row.homeClubId} /><div className="mc-score">{kind === 'result' ? <><strong>{homeScore ?? '—'}</strong><i>Final</i><strong>{awayScore ?? '—'}</strong></> : <><strong>VS</strong><i>{row.matchTime ?? timeFromDate(row.matchDate) ?? 'Scheduled'}</i></>}</div><Team name={away} id={row.awayClubId} /></div>
      <div className="mc-foot"><span>{row.round != null ? roundLabel(row.round) : 'Round not provided'}{row.verified ? ' · Verified' : ''}</span><b>Open match centre →</b></div>
    </Link>
    <div className="mc-card-links">{row.leagueId && <Link to={`/league/${row.leagueId}`}>League</Link>}{row.homeClubId && <Link to={`/team/${row.homeClubId}`}>{home}</Link>}{row.awayClubId && <Link to={`/team/${row.awayClubId}`}>{away}</Link>}</div>
  </article>
}

function Team({ name, id }: { name: string; id?: string | null }) { const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase(); const content = <><span>{initials || 'FC'}</span><strong>{name}</strong></>; return id ? <span className="mc-team">{content}</span> : <div className="mc-team">{content}</div> }
function homeName(row: MatchRow) { return row.homeClubName ?? row.homeName ?? 'Home team' }
function awayName(row: MatchRow) { return row.awayClubName ?? row.awayName ?? 'Away team' }
function sortDateAsc(a: MatchRow, b: MatchRow) { return dateValue(a.matchDate, true) - dateValue(b.matchDate, true) }
function sortDateDesc(a: MatchRow, b: MatchRow) { return dateValue(b.matchDate, false) - dateValue(a.matchDate, false) }
function dateValue(value?: string | null, futureFallback = false) { const n = value ? Date.parse(value) : (futureFallback ? Number.MAX_SAFE_INTEGER : 0); return Number.isFinite(n) ? n : (futureFallback ? Number.MAX_SAFE_INTEGER : 0) }
function formatDate(value?: string | null) { if (!value) return 'Date to be confirmed'; const d = new Date(value); return Number.isNaN(d.getTime()) ? 'Date to be confirmed' : d.toLocaleDateString('en-AU', { weekday:'short', day:'numeric', month:'short', year:'numeric' }) }
function timeFromDate(value?: string | null) { if (!value || !/[T ]\d{2}:\d{2}/.test(value)) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) }
function localDateKey(value?: string | null) { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return ''; const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}` }
function normalise(value?: string | null) { return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function normaliseRound(value?: string | number | null) { return normalise(String(value ?? '').replace(/^round\s*/i, '')) }
function roundLabel(value: string | number) { const text = String(value); return /^round\b/i.test(text) ? text : `Round ${text}` }
function semanticKey(row: MatchRow) { const dateKey = localDateKey(row.matchDate); return [row.leagueId ?? normalise(row.leagueName), row.season, normaliseRound(row.round), dateKey, normalise(homeName(row)), normalise(awayName(row))].join('|') }
function semanticDedupe(rows: MatchRow[]) {
  const map = new Map<string, MatchRow>()
  rows.forEach(row => {
    const key = semanticKey(row) || `${row.sourceType}:${row.id}`
    const current = map.get(key)
    if (!current || sourceScore(row) > sourceScore(current)) map.set(key, row)
  })
  return Array.from(map.values())
}
function sourceScore(row: MatchRow) { return (row.sourceType === 'football' ? 4 : 0) + (row.verified ? 2 : 0) + (row.leagueId ? 1 : 0) + (row.homeClubId && row.awayClubId ? 1 : 0) }
function uniqueOptions(rows: MatchRow[], kind: 'league' | 'state' | 'round' | 'season') {
  const map = new Map<string, string>()
  rows.forEach(row => {
    if (kind === 'league' && row.leagueId) map.set(row.leagueId, row.leagueName ?? 'Unnamed league')
    if (kind === 'state' && row.state) map.set(row.state.toUpperCase(), row.state.toUpperCase())
    if (kind === 'round' && row.round != null) map.set(String(row.round), roundLabel(row.round))
    if (kind === 'season' && row.season) map.set(String(row.season), String(row.season))
  })
  return Array.from(map, ([value, label]) => ({ value, label })).sort((a,b) => kind === 'round' ? Number(normaliseRound(a.value)) - Number(normaliseRound(b.value)) : kind === 'season' ? b.label.localeCompare(a.label) : a.label.localeCompare(b.label))
}
function groupMatches(rows: MatchRow[]) {
  const groups = new Map<string, { key: string; leagueId?: string | null; leagueName: string; state?: string | null; label: string; rows: MatchRow[] }>()
  rows.forEach(row => {
    const label = row.round != null ? roundLabel(row.round) : formatDate(row.matchDate)
    const key = `${row.leagueId ?? row.leagueName ?? 'community'}:${label}`
    const group = groups.get(key) ?? { key, leagueId: row.leagueId, leagueName: row.leagueName ?? 'Community football', state: row.state, label, rows: [] }
    group.rows.push(row); groups.set(key, group)
  })
  return Array.from(groups.values())
}

const styles = `.mc-page{min-height:100vh;background:#f3f5f7;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.mc-shell{width:min(1180px,calc(100% - 36px));margin:0 auto}.mc-hero{background:#050505;color:#fff;border-bottom:5px solid #2daaf5;padding:54px 0}.mc-hero span{color:#2daaf5;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.16em}.mc-hero h1,.mc-group h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.mc-hero h1{font-size:clamp(4rem,10vw,8rem);line-height:.82;margin:10px 0}.mc-hero p{max-width:760px;color:#c8d0da;font-size:18px;margin:0}.mc-content{padding:28px 0 56px}.mc-tabs{display:flex;gap:8px;margin-bottom:18px}.mc-tabs button{border:1px solid #dce2e8;background:#fff;color:#111318;border-radius:999px;padding:13px 20px;font-weight:950;text-transform:uppercase;cursor:pointer}.mc-tabs button.active{background:#2daaf5;border-color:#2daaf5}.mc-filters{display:grid;grid-template-columns:1.6fr .65fr 1.15fr .7fr .7fr .85fr auto;gap:10px;align-items:end;background:#fff;border:1px solid #dfe5eb;border-radius:14px;padding:16px;margin-bottom:14px}.mc-filters label{display:grid;gap:6px}.mc-filters label>span{font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.12em;color:#687385}.mc-filters input,.mc-filters select{width:100%;box-sizing:border-box;border:1px solid #d9e0e7;border-radius:9px;background:#f8fafc;color:#111318;padding:12px;font:inherit;font-weight:750}.mc-clear{border:0;border-radius:9px;background:#050505;color:#fff;padding:13px 15px;font-weight:900;text-transform:uppercase;cursor:pointer}.mc-summary{display:flex;align-items:baseline;gap:8px;margin:18px 2px}.mc-summary strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:32px}.mc-summary span{font-weight:850;color:#687385}.mc-summary em{margin-left:auto;color:#2daaf5;font-style:normal;font-weight:950;text-transform:uppercase}.mc-warning{border:1px solid #f1cf70;background:#fff8dc;color:#775600;border-radius:10px;padding:12px 14px;font-weight:800;font-size:13px}.mc-group{margin-top:24px}.mc-group>header{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:11px;border-bottom:2px solid #111318;padding-bottom:9px}.mc-group>header span{color:#2daaf5;font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:.14em}.mc-group h2{font-size:clamp(2rem,4vw,3.7rem);line-height:.9;margin:3px 0 0}.mc-group h2 a{color:inherit;text-decoration:none}.mc-group>header small{font-weight:950;text-transform:uppercase}.mc-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mc-card{background:#fff;border:1px solid #dfe5eb;border-radius:12px;box-shadow:0 7px 22px rgba(17,24,39,.06);overflow:hidden}.mc-card-main{display:block;color:#111318;text-decoration:none;padding:20px;transition:background .18s}.mc-card-main:hover{background:#fbfdff}.mc-meta,.mc-foot{display:flex;align-items:center;justify-content:space-between;gap:12px}.mc-meta span{font-weight:950}.mc-meta small{color:#687385;text-align:right}.mc-teams{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px;margin:22px 0}.mc-team{text-align:center;min-width:0}.mc-team span{width:48px;height:48px;border-radius:12px;background:#e8f6ff;color:#087bbf;display:grid;place-items:center;margin:0 auto 8px;font-family:'Bebas Neue',Impact,sans-serif;font-size:20px}.mc-team strong{display:block;font-size:15px;line-height:1.15}.mc-score{display:flex;align-items:center;gap:9px}.mc-score strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:36px;color:#087bbf}.mc-score i{font-style:normal;text-transform:uppercase;font-size:9px;font-weight:950;color:#687385}.mc-foot{border-top:1px solid #e7ebef;padding-top:12px}.mc-foot span{color:#687385;font-size:11px;font-weight:800}.mc-foot b{font-size:10px;text-transform:uppercase}.mc-card-links{display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid #e7ebef;padding:10px 14px;background:#f8fafc}.mc-card-links a{border-radius:999px;background:#e9f6fd;color:#087bbf;text-decoration:none;padding:6px 9px;font-size:9px;font-weight:950;text-transform:uppercase;white-space:nowrap}.mc-state{min-height:280px;display:grid;place-items:center;text-align:center;background:#fff;border:1px solid #dfe5eb;border-radius:12px;color:#687385}.mc-state strong,.mc-state span{display:block}.mc-state strong{color:#111318;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;text-transform:uppercase}.mc-state span{margin-top:8px}.mc-state.error strong{color:#d71920}.mc-more{display:block;margin:26px auto 0;border:0;border-radius:999px;background:#2daaf5;padding:13px 22px;font-weight:950;text-transform:uppercase;cursor:pointer}@media(max-width:980px){.mc-filters{grid-template-columns:repeat(3,minmax(0,1fr))}.mc-search{grid-column:span 2}.mc-clear{min-height:45px}.mc-list{grid-template-columns:1fr}}@media(max-width:620px){.mc-shell{width:min(100% - 24px,1180px)}.mc-hero{padding:38px 0}.mc-tabs{display:grid;grid-template-columns:1fr 1fr}.mc-tabs button{padding:12px 8px;font-size:11px}.mc-filters{grid-template-columns:1fr 1fr;padding:12px}.mc-search{grid-column:1/-1}.mc-clear{grid-column:1/-1}.mc-card-main{padding:15px}.mc-meta{align-items:flex-start}.mc-meta small{max-width:52%}.mc-teams{gap:7px}.mc-team span{width:40px;height:40px}.mc-team strong{font-size:13px}.mc-score strong{font-size:29px}.mc-summary em{display:none}.mc-group>header{align-items:flex-start}.mc-group h2{font-size:2.4rem}.mc-card-links{overflow-x:auto;flex-wrap:nowrap}}`