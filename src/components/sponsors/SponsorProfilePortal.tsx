import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import SponsorShowcase from './SponsorShowcase'

type TargetState = {
  node: HTMLElement
  entityId: string
  entityName: string
}

/**
 * League-only sponsor portal.
 *
 * Club profiles render sponsors natively inside TeamProfile, including directly
 * below the Team Selection oval. Keeping club rendering out of this DOM portal
 * avoids duplicate requests and repeated slot insertion/removal while tabs change.
 */
export default function SponsorProfilePortal() {
  const { pathname } = useLocation()
  const [target, setTarget] = useState<TargetState | null>(null)

  useEffect(() => {
    setTarget(null)
    document.getElementById('pf-league-sponsor-profile-slot')?.remove()

    const match = pathname.match(/^\/league\/([^/]+)/)
    if (!match) return

    let cancelled = false
    let attempts = 0
    let timer = 0
    const entityId = decodeURIComponent(match[1])

    const attach = () => {
      if (cancelled) return
      const shell = document.querySelector<HTMLElement>('.league-profile-shell')
      if (!shell?.parentElement) {
        if (attempts++ < 80) timer = window.setTimeout(attach, 50)
        return
      }

      const node = document.createElement('div')
      node.id = 'pf-league-sponsor-profile-slot'
      node.className = 'pf-profile-sponsor-slot'
      shell.insertAdjacentElement('beforebegin', node)

      const heading = document.querySelector<HTMLElement>('.league-profile-page h1')?.textContent?.trim() || 'League'
      setTarget({ node, entityId, entityName: heading })
    }

    attach()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.getElementById('pf-league-sponsor-profile-slot')?.remove()
    }
  }, [pathname])

  if (!target) return null

  return createPortal(<>
    <div className="pf-profile-sponsor-shell">
      <SponsorShowcase scope="league" entityId={target.entityId} entityName={target.entityName} />
    </div>
    <style>{`
      .pf-profile-sponsor-slot{background:#eef3f7;border-top:1px solid #dfe6ec;border-bottom:1px solid #dfe6ec}.pf-profile-sponsor-shell{width:min(1180px,calc(100% - 40px));margin:0 auto;padding:22px 0}.pf-profile-sponsor-shell>.pf-sponsor-showcase{overflow:hidden;border:1px solid #dfe5ea;border-radius:14px;background:#fff;box-shadow:0 8px 24px rgba(17,24,39,.06)}@media(max-width:760px){.pf-profile-sponsor-shell{width:calc(100% - 28px);padding:16px 0}}
    `}</style>
  </>, target.node)
}
