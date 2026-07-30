import type { ClubProfile } from '../../lib/rankings'

export default function PublicClubGallery({ club }: { club: ClubProfile }) {
  const gallery = Array.isArray(club.gallery) ? club.gallery.filter(Boolean) : []
  const uniforms = Array.isArray(club.uniformPhotos) ? club.uniformPhotos.filter(Boolean) : []
  const photos = [...new Set([...gallery, ...uniforms])]

  return (
    <section className="public-club-gallery">
      <div className="public-club-gallery-head">
        <span>Club media</span>
        <h2>Photo <em>Gallery</em></h2>
        <p>{photos.length ? `Photos published by ${club.clubName}.` : `No photos have been published by ${club.clubName} yet.`}</p>
      </div>

      {photos.length ? (
        <div className="public-club-gallery-grid">
          {photos.map((url, index) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" aria-label={`Open ${club.clubName} photo ${index + 1}`}>
              <img src={url} alt={`${club.clubName} club photo ${index + 1}`} loading={index < 2 ? 'eager' : 'lazy'} />
            </a>
          ))}
        </div>
      ) : (
        <div className="public-club-gallery-empty">
          <strong>Photos coming soon</strong>
          <p>The club can publish photos through its PlayFooty workspace.</p>
        </div>
      )}

      <style>{`
        .public-club-gallery{box-sizing:border-box;width:100%;padding:clamp(24px,4vw,38px)!important;font-family:Barlow,Inter,Arial,sans-serif}
        .public-club-gallery-head>span{display:block;color:var(--club-primary,#2daaf5);font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
        .public-club-gallery-head h2{margin:7px 0 9px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.6rem,5vw,4.4rem);line-height:.9;text-transform:uppercase;color:#111318}
        .public-club-gallery-head h2 em{color:var(--club-primary,#2daaf5);font-style:normal}
        .public-club-gallery-head p{margin:0 0 22px;color:#687385;font-size:15px;line-height:1.55}
        .public-club-gallery-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .public-club-gallery-grid a{display:block;overflow:hidden;border-radius:10px;background:#e9eef2;aspect-ratio:4/3}
        .public-club-gallery-grid img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .2s ease}
        .public-club-gallery-grid a:hover img{transform:scale(1.02)}
        .public-club-gallery-empty{padding:30px;border:1px dashed #d7dfe6;border-radius:10px;background:#fbfdff;text-align:center}
        .public-club-gallery-empty strong{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;text-transform:uppercase;color:#111318}
        .public-club-gallery-empty p{margin:8px 0 0;color:#687385}
        @media(max-width:620px){.public-club-gallery{padding:20px 30px!important}.public-club-gallery-grid{grid-template-columns:1fr}}
      `}</style>
    </section>
  )
}
