import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Public claim access is paused. Keep the underlying claim workflow and records
 * intact for a future rollout, but remove every public-facing entry point now.
 */
export default function PublicClaimRemoval() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const claimMatch = pathname.match(/^\/claim-club\/([^/]+)/)
    if (claimMatch) {
      navigate(`/team/${claimMatch[1]}`, { replace: true })
      return
    }

    if (!pathname.startsWith('/team/')) return

    let timer = 0
    const removeClaimSurfaces = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const claimLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/claim-club/"]'))
        for (const link of claimLinks) {
          const section = link.closest('section')
          const card = link.closest('.gn-card, .club-card, article')
          ;(section ?? card ?? link).remove()
        }

        const candidates = Array.from(document.querySelectorAll<HTMLElement>('section, article, .gn-card, .club-card'))
        for (const node of candidates) {
          const text = node.textContent?.toLowerCase() ?? ''
          if (text.includes('claim this club') || text.includes('manage this club') || text.includes('claim club')) node.remove()
        }
      }, 40)
    }

    removeClaimSurfaces()
    const observer = new MutationObserver(removeClaimSurfaces)
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [navigate, pathname])

  return <style>{`
    a[href^="/claim-club/"],
    .pf-claim-club-fab,
    [class*="claim-club"],
    [class*="club-claim"] {
      display: none !important;
    }
  `}</style>
}
