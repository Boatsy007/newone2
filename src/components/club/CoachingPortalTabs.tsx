import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { CalendarCheck, Clock3, Dumbbell, LayoutDashboard, ShieldCheck, Trophy, Users, Workflow } from 'lucide-react'
import TeamSelectionAvailabilityWarnings from './TeamSelectionAvailabilityWarnings'
import ClubPortalMatchDay from '../../pages/ClubPortalMatchDay'
import ClubPortalTraining from '../../pages/ClubPortalTraining'
import TrainingRecordsPanel from './TrainingRecordsPanel'
import MatchDayLiveSync from './MatchDayLiveSync'
import PublicLiveMatchPortal from './PublicLiveMatchPortal'

const COACHING_SECTIONS = new Set(['coaching', 'availability', 'team-selection', 'whiteboard', 'users'])

export default function CoachingPortalTabs() {
  const { pathname, search } = useLocation()
  const [host, setHost] = useState<HTMLElement | null>(null)
  const match = pathname.match(/^\/club-portal\/([^/]+)\/(coaching|availability|team-selection|whiteboard|users)(?:\/|$)/)
  const clubId = match?.[1] ?? ''
  const section = match?.[2] ?? ''
  const view = section === 'coaching' ? new URLSearchParams(search).get('view') : null
  const matchDay = view === 'match-day'
  const training = view === 'training'
  const overlay = matchDay || training
  const visible = Boolean(clubId && COACHING_SECTIONS.has(section))

  useEffect(() => {
    if (!overlay) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [overlay])

  useLayoutEffect(() => {
    setHost(null)
    document.getElementById('playfooty-coaching-tabs')?.remove()
    if (!visible || overlay) return

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
  }, [pathname, visible, overlay])

  const globalLayers = <><TeamSelectionAvailabilityWarnings/><MatchDayLiveSync/><PublicLiveMatchPortal/></>

  if (overlay) return <>{globalLayers}{createPortal(<div className="coach-workspace-layer">
    <Routes>
      <Route path="/club-portal/:clubId/coaching" element={matchDay ? <ClubPortalMatchDay/> : <><ClubPortalTraining/><TrainingRecordsPanel clubId={clubId}/></>}/>
    </Routes>
  </div>, document.body)}<style>{workspaceStyles}</style></>

  if (!visible || !host) return globalLayers

  const links = [
    { label: 'Overview', section: 'coaching', href: `/club-portal/${clubId}/coaching`, icon: LayoutDashboard },
    { label: 'Availability', section: 'availability', href: `/club-portal/${clubId}/availability`, icon: CalendarCheck },
    { label: 'Team selection', section: 'team-selection', href: `/club-portal/${clubId}/team-selection`, icon: Trophy },
    { label: 'Training', section: 'training', href: `/club-portal/${clubId}/coaching?view=training`, icon: Dumbbell },
    { label: 'Match Day', section: 'match-day', href: `/club-portal/${clubId}/coaching?view=match-day`, icon: Clock3 },
    { label: 'Whiteboard', section: 'whiteboard', href: `/club-portal/${clubId}/whiteboard`, icon: Workflow },
    { label: 'Access', section: 'users', href: `/club-portal/${clubId}/users`, icon: Users },
  ]

  return <>{globalLayers}{createPortal(<>
    <nav className="coach-portal-tabs" aria-label="Coaching portal sections">
      <div className="coach-portal-tabs-inner">
        <div className="coach-portal-tabs-scroll">
          {links.map(item => <Link key={item.section} to={item.href} className={(section === item.section || view === item.section) ? 'active' : ''} aria-current={(section === item.section || view === item.section) ? 'page' : undefined}>
            <item.icon size={17}/><span>{item.label}</span>
          </Link>)}
        </div>
        <Link className="coach-portal-exit" to={`/club-portal/${clubId}`}><ShieldCheck size={16}/><span>Club dashboard</span></Link>
      </div>
    </nav>
    <style>{styles}</style>
  </>, host)}</>
}

const workspaceStyles = `.coach-workspace-layer{position:fixed;inset:0;z-index:100000;overflow:auto;background:#eef3f7}`
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
