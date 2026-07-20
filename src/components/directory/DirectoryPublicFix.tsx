import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

type RankingLogo = { clubId: string; logoUrl?: string | null }
type RankingsPayload = { data?: RankingLogo[] }

function normalise(value: string) {
  return value.trim().toLocaleLowerCase('en-AU').replace(/\s+/g, ' ')
}

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

function ensureFinderMessage(directory: HTMLElement) {
  let message = directory.querySelector<HTMLElement>('.pf-directory-finder-message')
  if (!message) {
    message = document.createElement('div')
    message.className = 'pf-directory-finder-message'
    directory.appendChild(message)
  }
  return message
}

function applyDirectoryFilter() {
  const page = document.querySelector<HTMLElement>('.clubs-page')
  if (!page) return

  const search = page.querySelector<HTMLInputElement>('.search-box input')
  const selects = page.querySelectorAll<HTMLSelectElement>('.filters-panel select')
  const stateSelect = selects[0]
  const leagueSelect = selects[1]
  const query = normalise(search?.value ?? '')
  const state = normalise(stateSelect?.selectedOptions[0]?.textContent ?? '')
  const league = normalise(leagueSelect?.selectedOptions[0]?.textContent ?? '')
  const hasState = Boolean(stateSelect?.value)
  const hasLeague = Boolean(leagueSelect?.value)
  const active = Boolean(query || hasState || hasLeague)

  page.classList.toggle('pf-directory-filter-active', active)

  const directory = page.querySelector<HTMLElement>('.clubs-directory')
  const grid = page.querySelector<HTMLElement>('.club-grid')
  if (!directory) return

  const cards = Array.from(page.querySelectorAll<HTMLElement>('.club-grid .club-card'))
  let visible = 0

  for (const card of cards) {
    const text = normalise(card.textContent ?? '')
    const matchesQuery = !query || text.includes(query)
    const matchesState = !hasState || text.includes(state)
    const matchesLeague = !hasLeague || text.includes(league)
    const show = active && matchesQuery && matchesState && matchesLeague
    card.style.display = show ? '' : 'none'
    if (show) visible += 1
  }

  if (grid) grid.style.display = active && visible > 0 ? '' : 'none'

  const message = ensureFinderMessage(directory)
  if (!active) {
    message.textContent = 'Search for a club or choose a state and league to begin.'
    message.style.display = 'grid'
  } else if (visible === 0) {
    message.textContent = 'No clubs match those filters.'
    message.style.display = 'grid'
  } else {
    message.style.display = 'none'
  }

  const count = page.querySelector<HTMLElement>('.directory-toolbar b')
  if (count) count.textContent = String(active ? visible : 0)
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
    if (pathname !== '/directory') return
    let scheduled = 0
    const apply = () => {
      window.clearTimeout(scheduled)
      scheduled = window.setTimeout(() => {
        applyDirectoryFilter()
        if (logos.size > 0) applyDirectoryLogos(logos)
      }, 0)
    }

    apply()
    document.addEventListener('input', apply)
    document.addEventListener('change', apply)
    const root = document.querySelector('.clubs-page')
    const observer = new MutationObserver(apply)
    if (root) observer.observe(root, { childList: true, subtree: true })

    return () => {
      window.clearTimeout(scheduled)
      observer.disconnect()
      document.removeEventListener('input', apply)
      document.removeEventListener('change', apply)
    }
  }, [logos, pathname])

  if (pathname !== '/directory') return null

  return <style>{`
    .clubs-page .featured-strip,
    .clubs-page .clubs-sidebar {
      display: none !important;
    }

    .clubs-page .clubs-layout {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .pf-directory-finder-message {
      min-height: 210px;
      place-items: center;
      padding: 32px 20px;
      color: #64748b;
      font-size: 13px;
      font-weight: 950;
      letter-spacing: .12em;
      line-height: 1.5;
      text-align: center;
      text-transform: uppercase;
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
