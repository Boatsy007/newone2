import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ClubPortalDashboardLink() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname !== '/club-portal') return
    const connect = () => {
      document.querySelectorAll<HTMLAnchorElement>('.membership-list article a[href^="/team/"]').forEach(link => {
        const clubId = link.getAttribute('href')?.replace(/^\/team\//, '')
        if (!clubId) return
        link.setAttribute('href', `/club-portal/${clubId}`)
        link.childNodes.forEach(node => { if (node.nodeType === Node.TEXT_NODE) node.textContent = 'Open portal ' })
        link.setAttribute('aria-label', 'Open club management dashboard')
      })
    }
    connect()
    const observer = new MutationObserver(connect)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])
  return null
}
