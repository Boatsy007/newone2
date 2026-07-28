import { Link, useLocation } from 'react-router-dom'
import FollowButton from './FollowButton'
import type { FollowEntity } from '../../lib/supporter'

type FollowTarget = { entityType: FollowEntity; entityId: string }

function targetFromPath(pathname: string): FollowTarget | null {
  const club = pathname.match(/^\/team\/([^/]+)$/)
  if (club) return { entityType: 'CLUB', entityId: decodeURIComponent(club[1]) }

  const league = pathname.match(/^\/league\/([^/]+)$/)
  if (league) return { entityType: 'LEAGUE', entityId: decodeURIComponent(league[1]) }

  const player = pathname.match(/^\/player\/([^/]+)$/)
  if (player) return { entityType: 'PLAYER', entityId: decodeURIComponent(player[1]) }

  return null
}

export default function ProfileFollowDock() {
  const { pathname } = useLocation()
  const target = targetFromPath(pathname)
  if (!target) return null

  return <aside className="pf-follow-dock" aria-label="Supporter actions">
    <FollowButton entityType={target.entityType} entityId={target.entityId} compact />
    <Link to="/feed">My feed</Link>
    <style>{`
      .pf-follow-dock{position:fixed;right:18px;bottom:18px;z-index:45;display:flex;align-items:center;gap:8px;padding:9px;border:1px solid #dbe3ea;border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 12px 34px rgba(15,23,42,.16);backdrop-filter:blur(10px)}
      .pf-follow-dock .pf-follow-wrap{display:flex}
      .pf-follow-dock .pf-follow-wrap small{position:absolute;right:8px;bottom:calc(100% + 7px);padding:6px 9px;border-radius:8px;background:#fff;color:#d71920;box-shadow:0 6px 18px rgba(15,23,42,.12);white-space:nowrap}
      .pf-follow-dock>a{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 13px;border-radius:999px;color:#111318;text-decoration:none;font-family:'Barlow Condensed',Arial,sans-serif;font-size:11px;font-weight:950;letter-spacing:.05em;text-transform:uppercase}
      .pf-follow-dock>a:hover,.pf-follow-dock>a:focus-visible{background:#edf7fd;outline:none}
      @media(max-width:620px){.pf-follow-dock{right:10px;bottom:10px;left:10px;justify-content:center}.pf-follow-dock .pf-follow-wrap{flex:1}.pf-follow-dock .pf-follow-wrap button{width:100%}.pf-follow-dock>a{flex:0 0 auto}}
    `}</style>
  </aside>
}
