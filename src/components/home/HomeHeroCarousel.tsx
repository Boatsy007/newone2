import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { EditorialImage } from '../../news/components'
import { categoryOf, featuredArticles, latestArticles, loadPublished, newsPath, type Article } from '../../news/content'
import { teamPath, type RankingEntry } from '../../lib/rankings'
import { TeamLogo } from '../rankings/bits'

type Props = { top?: RankingEntry; updatedAt?: string | null }
type NewsSlot = { key: string; article?: Article; title: string; summary: string; label: string }
type Slide =
  | { kind: 'rankings'; key: string }
  | { kind: 'news'; key: string; slot: NewsSlot }
  | { kind: 'feature'; key: string }

const AUTOPLAY_MS = 5000
const PLACEHOLDERS: NewsSlot[] = [
  { key: 'news-placeholder-1', label: 'Featured story', title: 'Community football news coming soon', summary: 'Published stories with match-day images will appear here once they are ready.' },
  { key: 'news-placeholder-2', label: 'Match report', title: 'The weekend’s biggest moments', summary: 'Featured match reports, club stories and league updates will rotate through this space.' },
  { key: 'news-placeholder-3', label: 'Player spotlight', title: 'Players shaping the season', summary: 'Player features and community football stories will appear here when published.' },
]

export default function HomeHeroCarousel({ top, updatedAt }: Props) {
  const { pathname } = useLocation()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const startX = useRef<number | null>(null)

  useEffect(() => {
    if (pathname !== '/') {
      setTarget(null)
      document.getElementById('pf-home-hero-carousel-slot')?.remove()
      document.querySelector<HTMLElement>('.pf-hero[data-pf-original-hero="true"]')?.style.removeProperty('display')
      return
    }
    let mounted = true
    const attach = () => {
      if (!mounted) return false
      const original = document.querySelector<HTMLElement>('.pf-hero')
      if (!original || original.closest('#pf-home-hero-carousel-slot')) return false
      original.dataset.pfOriginalHero = 'true'
      original.style.display = 'none'
      let slot = document.getElementById('pf-home-hero-carousel-slot')
      if (!slot) {
        slot = document.createElement('div')
        slot.id = 'pf-home-hero-carousel-slot'
        original.parentElement?.insertBefore(slot, original)
      }
      setTarget(slot)
      return true
    }
    let observer: MutationObserver | null = null
    if (!attach()) {
      observer = new MutationObserver(() => { if (attach()) observer?.disconnect() })
      observer.observe(document.body, { childList: true, subtree: true })
    }
    return () => {
      mounted = false
      observer?.disconnect()
      document.querySelector<HTMLElement>('.pf-hero[data-pf-original-hero="true"]')?.style.removeProperty('display')
      document.getElementById('pf-home-hero-carousel-slot')?.remove()
      setTarget(null)
    }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/') return
    let alive = true
    void loadPublished().then(() => {
      if (!alive) return
      const seen = new Set<string>()
      const chosen = [...featuredArticles(), ...latestArticles(8)].filter(article => {
        if (!article.heroSeed || seen.has(article.slug)) return false
        seen.add(article.slug)
        return true
      }).slice(0, 3)
      setArticles(chosen)
    }).catch(() => { if (alive) setArticles([]) })
    return () => { alive = false }
  }, [pathname])

  const newsSlots = useMemo<NewsSlot[]>(() => PLACEHOLDERS.map((placeholder, index) => {
    const article = articles[index]
    return article ? { key: article.slug, article, title: article.title, summary: article.summary, label: categoryOf(article.category).label } : placeholder
  }), [articles])

  const slides = useMemo<Slide[]>(() => [
    { kind: 'rankings', key: 'rankings' },
    ...newsSlots.map(slot => ({ kind: 'news' as const, key: slot.key, slot })),
    { kind: 'feature', key: 'feature' },
  ], [newsSlots])

  useEffect(() => { if (active >= slides.length) setActive(0) }, [active, slides.length])
  useEffect(() => {
    if (paused || slides.length <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setActive(index => (index + 1) % slides.length), AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [paused, slides.length])

  if (!target || pathname !== '/') return null
  const go = (index: number) => setActive((index + slides.length) % slides.length)
  const touchStart = (event: React.TouchEvent) => { startX.current = event.touches[0]?.clientX ?? null; setPaused(true) }
  const touchEnd = (event: React.TouchEvent) => {
    const from = startX.current
    const to = event.changedTouches[0]?.clientX
    startX.current = null
    if (from != null && to != null && Math.abs(from - to) > 45) go(active + (from > to ? 1 : -1))
    window.setTimeout(() => setPaused(false), 700)
  }

  return createPortal(<section className="pf-hero-carousel gk-no-auto-share" aria-roledescription="carousel" aria-label="Featured PlayFooty stories" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)} onTouchStart={touchStart} onTouchEnd={touchEnd}>
    <div className="pf-hero-carousel-track" style={{ transform: `translateX(-${active * 100}%)` }}>
      {slides.map(slide => <div className="pf-hero-carousel-slide" key={slide.key} aria-hidden={slides[active]?.key !== slide.key}>
        {slide.kind === 'rankings' && <RankingsSlide top={top} updatedAt={updatedAt ?? null} />}
        {slide.kind === 'news' && <NewsSlide slot={slide.slot} />}
        {slide.kind === 'feature' && <FeatureSlide />}
      </div>)}
    </div>
    <div className="pf-hero-carousel-controls" aria-label="Choose hero slide">{slides.map((slide, index) => <button key={slide.key} type="button" className={index === active ? 'is-active' : ''} onClick={() => setActive(index)} aria-label={`Show slide ${index + 1}`}><span /></button>)}</div>
    <style>{styles}</style>
  </section>, target)
}

function RankingsSlide({ top, updatedAt }: Props) {
  return <div className="pfhc-ranking pfhc-shell">
    <div className="pfhc-ranking-copy"><span>Community football, ranked</span><h1>Australia's<br /><em>strongest</em><br />community clubs</h1><p>Real rankings. Real clubs. Real football.</p><Link to="/rankings">View national top 20 <ArrowRight size={18} /></Link><small><i /> Rankings updated {updatedAt ? formatShortDate(updatedAt) : 'live'}</small></div>
    <div className="pfhc-ranking-side">
      <span className="pfhc-ranking-label">Current national number one</span>
      {top ? <Link to={teamPath(top.clubId)} className="pfhc-number-one"><span className="pfhc-number-badge">1</span><TeamLogo name={top.clubName} src={top.logoUrl ?? undefined} size={92} /><div><strong>{top.clubName}</strong><small>{top.leagueName} · {top.state}</small><em>{top.record.wins}-{top.record.losses}{top.record.draws ? `-${top.record.draws}` : ''}</em></div><b>{top.powerRating.toFixed(1)}</b></Link> : <div className="pfhc-number-one is-loading">Rankings loading…</div>}
    </div>
  </div>
}

function NewsSlide({ slot }: { slot: NewsSlot }) {
  const content = <><div className="pfhc-news-image">{slot.article ? <EditorialImage seed={slot.article.heroSeed} ratio="16 / 7" rounded={0} /> : <div className="pfhc-placeholder-art"><span>PLAYFOOTY NEWS</span></div>}</div><div className="pfhc-news-shade" /><div className="pfhc-news-copy pfhc-shell"><span>{slot.label}{slot.article ? ` · ${formatShortDate(slot.article.date)}` : ''}</span><h2>{slot.title}</h2><p>{slot.summary}</p><b>{slot.article ? 'Read story' : 'News publishing soon'} <ArrowRight size={18} /></b></div></>
  return slot.article ? <Link to={newsPath(slot.article.slug)} className="pfhc-news">{content}</Link> : <div className="pfhc-news is-placeholder">{content}</div>
}

function FeatureSlide() { return <Link to="/matches" className="pfhc-feature"><div className="pfhc-feature-art"><span>PF</span><i /><b /></div><div className="pfhc-feature-copy pfhc-shell"><span>Every club. Every player. Every week.</span><h2>Follow every<br /><em>big moment</em></h2><p>Featured games, team selections, rankings, records and community football news in one place.</p><b>Explore match centre <ArrowRight size={18} /></b></div></Link> }
function formatShortDate(value: string) { return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) }

const styles = `
#pf-home-hero-carousel-slot{display:block;width:100%}.pf-hero-carousel{position:relative;width:100%;overflow:hidden;border-bottom:1px solid #e3e7ec;background:#fff;font-family:Barlow,Inter,Arial,sans-serif}.pf-hero-carousel-track{display:flex;width:100%;transition:transform .65s cubic-bezier(.22,1,.36,1);will-change:transform}.pf-hero-carousel-slide{flex:0 0 100%;min-width:0;min-height:620px}.pfhc-shell{width:min(1440px,calc(100% - 48px));margin:0 auto}
.pfhc-ranking{min-height:620px;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(390px,.72fr);align-items:center;gap:54px;padding-top:48px;padding-bottom:68px}.pfhc-ranking-copy>span,.pfhc-feature-copy>span{text-transform:uppercase;font-size:12px;font-weight:800;letter-spacing:.2em;color:#42b8ff}.pfhc-ranking h1,.pfhc-news h2,.pfhc-feature h2{font-family:'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase}.pfhc-ranking h1{font-size:clamp(4.5rem,7.4vw,8rem);line-height:.8;letter-spacing:-.025em;margin:16px 0 20px;color:#050505}.pfhc-ranking h1 em,.pfhc-feature h2 em{font-style:normal;color:#42b8ff}.pfhc-ranking-copy>p{font-size:19px;margin:0 0 24px;color:#4d5560}.pfhc-ranking-copy>a,.pfhc-news-copy>b,.pfhc-feature-copy>b{display:inline-flex;align-items:center;gap:10px;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:900;border-radius:7px;background:#42b8ff;color:#050505;padding:14px 20px}.pfhc-ranking-copy>small{display:flex;align-items:center;gap:9px;margin-top:22px;font-weight:800;text-transform:uppercase;font-size:11px}.pfhc-ranking-copy>small i{width:9px;height:9px;background:#42b8ff;border-radius:50%}
.pfhc-ranking-side{align-self:stretch;display:flex;flex-direction:column;justify-content:center}.pfhc-ranking-label{text-transform:uppercase;font-size:11px;font-weight:900;letter-spacing:.15em;color:#687385;margin:0 0 12px}.pfhc-number-one{display:grid;grid-template-columns:54px 100px minmax(0,1fr) auto;align-items:center;gap:16px;padding:22px;background:#fff;border:1px solid #d9e0e7;border-radius:16px;box-shadow:0 18px 40px rgba(14,28,45,.12);color:#111318;text-decoration:none}.pfhc-number-badge{display:grid;place-items:center;width:50px;height:50px;border-radius:9px;background:#42b8ff;font-family:'Bebas Neue',Impact,sans-serif;font-size:34px}.pfhc-number-one div strong,.pfhc-number-one div small,.pfhc-number-one div em{display:block}.pfhc-number-one div strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:31px;line-height:.95;text-transform:uppercase}.pfhc-number-one div small{color:#687385;margin-top:5px}.pfhc-number-one div em{font-style:normal;font-weight:900;margin-top:8px}.pfhc-number-one>b{font-family:'Bebas Neue',Impact,sans-serif;font-size:48px;color:#42b8ff}.pfhc-number-one.is-loading{display:block}
.pfhc-news,.pfhc-feature{position:relative;display:block;min-height:620px;overflow:hidden;color:#fff;text-decoration:none;background:#071727}.pfhc-news-image{position:absolute;inset:0}.pfhc-news-image>div{width:100%;height:100%;aspect-ratio:auto!important;border-radius:0!important}.pfhc-placeholder-art{display:grid;place-items:center;background:linear-gradient(135deg,#06111e,#0b3650 58%,#149ddd);color:rgba(255,255,255,.2);font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4rem,11vw,10rem);letter-spacing:.03em}.pfhc-news-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,9,20,.95),rgba(2,9,20,.7) 48%,rgba(2,9,20,.2)),linear-gradient(0deg,rgba(2,9,20,.9),transparent 58%)}.pfhc-news-copy,.pfhc-feature-copy{position:relative;z-index:2;min-height:620px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;padding-top:72px;padding-bottom:82px}.pfhc-news-copy>span{font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#42b8ff}.pfhc-news h2,.pfhc-feature h2{max-width:940px;margin:16px 0 14px;font-size:clamp(3.6rem,6.5vw,6.8rem);line-height:.87}.pfhc-news-copy>p,.pfhc-feature-copy>p{max-width:720px;margin:0 0 24px;font-size:18px;line-height:1.45;color:rgba(255,255,255,.82)}.pfhc-news.is-placeholder .pfhc-news-copy>b{opacity:.72}
.pfhc-feature{background:linear-gradient(135deg,#050505 0 52%,#082b40 75%,#0a4f73)}.pfhc-feature-art{position:absolute;right:3%;top:8%;width:48%;height:82%}.pfhc-feature-art>span{position:absolute;right:12%;top:22%;display:grid;place-items:center;width:240px;height:150px;border-radius:50%;transform:rotate(-15deg);background:#42b8ff;border:3px solid #050505;color:#050505;font-family:'Bebas Neue',Impact,sans-serif;font-size:50px}.pfhc-feature-art>i,.pfhc-feature-art>b{position:absolute;border-radius:50%;background:rgba(66,184,255,.13)}.pfhc-feature-art>i{width:430px;height:430px;right:-8%;top:4%}.pfhc-feature-art>b{width:310px;height:310px;right:31%;bottom:-8%}
.pf-hero-carousel-controls{position:absolute;left:50%;bottom:20px;z-index:5;display:flex;gap:8px;transform:translateX(-50%)}.pf-hero-carousel-controls button{width:52px;height:6px;padding:0;border:0;border-radius:999px;background:rgba(150,160,174,.38);overflow:hidden}.pf-hero-carousel-controls button span{display:block;width:0;height:100%;background:#42b8ff}.pf-hero-carousel-controls button.is-active span{width:100%;animation:pfhcProgress ${AUTOPLAY_MS}ms linear}@keyframes pfhcProgress{from{width:0}to{width:100%}}
@media(prefers-reduced-motion:reduce){.pf-hero-carousel-track{transition:none}.pf-hero-carousel-controls button.is-active span{animation:none;width:100%}}
@media(max-width:760px){.pf-hero-carousel-slide,.pfhc-ranking,.pfhc-news,.pfhc-feature{min-height:690px}.pfhc-shell{width:calc(100% - 24px)}.pfhc-ranking{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:24px;padding-top:30px;padding-bottom:72px}.pfhc-ranking h1{font-size:4.45rem}.pfhc-ranking-copy>p{font-size:16px}.pfhc-ranking-side{margin-top:auto}.pfhc-number-one{grid-template-columns:42px 66px minmax(0,1fr) auto;gap:10px;padding:13px;border-radius:12px}.pfhc-number-badge{width:40px;height:40px;font-size:28px}.pfhc-number-one div strong{font-size:22px}.pfhc-number-one div small{font-size:11px}.pfhc-number-one div em{font-size:12px}.pfhc-number-one>b{font-size:33px}.pfhc-news-copy,.pfhc-feature-copy{min-height:690px;padding-top:90px;padding-bottom:76px}.pfhc-news h2,.pfhc-feature h2{font-size:3.7rem;max-width:95%}.pfhc-news-copy>p,.pfhc-feature-copy>p{font-size:15px;max-width:94%}.pfhc-news-shade{background:linear-gradient(0deg,rgba(2,9,20,.97),rgba(2,9,20,.72) 64%,rgba(2,9,20,.18))}.pfhc-feature-art{right:-18%;top:8%;width:85%;height:55%;opacity:.76}.pfhc-feature-art>span{width:150px;height:94px;font-size:34px}.pf-hero-carousel-controls button{width:34px}}
`