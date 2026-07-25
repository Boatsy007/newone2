import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { EditorialImage } from '../../news/components'
import { categoryOf, featuredArticles, latestArticles, loadPublished, newsPath, type Article } from '../../news/content'
import { teamPath, type RankingEntry } from '../../lib/rankings'
import { TeamLogo } from '../rankings/bits'

type Props = {
  top?: RankingEntry
  updatedAt?: string | null
}

type Slide =
  | { kind: 'rankings'; key: string }
  | { kind: 'news'; key: string; article: Article }
  | { kind: 'feature'; key: string }

const AUTOPLAY_MS = 5000

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
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect()
      })
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
    void loadPublished()
      .then(() => {
        if (!alive) return
        const preferred = featuredArticles().filter(article => article.heroSeed)
        const fallback = latestArticles(8).filter(article => article.heroSeed)
        const seen = new Set<string>()
        const chosen = [...preferred, ...fallback].filter(article => {
          if (seen.has(article.slug)) return false
          seen.add(article.slug)
          return true
        }).slice(0, 3)
        setArticles(chosen)
      })
      .catch(() => { if (alive) setArticles([]) })
    return () => { alive = false }
  }, [pathname])

  const slides = useMemo<Slide[]>(() => [
    { kind: 'rankings', key: 'rankings' },
    ...articles.map(article => ({ kind: 'news' as const, key: article.slug, article })),
    { kind: 'feature', key: 'feature' },
  ], [articles])

  useEffect(() => {
    if (active >= slides.length) setActive(0)
  }, [active, slides.length])

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

  return createPortal(
    <section
      className="pf-hero-carousel gk-no-auto-share"
      aria-roledescription="carousel"
      aria-label="Featured PlayFooty stories"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={touchStart}
      onTouchEnd={touchEnd}
    >
      <div className="pf-hero-carousel-track" style={{ transform: `translateX(-${active * 100}%)` }}>
        {slides.map(slide => <div className="pf-hero-carousel-slide" key={slide.key} aria-hidden={slides[active]?.key !== slide.key}>
          {slide.kind === 'rankings' && <RankingsSlide top={top} updatedAt={updatedAt ?? null} />}
          {slide.kind === 'news' && <NewsSlide article={slide.article} />}
          {slide.kind === 'feature' && <FeatureSlide />}
        </div>)}
      </div>
      <div className="pf-hero-carousel-controls" aria-label="Choose hero slide">
        {slides.map((slide, index) => <button key={slide.key} type="button" className={index === active ? 'is-active' : ''} onClick={() => setActive(index)} aria-label={`Show slide ${index + 1}`}><span /></button>)}
      </div>
      <style>{styles}</style>
    </section>,
    target,
  )
}

function RankingsSlide({ top, updatedAt }: Props) {
  return <div className="pfhc-ranking pfhc-shell">
    <div className="pfhc-ranking-copy">
      <span>Community football, ranked</span>
      <h1>Australia's<br /><em>strongest</em><br />community clubs</h1>
      <p>Real rankings. Real clubs. Real football.</p>
      <Link to="/rankings">View national top 20 <ArrowRight size={18} /></Link>
      <small><i /> Rankings updated {updatedAt ? formatShortDate(updatedAt) : 'live'}</small>
    </div>
    <div className="pfhc-ranking-art" aria-hidden="true">
      <div className="pfhc-speed-lines" />
      <div className="pfhc-player"><span /><b /><i>PF</i></div>
      {top && <Link to={teamPath(top.clubId)} className="pfhc-number-one">
        <span>1</span><TeamLogo name={top.clubName} src={top.logoUrl ?? undefined} size={64} />
        <div><strong>{top.clubName}</strong><small>{top.leagueName} · {top.state}</small></div><b>{top.powerRating.toFixed(1)}</b>
      </Link>}
    </div>
  </div>
}

function NewsSlide({ article }: { article: Article }) {
  return <Link to={newsPath(article.slug)} className="pfhc-news">
    <div className="pfhc-news-image"><EditorialImage seed={article.heroSeed} ratio="16 / 7" rounded={0} /></div>
    <div className="pfhc-news-shade" />
    <div className="pfhc-news-copy pfhc-shell">
      <span>{categoryOf(article.category).label} · {formatShortDate(article.date)}</span>
      <h2>{article.title}</h2>
      <p>{article.summary}</p>
      <b>Read story <ArrowRight size={18} /></b>
    </div>
  </Link>
}

function FeatureSlide() {
  return <Link to="/matches" className="pfhc-feature">
    <div className="pfhc-feature-art"><span>PF</span><i /><b /></div>
    <div className="pfhc-feature-copy pfhc-shell">
      <span>Every club. Every player. Every week.</span>
      <h2>Follow every<br /><em>big moment</em></h2>
      <p>Featured games, team selections, rankings, records and community football news in one place.</p>
      <b>Explore match centre <ArrowRight size={18} /></b>
    </div>
  </Link>
}

function formatShortDate(value: string) { return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) }

const styles = `
#pf-home-hero-carousel-slot{display:block;width:100%}
.pf-hero-carousel{position:relative;width:100%;overflow:hidden;border-bottom:1px solid #e3e7ec;background:#fff;font-family:Barlow,Inter,Arial,sans-serif}
.pf-hero-carousel-track{display:flex;width:100%;transition:transform .65s cubic-bezier(.22,1,.36,1);will-change:transform}
.pf-hero-carousel-slide{flex:0 0 100%;min-width:0;min-height:640px}
.pfhc-shell{width:min(1440px,calc(100% - 48px));margin:0 auto}
.pfhc-ranking{min-height:640px;display:grid;grid-template-columns:minmax(430px,.88fr) minmax(500px,1.12fr);align-items:center}
.pfhc-ranking-copy{padding:62px 0 58px;position:relative;z-index:2}.pfhc-ranking-copy>span,.pfhc-feature-copy>span{text-transform:uppercase;font-size:12px;font-weight:800;letter-spacing:.2em;color:#42b8ff}
.pfhc-ranking h1,.pfhc-news h2,.pfhc-feature h2{font-family:'Bebas Neue',Impact,'Arial Narrow Bold',sans-serif;text-transform:uppercase}.pfhc-ranking h1{font-size:clamp(4.6rem,8vw,8.8rem);line-height:.79;letter-spacing:-.025em;margin:17px 0 20px;color:#050505}.pfhc-ranking h1 em,.pfhc-feature h2 em{font-style:normal;color:#42b8ff}.pfhc-ranking-copy>p{font-size:19px;margin:0 0 24px;color:#4d5560}.pfhc-ranking-copy>a,.pfhc-news-copy>b,.pfhc-feature-copy>b{display:inline-flex;align-items:center;justify-content:center;gap:10px;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:900;letter-spacing:.025em;border-radius:7px;background:#42b8ff;color:#050505;padding:14px 20px}.pfhc-ranking-copy>small{display:flex;align-items:center;gap:9px;margin-top:22px;font-weight:800;text-transform:uppercase;font-size:11px}.pfhc-ranking-copy>small i{width:9px;height:9px;background:#42b8ff;border-radius:50%}
.pfhc-ranking-art{position:relative;height:100%;min-height:640px}.pfhc-speed-lines{position:absolute;inset:8% -12% 3% 3%;background:radial-gradient(circle at 58% 42%,rgba(66,184,255,.52),transparent 24%),repeating-linear-gradient(160deg,transparent 0 31px,rgba(66,184,255,.075) 32px 35px);clip-path:polygon(10% 7%,100% 0,91% 87%,0 100%)}.pfhc-player{position:absolute;right:9%;top:9%;width:53%;height:68%;filter:drop-shadow(0 18px 24px rgba(0,0,0,.16));opacity:.94}.pfhc-player>span{position:absolute;top:0;left:43%;width:82px;height:90px;border-radius:50%;background:linear-gradient(145deg,#202020,#090909)}.pfhc-player>b{position:absolute;left:15%;top:72px;width:75%;height:75%;background:linear-gradient(135deg,#202020 0 50%,#101010 51% 61%,#191919 62%);clip-path:polygon(34% 0,70% 4%,100% 28%,79% 52%,93% 100%,56% 90%,30% 100%,17% 58%,0 36%,20% 17%)}.pfhc-player>i{position:absolute;left:7%;top:44%;width:126px;height:78px;border-radius:50%;transform:rotate(-18deg);background:#42b8ff;border:2px solid #050505;display:grid;place-items:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:25px;color:#050505;font-style:normal}
.pfhc-number-one{position:absolute;left:0;right:2%;bottom:30px;display:grid;grid-template-columns:46px 68px minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px 17px;background:rgba(255,255,255,.97);border:1px solid #d9e0e7;border-radius:10px;box-shadow:0 12px 28px rgba(14,28,45,.12);color:#111318;text-decoration:none}.pfhc-number-one>span{display:grid;place-items:center;width:42px;height:42px;border-radius:6px;background:#42b8ff;font-family:'Bebas Neue',Impact,sans-serif;font-size:27px}.pfhc-number-one div strong,.pfhc-number-one div small{display:block}.pfhc-number-one div small{color:#687385;margin-top:3px}.pfhc-number-one>b{font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;color:#42b8ff}
.pfhc-news,.pfhc-feature{position:relative;display:block;min-height:640px;overflow:hidden;color:#fff;text-decoration:none;background:#071727}.pfhc-news-image{position:absolute;inset:0}.pfhc-news-image>div{width:100%;height:100%;aspect-ratio:auto!important;border-radius:0!important}.pfhc-news-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,9,20,.94) 0%,rgba(2,9,20,.72) 46%,rgba(2,9,20,.22) 75%,rgba(2,9,20,.08)),linear-gradient(0deg,rgba(2,9,20,.88),transparent 58%)}.pfhc-news-copy,.pfhc-feature-copy{position:relative;z-index:2;min-height:640px;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;padding-top:72px;padding-bottom:86px}.pfhc-news-copy>span{font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#42b8ff}.pfhc-news h2,.pfhc-feature h2{max-width:920px;margin:16px 0 14px;font-size:clamp(3.8rem,7vw,7rem);line-height:.86}.pfhc-news-copy>p,.pfhc-feature-copy>p{max-width:720px;margin:0 0 24px;font-size:18px;line-height:1.45;color:rgba(255,255,255,.82)}
.pfhc-feature{background:linear-gradient(135deg,#050505 0 52%,#082b40 75%,#0a4f73)}.pfhc-feature-art{position:absolute;right:3%;top:8%;width:48%;height:82%}.pfhc-feature-art>span{position:absolute;right:12%;top:22%;display:grid;place-items:center;width:240px;height:150px;border-radius:50%;transform:rotate(-15deg);background:#42b8ff;border:3px solid #050505;color:#050505;font-family:'Bebas Neue',Impact,sans-serif;font-size:50px}.pfhc-feature-art>i,.pfhc-feature-art>b{position:absolute;border-radius:50%;background:rgba(66,184,255,.13)}.pfhc-feature-art>i{width:430px;height:430px;right:-8%;top:4%}.pfhc-feature-art>b{width:310px;height:310px;right:31%;bottom:-8%}
.pf-hero-carousel-controls{position:absolute;left:50%;bottom:22px;z-index:5;display:flex;gap:9px;transform:translateX(-50%)}.pf-hero-carousel-controls button{width:62px;height:6px;padding:0;border:0;border-radius:999px;background:rgba(150,160,174,.38);overflow:hidden;cursor:pointer}.pf-hero-carousel-controls button span{display:block;width:0;height:100%;background:#42b8ff}.pf-hero-carousel-controls button.is-active span{width:100%;animation:pfhcProgress ${AUTOPLAY_MS}ms linear}.pf-hero-carousel:hover .pf-hero-carousel-controls button.is-active span,.pf-hero-carousel:focus-within .pf-hero-carousel-controls button.is-active span{animation-play-state:paused}@keyframes pfhcProgress{from{width:0}to{width:100%}}
@media(prefers-reduced-motion:reduce){.pf-hero-carousel-track{transition:none}.pf-hero-carousel-controls button.is-active span{animation:none;width:100%}}
@media(max-width:760px){.pf-hero-carousel-slide,.pfhc-ranking,.pfhc-news,.pfhc-feature{min-height:680px}.pfhc-shell{width:calc(100% - 24px)}.pfhc-ranking{display:block;position:relative;padding-top:34px}.pfhc-ranking-copy{padding:22px 0 0;position:relative;z-index:3}.pfhc-ranking h1{font-size:4.65rem}.pfhc-ranking-copy>p{font-size:16px}.pfhc-ranking-art{position:absolute;inset:235px 0 0;min-height:0}.pfhc-player{right:-5%;top:5%;width:70%;height:62%}.pfhc-player>span{width:58px;height:64px}.pfhc-player>b{top:52px}.pfhc-player>i{width:94px;height:58px;font-size:20px}.pfhc-number-one{left:0;right:0;bottom:26px;grid-template-columns:40px 58px minmax(0,1fr) auto;padding:12px}.pfhc-number-one>b{font-size:31px}.pfhc-news-copy,.pfhc-feature-copy{min-height:680px;padding-top:90px;padding-bottom:78px}.pfhc-news h2,.pfhc-feature h2{font-size:3.75rem;max-width:95%}.pfhc-news-copy>p,.pfhc-feature-copy>p{font-size:15px;max-width:92%}.pfhc-news-shade{background:linear-gradient(0deg,rgba(2,9,20,.96) 0%,rgba(2,9,20,.7) 60%,rgba(2,9,20,.2))}.pfhc-feature-art{right:-18%;top:8%;width:85%;height:55%;opacity:.76}.pfhc-feature-art>span{width:150px;height:94px;font-size:34px}.pf-hero-carousel-controls{bottom:18px}.pf-hero-carousel-controls button{width:42px}}
`
