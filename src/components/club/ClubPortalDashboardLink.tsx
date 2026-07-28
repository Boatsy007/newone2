import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ClubPortalDashboardLink() {
  const { pathname } = useLocation()
  useEffect(() => {
    const connect = () => {
      if (pathname === '/club-portal') {
        document.querySelectorAll<HTMLAnchorElement>('.membership-list article a[href^="/team/"]').forEach(link => {
          const clubId = link.getAttribute('href')?.replace(/^\/team\//, '')
          if (!clubId) return
          link.setAttribute('href', `/club-portal/${clubId}`)
          link.childNodes.forEach(node => { if (node.nodeType === Node.TEXT_NODE) node.textContent = 'Open portal ' })
          link.setAttribute('aria-label', 'Open club management dashboard')
        })
      }

      const match = pathname.match(/^\/club-portal\/([^/]+)$/)
      if (match) {
        const clubId = match[1]
        document.querySelectorAll<HTMLAnchorElement>('.cp-tools a').forEach(link => {
          const label = link.querySelector('strong')?.textContent?.trim().toLowerCase()
          if (label !== 'team selection') return
          link.setAttribute('href', `/club-portal/${clubId}/team-selection`)
          link.setAttribute('aria-label', 'Open club team selection editor')
          if (document.querySelector('[data-player-availability-link]')) return
          const availability = link.cloneNode(true) as HTMLAnchorElement
          availability.dataset.playerAvailabilityLink = 'true'
          availability.setAttribute('href', `/club-portal/${clubId}/availability`)
          availability.setAttribute('aria-label', 'Open player availability dashboard')
          const strong = availability.querySelector('strong')
          const detail = availability.querySelector('span')
          if (strong) strong.textContent = 'Player availability'
          if (detail) detail.textContent = 'Invite players and track weekly responses'
          link.insertAdjacentElement('afterend', availability)
        })
      }
    }
    connect()
    const observer = new MutationObserver(connect)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])
  return null
}
