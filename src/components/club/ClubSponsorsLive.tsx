import { useEffect, useMemo, useState } from 'react'
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
    })
  }, [rows])

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
        <div className="club-sponsor-grid">
          {sponsors.map(row => {
            const sponsor = row.sponsor!
            const logo = sponsor.logoUrl || sponsor.squareLogoUrl || null
            const href = row.ctaUrl || sponsor.websiteUrl || null
            const body = (
              <>
                <span className="club-sponsor-label">Official club sponsor</span>
                {logo ? <img src={logo} alt={`${sponsor.name} logo`} loading="eager" /> : null}
                <strong>{sponsor.name}</strong>
                {href ? <small>Visit sponsor website →</small> : null}
              </>
            )
            return href ? (
              <a key={row.id} className="club-sponsor-card" href={href} target="_blank" rel="noreferrer">{body}</a>
            ) : (
              <div key={row.id} className="club-sponsor-card">{body}</div>
            )
          })}
        </div>
      ) : (
        <div className="club-sponsor-empty">
          <span>Sponsor-ready space</span>
          <h3>Support {club.clubName}</h3>
          <p>No sponsors are listed yet. This section is ready for real club partners without displaying fake sponsors.</p>
        </div>
      )}

      <style>{`
        .club-sponsors-live{padding:clamp(24px,4vw,38px);font-family:Barlow,Inter,Arial,sans-serif}
        .club-sponsors-head>span{display:block;color:#2daaf5;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
        .club-sponsors-head h2{margin:7px 0 9px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.4rem,5vw,4rem);line-height:.9;text-transform:uppercase;color:#111318}
        .club-sponsors-head h2 em{color:#2daaf5;font-style:normal}.club-sponsors-head p{margin:0 0 22px;color:#687385;font-size:15px;line-height:1.55}
        .club-sponsor-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
        .club-sponsor-card{min-height:190px;padding:22px;border:1px solid #dfe4e9;border-radius:10px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#111318;text-align:center;text-decoration:none;box-shadow:0 6px 18px rgba(17,24,39,.055)}
        a.club-sponsor-card:hover{border-color:#2daaf5;transform:translateY(-2px)}
        .club-sponsor-card img{display:block;width:auto;max-width:min(230px,86%);height:auto;max-height:95px;object-fit:contain}
        .club-sponsor-card strong{font-size:18px;font-weight:900;line-height:1.15}.club-sponsor-card small{color:#0878bd;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}
        .club-sponsor-label{color:#687385;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
        .club-sponsor-empty{padding:clamp(22px,4vw,34px);border:1px dashed #dfe4e9;border-radius:10px;background:#fbfdff}.club-sponsor-empty>span{color:#2daaf5;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.club-sponsor-empty h3{margin:10px 0 8px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(1.5rem,3vw,2.3rem);line-height:.95;text-transform:uppercase}.club-sponsor-empty p{margin:0;color:#687385;line-height:1.6}
        .club-sponsor-loading{height:190px;border-radius:10px;background:linear-gradient(90deg,#eef2f5 25%,#f8fafb 50%,#eef2f5 75%);background-size:200% 100%;animation:club-sponsor-shimmer 1.2s linear infinite}@keyframes club-sponsor-shimmer{to{background-position:-200% 0}}
        @media(max-width:620px){.club-sponsors-live{padding:22px 18px}.club-sponsor-card{min-height:175px;padding:20px}.club-sponsor-card img{max-width:240px;max-height:105px}.club-sponsor-card strong{font-size:19px}}
      `}</style>
    </section>
  )
}
