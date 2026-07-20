import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

type FormResult = 'W' | 'L' | 'D'

type ClubPayload = {
  data?: {
    clubId: string
    clubName: string
    season?: string | null
  }
}

type ResultRow = {
  id: string
  matchDate?: string | null
  homeClubId?: string | null
  awayClubId?: string | null
  homeClubName?: string
  awayClubName?: string
  homeName?: string
  awayName?: string
  homePoints?: number
  awayPoints?: number
  homeScore?: number
  awayScore?: number
}

type ResultsPayload = { data?: ResultRow[] }

const normalise = (value: string | null | undefined) => (value ?? '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/\b(seniors?|senior men|a grade|football club|fc)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

function resultForClub(row: ResultRow, clubId: string, clubName: string): FormResult | null {
  const homeName = row.homeClubName ?? row.homeName ?? ''
  const awayName = row.awayClubName ?? row.awayName ?? ''
  const isHome = row.homeClubId === clubId || normalise(homeName) === normalise(clubName)
  const isAway = row.awayClubId === clubId || normalise(awayName) === normalise(clubName)
  if (!isHome && !isAway) return null

  const home = Number(row.homePoints ?? row.homeScore)
  const away = Number(row.awayPoints ?? row.awayScore)
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null
  if (home === away) return 'D'
  return isHome ? (home > away ? 'W' : 'L') : (away > home ? 'W' : 'L')
}

function pip(result: FormResult) {
  const span = document.createElement('span')
  span.textContent = result
  span.title = result
  span.dataset.pfFormResult = result
  Object.assign(span.style, {
    width: '20px',
    height: '20px',
    borderRadius: '5px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '11px',
    fontWeight: '800',
    color: '#fff',
    background: result === 'W' ? '#22c55e' : result === 'L' ? '#dc2626' : '#168fd2',
  })
  return span
}

function renderForm(form: FormResult[]) {
  const signature = form.join('')
  const labels = Array.from(document.querySelectorAll<HTMLElement>('.font-condensed'))
    .filter(node => ['form', 'recent form'].includes(node.textContent?.trim().toLowerCase() ?? ''))

  labels.forEach(label => {
    const host = label.parentElement
    if (!host) return

    const existing = Array.from(host.querySelectorAll<HTMLElement>('div'))
      .find(node => node !== label && Array.from(node.children).some(child => ['W', 'L', 'D'].includes(child.textContent?.trim() ?? '')))
    if (existing && !existing.classList.contains('pf-live-recent-form')) existing.style.setProperty('display', 'none', 'important')

    let live = host.querySelector<HTMLElement>(':scope > .pf-live-recent-form')
    if (!live) {
      live = document.createElement('div')
      live.className = 'pf-live-recent-form'
      host.appendChild(live)
    }

    live.style.setProperty('display', 'flex', 'important')
    live.style.setProperty('gap', '4px', 'important')
    live.style.setProperty('visibility', 'visible', 'important')
    live.style.setProperty('opacity', '1', 'important')
    live.style.setProperty('margin-top', label.textContent?.trim().toLowerCase() === 'recent form' ? '10px' : '0', 'important')

    if (live.dataset.signature !== signature) {
      live.replaceChildren(...form.map(pip))
      live.dataset.signature = signature
    }
  })
}

export default function ClubRecentFormBridge() {
  const { pathname } = useLocation()

  useEffect(() => {
    const match = pathname.match(/^\/team\/([^/]+)$/)
    if (!match) return
    const clubId = decodeURIComponent(match[1])
    let active = true
    let observer: MutationObserver | null = null
    let timer = 0
    let interval = 0

    void fetch(`/api/clubs/${encodeURIComponent(clubId)}`)
      .then(response => response.ok ? response.json() as Promise<ClubPayload> : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(async payload => {
        const club = payload.data
        if (!club) return
        const season = club.season ? `?season=${encodeURIComponent(club.season)}` : ''
        const response = await fetch(`/api/clubs/${encodeURIComponent(club.clubId)}/results${season}`)
        if (!response.ok) return
        const results = await response.json() as ResultsPayload
        if (!active) return

        const rows = Array.isArray(results.data) ? [...results.data] : []
        rows.sort((a, b) => {
          const left = a.matchDate ? Date.parse(a.matchDate) : 0
          const right = b.matchDate ? Date.parse(b.matchDate) : 0
          return right - left
        })
        const form = rows.flatMap(row => {
          const value = resultForClub(row, club.clubId, club.clubName)
          return value ? [value] : []
        }).slice(0, 5)
        if (!form.length) return

        const apply = () => {
          window.clearTimeout(timer)
          timer = window.setTimeout(() => { if (active) renderForm(form) }, 20)
        }
        renderForm(form)
        observer = new MutationObserver(apply)
        observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
        interval = window.setInterval(() => { if (active) renderForm(form) }, 500)
      })
      .catch(() => undefined)

    return () => {
      active = false
      observer?.disconnect()
      window.clearTimeout(timer)
      window.clearInterval(interval)
      document.querySelectorAll('.pf-live-recent-form').forEach(node => node.remove())
    }
  }, [pathname])

  return null
}
