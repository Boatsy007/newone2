import { useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Play } from 'lucide-react'
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
  {
    id: 'featured-placeholder-1', category: 'mark', playerName: 'Player to be featured', clubId: null,
    clubName: 'Mark of the Week', leagueName: 'Select an approved highlight in Admin', videoUrl: '', thumbnailUrl: null,
    description: null, detailUrl: '/highlights', featuredOrder: 1, clubLogoUrl: null, placeholder: true,
  },
  {
    id: 'featured-placeholder-2', category: 'goal', playerName: 'Player to be featured', clubId: null,
    clubName: 'Goal of the Week', leagueName: 'Select an approved highlight in Admin', videoUrl: '', thumbnailUrl: null,
    description: null, detailUrl: '/highlights', featuredOrder: 2, clubLogoUrl: null, placeholder: true,
  },
  {
    id: 'featured-placeholder-3', category: 'play', playerName: 'Player to be featured', clubId: null,
    clubName: 'Featured Highlight', leagueName: 'Select an approved highlight in Admin', videoUrl: '', thumbnailUrl: null,
    description: null, detailUrl: '/highlights', featuredOrder: 3, clubLogoUrl: null, placeholder: true,
  },
]

const categoryLabel = (category: string) => {
  if (category === 'mark') return 'Mark of the Week'
  if (category === 'goal') return 'Goal of the Week'
  if (category === 'performance') return 'Featured Performance'
  return 'Featured Highlight'
}

export default function HomeFeaturedHighlights() {
  const { pathname } = useLocation()
  const [rows, setRows] = useState<DisplayHighlight[]>([])
  const rootRef = useRef<Root | null>(null)
  const slotRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (pathname !== '/') return

    let cancelled = false
    let observer: MutationObserver | null = null
    let timeout = 0

    const attach = () => {
      if (cancelled || rootRef.current) return true
      const featureGrid = document.querySelector<HTMLElement>('.pf-feature-grid')
      if (!featureGrid?.parentElement) return false

      let slot = document.getElementById('pf-home-featured-highlights-slot')
      if (!slot) {
        slot = document.createElement('div')
        slot.id = 'pf-home-featured-highlights-slot'
      }
      featureGrid.parentElement.insertBefore(slot, featureGrid)
      slotRef.current = slot
      rootRef.current = createRoot(slot)
      return true
    }

    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
      timeout = window.setTimeout(() => observer?.disconnect(), 10000)
    }

    return () => {
      cancelled = true
      if (timeout) window.clearTimeout(timeout)
      observer?.disconnect()
      rootRef.current?.unmount()
      rootRef.current = null
      slotRef.current?.remove()
      slotRef.current = null
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
      setRows(highlights.map(row => ({
        ...row,
        clubLogoUrl: row.clubId ? logoMaps.byClubId.get(row.clubId) ?? null : null,
      })))
    }).catch(() => { if (active) setRows([]) })
    return () => { active = false }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/' || !rootRef.current) return
    const displayRows = placeholders.map((placeholder, index) =>
      rows.find(row => row.featuredOrder === index + 1) ?? rows[index] ?? placeholder,
    )
    rootRef.current.render(<FeaturedHighlightsSection rows={displayRows} />)
  }, [pathname, rows])

  useEffect(() => {
    if (pathname !== '/') return
    const interval = window.setInterval(() => {
      if (!rootRef.current) return
      const displayRows = placeholders.map((placeholder, index) =>
        rows.find(row => row.featuredOrder === index + 1) ?? rows[index] ?? placeholder,
      )
      rootRef.current.render(<FeaturedHighlightsSection rows={displayRows} />)
      window.clearInterval(interval)
    }, 100)
    return () => window.clearInterval(interval)
  }, [pathname, rows])

  return null
}

function FeaturedHighlightsSection({ rows }: { rows: DisplayHighlight[] }) {
  return <section className="pf-featured-highlights pf-shell">
    <header>
      <div><span>Marks, goals and moments of the week</span><h2>Featured Highlights</h2></div>
      <Link to="/highlights">All highlights</Link>
    </header>
    <div className="pf-featured-highlights-row">
      {rows.map(row => (
        <article key={row.id} className={`pf-featured-highlight-card${row.placeholder ? ' is-placeholder' : ''}`}>
          <Link to={row.detailUrl || `/highlights/${row.id}`} className="pf-featured-highlight-media" aria-label={row.placeholder ? categoryLabel(row.category) : `Watch ${row.playerName} ${categoryLabel(row.category)}`}>
            {row.thumbnailUrl ? <img src={row.thumbnailUrl} alt="" loading="lazy" /> : <span className="pf-featured-highlight-placeholder" />}
            <span className="pf-featured-highlight-shade" />
            <span className="pf-featured-highlight-category">{categoryLabel(row.category)}</span>
            <span className="pf-featured-highlight-player">{row.playerName}</span>
            <span className="pf-featured-highlight-play"><Play size={34} fill="currentColor" /></span>
          </Link>
          <div className="pf-featured-highlight-club">
            {row.clubId ? <Link to={`/team/${row.clubId}`} aria-label={`Open ${row.clubName} club profile`}><TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={58} /></Link> : <span className="pf-featured-highlight-empty-logo"><span>PF</span></span>}
            <div><strong>{row.clubName}</strong><small>{row.leagueName ?? row.description ?? 'Community football highlight'}</small></div>
          </div>
        </article>
      ))}
    </div>
    <style>{styles}</style>
  </section>
}

const styles = `
#pf-home-featured-highlights-slot{display:block;clear:both;background:#fff;border-top:12px solid #eef3f7;padding:38px 0 48px;box-sizing:border-box}
.pf-featured-highlights{font-family:Barlow,Inter,Arial,sans-serif}.pf-featured-highlights>header{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:18px}.pf-featured-highlights header span{display:block;color:#0783c9;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.pf-featured-highlights h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.5rem,5vw,4.8rem);line-height:.88;margin:6px 0 0;text-transform:uppercase}.pf-featured-highlights header>a{color:#42b8ff;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:900}
.pf-featured-highlights-row{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 0 10px;scrollbar-width:none}.pf-featured-highlights-row::-webkit-scrollbar{display:none}.pf-featured-highlight-card{flex:0 0 min(520px,88vw);scroll-snap-align:start;overflow:hidden;border:1px solid #dce3eb;border-radius:14px;background:#fff;box-shadow:0 8px 22px rgba(17,24,39,.08)}
.pf-featured-highlight-media{position:relative;display:block;aspect-ratio:16/9;overflow:hidden;background:#070b11;color:#fff;text-decoration:none}.pf-featured-highlight-media>img,.pf-featured-highlight-placeholder{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.pf-featured-highlight-placeholder{display:block;background:radial-gradient(circle at 72% 30%,rgba(66,184,255,.48),transparent 27%),linear-gradient(135deg,#050505,#10283a 58%,#148fd2)}.pf-featured-highlight-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.2) 38%,rgba(0,0,0,.86))}.pf-featured-highlight-category{position:absolute;left:22px;top:20px;padding:7px 10px;border-radius:999px;background:#42b8ff;color:#050505;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.pf-featured-highlight-player{position:absolute;left:22px;right:90px;bottom:22px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.3rem,5vw,4.2rem);line-height:.88;text-transform:uppercase}.pf-featured-highlight-play{position:absolute;left:50%;top:50%;display:grid;place-items:center;width:74px;height:74px;border-radius:50%;background:rgba(17,27,42,.88);transform:translate(-50%,-50%);box-shadow:0 8px 24px rgba(0,0,0,.28)}
.pf-featured-highlight-club{display:flex;align-items:center;gap:14px;padding:16px 20px}.pf-featured-highlight-club>a,.pf-featured-highlight-empty-logo{display:grid;place-items:center;flex:0 0 62px;width:62px;height:62px;text-decoration:none}.pf-featured-highlight-club img{max-width:58px;max-height:58px;object-fit:contain}.pf-featured-highlight-empty-logo{border-radius:14px;background:#eef3f7;color:#148fd2;font-family:'Bebas Neue',Impact,sans-serif;font-size:25px}.pf-featured-highlight-club div{min-width:0}.pf-featured-highlight-club strong,.pf-featured-highlight-club small{display:block}.pf-featured-highlight-club strong{font-size:17px;color:#111318}.pf-featured-highlight-club small{margin-top:4px;color:#687385;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pf-featured-highlight-card.is-placeholder .pf-featured-highlight-play{opacity:.7}
@media(min-width:1200px){.pf-featured-highlight-card{flex-basis:calc((100% - 32px)/3)}}
@media(max-width:620px){#pf-home-featured-highlights-slot{padding:28px 0 34px}.pf-featured-highlights{width:calc(100% - 24px)}.pf-featured-highlights>header{align-items:flex-end}.pf-featured-highlights h2{font-size:3.1rem}.pf-featured-highlights header>a{font-size:10px}.pf-featured-highlight-card{flex-basis:88vw}.pf-featured-highlight-category{left:16px;top:15px}.pf-featured-highlight-player{left:16px;bottom:17px}.pf-featured-highlight-play{width:62px;height:62px}.pf-featured-highlight-club{padding:13px 16px}}
`
