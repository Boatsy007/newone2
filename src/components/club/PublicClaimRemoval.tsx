import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Public claim access is paused. Keep the underlying claim workflow and records
 * intact for a future rollout, but hide public entry points without mutating
 * React-owned DOM nodes.
 */
export default function PublicClaimRemoval() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const claimMatch = pathname.match(/^\/claim-club\/([^/]+)/)
    if (claimMatch) navigate(`/team/${claimMatch[1]}`, { replace: true })
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
