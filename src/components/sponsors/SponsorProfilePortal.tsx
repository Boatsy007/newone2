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
  const { pathname } = useLocation()
  const [target, setTarget] = useState<TargetState | null>(null)

  useEffect(() => {
    setTarget(null)
    const clubMatch = pathname.match(/^\/team\/([^/]+)/)
    const leagueMatch = pathname.match(/^\/league\/([^/]+)/)
    if (!clubMatch && !leagueMatch) return

    let cancelled = false
    let timer = 0

    const attach = () => {
      if (cancelled) return
      const scope = clubMatch ? 'club' as const : 'league' as const
      const entityId = decodeURIComponent((clubMatch ?? leagueMatch)![1])
      const tabs = clubMatch ? document.querySelector<HTMLElement>('.club-profile-tabs') : null
      const clubMain = clubMatch ? document.querySelector<HTMLElement>('.club-profile-main') : null
      const teamSlot = clubMatch ? document.getElementById('pf-club-team-sheet-slot') : null
      const teamActive = clubMatch && document.body.dataset.pfTeamSelectionActive === 'true'
      const leagueShell = leagueMatch ? document.querySelector<HTMLElement>('.league-profile-shell') : null
      const anchor = teamActive && teamSlot ? teamSlot : tabs ?? clubMain ?? leagueShell

      if (!anchor) {
        timer = window.setTimeout(attach, 100)
        return
      }

      const slotId = `pf-${scope}-sponsor-profile-slot`
      let node = document.getElementById(slotId)
      if (!node) {
        node = document.createElement('div')
        node.id = slotId
        node.className = 'pf-profile-sponsor-slot'
      }

      if (clubMatch) {
        node.classList.toggle('pf-team-selection-sponsor', Boolean(teamActive && teamSlot))
        if (teamActive && teamSlot) {
          if (node.parentElement !== teamSlot || node !== teamSlot.lastElementChild) teamSlot.append(node)
        } else if (tabs?.parentElement && node.previousElementSibling !== tabs) {
          tabs.insertAdjacentElement('afterend', node)
        } else if (!tabs && clubMain?.parentElement && node.nextElementSibling !== clubMain) {
          clubMain.insertAdjacentElement('beforebegin', node)
        }
      } else if (leagueShell?.parentElement && node.nextElementSibling !== leagueShell) {
        leagueShell.insertAdjacentElement('beforebegin', node)
      }

      const heading = clubMatch
        ? document.querySelector<HTMLElement>('.club-profile-tabs [role="tablist"]')?.getAttribute('aria-label')?.replace(/ profile sections$/i, '')
          ?? document.querySelector<HTMLElement>('.club-profile-page h1')?.textContent?.trim()
        : document.querySelector<HTMLElement>('.league-profile-page h1')?.textContent?.trim()

      setTarget(previous => {
        if (previous?.node === node && previous.scope === scope && previous.entityId === entityId && previous.entityName === (heading || (scope === 'club' ? 'Club' : 'League'))) return previous
        return { node, scope, entityId, entityName: heading || (scope === 'club' ? 'Club' : 'League') }
      })
    }

    const scheduleAttach = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(attach, 30)
    }

    attach()
    window.addEventListener('pf-team-selection-change', scheduleAttach)
    const root = document.getElementById('root') ?? document.body
    const observer = new MutationObserver(scheduleAttach)
    observer.observe(root, { childList: true, subtree: true })

    return () => {
      cancelled = true
      observer.disconnect()
      window.removeEventListener('pf-team-selection-change', scheduleAttach)
      window.clearTimeout(timer)
      document.getElementById('pf-club-sponsor-profile-slot')?.remove()
      document.getElementById('pf-league-sponsor-profile-slot')?.remove()
    }
  }, [pathname])

  if (!target) return null

  return createPortal(<>
    <div className="pf-profile-sponsor-shell">
      <SponsorShowcase scope={target.scope} entityId={target.entityId} entityName={target.entityName} />
    </div>
    <style>{`
      .pf-profile-sponsor-slot{background:#eef3f7;border-top:1px solid #dfe6ec;border-bottom:1px solid #dfe6ec}.pf-profile-sponsor-shell{width:min(1180px,calc(100% - 40px));margin:0 auto;padding:22px 0}.pf-profile-sponsor-shell>.pf-sponsor-showcase{overflow:hidden;border:1px solid #dfe5ea;border-radius:14px;background:#fff;box-shadow:0 8px 24px rgba(17,24,39,.06)}.pf-team-selection-sponsor{margin-top:22px;background:transparent;border:0}.pf-team-selection-sponsor .pf-profile-sponsor-shell{width:100%;padding:0}.pf-team-selection-sponsor .pf-sponsor-showcase{box-shadow:0 5px 18px rgba(17,24,39,.055)}@media(max-width:760px){.pf-profile-sponsor-shell{width:calc(100% - 28px);padding:16px 0}.pf-team-selection-sponsor .pf-profile-sponsor-shell{width:100%;padding:0}}
    `}</style>
  </>, target.node)
}