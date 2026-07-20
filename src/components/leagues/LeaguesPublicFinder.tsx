import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function applyLeagueFinder() {
  const page = document.querySelector<HTMLElement>('.leagues-page')
  if (!page) return false

  page.querySelector('.featured-strip')?.remove()
  page.querySelector('.leagues-sidebar')?.remove()

  const layout = page.querySelector<HTMLElement>('.leagues-layout')
  if (layout) layout.style.gridTemplateColumns = 'minmax(0, 1fr)'

  const search = page.querySelector<HTMLInputElement>('.search-box input')
  const state = page.querySelector<HTMLSelectElement>('.filters-panel select')
  const active = Boolean(search?.value.trim() || (state?.value && state.value !== 'All states'))
  const grid = page.querySelector<HTMLElement>('.league-grid')
  const directory = page.querySelector<HTMLElement>('.league-directory')
  const count = page.querySelector<HTMLElement>('.directory-toolbar b')
  if (!directory) return true

  let message = directory.querySelector<HTMLElement>('.pf-league-finder-message')
  if (!message) {
    message = document.createElement('div')
    message.className = 'pf-league-finder-message'
    directory.appendChild(message)
  }

  const visible = active ? page.querySelectorAll('.league-grid .league-card').length : 0
  if (count) count.textContent = String(visible)
  if (grid) grid.style.display = active && visible > 0 ? '' : 'none'

  if (!active) {
    message.textContent = 'Search for a league or choose a state to begin.'
    message.style.display = 'grid'
  } else if (visible === 0) {
    message.textContent = 'No leagues match those filters.'
    message.style.display = 'grid'
  } else {
    message.style.display = 'none'
  }

  return true
}

export default function LeaguesPublicFinder() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname !== '/leagues') return

    let attempts = 0
    let timer = 0
    const apply = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const ready = applyLeagueFinder()
        if (!ready && attempts < 20) {
          attempts += 1
          timer = window.setTimeout(apply, 50)
        }
      }, 0)
    }

    apply()
    document.addEventListener('input', apply)
    document.addEventListener('change', apply)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('input', apply)
      document.removeEventListener('change', apply)
    }
  }, [pathname])

  if (pathname !== '/leagues') return null

  return <style>{`
    .leagues-page .featured-strip,
    .leagues-page .leagues-sidebar {
      display: none !important;
    }

    .leagues-page .leagues-layout {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .pf-league-finder-message {
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
  `}</style>
}
