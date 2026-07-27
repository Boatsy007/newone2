import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getKey } from '../../lib/admin'

const accessLinks = [
  { key: 'club-access', label: 'Club Access', path: '/admin/claims', icon: '♟' },
  { key: 'league-access', label: 'League Access', path: '/admin/league-access', icon: '♙' },
]

const operationLinks = [
  { key: 'highlights', label: 'Featured Highlights', path: '/admin/highlights', icon: '▶' },
  { key: 'featured-games', label: 'Featured Games', path: '/admin/featured-games', icon: '⚔' },
  { key: 'club-plans', label: 'Club Plans', path: '/admin/club-plans', icon: '♛' },
  { key: 'ocr-planner', label: 'OCR Planner', path: '/admin/maintenance-queue', icon: '◫' },
  { key: 'league-rollout', label: 'League Rollout', path: '/admin/league-coverage', icon: '▱' },
  { key: 'system-health', label: 'System Health', path: '/admin/health', icon: '⌁' },
]

export default function AdminOperationsMenu() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (pathname !== '/admin') {
      document.querySelectorAll('[data-pf-operations-menu],[data-pf-access-menu],[data-pf-access-actions]').forEach(node => node.remove())
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

    const attach = () => {
      const side = document.querySelector<HTMLElement>('.side')
      if (!side) return false

      if (!side.querySelector('[data-pf-access-menu]')) {
        const access = document.createElement('div')
        access.className = 'grp'
        access.dataset.pfAccessMenu = 'true'
        access.innerHTML = `<label>ACCESS</label><nav class="nav"></nav>`
        const nav = access.querySelector<HTMLElement>('.nav')!
        accessLinks.forEach(item => nav.append(makeLink(item)))

        const importsGroup = Array.from(side.querySelectorAll<HTMLElement>('.grp')).find(group => group.textContent?.includes('IMPORTS'))
        side.insertBefore(access, importsGroup ?? side.querySelector('.foot'))
      }

      if (!side.querySelector('[data-pf-operations-menu]')) {
        const foot = side.querySelector<HTMLElement>('.foot')
        const group = document.createElement('div')
        group.className = 'grp'
        group.dataset.pfOperationsMenu = 'true'
        group.innerHTML = `<label>OPERATIONS</label><nav class="nav"></nav>`
        const nav = group.querySelector<HTMLElement>('.nav')!
        operationLinks.forEach(item => nav.append(makeLink(item)))

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
        side.insertBefore(group, foot ?? null)
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
      document.querySelectorAll('[data-pf-operations-menu],[data-pf-access-menu],[data-pf-access-actions]').forEach(node => node.remove())
    }
  }, [navigate, pathname])

  return null
}
