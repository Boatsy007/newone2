import { Link } from 'react-router-dom'
import type { ClubProfile } from '../../lib/rankings'
import { teamPath } from '../../lib/rankings'
import { TeamLogo } from '../rankings/bits'

type RelatedRow = NonNullable<ClubProfile['ladder']>[number] & {
  logoUrl?: string | null
}

export default function RelatedClubsWithLogos({ club }: { club: ClubProfile }) {
  const rows = (club.ladder ?? [])
    .filter(row => row.clubId !== club.clubId)
    .slice(0, 6) as RelatedRow[]

  if (!rows.length) return null

  return (
    <section className="related-clubs-logo-section">
      <div className="related-clubs-logo-inner">
        <header>
          <h2>Related <span>clubs</span></h2>
          <p>{club.leagueName ? `Other clubs in ${club.leagueName}.` : 'Clubs nearby on the current ladder.'}</p>
        </header>

        <div className="related-clubs-logo-grid">
          {rows.map(row => (
            <Link key={row.clubId} to={teamPath(row.clubId)} className="related-clubs-logo-card">
              <TeamLogo name={row.clubName} src={row.logoUrl ?? undefined} size={54} />
              <span className="related-clubs-logo-copy">
                <strong>{row.clubName}</strong>
                <small>{row.wins}-{row.losses}{row.draws ? `-${row.draws}` : ''} · {row.percentage ? `${row.percentage.toFixed(0)}%` : 'percentage pending'}</small>
              </span>
              <b>#{row.position ?? '·'}</b>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .related-clubs-logo-section{background:#f8fafb;box-sizing:border-box}
        .related-clubs-logo-inner{padding:clamp(28px,4vw,42px) 22px;box-sizing:border-box}
        .related-clubs-logo-inner>header{margin-bottom:22px}
        .related-clubs-logo-section h2{margin:0;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(34px,4vw,46px);line-height:.95;text-transform:uppercase;color:#111318}
        .related-clubs-logo-section h2 span{color:var(--club-primary,#2daaf5)}
        .related-clubs-logo-section p{margin:12px 0 0;color:#7b838c;font-size:16px;line-height:1.5}
        .related-clubs-logo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        .related-clubs-logo-card{display:grid;grid-template-columns:54px minmax(0,1fr) auto;align-items:center;gap:14px;min-height:92px;padding:16px 18px;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055);color:#111318;text-decoration:none}
        .related-clubs-logo-card:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(17,24,39,.09)}
        .related-clubs-logo-copy{min-width:0}
        .related-clubs-logo-copy strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:16px;line-height:1.2}
        .related-clubs-logo-copy small{display:block;margin-top:5px;color:#8a9199;font-family:Barlow,Inter,Arial,sans-serif;font-size:12px}
        .related-clubs-logo-card>b{font-family:'Bebas Neue',Impact,sans-serif;font-size:24px;color:var(--club-primary,#2daaf5)}
        @media(max-width:720px){
          .related-clubs-logo-inner{padding:28px 16px 34px}
          .related-clubs-logo-grid{grid-template-columns:1fr;gap:12px}
          .related-clubs-logo-card{grid-template-columns:58px minmax(0,1fr) auto;min-height:100px;padding:16px}
          .related-clubs-logo-card .related-clubs-logo-copy strong{font-size:17px}
        }
      `}</style>
    </section>
  )
}
