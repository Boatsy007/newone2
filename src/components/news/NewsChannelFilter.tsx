import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import {
  allArticles,
  categoryOf,
  formatDate,
  loadPublished,
  newsPath,
  type Article,
  type CategoryId,
} from '../../news/content'
import { EditorialImage } from '../../news/components'

type ChannelId = 'all' | 'featured' | 'local-legends' | 'rankings' | 'club-news' | 'league-news' | 'community' | 'opinion'

type Channel = {
  id: ChannelId
  label: string
  description: string
  matches: (article: Article) => boolean
}

const LOCAL_LEGEND_CATEGORIES = new Set<CategoryId>(['player-spotlight', 'coach-spotlight', 'history'])

const CHANNELS: Channel[] = [
  { id: 'all', label: 'All', description: 'Every published PlayFooty story.', matches: () => true },
  { id: 'featured', label: 'Featured', description: 'The biggest stories selected by the PlayFooty newsroom.', matches: article => article.featured === true },
  { id: 'local-legends', label: 'Local Legends', description: 'Players, coaches and football people whose stories deserve to be told.', matches: article => LOCAL_LEGEND_CATEGORIES.has(article.category) },
  { id: 'rankings', label: 'Rankings', description: 'National rankings, movement and analysis.', matches: article => article.category === 'rankings' },
  { id: 'club-news', label: 'Club News', description: 'Updates and stories from community football clubs.', matches: article => article.category === 'club-news' || article.tags.club != null },
  { id: 'league-news', label: 'League News', description: 'Competition news and league-wide updates.', matches: article => article.category === 'league-news' || article.category === 'state-news' },
  { id: 'community', label: 'Community', description: 'Grassroots stories and the people behind the game.', matches: article => article.category === 'community' || article.category === 'grassroots' },
  { id: 'opinion', label: 'Opinion', description: 'Analysis, ideas and debate from around community football.', matches: article => article.category === 'opinion' },
]

export default function NewsChannelFilter() {
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [, refresh] = useState(0)

  useEffect(() => {
    if (pathname !== '/news') {
      setTarget(null)
      return
    }
    let cancelled = false
    const attach = () => {
      if (cancelled) return
      const header = document.querySelector<HTMLElement>('.news-header')
      if (!header) return
      let slot = document.getElementById('pf-news-channel-filter-slot')
      if (!slot) {
        slot = document.createElement('div')
        slot.id = 'pf-news-channel-filter-slot'
        header.insertAdjacentElement('afterend', slot)
      }
      setTarget(slot)
    }
    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => {
      cancelled = true
      observer.disconnect()
      setTarget(null)
    }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/news') return
    let active = true
    void loadPublished().then(() => { if (active) refresh(value => value + 1) })
    return () => { active = false }
  }, [pathname])

  const requested = searchParams.get('channel') as ChannelId | null
  const selected = CHANNELS.some(channel => channel.id === requested) ? requested! : 'all'
  const channel = CHANNELS.find(item => item.id === selected) ?? CHANNELS[0]
  const articles = allArticles()
  const filtered = useMemo(() => articles.filter(channel.matches), [articles, channel])

  useEffect(() => {
    if (pathname !== '/news') return
    document.documentElement.dataset.newsChannel = selected
    return () => { delete document.documentElement.dataset.newsChannel }
  }, [pathname, selected])

  if (!target || pathname !== '/news') return null

  const choose = (id: ChannelId) => {
    const next = new URLSearchParams(searchParams)
    if (id === 'all') next.delete('channel')
    else next.set('channel', id)
    setSearchParams(next, { replace: true })
  }

  return createPortal(<>
    <section className="pf-news-channels" aria-label="Browse news by type">
      <div className="pf-news-channel-scroll" role="tablist" aria-label="News types">
        {CHANNELS.map(item => {
          const count = articles.filter(item.matches).length
          return <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected === item.id}
            className={selected === item.id ? 'active' : ''}
            onClick={() => choose(item.id)}
          >
            <span>{item.label}</span>
            <small>{count}</small>
          </button>
        })}
      </div>
    </section>

    {selected !== 'all' && <section className="pf-news-channel-results" aria-live="polite">
      <header>
        <div><span>Browse news</span><h2>{channel.label}</h2><p>{channel.description}</p></div>
        <b>{filtered.length} {filtered.length === 1 ? 'story' : 'stories'}</b>
      </header>
      {filtered.length > 0
        ? <div className="pf-news-channel-grid">{filtered.map(article => <ChannelCard key={article.slug} article={article} />)}</div>
        : <div className="pf-news-channel-empty"><h3>No published stories yet</h3><p>Articles in this section will appear here after they are published.</p></div>}
    </section>}

    <style>{`
      .pf-news-channels{margin:0 0 18px}.pf-news-channel-scroll{display:flex;gap:9px;overflow-x:auto;scrollbar-width:none;padding:2px 1px 8px;scroll-snap-type:x proximity}.pf-news-channel-scroll::-webkit-scrollbar{display:none}.pf-news-channel-scroll button{scroll-snap-align:start;flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:9px 13px;border:1px solid #dbe3ee;border-radius:999px;background:#fff;color:#062a5f;font:950 12px/1 Barlow,Inter,Arial,sans-serif;text-transform:uppercase;letter-spacing:.055em;cursor:pointer}.pf-news-channel-scroll button small{display:grid;place-items:center;min-width:21px;height:21px;padding:0 5px;border-radius:999px;background:#eef4fa;color:#64748b;font-size:10px}.pf-news-channel-scroll button.active{background:#2daaf5;border-color:#2daaf5;color:#050505;box-shadow:0 8px 20px rgba(45,170,245,.2)}.pf-news-channel-scroll button.active small{background:#050505;color:#fff}.pf-news-channel-results{margin-bottom:18px}.pf-news-channel-results>header{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;border-bottom:3px solid #062a5f;padding:2px 0 13px;margin-bottom:15px}.pf-news-channel-results>header span{color:#0783c9;font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.pf-news-channel-results h2{margin:4px 0 2px;color:#062a5f;font-size:clamp(2.5rem,6vw,5rem);line-height:.86;text-transform:uppercase;letter-spacing:-.055em}.pf-news-channel-results header p{margin:8px 0 0;color:#64748b;font-weight:700}.pf-news-channel-results header>b{white-space:nowrap;color:#0783c9;text-transform:uppercase;font-size:12px;letter-spacing:.08em}.pf-news-channel-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.pf-news-channel-card{display:flex;flex-direction:column;border:1px solid #dbe3ee;border-radius:16px;background:#fff;color:#111827;text-decoration:none;overflow:hidden;box-shadow:0 12px 28px rgba(6,42,95,.08)}.pf-news-channel-copy{display:flex;flex:1;flex-direction:column;padding:16px}.pf-news-channel-copy>span{color:#0783c9;font-size:10px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}.pf-news-channel-copy h3{margin:10px 0 8px;color:#062a5f;font-size:25px;line-height:1;text-transform:uppercase;letter-spacing:-.04em}.pf-news-channel-copy p{margin:0;color:#4b5d73;line-height:1.45}.pf-news-channel-meta{display:block;margin-top:auto;padding-top:14px;color:#64748b;font-size:11px;font-weight:800}.pf-news-channel-cta{display:inline-flex;align-items:center;gap:7px;margin-top:12px;color:#0783c9;font-size:11px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.pf-news-channel-empty{border:1px solid #dbe3ee;border-radius:16px;padding:34px 20px;text-align:center;background:#fff}.pf-news-channel-empty h3{margin:0;color:#062a5f;font-size:30px;text-transform:uppercase}.pf-news-channel-empty p{color:#64748b;font-weight:700}html[data-news-channel]:not([data-news-channel="all"]) .news-page>.featured-story,html[data-news-channel]:not([data-news-channel="all"]) .news-page>.news-layout{display:none!important}@media(max-width:980px){.pf-news-channel-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.pf-news-channel-scroll{margin-right:-12px;padding-right:12px}.pf-news-channel-grid{grid-template-columns:1fr}.pf-news-channel-results>header{align-items:flex-start;flex-direction:column}.pf-news-channel-results h2{font-size:3.2rem}.pf-news-channel-card{border-radius:14px}}
    `}</style>
  </>, target)
}

function ChannelCard({ article }: { article: Article }) {
  return <Link to={newsPath(article.slug)} className="pf-news-channel-card">
    <EditorialImage seed={article.heroSeed} ratio="16 / 10" rounded={0} label={categoryOf(article.category).label} />
    <div className="pf-news-channel-copy">
      <span>{categoryOf(article.category).label}</span>
      <h3>{article.title}</h3>
      <p>{article.summary}</p>
      <small className="pf-news-channel-meta">{formatDate(article.date)} · {article.readingTime} min read</small>
      <span className="pf-news-channel-cta">Read story <ArrowRight size={14} /></span>
    </div>
  </Link>
}
