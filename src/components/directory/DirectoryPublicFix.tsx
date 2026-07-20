import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

type RankingLogo = { clubId: string; logoUrl?: string | null }
type RankingsPayload = { data?: RankingLogo[] }

function applyDirectoryLogos(logos: Map<string, string>) {
  document.querySelectorAll<HTMLAnchorElement>('.clubs-page .club-card[href^="/team/"], .clubs-page .feature-tile[href^="/team/"]').forEach(card => {
    const href = card.getAttribute('href') ?? ''
    const clubId = decodeURIComponent(href.split('/team/')[1]?.split(/[?#]/)[0] ?? '')
    const logoUrl = logos.get(clubId)
    if (!logoUrl) return

    const slot = card.querySelector<HTMLElement>('header > :first-child, :scope > :first-child')
    if (!slot || slot.dataset.pfRealLogo === logoUrl) return

    slot.dataset.pfRealLogo = logoUrl
    slot.innerHTML = ''
    const image = document.createElement('img')
    image.src = logoUrl
    image.alt = ''
    image.loading = 'lazy'
    image.decoding = 'async'
    image.style.width = '100%'
    image.style.height = '100%'
    image.style.objectFit = 'contain'
    slot.appendChild(image)
  })
}

export default function DirectoryPublicFix() {
  const { pathname } = useLocation()
  const [logos, setLogos] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (pathname !== '/directory') return
    let active = true
    void fetch('/api/rankings')
      .then(response => response.ok ? response.json() as Promise<RankingsPayload> : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(payload => {
        if (!active) return
        setLogos(new Map((payload.data ?? []).filter(row => row.logoUrl).map(row => [row.clubId, row.logoUrl as string])))
      })
      .catch(() => { if (active) setLogos(new Map()) })
    return () => { active = false }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/directory' || logos.size === 0) return
    const apply = () => window.setTimeout(() => applyDirectoryLogos(logos), 0)
    apply()
    document.addEventListener('input', apply)
    document.addEventListener('change', apply)
    return () => {
      document.removeEventListener('input', apply)
      document.removeEventListener('change', apply)
    }
  }, [logos, pathname])

  if (pathname !== '/directory') return null

  return <style>{`
    /* When filters are active, show only the filtered directory results. */
    .clubs-page .clubs-header:has(.clear-btn) + .featured-strip {
      display: none !important;
    }

    .clubs-page .club-card,
    .clubs-page .feature-tile {
      position: relative !important;
      padding-bottom: 68px !important;
    }

    .clubs-page .club-card > .pf-auto-share,
    .clubs-page .feature-tile > .pf-auto-share {
      top: auto !important;
      right: 14px !important;
      bottom: 14px !important;
      padding: 9px 13px !important;
      gap: 7px !important;
      min-height: 38px;
    }

    .clubs-page .club-card > .pf-auto-share span,
    .clubs-page .feature-tile > .pf-auto-share span {
      display: inline !important;
    }

    .clubs-page .club-card .club-rank {
      padding-right: 0;
    }

    @media (max-width: 720px) {
      .clubs-page .club-card,
      .clubs-page .feature-tile {
        padding-bottom: 72px !important;
      }

      .clubs-page .club-card > .pf-auto-share,
      .clubs-page .feature-tile > .pf-auto-share {
        right: 15px !important;
        bottom: 15px !important;
      }
    }
  `}</style>
}
