import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getKey } from '../../lib/admin'

const accessLinks = [
  { key: 'club-access', label: 'Club Claims & Users', path: '/admin/claims', icon: '♟' },
  { key: 'league-access', label: 'League Claims & Users', path: '/admin/league-access', icon: '♙' },
]

const importLinks = [
  { key: 'universal-imports', label: 'Universal Import', path: '/admin/universal-imports', icon: '⇧' },
  { key: 'ladder-images', label: 'Ladder Images', path: '/admin/ladder-images', icon: '▤' },
  { key: 'match-images', label: 'Results & Fixtures', path: '/admin/match-images', icon: '⚑' },
  { key: 'goal-kicker-images', label: 'Goal Kickers', path: '/admin/goal-kicker-images', icon: '◎' },
  { key: 'mvp-images', label: 'MVP', path: '/admin/mvp-images', icon: '★' },
  { key: 'profile-images', label: 'Profile Images', path: '/admin/profile-images', icon: '▣' },
]

const operationLinks = [
  { key: 'launch-readiness', label: 'Launch Readiness', path: '/admin/launch-readiness', icon: '✓' },
  { key: 'system-health', label: 'System Health', path: '/admin/health', icon: '⌁' },
  { key: 'maintenance', label: 'Repair Queue', path: '/admin/maintenance-queue', icon: '◫' },
  { key: 'league-coverage', label: 'League Coverage', path: '/admin/league-coverage', icon: '▱' },
  { key: 'highlights', label: 'Highlights', path: '/admin/highlights', icon: '▶' },
  { key: 'featured-games', label: 'Featured Games', path: '/admin/featured-games', icon: '⚔' },
]

export default function AdminOperationsMenu() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (pathname !== '/admin') {
      document.querySelectorAll('[data-pf-operations-menu],[data-pf-access-menu],[data-pf-import-menu],[data-pf-access-actions]').forEach(node => node.remove())
      return
    }

    let observer: MutationObserver | null = null

    const makeLink = (item: { label: string; path: string; icon: string }) => {
      const link = document.createElement('a')
      link.href = item.path
      link.innerHTML = `<span aria-hidden="true" style="font-size:18px;width:18px;text-align:center">${item.icon}</span>${item.label}`
      link.addEventListener('click', event => {
        event.preventDefault()
        navigate(item.path)
      })
      return link
    }

    const makeGroup = (label: string, marker: string, links: typeof operationLinks) => {
      const group = document.createElement('div')
      group.className = 'grp'
      group.setAttribute(marker, 'true')
      group.innerHTML = `<label>${label}</label><nav class="nav"></nav>`
      const nav = group.querySelector<HTMLElement>('.nav')!
      links.forEach(item => nav.append(makeLink(item)))
      return group
    }

    const attach = () => {
      const side = document.querySelector<HTMLElement>('.side')
      if (!side) return false
      const foot = side.querySelector<HTMLElement>('.foot')

      if (!side.querySelector('[data-pf-access-menu]')) {
        const access = makeGroup('ACCESS', 'data-pf-access-menu', accessLinks)
        const importsGroup = Array.from(side.querySelectorAll<HTMLElement>('.grp')).find(group => group.textContent?.includes('IMPORTS'))
        side.insertBefore(access, importsGroup ?? foot)
      }

      const oldImports = Array.from(side.querySelectorAll<HTMLElement>('.grp')).find(group => group.textContent?.includes('IMPORTS') && !group.hasAttribute('data-pf-import-menu'))
      if (oldImports) oldImports.style.display = 'none'
      if (!side.querySelector('[data-pf-import-menu]')) {
        const imports = makeGroup('IMPORTS', 'data-pf-import-menu', importLinks)
        side.insertBefore(imports, foot)
      }

      if (!side.querySelector('[data-pf-operations-menu]')) {
        const group = makeGroup('OPERATIONS', 'data-pf-operations-menu', operationLinks)
        const nav = group.querySelector<HTMLElement>('.nav')!
        const recalc = document.createElement('button')
        recalc.type = 'button'
        recalc.innerHTML = '<span aria-hidden="true" style="font-size:18px;width:18px;text-align:center">↻</span>Recalculate Rankings'
        recalc.addEventListener('click', async () => {
          if (!getKey() || recalc.dataset.busy === 'true') return
          if (!window.confirm('Recalculate every national club ranking using the current verified ladder data?')) return
          recalc.dataset.busy = 'true'
          recalc.textContent = 'Recalculating…'
          try {
            const response = await fetch('/admin/platform/recalculate', {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${getKey()}` },
            })
            const payload = await response.json().catch(() => ({})) as { data?: { clubsRanked?: number }; error?: string }
            if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
            recalc.textContent = `Recalculated${typeof payload.data?.clubsRanked === 'number' ? ` · ${payload.data.clubsRanked}` : ''}`
            window.setTimeout(() => { recalc.innerHTML = '<span aria-hidden="true" style="font-size:18px;width:18px;text-align:center">↻</span>Recalculate Rankings' }, 3500)
          } catch (error) {
            recalc.textContent = error instanceof Error ? error.message : 'Recalculation failed'
            window.setTimeout(() => { recalc.innerHTML = '<span aria-hidden="true" style="font-size:18px;width:18px;text-align:center">↻</span>Recalculate Rankings' }, 4500)
          } finally {
            delete recalc.dataset.busy
          }
        })
        nav.append(recalc)
        side.insertBefore(group, foot)
      }

      const actions = document.querySelector<HTMLElement>('.acts')
      if (actions && !actions.querySelector('[data-pf-access-actions]')) {
        for (const item of accessLinks) {
          const link = document.createElement('a')
          link.className = 'act'
          link.href = item.path
          link.dataset.pfAccessActions = 'true'
          link.innerHTML = `<i><span aria-hidden="true" style="font-size:22px">${item.icon}</span></i><span>${item.label}</span><span aria-hidden="true">›</span>`
          link.addEventListener('click', event => {
            event.preventDefault()
            navigate(item.path)
          })
          actions.prepend(link)
        }
      }

      return true
    }

    if (!attach()) {
      observer = new MutationObserver(() => { if (attach()) observer?.disconnect() })
      observer.observe(document.body, { childList: true, subtree: true })
    }
    return () => {
      observer?.disconnect()
      document.querySelectorAll('[data-pf-operations-menu],[data-pf-access-menu],[data-pf-import-menu],[data-pf-access-actions]').forEach(node => node.remove())
    }
  }, [navigate, pathname])

  return null
}
