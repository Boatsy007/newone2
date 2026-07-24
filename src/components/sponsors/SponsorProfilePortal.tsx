import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import SponsorShowcase from './SponsorShowcase'

type TargetState = {
  node: HTMLElement
  scope: 'club' | 'league'
  entityId: string
  entityName: string
}

export default function SponsorProfilePortal() {
  const { pathname, search } = useLocation()
  const [target, setTarget] = useState<TargetState | null>(null)
  const teamSelectionActive = pathname.startsWith('/team/') && new URLSearchParams(search).get('tab') === 'team-selection'

  useEffect(() => {
    setTarget(null)
    document.getElementById('pf-club-sponsor-profile-slot')?.remove()
    document.getElementById('pf-league-sponsor-profile-slot')?.remove()

    const clubMatch = pathname.match(/^\/team\/([^/]+)/)
    const leagueMatch = pathname.match(/^\/league\/([^/]+)/)
    if ((!clubMatch && !leagueMatch) || (clubMatch && teamSelectionActive)) return

    let cancelled = false
    let attempts = 0
    let timer = 0

    const attach = () => {
      if (cancelled) return
      const scope = clubMatch ? 'club' as const : 'league' as const
      const entityId = decodeURIComponent((clubMatch ?? leagueMatch)![1])
      const tabs = clubMatch ? document.querySelector<HTMLElement>('.club-profile-tabs') : null
      const leagueShell = leagueMatch ? document.querySelector<HTMLElement>('.league-profile-shell') : null
      const anchor = tabs ?? leagueShell

      if (!anchor) {
        if (attempts++ < 80) timer = window.setTimeout(attach, 50)
        return
      }

      const slotId = `pf-${scope}-sponsor-profile-slot`
      const node = document.createElement('div')
      node.id = slotId
      node.className = 'pf-profile-sponsor-slot'
      if (clubMatch) anchor.insertAdjacentElement('afterend', node)
      else anchor.insertAdjacentElement('beforebegin', node)

      const heading = clubMatch
        ? document.querySelector<HTMLElement>('.club-profile-tabs [role="tablist"]')?.getAttribute('aria-label')?.replace(/ profile sections$/i, '')
        : document.querySelector<HTMLElement>('.league-profile-page h1')?.textContent?.trim()

      setTarget({ node, scope, entityId, entityName: heading || (scope === 'club' ? 'Club' : 'League') })
    }

    attach()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.getElementById('pf-club-sponsor-profile-slot')?.remove()
      document.getElementById('pf-league-sponsor-profile-slot')?.remove()
    }
  }, [pathname, teamSelectionActive])

  if (!target) return null

  return createPortal(<>
    <div className="pf-profile-sponsor-shell">
      <SponsorShowcase scope={target.scope} entityId={target.entityId} entityName={target.entityName} />
    </div>
    <style>{`
      .pf-profile-sponsor-slot{background:#eef3f7;border-top:1px solid #dfe6ec;border-bottom:1px solid #dfe6ec}.pf-profile-sponsor-shell{width:min(1180px,calc(100% - 40px));margin:0 auto;padding:22px 0}.pf-profile-sponsor-shell>.pf-sponsor-showcase{overflow:hidden;border:1px solid #dfe5ea;border-radius:14px;background:#fff;box-shadow:0 8px 24px rgba(17,24,39,.06)}@media(max-width:760px){.pf-profile-sponsor-shell{width:calc(100% - 28px);padding:16px 0}}
    `}</style>
  </>, target.node)
}
