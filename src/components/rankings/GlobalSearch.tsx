import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, FileText, Search, Trophy, Video, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchUnifiedSearch, strengthStars, type SearchResponse, type SearchResults } from '../../lib/rankings'
import { StarStrength, TeamLogo } from './bits'

const BLUE = '#2daaf5'
const BLACK = '#050505'
const TEXT = '#111318'
const MUTED = '#687385'
const LINE = '#e3e7ec'

export interface SearchController { isOpen: boolean; open: () => void; close: () => void; toggle: () => void }

export function useSearchController(): SearchController {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(value => !value), [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); toggle() }
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, close])
  return { isOpen, open, close, toggle }
}

const EMPTY: SearchResults = { clubs: [], leagues: [], players: [], matches: [], news: [], highlights: [], records: [] }
const destinations = [
  { label: 'National rankings', description: 'Australia’s ranked community football clubs', path: '/rankings' },
  { label: 'Goal kickers', description: 'Player goal-kicking leaders and statistics', path: '/goal-kickers' },
  { label: 'Leagues & ladders', description: 'Find competitions, clubs and ladder positions', path: '/leagues' },
  { label: 'Match Centre', description: 'Upcoming fixtures and completed results', path: '/matches' },
  { label: 'Football records', description: 'Weekly and season records', path: '/records' },
  { label: 'Latest news', description: 'Community football stories and analysis', path: '/news' },
  { label: 'Weekly highlights', description: 'Goal, mark, play and performance awards', path: '/highlights' },
]

export default function GlobalSearch({ controller }: { controller: SearchController }) {
  const { isOpen, close } = controller
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<SearchResponse>({ data: EMPTY, meta: { query: '', total: 0, partial: [] } })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const active = query.trim().length >= 2
  const data = response.data
  const hasResults = response.meta.total > 0
  const pages = useMemo(() => {
    const q = query.trim().toLowerCase()
    return active ? destinations.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(q)) : destinations
  }, [active, query])

  const go = useCallback((path: string) => { close(); setQuery(''); navigate(path) }, [close, navigate])

  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => { document.body.style.overflow = previous }
  }, [isOpen])

  useEffect(() => {
    if (!active) { setResponse({ data: EMPTY, meta: { query: '', total: 0, partial: [] } }); setLoading(false); setError(''); return }
    let alive = true
    setLoading(true); setError('')
    const timer = window.setTimeout(() => {
      fetchUnifiedSearch(query.trim())
        .then(next => { if (alive) setResponse(next) })
        .catch(() => { if (alive) { setResponse({ data: EMPTY, meta: { query: query.trim(), total: 0, partial: ['all'] } }); setError('Search is temporarily unavailable.') } })
        .finally(() => { if (alive) setLoading(false) })
    }, 220)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [query, active])

  const keyboard = (event: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return
    const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('.pf-search-result,.pf-search-shortcuts button') ?? [])
    if (!buttons.length) return
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Enter' && index >= 0) { event.preventDefault(); buttons[index].click(); return }
    event.preventDefault()
    const next = event.key === 'ArrowUp' ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length
    buttons[next].focus()
  }

  if (!isOpen) return null
  return <div className="pf-global-search" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <section ref={dialogRef} className="pf-search-dialog" role="dialog" aria-modal="true" aria-label="Search PlayFooty" onKeyDown={keyboard}>
      <header className="pf-search-header"><div><span>Universal search</span><h2>Find anything in PlayFooty</h2><p>Search real clubs, leagues, players, matches, news, highlights and records.</p></div><button type="button" onClick={close} aria-label="Close search"><X size={22}/></button></header>
      <label className="pf-search-field"><Search size={23}/><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a club, league, player, match or story" autoComplete="off"/><kbd>ESC</kbd></label>
      <div className="pf-search-content">
        {!active && <SearchStart pages={pages} go={go}/>} 
        {active && loading && <div className="pf-search-status">Searching PlayFooty…</div>}
        {active && !loading && error && <div className="pf-search-status"><strong>Search unavailable</strong><span>{error}</span></div>}
        {active && !loading && !error && response.meta.partial.length > 0 && <div className="pf-search-warning">Some search sources are temporarily unavailable. Results from the remaining sources are shown.</div>}
        {active && !loading && !error && !hasResults && pages.length === 0 && <NoResults query={query}/>} 

        {active && data.clubs.length > 0 && <ResultGroup title="Clubs"><>{data.clubs.map(club => <Result key={club.id} onClick={() => go(club.href)} icon={<TeamLogo name={club.name} src={club.logoUrl ?? undefined} size={46}/>} title={club.name} detail={[club.leagueName, club.state].filter(Boolean).join(' · ')} metric={club.rank ? `#${club.rank}` : undefined}/>)}</></ResultGroup>}
        {active && data.players.length > 0 && <ResultGroup title="Players & goal kickers"><>{data.players.map(player => <Result key={player.id} onClick={() => go(player.href)} icon={<TeamLogo name={player.clubName} src={player.logoUrl ?? undefined} size={46}/>} title={player.name} detail={`${player.clubName} · ${player.leagueName}`} metric={`${player.goals} goals`}/>)}</></ResultGroup>}
        {active && data.leagues.length > 0 && <ResultGroup title="Leagues"><>{data.leagues.map(league => <Result key={league.id} onClick={() => go(league.href)} icon={<span className="pf-league-mark">{league.state}</span>} title={league.name} detail={`${league.state} · League profile and ladder`} metric={<StarStrength stars={strengthStars(league.strengthScore)} size={10}/>}/>)}</></ResultGroup>}
        {active && data.matches.length > 0 && <ResultGroup title="Matches"><>{data.matches.map(match => <Result key={`${match.kind}-${match.id}`} onClick={() => go(match.href)} icon={<span className="pf-page-icon"><CalendarDays size={20}/></span>} title={match.title} detail={`${match.leagueName}${match.round ? ` · ${match.round}` : ''}${match.date ? ` · ${dateLabel(match.date)}` : ''}`} metric={match.kind === 'result' ? 'Final' : 'Fixture'}/>)}</></ResultGroup>}
        {active && data.news.length > 0 && <ResultGroup title="News"><>{data.news.map(article => <Result key={article.id} onClick={() => go(article.href)} icon={<span className="pf-page-icon"><FileText size={20}/></span>} title={article.title} detail={article.summary} metric={article.category}/>)}</></ResultGroup>}
        {active && data.highlights.length > 0 && <ResultGroup title="Highlights"><>{data.highlights.map(highlight => <Result key={highlight.id} onClick={() => go(highlight.href)} icon={<span className="pf-page-icon"><Video size={20}/></span>} title={highlight.title} detail={`${highlight.clubName}${highlight.leagueName ? ` · ${highlight.leagueName}` : ''}`} metric={highlight.winner ? 'Winner' : highlight.weekKey}/>)}</></ResultGroup>}
        {active && data.records.length > 0 && <ResultGroup title="Records"><>{data.records.map(record => <Result key={record.id} onClick={() => go(record.href)} icon={<span className="pf-page-icon"><Trophy size={20}/></span>} title={record.title} detail={record.summary}/>)}</></ResultGroup>}
        {active && pages.length > 0 && <ResultGroup title="PlayFooty sections"><>{pages.map(page => <Result key={page.path} onClick={() => go(page.path)} icon={<span className="pf-page-icon"><Trophy size={20}/></span>} title={page.label} detail={page.description} metric={<ArrowRight size={18}/>}/>)}</></ResultGroup>}
      </div>
    </section>
    <SearchStyles/>
  </div>
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) { return <section className="pf-search-group"><h3>{title}</h3><div>{children}</div></section> }
function Result({ onClick, icon, title, detail, metric }: { onClick: () => void; icon: React.ReactNode; title: string; detail: string; metric?: React.ReactNode }) { return <button type="button" className="pf-search-result" onClick={onClick}>{icon}<span><strong>{title}</strong><small>{detail}</small></span>{metric && <em>{metric}</em>}</button> }
function SearchStart({ pages, go }: { pages: typeof destinations; go: (path: string) => void }) { return <div className="pf-search-start"><div><span className="pf-search-eyebrow">Popular destinations</span><div className="pf-search-shortcuts">{pages.map(page => <button type="button" key={page.path} onClick={() => go(page.path)}><strong>{page.label}</strong><small>{page.description}</small><ArrowRight size={16}/></button>)}</div></div><div className="pf-search-help"><span className="pf-search-eyebrow">Keyboard</span><p>Use ↑ and ↓ to move through results, Enter to open, Esc to close, or Ctrl/⌘ + K anywhere on the site.</p></div></div> }
function NoResults({ query }: { query: string }) { return <div className="pf-search-status"><strong>No matches for “{query.trim()}”</strong><span>This zero-result search has been logged anonymously so the index can be improved.</span></div> }
function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) }

function SearchStyles() { return <style>{`
.pf-global-search{position:fixed;inset:0;z-index:140;display:flex;justify-content:center;align-items:flex-start;padding:6vh 18px;background:rgba(5,5,5,.72);backdrop-filter:blur(8px)}
.pf-search-dialog{width:min(1040px,100%);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:#fff;box-shadow:0 36px 100px rgba(0,0,0,.38);font-family:Barlow,Inter,Arial,sans-serif}
.pf-search-header{display:flex;justify-content:space-between;gap:24px;padding:25px 27px 21px;background:${BLACK};color:#fff}.pf-search-header>div>span,.pf-search-eyebrow{display:block;color:${BLUE};font-size:10px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}.pf-search-header h2{margin:7px 0 5px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.4rem,5vw,4.6rem);line-height:.9;text-transform:uppercase}.pf-search-header p{margin:0;color:#c9d0d8;font-size:14px}.pf-search-header>button{align-self:flex-start;display:grid;place-items:center;width:42px;height:42px;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:transparent;color:#fff;cursor:pointer}
.pf-search-field{display:flex;align-items:center;gap:12px;margin:18px 20px 14px;padding:0 16px;border:2px solid ${BLACK};border-radius:8px;background:#fff}.pf-search-field svg{color:${BLUE}}.pf-search-field input{flex:1;min-width:0;padding:17px 0;border:0;outline:0;background:transparent;color:${TEXT};font-size:18px}.pf-search-field kbd{padding:4px 7px;border:1px solid ${LINE};border-radius:5px;color:${MUTED};font-size:10px;font-weight:800}
.pf-search-content{overflow:auto;padding:0 20px 20px}.pf-search-warning{margin:4px 0 12px;padding:11px 13px;border:1px solid #f2c96d;border-radius:8px;background:#fff9e8;color:#76520a;font-size:12px;font-weight:800}.pf-search-group{margin-top:13px}.pf-search-group h3{position:sticky;top:0;z-index:2;margin:0 0 9px;padding:10px 12px;background:${BLACK};color:#fff;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.pf-search-group>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.pf-search-result{display:flex;align-items:center;gap:11px;min-width:0;width:100%;padding:11px;border:1px solid ${LINE};border-radius:8px;background:#fff;color:${TEXT};text-align:left;cursor:pointer;transition:border-color .16s,transform .16s,box-shadow .16s}.pf-search-result:hover,.pf-search-result:focus-visible{transform:translateY(-1px);border-color:#90cdec;box-shadow:0 9px 22px rgba(17,24,39,.08);outline:3px solid rgba(45,170,245,.22)}.pf-search-result>span:not(.pf-league-mark):not(.pf-page-icon){min-width:0;flex:1}.pf-search-result strong,.pf-search-result small{display:block}.pf-search-result strong{font-size:15px}.pf-search-result small{margin-top:3px;color:${MUTED};font-size:11px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pf-search-result em{flex:0 0 auto;color:${BLUE};font-family:'Bebas Neue',Impact,sans-serif;font-size:18px;font-style:normal;text-transform:uppercase}.pf-league-mark,.pf-page-icon{flex:0 0 auto;display:grid;place-items:center;width:46px;height:46px;border-radius:7px;background:#eef8ff;color:${BLACK};font-size:10px;font-weight:900}.pf-search-start{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;padding:8px 0}.pf-search-shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}.pf-search-shortcuts button{position:relative;padding:13px 34px 13px 13px;border:1px solid ${LINE};border-radius:8px;background:#fff;color:${TEXT};cursor:pointer;text-align:left}.pf-search-shortcuts strong,.pf-search-shortcuts small{display:block}.pf-search-shortcuts small{margin-top:3px;color:${MUTED};font-size:11px}.pf-search-shortcuts svg{position:absolute;right:11px;top:50%;transform:translateY(-50%);color:${BLUE}}.pf-search-help{padding:14px;border:1px solid ${LINE};border-radius:8px;background:#f8fafc}.pf-search-help p{color:${MUTED};font-size:13px;line-height:1.5}.pf-search-status{display:grid;place-items:center;min-height:150px;padding:25px;text-align:center;color:${MUTED};font-weight:800}.pf-search-status strong{color:${TEXT};font-size:20px}.pf-search-status span{margin-top:6px;font-size:13px;font-weight:500}
@media(max-width:720px){.pf-global-search{padding:0}.pf-search-dialog{height:100%;max-height:none;border:0;border-radius:0}.pf-search-header{padding:18px}.pf-search-header h2{font-size:2.8rem}.pf-search-header p{font-size:12px}.pf-search-field{margin:12px;padding:0 13px}.pf-search-field input{font-size:16px}.pf-search-field kbd{display:none}.pf-search-content{padding:0 12px 18px}.pf-search-group>div{grid-template-columns:1fr}.pf-search-start{grid-template-columns:1fr}.pf-search-shortcuts{grid-template-columns:1fr 1fr}.pf-search-result{min-height:70px}}
@media(max-width:390px){.pf-search-shortcuts{grid-template-columns:1fr}.pf-search-header h2{font-size:2.45rem}}
`}</style> }
