import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Play } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { TeamLogo } from '../rankings/bits'
import { loadHomeCardLogoMaps } from '../../lib/homeCardLogos'

type FeaturedHighlight = {
  id: string
  category: string
  playerName: string
  clubId: string | null
  clubName: string
  leagueName: string | null
  videoUrl: string
  thumbnailUrl: string | null
  description: string | null
  detailUrl: string
  featuredOrder: number | null
}

type DisplayHighlight = FeaturedHighlight & { clubLogoUrl: string | null; placeholder?: boolean }

const placeholders: DisplayHighlight[] = [
  { id: 'featured-placeholder-1', category: 'mark', playerName: 'Player to be featured', clubId: null, clubName: 'Mark of the Week', leagueName: 'Choose an approved highlight in Admin', videoUrl: '', thumbnailUrl: null, description: null, detailUrl: '/highlights', featuredOrder: 1, clubLogoUrl: null, placeholder: true },
  { id: 'featured-placeholder-2', category: 'goal', playerName: 'Player to be featured', clubId: null, clubName: 'Goal of the Week', leagueName: 'Choose an approved highlight in Admin', videoUrl: '', thumbnailUrl: null, description: null, detailUrl: '/highlights', featuredOrder: 2, clubLogoUrl: null, placeholder: true },
  { id: 'featured-placeholder-3', category: 'play', playerName: 'Player to be featured', clubId: null, clubName: 'Featured Highlight', leagueName: 'Choose an approved highlight in Admin', videoUrl: '', thumbnailUrl: null, description: null, detailUrl: '/highlights', featuredOrder: 3, clubLogoUrl: null, placeholder: true },
]

const categoryLabel = (category: string) => {
  if (category === 'mark') return 'Mark of the Week'
  if (category === 'goal') return 'Goal of the Week'
  if (category === 'performance') return 'Featured Performance'
  return 'Featured Highlight'
}

function youtubeEmbedUrl(value: string) {
  try {
    const url = new URL(value)
    let id = ''
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1).split('/')[0]
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2] ?? ''
      else if (url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2] ?? ''
      else id = url.searchParams.get('v') ?? ''
    }
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&loop=1&playlist=${encodeURIComponent(id)}&playsinline=1&controls=1&rel=0` : null
  } catch {
    return null
  }
}

function playableVideoUrl(value: string) {
  try {
    const url = new URL(value)
    return /\.(mp4|webm|mov|m4v)(?:$|[?#])/i.test(url.pathname) || url.pathname.includes('/storage/v1/object/public/')
  } catch {
    return false
  }
}

export default function HomeFeaturedHighlights() {
  const { pathname } = useLocation()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [rows, setRows] = useState<DisplayHighlight[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (pathname !== '/') {
      setTarget(null)
      return
    }

    let cancelled = false
    let observer: MutationObserver | null = null
    const attach = () => {
      if (cancelled) return true
      const featureGrid = document.querySelector<HTMLElement>('.pf-feature-grid')
      if (!featureGrid) return false
      setTarget(featureGrid)
      return true
    }

    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    const timeout = window.setTimeout(() => observer?.disconnect(), 10000)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      observer?.disconnect()
      setTarget(null)
    }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/') return
    let active = true
    void Promise.all([
      fetch('/api/highlights/featured').then(response => response.ok ? response.json() as Promise<{ data?: FeaturedHighlight[] }> : Promise.reject(new Error(`HTTP ${response.status}`))),
      loadHomeCardLogoMaps(),
    ]).then(([payload, logoMaps]) => {
      if (!active) return
      const highlights = Array.isArray(payload.data) ? payload.data.slice(0, 3) : []
      const mapped = highlights.map(row => ({ ...row, clubLogoUrl: row.clubId ? logoMaps.byClubId.get(row.clubId) ?? null : null }))
      setRows(mapped)
      setActiveId(mapped[0]?.id ?? null)
    }).catch(() => { if (active) setRows([]) })
    return () => { active = false }
  }, [pathname])

  const displayRows = placeholders.map((placeholder, index) => rows.find(row => row.featuredOrder === index + 1) ?? rows[index] ?? placeholder)

  useEffect(() => {
    const root = rowRef.current
    if (!root || pathname !== '/') return
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-highlight-id]'))
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible?.intersectionRatio && visible.intersectionRatio >= 0.58) {
        setActiveId((visible.target as HTMLElement).dataset.highlightId ?? null)
      }
    }, { root, threshold: [0.35, 0.58, 0.75, 1] })
    cards.forEach(card => observer.observe(card))
    return () => observer.disconnect()
  }, [displayRows.map(row => row.id).join('|'), pathname])

  if (!target || pathname !== '/') return null

  return createPortal(
    <section className="pf-featured-highlights">
      <header>
        <div><span>Marks, goals and moments of the week</span><h2>Plays of the Week</h2></div>
        <Link to="/highlights">All highlights</Link>
      </header>
      <div className="pf-featured-highlights-row" ref={rowRef}>
        {displayRows.map(row => (
          <article key={row.id} data-highlight-id={row.id} className={`pf-featured-highlight-card${row.placeholder ? ' is-placeholder' : ''}${activeId === row.id ? ' is-active' : ''}`}>
            <HighlightMedia row={row} active={activeId === row.id} />
            <div className="pf-featured-highlight-club">
              {row.clubId ? <Link to={`/team/${row.clubId}`} aria-label={`Open ${row.clubName} club profile`}><TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={58} /></Link> : <span className="pf-featured-highlight-empty-logo"><span>PF</span></span>}
              <div><strong>{row.clubName}</strong><small>{row.leagueName ?? row.description ?? 'Community football highlight'}</small></div>
              {!row.placeholder && <Link className="pf-featured-highlight-detail" to={row.detailUrl || `/highlights/${row.id}`}>Full highlight <ExternalLink size={13} /></Link>}
            </div>
          </article>
        ))}
      </div>
      <style>{styles}</style>
    </section>,
    target,
  )
}

function HighlightMedia({ row, active }: { row: DisplayHighlight; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const youtubeUrl = row.placeholder ? null : youtubeEmbedUrl(row.videoUrl)
  const directVideo = !row.placeholder && playableVideoUrl(row.videoUrl)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active) void video.play().catch(() => {})
    else video.pause()
  }, [active, row.videoUrl])

  return <div className="pf-featured-highlight-media" aria-label={row.placeholder ? categoryLabel(row.category) : `${row.playerName} ${categoryLabel(row.category)}`}>
    {row.placeholder ? <span className="pf-featured-highlight-placeholder" /> : youtubeUrl && active ? (
      <iframe src={youtubeUrl} title={`${row.playerName} ${categoryLabel(row.category)}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
    ) : directVideo ? (
      <video ref={videoRef} src={row.videoUrl} poster={row.thumbnailUrl ?? undefined} muted loop playsInline controls preload={active ? 'auto' : 'metadata'} />
    ) : row.thumbnailUrl ? (
      <a href={row.videoUrl} target="_blank" rel="noreferrer"><img src={row.thumbnailUrl} alt="" loading="lazy" /><span className="pf-featured-highlight-play"><Play size={34} fill="currentColor" /></span></a>
    ) : (
      <a href={row.videoUrl} target="_blank" rel="noreferrer"><span className="pf-featured-highlight-placeholder" /><span className="pf-featured-highlight-play"><Play size={34} fill="currentColor" /></span></a>
    )}
    {!youtubeUrl && !directVideo && !row.placeholder ? null : <span className="pf-featured-highlight-shade" />}
    <span className="pf-featured-highlight-category">{categoryLabel(row.category)}</span>
    <span className="pf-featured-highlight-player">{row.playerName}</span>
    {row.placeholder && <span className="pf-featured-highlight-play"><Play size={34} fill="currentColor" /></span>}
  </div>
}

const styles = `
.pf-feature-grid>.pf-featured-highlights{grid-column:1/-1;order:-1;width:100%;min-width:0;display:block;background:#fff;border-top:12px solid #eef3f7;padding:38px 0 48px;box-sizing:border-box;font-family:Barlow,Inter,Arial,sans-serif;overflow:hidden}
.pf-featured-highlights>header{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:18px}.pf-featured-highlights header span{display:block;color:#0783c9;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.pf-featured-highlights h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.5rem,5vw,4.8rem);line-height:.88;margin:6px 0 0;text-transform:uppercase}.pf-featured-highlights header>a{flex:0 0 auto;color:#42b8ff;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:900;white-space:nowrap}
.pf-featured-highlights-row{display:flex;gap:16px;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding-inline:0;padding:2px 0 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.pf-featured-highlights-row::-webkit-scrollbar{display:none}.pf-featured-highlight-card{flex:0 0 min(520px,88vw);min-width:0;scroll-snap-align:start;scroll-snap-stop:always;overflow:hidden;border:1px solid #dce3eb;border-radius:14px;background:#fff;box-shadow:0 8px 22px rgba(17,24,39,.08)}
.pf-featured-highlight-media{position:relative;display:block;aspect-ratio:16/9;overflow:hidden;background:#070b11;color:#fff;text-decoration:none}.pf-featured-highlight-media>video,.pf-featured-highlight-media>iframe,.pf-featured-highlight-media>a,.pf-featured-highlight-media>a>img,.pf-featured-highlight-placeholder{position:absolute;inset:0;width:100%;height:100%;border:0;object-fit:cover}.pf-featured-highlight-media>a{display:block;color:#fff}.pf-featured-highlight-placeholder{display:block;background:radial-gradient(circle at 72% 30%,rgba(66,184,255,.48),transparent 27%),linear-gradient(135deg,#050505,#10283a 58%,#148fd2)}.pf-featured-highlight-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.04) 54%,rgba(0,0,0,.78))}.pf-featured-highlight-category{position:absolute;z-index:3;left:22px;top:20px;padding:7px 10px;border-radius:999px;background:#42b8ff;color:#050505;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;pointer-events:none}.pf-featured-highlight-player{position:absolute;z-index:3;left:22px;right:90px;bottom:22px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.3rem,5vw,4.2rem);line-height:.88;text-transform:uppercase;pointer-events:none;text-shadow:0 2px 10px rgba(0,0,0,.55)}.pf-featured-highlight-play{position:absolute;z-index:3;left:50%;top:50%;display:grid;place-items:center;width:74px;height:74px;border-radius:50%;background:rgba(17,27,42,.88);transform:translate(-50%,-50%);box-shadow:0 8px 24px rgba(0,0,0,.28)}
.pf-featured-highlight-club{display:flex;align-items:center;gap:14px;padding:16px 20px}.pf-featured-highlight-club>a:not(.pf-featured-highlight-detail),.pf-featured-highlight-empty-logo{display:grid;place-items:center;flex:0 0 62px;width:62px;height:62px;text-decoration:none}.pf-featured-highlight-club img{max-width:58px;max-height:58px;object-fit:contain}.pf-featured-highlight-empty-logo{border-radius:14px;background:#eef3f7;color:#148fd2;font-family:'Bebas Neue',Impact,sans-serif;font-size:25px}.pf-featured-highlight-club>div{min-width:0;flex:1}.pf-featured-highlight-club strong,.pf-featured-highlight-club small{display:block}.pf-featured-highlight-club strong{font-size:17px;color:#111318}.pf-featured-highlight-club small{margin-top:4px;color:#687385;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pf-featured-highlight-detail{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;color:#0783c9;text-decoration:none;text-transform:uppercase;font-size:10px;font-weight:900}.pf-featured-highlight-card.is-placeholder .pf-featured-highlight-play{opacity:.7}
@media(min-width:1200px){.pf-featured-highlight-card{flex-basis:calc((100% - 32px)/3)}}
@media(max-width:900px){.pf-feature-grid>.pf-featured-highlights{padding:30px 0 38px}.pf-featured-highlights>header{align-items:flex-end;gap:12px;margin-bottom:15px}.pf-featured-highlights h2{font-size:clamp(2.6rem,8vw,3.7rem)}.pf-featured-highlights-row{gap:12px;padding-bottom:8px}.pf-featured-highlight-card{flex-basis:min(82vw,440px)}.pf-featured-highlight-player{font-size:clamp(2rem,7vw,3.25rem)}}
@media(max-width:620px){.pf-feature-grid>.pf-featured-highlights{width:100%;padding:24px 0 30px;border-top-width:9px}.pf-featured-highlights>header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:8px;margin-bottom:14px}.pf-featured-highlights header span{font-size:8px;line-height:1.25;letter-spacing:.13em}.pf-featured-highlights h2{font-size:2.65rem;line-height:.9;margin-top:5px}.pf-featured-highlights header>a{align-self:end;padding-bottom:3px;font-size:9px}.pf-featured-highlights-row{width:100%;gap:10px;scroll-padding-inline:0;padding:1px 0 8px}.pf-featured-highlight-card{flex:0 0 calc(100vw - 56px);max-width:390px;border-radius:12px}.pf-featured-highlight-media{aspect-ratio:16/9}.pf-featured-highlight-category{left:13px;top:12px;padding:6px 8px;font-size:8px}.pf-featured-highlight-player{left:14px;right:60px;bottom:14px;font-size:2.25rem;line-height:.9}.pf-featured-highlight-play{width:52px;height:52px}.pf-featured-highlight-play svg{width:24px;height:24px}.pf-featured-highlight-club{gap:11px;padding:11px 13px}.pf-featured-highlight-club>a:not(.pf-featured-highlight-detail),.pf-featured-highlight-empty-logo{flex-basis:48px;width:48px;height:48px;border-radius:11px}.pf-featured-highlight-club img{max-width:44px;max-height:44px}.pf-featured-highlight-empty-logo{font-size:21px}.pf-featured-highlight-club strong{font-size:14px;line-height:1.1}.pf-featured-highlight-club small{font-size:9px;margin-top:3px}.pf-featured-highlight-detail{font-size:8px}}
`