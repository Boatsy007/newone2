import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Search, Trophy, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchRankings, fetchSearch, leaguePath, strengthStars, teamPath, type RankingEntry, type SearchResults } from '../../lib/rankings'
import { categoryOf, formatDate, latestArticles, loadPublished, newsPath, searchArticles, type Article } from '../../news/content'
import { EditorialImage } from '../../news/components'
import { StarStrength, TeamLogo } from './bits'

const BLUE = '#2daaf5'
const BLACK = '#050505'
const TEXT = '#111318'
const MUTED = '#687385'
const LINE = '#e3e7ec'

export interface SearchController {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export function useSearchController(): SearchController {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(value => !value), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        toggle()
      }
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, close])

  return { isOpen, open, close, toggle }
}

type GoalKicker = {
  rank: number
  playerName: string
  goals: number
  clubName: string
  leagueName: string
  clubLogoUrl?: string | null
}

type Destination = {
  label: string
  description: string
  path: string
  keywords: string
}

const destinations: Destination[] = [
  { label: 'National rankings', description: 'Australia’s ranked community football clubs', path: '/rankings', keywords: 'rank rankings power rating top 20 clubs' },
  { label: 'Goal kickers', description: 'Player goal-kicking leaders and statistics', path: '/goal-kickers', keywords: 'players goals stats statistics goal kickers' },
  { label: 'Leagues & ladders', description: 'Find competitions, clubs and ladder positions', path: '/leagues', keywords: 'leagues ladders fixtures results competitions' },
  { label: 'Club directory', description: 'Browse community football clubs across Australia', path: '/directory', keywords: 'clubs teams directory search' },
  { label: 'Latest news', description: 'Community football stories and match reports', path: '/news', keywords: 'news articles stories reports' },
  { label: 'Weekly highlights', description: 'Goal, mark and play of the week awards', path: '/highlights', keywords: 'highlights vote voting goal mark play awards video' },
]

export default function GlobalSearch({ controller }: { controller: SearchController }) {
  const { isOpen, close } = controller
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>({ teams: [], leagues: [] })
  const [goalKickers, setGoalKickers] = useState<GoalKicker[]>([])
  const [rankings, setRankings] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [, refreshNews] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const normalized = query.trim().toLowerCase()
  const active = normalized.length >= 2
  const news = useMemo(() => active ? searchArticles({ q: query.trim(), category: '', state: '', league: '', club: '' }).slice(0, 6) : [], [query, active])
  const suggestions = latestArticles(4)
  const players = useMemo(() => active ? goalKickers.filter(player => `${player.playerName} ${player.clubName} ${player.leagueName}`.toLowerCase().includes(normalized)).slice(0, 8) : [], [active, goalKickers, normalized])
  const pages = useMemo(() => active ? destinations.filter(item => `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(normalized)).slice(0, 6) : destinations.slice(0, 6), [active, normalized])
  const logoByClubId = useMemo(() => new Map(rankings.map(entry => [entry.clubId, entry.logoUrl ?? undefined])), [rankings])
  const hasResults = results.teams.length > 0 || results.leagues.length > 0 || players.length > 0 || news.length > 0 || pages.length > 0

  const go = useCallback((path: string) => {
    close()
    setQuery('')
    navigate(path)
  }, [close, navigate])

  useEffect(() => {
    if (!isOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => { document.body.style.overflow = previous }
  }, [isOpen])

  useEffect(() => {
    loadPublished().then(() => refreshNews(value => value + 1))
    fetch('/api/goal-kickers?mode=raw&limit=250')
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: GoalKicker[] }) => setGoalKickers(Array.isArray(payload.data) ? payload.data : []))
      .catch(() => setGoalKickers([]))
    fetchRankings().then(response => setRankings(response.data)).catch(() => setRankings([]))
  }, [])

  useEffect(() => {
    if (!active) {
      setResults({ teams: [], leagues: [] })
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      fetchSearch(query.trim())
        .then(setResults)
        .catch(() => setResults({ teams: [], leagues: [] }))
        .finally(() => setLoading(false))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [query, active])

  if (!isOpen) return null

  return <div className="pf-global-search" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <section className="pf-search-dialog" role="dialog" aria-modal="true" aria-label="Search PlayFooty">
      <header className="pf-search-header">
        <div><span>Universal search</span><h2>Find anything in PlayFooty</h2><p>Search clubs, leagues, players, goal kickers, news and site sections.</p></div>
        <button type="button" onClick={close} aria-label="Close search"><X size={22} /></button>
      </header>

      <label className="pf-search-field">
        <Search size={23} />
        <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a club, league, player or story" autoComplete="off" />
        <kbd>ESC</kbd>
      </label>

      <div className="pf-search-content">
        {!active && <SearchStart suggestions={suggestions} pages={pages} go={go} />}
        {active && loading && <div className="pf-search-status">Searching PlayFooty…</div>}
        {active && !loading && !hasResults && <NoResults query={query} />}

        {active && results.teams.length > 0 && <ResultGroup title="Clubs & teams">
          {results.teams.map(team => <button type="button" key={team.clubId} className="pf-search-result" onClick={() => go(teamPath(team.clubId))}>
            <TeamLogo name={team.clubName} src={logoByClubId.get(team.clubId)} size={48} />
            <span><strong>{team.clubName}</strong><small>{team.leagueName} · {team.state}</small></span>
            <em>#{team.rank}</em>
          </button>)}
        </ResultGroup>}

        {active && players.length > 0 && <ResultGroup title="Players & goal kickers">
          {players.map(player => <button type="button" key={`${player.rank}-${player.playerName}-${player.clubName}`} className="pf-search-result" onClick={() => go(`/goal-kickers?q=${encodeURIComponent(player.playerName)}`)}>
            <TeamLogo name={player.clubName} src={player.clubLogoUrl ?? undefined} size={48} />
            <span><strong>{player.playerName}</strong><small>{player.clubName} · {player.leagueName}</small></span>
            <em>{player.goals} goals</em>
          </button>)}
        </ResultGroup>}

        {active && results.leagues.length > 0 && <ResultGroup title="Leagues">
          {results.leagues.map(league => <button type="button" key={league.id} className="pf-search-result" onClick={() => go(leaguePath(league.id))}>
            <span className="pf-league-mark">{league.state}</span>
            <span><strong>{league.name}</strong><small>{league.state} · League profile and ladder</small></span>
            <StarStrength stars={strengthStars(league.strengthScore)} size={10} />
          </button>)}
        </ResultGroup>}

        {active && news.length > 0 && <ResultGroup title="News">
          {news.map(article => <NewsResult key={article.slug} article={article} go={go} />)}
        </ResultGroup>}

        {active && pages.length > 0 && <ResultGroup title="PlayFooty sections">
          {pages.map(page => <button type="button" key={page.path} className="pf-search-result pf-page-result" onClick={() => go(page.path)}>
            <span className="pf-page-icon"><Trophy size={20} /></span>
            <span><strong>{page.label}</strong><small>{page.description}</small></span>
            <ArrowRight size={18} />
          </button>)}
        </ResultGroup>}
      </div>
    </section>
    <SearchStyles />
  </div>
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="pf-search-group"><h3>{title}</h3><div>{children}</div></section>
}

function NewsResult({ article, go }: { article: Article; go: (path: string) => void }) {
  const category = categoryOf(article.category)
  return <button type="button" className="pf-search-result pf-news-result" onClick={() => go(newsPath(article.slug))}>
    <EditorialImage seed={article.heroSeed} ratio="4 / 3" rounded={6} label={category.label} />
    <span><i style={{ background: category.accent }}>{category.label}</i><strong>{article.title}</strong><small>{formatDate(article.date)} · {article.readingTime} min read</small></span>
    <ArrowRight size={18} />
  </button>
}

function SearchStart({ suggestions, pages, go }: { suggestions: Article[]; pages: Destination[]; go: (path: string) => void }) {
  return <div className="pf-search-start">
    <div><span className="pf-search-eyebrow">Popular destinations</span><div className="pf-search-shortcuts">{pages.map(page => <button type="button" key={page.path} onClick={() => go(page.path)}><strong>{page.label}</strong><small>{page.description}</small><ArrowRight size={16} /></button>)}</div></div>
    {suggestions.length > 0 && <div><span className="pf-search-eyebrow">Latest stories</span><div className="pf-search-suggestions">{suggestions.map(article => <button type="button" key={article.slug} onClick={() => go(newsPath(article.slug))}>{article.title}<ArrowRight size={14} /></button>)}</div></div>}
  </div>
}

function NoResults({ query }: { query: string }) {
  return <div className="pf-search-status"><strong>No matches for “{query.trim()}”</strong><span>Try a club, league, player, state, ranking or news topic.</span></div>
}

function SearchStyles() { return <style>{`
  .pf-global-search{position:fixed;inset:0;z-index:140;display:flex;justify-content:center;align-items:flex-start;padding:6vh 18px;background:rgba(5,5,5,.72);backdrop-filter:blur(8px)}
  .pf-search-dialog{width:min(1040px,100%);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.16);border-radius:12px;background:#fff;box-shadow:0 36px 100px rgba(0,0,0,.38);font-family:Barlow,Inter,Arial,sans-serif}
  .pf-search-header{display:flex;justify-content:space-between;gap:24px;padding:25px 27px 21px;background:${BLACK};color:#fff}.pf-search-header>div>span,.pf-search-eyebrow{display:block;color:${BLUE};font-size:10px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}.pf-search-header h2{margin:7px 0 5px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.4rem,5vw,4.6rem);line-height:.9;text-transform:uppercase}.pf-search-header p{margin:0;color:#c9d0d8;font-size:14px}.pf-search-header>button{align-self:flex-start;display:grid;place-items:center;width:42px;height:42px;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:transparent;color:#fff;cursor:pointer}
  .pf-search-field{display:flex;align-items:center;gap:12px;margin:18px 20px 14px;padding:0 16px;border:2px solid ${BLACK};border-radius:8px;background:#fff}.pf-search-field svg{color:${BLUE}}.pf-search-field input{flex:1;min-width:0;padding:17px 0;border:0;outline:0;background:transparent;color:${TEXT};font-size:18px}.pf-search-field kbd{padding:4px 7px;border:1px solid ${LINE};border-radius:5px;color:${MUTED};font-size:10px;font-weight:800}
  .pf-search-content{overflow:auto;padding:0 20px 20px}.pf-search-group{margin-top:13px}.pf-search-group h3{position:sticky;top:0;z-index:2;margin:0 0 9px;padding:10px 12px;background:${BLACK};color:#fff;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.pf-search-group>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
  .pf-search-result{display:flex;align-items:center;gap:11px;min-width:0;width:100%;padding:11px;border:1px solid ${LINE};border-radius:8px;background:#fff;color:${TEXT};text-align:left;cursor:pointer;transition:border-color .16s,transform .16s,box-shadow .16s}.pf-search-result:hover{transform:translateY(-1px);border-color:#bdc8d3;box-shadow:0 9px 22px rgba(17,24,39,.08)}.pf-search-result>span:not(.pf-league-mark):not(.pf-page-icon){min-width:0;flex:1}.pf-search-result strong,.pf-search-result small{display:block}.pf-search-result strong{font-size:15px}.pf-search-result small{margin-top:3px;color:${MUTED};font-size:11px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pf-search-result em{flex:0 0 auto;color:${BLUE};font-family:'Bebas Neue',Impact,sans-serif;font-size:21px;font-style:normal;text-transform:uppercase}.pf-league-mark,.pf-page-icon{flex:0 0 auto;display:grid;place-items:center;width:46px;height:46px;border-radius:7px;background:#eef8ff;color:${BLACK};font-size:10px;font-weight:900}.pf-news-result{align-items:stretch}.pf-news-result>.cnews-img-wrap{width:92px;flex:0 0 auto}.pf-news-result i{display:inline-flex;margin-bottom:4px;padding:3px 6px;border-radius:999px;color:#fff;font-size:9px;font-style:normal;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.pf-page-result>svg,.pf-news-result>svg{flex:0 0 auto;color:${BLUE}}
  .pf-search-start{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;padding:8px 0}.pf-search-shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}.pf-search-shortcuts button,.pf-search-suggestions button{border:1px solid ${LINE};border-radius:8px;background:#fff;color:${TEXT};cursor:pointer;text-align:left}.pf-search-shortcuts button{position:relative;padding:13px 34px 13px 13px}.pf-search-shortcuts strong,.pf-search-shortcuts small{display:block}.pf-search-shortcuts small{margin-top:3px;color:${MUTED};font-size:11px;line-height:1.25}.pf-search-shortcuts svg{position:absolute;right:11px;top:50%;transform:translateY(-50%);color:${BLUE}}.pf-search-suggestions{display:grid;gap:7px;margin-top:9px}.pf-search-suggestions button{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px;font-weight:750}.pf-search-suggestions svg{flex:0 0 auto;color:${BLUE}}
  .pf-search-status{display:grid;place-items:center;min-height:150px;padding:25px;text-align:center;color:${MUTED};font-weight:800}.pf-search-status strong{color:${TEXT};font-size:20px}.pf-search-status span{margin-top:6px;font-size:13px;font-weight:500}
  .pf-search-result:focus-visible,.pf-search-header button:focus-visible,.pf-search-shortcuts button:focus-visible,.pf-search-suggestions button:focus-visible{outline:3px solid rgba(45,170,245,.35);outline-offset:2px}
  @media(max-width:720px){.pf-global-search{padding:0}.pf-search-dialog{height:100%;max-height:none;border:0;border-radius:0}.pf-search-header{padding:18px}.pf-search-header h2{font-size:2.8rem}.pf-search-header p{font-size:12px}.pf-search-field{margin:12px;padding:0 13px}.pf-search-field input{font-size:16px}.pf-search-field kbd{display:none}.pf-search-content{padding:0 12px 18px}.pf-search-group>div{grid-template-columns:1fr}.pf-search-start{grid-template-columns:1fr}.pf-search-shortcuts{grid-template-columns:1fr 1fr}.pf-search-result{min-height:70px}.pf-news-result>.cnews-img-wrap{width:82px}}
  @media(max-width:390px){.pf-search-shortcuts{grid-template-columns:1fr}.pf-search-header h2{font-size:2.45rem}}
`}</style> }
