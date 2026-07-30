import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ClubProfile } from '../../lib/rankings'

const ACTIVE_STATUSES = new Set(['APPROVED', 'ACTIVE', 'PAYMENT_COMPLETE', 'RENEWAL_DUE'])

type Sponsor = {
  id: string
  name: string
  logoUrl?: string | null
  squareLogoUrl?: string | null
  websiteUrl?: string | null
}

type Sponsorship = {
  id: string
  status?: string | null
  tier?: string | null
  displayPriority?: number | null
  startDate?: string | null
  endDate?: string | null
  ctaUrl?: string | null
  sponsor?: Sponsor | null
}

export default function ClubSponsorsLive({ club }: { club: ClubProfile }) {
  const [rows, setRows] = useState<Sponsorship[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/clubs/${encodeURIComponent(club.clubId)}/sponsors`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: Sponsorship[] }) => {
        if (active) setRows(Array.isArray(payload.data) ? payload.data : [])
      })
      .catch(() => { if (active) setRows([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [club.clubId])

  const sponsors = useMemo(() => {
    const now = Date.now()
    return rows.filter(row => {
      if (!row.sponsor) return false
      if (row.status && !ACTIVE_STATUSES.has(row.status)) return false
      const start = row.startDate ? Date.parse(row.startDate) : NaN
      const end = row.endDate ? Date.parse(row.endDate) : NaN
      return (!Number.isFinite(start) || start <= now) && (!Number.isFinite(end) || end >= now)
    }).sort((a, b) => (b.displayPriority ?? 0) - (a.displayPriority ?? 0) || (a.sponsor?.name ?? '').localeCompare(b.sponsor?.name ?? ''))
  }, [rows])

  const explicitMajor = sponsors.filter(row => String(row.tier ?? '').toUpperCase() === 'MAJOR')
  const hasTierData = sponsors.some(row => Boolean(String(row.tier ?? '').trim()))
  const majorSponsors = explicitMajor.length > 0 ? explicitMajor : (!hasTierData ? sponsors.slice(0, Math.min(2, sponsors.length)) : [])
  const majorIds = new Set(majorSponsors.map(row => row.id))
  const otherSponsors = sponsors.filter(row => !majorIds.has(row.id))

  return (
    <section className="club-sponsors-live">
      <div className="club-sponsors-head">
        <span>Club partners</span>
        <h2>Club <em>Sponsors</em></h2>
        <p>{sponsors.length ? `Proud partners supporting ${club.clubName}.` : 'Premium partner placements can appear here once a sponsor is connected.'}</p>
      </div>

      {loading ? (
        <div className="club-sponsor-loading" aria-label="Loading club sponsors" />
      ) : sponsors.length ? (
        <div className="club-sponsor-groups">
          {majorSponsors.length > 0 && <SponsorCarousel title="Major sponsors" rows={majorSponsors} major />}
          {otherSponsors.length > 0 && <SponsorCarousel title="Club sponsors" rows={otherSponsors} />}
        </div>
      ) : (
        <div className="club-sponsor-empty">
          <span>Sponsor-ready space</span>
          <h3>Support {club.clubName}</h3>
          <p>No sponsors are listed yet. This section is ready for real club partners without displaying fake sponsors.</p>
        </div>
      )}

      <style>{`
        .club-sponsors-live{--sponsor-pad:clamp(28px,5vw,48px);padding:var(--sponsor-pad);font-family:Barlow,Inter,Arial,sans-serif;overflow:hidden}
        .club-sponsors-head,.club-sponsor-group-head{padding-inline:12px}
        .club-sponsors-head>span,.club-sponsor-group-head span{display:block;color:#2daaf5;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
        .club-sponsors-head h2{margin:7px 0 9px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.4rem,5vw,4rem);line-height:.9;text-transform:uppercase;color:#111318}
        .club-sponsors-head h2 em{color:#2daaf5;font-style:normal}.club-sponsors-head p{margin:0 0 26px;color:#687385;font-size:15px;line-height:1.55}
        .club-sponsor-groups{display:grid;gap:32px}.club-sponsor-group{position:relative;min-width:0}
        .club-sponsor-group-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:12px}
        .club-sponsor-group-head h3{margin:0;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(1.7rem,3vw,2.5rem);line-height:.95;text-transform:uppercase;color:#111318}
        .club-sponsor-group-head span{font-size:9px;white-space:nowrap}
        .club-sponsor-viewport{position:relative}
        .club-sponsor-carousel{display:flex;gap:14px;overflow-x:auto;overflow-y:hidden;padding:4px 12px 16px;scroll-snap-type:x mandatory;scroll-padding-inline:12px;scroll-behavior:smooth;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-inline:contain;touch-action:pan-x}
        .club-sponsor-carousel::-webkit-scrollbar{display:none}
        .club-sponsor-card{flex:0 0 clamp(210px,31vw,310px);min-width:0;min-height:160px;padding:28px;border:1px solid #dfe4e9;border-radius:14px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;color:#111318;text-align:center;text-decoration:none;box-sizing:border-box;box-shadow:0 7px 20px rgba(17,24,39,.065);scroll-snap-align:center;scroll-snap-stop:always;transition:border-color .18s ease,transform .18s ease}
        .club-sponsor-carousel.major .club-sponsor-card{flex-basis:clamp(300px,48vw,470px);min-height:225px;padding:36px}
        a.club-sponsor-card:hover{border-color:#2daaf5;transform:translateY(-2px)}
        .club-sponsor-card img{display:block;width:auto;max-width:min(250px,82%);height:auto;max-height:92px;object-fit:contain}.club-sponsor-carousel.major .club-sponsor-card img{max-width:min(360px,84%);max-height:132px}
        .club-sponsor-card strong{font-size:17px;font-weight:900;line-height:1.15}.club-sponsor-carousel.major .club-sponsor-card strong{font-size:21px}
        .club-sponsor-card small{color:#0878bd;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}.club-sponsor-label{color:#687385;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
        .club-sponsor-arrow{position:absolute;top:50%;z-index:4;display:grid;place-items:center;width:46px;height:64px;border:1px solid rgba(255,255,255,.65);border-radius:12px;background:rgba(10,18,28,.86);color:#fff;opacity:0;transform:translateY(-50%);transition:opacity .18s ease,background .18s ease;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.22)}
        .club-sponsor-arrow.prev{left:12px}.club-sponsor-arrow.next{right:12px}.club-sponsor-viewport:hover .club-sponsor-arrow,.club-sponsor-arrow:focus-visible{opacity:1}.club-sponsor-arrow:hover{background:#2daaf5;color:#071018}.club-sponsor-arrow svg{width:25px;height:25px}
        .club-sponsor-empty{padding:clamp(26px,5vw,40px);border:1px dashed #dfe4e9;border-radius:14px;background:#fbfdff}.club-sponsor-empty>span{color:#2daaf5;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.club-sponsor-empty h3{margin:10px 0 8px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(1.5rem,3vw,2.3rem);line-height:.95;text-transform:uppercase}.club-sponsor-empty p{margin:0;color:#687385;line-height:1.6}
        .club-sponsor-loading{height:225px;border-radius:14px;background:linear-gradient(90deg,#eef2f5 25%,#f8fafb 50%,#eef2f5 75%);background-size:200% 100%;animation:club-sponsor-shimmer 1.2s linear infinite}@keyframes club-sponsor-shimmer{to{background-position:-200% 0}}
        @media(max-width:620px){
          .club-sponsors-live{--sponsor-pad:24px;padding:30px var(--sponsor-pad) 36px}
          .club-sponsors-head,.club-sponsor-group-head{padding-inline:12px}.club-sponsors-head p{margin-bottom:24px}.club-sponsor-groups{gap:29px}.club-sponsor-group-head{margin-bottom:10px}
          .club-sponsor-viewport{margin-inline:calc(var(--sponsor-pad) * -1)}
          .club-sponsor-carousel{gap:12px;padding:4px 24px 15px;scroll-padding-inline:24px}
          .club-sponsor-card{flex:0 0 38vw;min-height:145px;padding:19px 14px;border-radius:12px;gap:8px}
          .club-sponsor-carousel.major .club-sponsor-card{flex:0 0 66vw;min-height:215px;padding:30px 22px}
          .club-sponsor-card img{max-width:88%;max-height:76px}.club-sponsor-carousel.major .club-sponsor-card img{max-width:88%;max-height:122px}.club-sponsor-card strong{font-size:14px}.club-sponsor-carousel.major .club-sponsor-card strong{font-size:19px}.club-sponsor-card small{font-size:8px}.club-sponsor-label{font-size:8px}
          .club-sponsor-arrow{display:none}.club-sponsor-group-head span{font-size:8px}
        }
      `}</style>
    </section>
  )
}

function SponsorCarousel({ title, rows, major = false }: { title: string; rows: Sponsorship[]; major?: boolean }) {
  const carouselRef = useRef<HTMLDivElement>(null)
  const move = (direction: -1 | 1) => {
    const carousel = carouselRef.current
    const card = carousel?.querySelector<HTMLElement>('.club-sponsor-card')
    if (!carousel || !card) return
    const gap = Number.parseFloat(getComputedStyle(carousel).columnGap || getComputedStyle(carousel).gap || '14') || 14
    carousel.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: 'smooth' })
  }

  return (
    <section className="club-sponsor-group">
      <div className="club-sponsor-group-head"><h3>{title}</h3>{rows.length > 1 && <span>Swipe to explore →</span>}</div>
      <div className="club-sponsor-viewport">
        {rows.length > 1 && <button className="club-sponsor-arrow prev" type="button" aria-label={`Previous ${title}`} onClick={() => move(-1)}><ChevronLeft /></button>}
        <div ref={carouselRef} className={`club-sponsor-carousel${major ? ' major' : ''}`}>
          {rows.map(row => {
            const sponsor = row.sponsor!
            const logo = sponsor.logoUrl || sponsor.squareLogoUrl || null
            const href = row.ctaUrl || sponsor.websiteUrl || null
            const body = <><span className="club-sponsor-label">{major ? 'Major club partner' : 'Official club sponsor'}</span>{logo ? <img src={logo} alt={`${sponsor.name} logo`} loading="eager" /> : null}<strong>{sponsor.name}</strong>{href ? <small>Visit sponsor website →</small> : null}</>
            return href ? <a key={row.id} className="club-sponsor-card" href={href} target="_blank" rel="noreferrer">{body}</a> : <div key={row.id} className="club-sponsor-card">{body}</div>
          })}
        </div>
        {rows.length > 1 && <button className="club-sponsor-arrow next" type="button" aria-label={`Next ${title}`} onClick={() => move(1)}><ChevronRight /></button>}
      </div>
    </section>
  )
}
