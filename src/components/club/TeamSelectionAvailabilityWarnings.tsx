import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

type Session = { access_token: string }
type AvailabilityPlayer = { id: string; status: string | null; reason: string | null }
type Overview = { selectedSheetId: string | null; players: AvailabilityPlayer[] }

const SESSION_KEY = 'playfooty.clubPortal.session.v1'

function session(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as Session : null
  } catch {
    return null
  }
}

function labelFor(player: AvailabilityPlayer) {
  const status = player.status === 'UNAVAILABLE' ? 'Not available'
    : player.status === 'TEST' ? 'Test'
    : player.status === 'UNLIKELY' ? 'Unlikely'
    : player.status === 'UNSURE' ? 'Not sure'
    : player.status === 'AVAILABLE' ? 'Available'
    : 'No response'
  const reason = player.reason ? ` · ${player.reason.toLowerCase().replaceAll('_', ' ')}` : ''
  return `${status}${reason}`
}

function warningClass(player: AvailabilityPlayer | undefined) {
  if (!player || !player.status || player.status === 'UNSURE') return 'availability-pending'
  if (player.status === 'UNAVAILABLE') return 'availability-unavailable'
  if (player.status === 'TEST' || player.status === 'UNLIKELY') return 'availability-caution'
  return ''
}

export default function TeamSelectionAvailabilityWarnings() {
  const { pathname } = useLocation()

  useEffect(() => {
    const match = pathname.match(/^\/club-portal\/([^/]+)\/team-selection$/)
    if (!match) return
    const clubId = match[1]
    const current = session()
    if (!current) return

    let stopped = false
    let players = new Map<string, AvailabilityPlayer>()
    let activeSheetId = ''
    let timer = 0

    const findSheetSelect = () => Array.from(document.querySelectorAll<HTMLSelectElement>('.cpts select')).find(select => {
      const label = select.closest('label')?.textContent?.toLowerCase() ?? ''
      return label.includes('existing selections')
    })

    const clearWarning = (label: HTMLLabelElement, select: HTMLSelectElement) => {
      select.classList.remove('availability-unavailable', 'availability-caution', 'availability-pending')
      label.querySelector('[data-availability-warning]')?.remove()
    }

    const paint = () => {
      document.querySelectorAll<HTMLLabelElement>('.cpts-position').forEach(label => {
        const select = label.querySelector('select')
        if (!select) return
        clearWarning(label, select)
        if (!select.value) return
        const player = players.get(select.value)
        const className = warningClass(player)
        if (!className) return
        select.classList.add(className)
        const note = document.createElement('small')
        note.dataset.availabilityWarning = 'true'
        note.className = `cpts-availability-warning ${className}`
        note.textContent = labelFor(player ?? { id: select.value, status: null, reason: null })
        label.appendChild(note)
      })
    }

    const load = async (sheetId: string) => {
      activeSheetId = sheetId
      if (!sheetId) {
        players = new Map()
        paint()
        return
      }
      try {
        const response = await fetch(`/api/club-portal/availability/clubs/${encodeURIComponent(clubId)}/overview?sheetId=${encodeURIComponent(sheetId)}`, {
          headers: { authorization: `Bearer ${current.access_token}` },
        })
        const payload = await response.json() as { data?: Overview }
        if (!response.ok || stopped || activeSheetId !== sheetId) return
        players = new Map((payload.data?.players ?? []).map(player => [player.id, player]))
        paint()
      } catch {
        if (!stopped) players = new Map()
      }
    }

    const connect = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const sheetSelect = findSheetSelect()
        const nextSheetId = sheetSelect?.value ?? ''
        if (nextSheetId !== activeSheetId) void load(nextSheetId)
        paint()
      }, 40)
    }

    const onChange = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLSelectElement)) return
      if (target.closest('.cpts-position')) paint()
      if (target === findSheetSelect()) void load(target.value)
    }

    const style = document.createElement('style')
    style.dataset.teamSelectionAvailabilityWarnings = 'true'
    style.textContent = `
      .cpts-position select.availability-unavailable{color:#b42318!important;border:2px solid #d92d20!important;background:#fff1f0!important;font-weight:950!important}
      .cpts-position select.availability-caution{color:#8a4b08!important;border:2px solid #e09a2d!important;background:#fff8e8!important;font-weight:950!important}
      .cpts-position select.availability-pending{color:#6840a5!important;border:2px solid #8b6fc0!important;background:#f6f1ff!important;font-weight:950!important}
      .cpts-availability-warning{display:block!important;margin-top:4px!important;font-size:8px!important;font-weight:950!important;line-height:1.2!important;text-transform:uppercase!important;letter-spacing:.03em!important}
      .cpts-availability-warning.availability-unavailable{color:#b42318!important}
      .cpts-availability-warning.availability-caution{color:#8a4b08!important}
      .cpts-availability-warning.availability-pending{color:#6840a5!important}
    `
    document.head.appendChild(style)

    document.addEventListener('change', onChange, true)
    const observer = new MutationObserver(connect)
    observer.observe(document.body, { childList: true, subtree: true })
    connect()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      document.removeEventListener('change', onChange, true)
      observer.disconnect()
      style.remove()
    }
  }, [pathname])

  return null
}
