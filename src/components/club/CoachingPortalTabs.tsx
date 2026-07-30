import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { CalendarCheck, LayoutDashboard, ShieldCheck, Trophy, Users, Workflow } from 'lucide-react'
import TeamSelectionAvailabilityWarnings from './TeamSelectionAvailabilityWarnings'

const COACHING_SECTIONS = new Set(['coaching', 'availability', 'team-selection', 'whiteboard', 'users'])

export default function CoachingPortalTabs() {
  const { pathname } = useLocation()
  const [host, setHost] = useState<HTMLElement | null>(null)
  const match = pathname.match(/^\/club-portal\/([^/]+)\/(coaching|availability|team-selection|whiteboard|users)(?:\/|$)/)
  const clubId = match?.[1] ?? ''
  const section = match?.[2] ?? ''
  const visible = Boolean(clubId && COACHING_SECTIONS.has(section))

  useLayoutEffect(() => {
    setHost(null)
    document.getElementById('playfooty-coaching-tabs')?.remove()
    if (!visible) return

    const header = document.querySelector<HTMLElement>('.pf-nav')
    if (!header?.parentElement) return

    const element = document.createElement('div')
    element.id = 'playfooty-coaching-tabs'
    header.insertAdjacentElement('afterend', element)
    setHost(element)

    return () => {
      element.remove()
      setHost(null)
    }
  }, [pathname, visible])

  const warningLayer = <TeamSelectionAvailabilityWarnings/>
  if (!visible || !host) return warningLayer

  const links = [
    { label: 'Overview', section: 'coaching', href: `/club-portal/${clubId}/coaching`, icon: LayoutDashboard },
    { label: 'Availability', section: 'availability', href: `/club-portal/${clubId}/availability`, icon: CalendarCheck },
    { label: 'Team selection', section: 'team-selection', href: `/club-portal/${clubId}/team-selection`, icon: Trophy },
    { label: 'Whiteboard', section: 'whiteboard', href: `/club-portal/${clubId}/whiteboard`, icon: Workflow },
    { label: 'Access', section: 'users', href: `/club-portal/${clubId}/users`, icon: Users },
  ]

  return <>{warningLayer}{createPortal(<>
    <nav className="coach-portal-tabs" aria-label="Coaching portal sections">
      <div className="coach-portal-tabs-inner">
        <div className="coach-portal-tabs-scroll">
          {links.map(item => <Link key={item.section} to={item.href} className={section === item.section ? 'active' : ''} aria-current={section === item.section ? 'page' : undefined}>
            <item.icon size={17}/><span>{item.label}</span>
          </Link>)}
        </div>
        <Link className="coach-portal-exit" to={`/club-portal/${clubId}`}><ShieldCheck size={16}/><span>Club dashboard</span></Link>
      </div>
    </nav>
    <style>{styles}</style>
  </>, host)}</>
}

const styles = `
.coach-portal-tabs{position:sticky;top:78px;z-index:69;background:#fff;border-bottom:1px solid #d9e1e8;box-shadow:0 5px 16px rgba(15,23,42,.06)}
.coach-portal-tabs-inner{width:min(1240px,calc(100% - 32px));min-height:62px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:14px}
.coach-portal-tabs-scroll{display:flex;align-items:stretch;gap:4px;min-width:0;overflow-x:auto;scrollbar-width:none}
.coach-portal-tabs-scroll::-webkit-scrollbar{display:none}
.coach-portal-tabs a{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:0 14px;border-radius:9px;color:#566270;text-decoration:none;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:800;letter-spacing:.025em;text-transform:uppercase;white-space:nowrap;transition:background .18s ease,color .18s ease}
.coach-portal-tabs-scroll a:hover{background:#edf5fa;color:#111318}
.coach-portal-tabs-scroll a.active{background:#071018;color:#fff;box-shadow:inset 0 -3px 0 #42b8ff}
.coach-portal-tabs-scroll a.active svg{color:#42b8ff}
.coach-portal-exit{flex:0 0 auto;border:1px solid #d6dee5;color:#111318!important;background:#fff}
.coach-portal-exit:hover{border-color:#42b8ff;background:#f4fbff}
@media(max-width:1180px){.coach-portal-tabs{top:72px}}
@media(max-width:760px){.coach-portal-tabs-inner{width:100%;min-height:56px;padding:6px 0 6px 10px;box-sizing:border-box}.coach-portal-tabs-scroll{padding-right:10px}.coach-portal-tabs a{min-height:44px;padding:0 12px;font-size:12px}.coach-portal-exit{display:none}}
`
