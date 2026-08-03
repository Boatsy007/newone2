import { ArrowRight, CalendarCheck, ClipboardCheck, Dumbbell, ShieldCheck, Swords, Target } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

type Dashboard = {
  teamSelection: { roundLabel: string; opponentName: string | null; matchDate: string | null; status: string; playerCount: number } | null
}

type AvailabilityPlayer = { status: string | null; reason: string | null }
type Availability = { players: AvailabilityPlayer[] }
type Session = { access_token: string }

const SESSION_KEY = 'playfooty.clubPortal.session.v1'

function session(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as Session : null
  } catch {
    return null
  }
}

async function getJson<T>(path: string, token: string) {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` }
  const response = await fetch(path, { headers })
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
  return payload
}

export default function ClubCoachingCommandCentre({ clubId }: { clubId: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const current = session()
    if (!current) {
      setError('Sign in through the Club Portal to continue.')
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError('')

    Promise.all([
      getJson<{ data?: Dashboard }>(`/api/club-portal/clubs/${encodeURIComponent(clubId)}/dashboard`, current.access_token),
      getJson<{ data?: Availability }>(`/api/club-portal/availability/clubs/${encodeURIComponent(clubId)}/overview`, current.access_token).catch(() => ({ data: undefined })),
    ]).then(([dashboardPayload, availabilityPayload]) => {
      if (!active) return
      setDashboard(dashboardPayload.data ?? null)
      setAvailability(availabilityPayload.data ?? null)
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load coaching priorities')
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [clubId])

  const counts = useMemo(() => {
    const players = availability?.players ?? []
    return {
      available: players.filter(player => player.status === 'AVAILABLE' && player.reason !== 'INJURY').length,
      pending: players.filter(player => !player.status).length,
    }
  }, [availability])

  const selection = dashboard?.teamSelection ?? null
  const selectionStatus = selection?.status?.toUpperCase() ?? 'NOT_STARTED'
  const selectionReady = selectionStatus === 'PUBLISHED' || selectionStatus === 'FINAL'
  const primary = counts.pending > 0
    ? { icon: CalendarCheck, eyebrow: 'Needs attention', title: `${counts.pending} player${counts.pending === 1 ? '' : 's'} yet to respond`, copy: 'Review availability before finalising this week’s side.', href: `/club-portal/${clubId}/availability`, action: 'Review availability' }
    : !selectionReady
      ? { icon: ClipboardCheck, eyebrow: 'Next action', title: selection ? 'Finish this week’s team selection' : 'Start this week’s team selection', copy: `${selection?.playerCount ?? 0} players currently selected${selection?.opponentName ? ` for ${selection.opponentName}` : ''}.`, href: `/club-portal/${clubId}/team-selection`, action: 'Open team selection' }
      : { icon: Swords, eyebrow: 'Match ready', title: 'Prepare the match-day workspace', copy: `${selection?.playerCount ?? 0} players are selected and ready for match day.`, href: `/club-portal/${clubId}/coaching?view=match-day`, action: 'Open Match Day' }
  const PrimaryIcon = primary.icon

  return <section className="coach-command-centre" aria-label="Coaching command centre">
    <div className="coach-command-heading">
      <div><span>COACHING COMMAND CENTRE</span><h2>Today</h2><p>The most important coaching actions for this week.</p></div>
    </div>

    {loading ? <div className="coach-command-loading">Loading coaching priorities…</div> : error ? <div className="coach-command-error">{error}</div> : <>
      <div className="coach-command-primary">
        <div className="coach-command-primary-icon"><PrimaryIcon size={28}/></div>
        <div><span>{primary.eyebrow}</span><strong>{primary.title}</strong><p>{primary.copy}</p></div>
        <Link to={primary.href}>{primary.action}<ArrowRight size={17}/></Link>
      </div>

      <div className="coach-command-status">
        <Link to={`/club-portal/${clubId}/availability`}><CalendarCheck size={20}/><span><small>Availability</small><strong>{counts.available} available</strong><em>{counts.pending ? `${counts.pending} awaiting response` : 'All responses reviewed'}</em></span></Link>
        <Link to={`/club-portal/${clubId}/team-selection`}><ShieldCheck size={20}/><span><small>Team selection</small><strong>{selection?.playerCount ?? 0} selected</strong><em>{selectionStatus.replaceAll('_', ' ').toLowerCase()}</em></span></Link>
        <Link to={`/club-portal/${clubId}/coaching?view=training-plan`}><Dumbbell size={20}/><span><small>Training</small><strong>Plan training</strong><em>Build the next session</em></span></Link>
        <Link to={`/club-portal/${clubId}/coaching?view=opposition`}><Target size={20}/><span><small>Opposition</small><strong>{selection?.opponentName || 'Not confirmed'}</strong><em>{selection?.roundLabel || 'Next match'}</em></span></Link>
        <Link to={`/club-portal/${clubId}/coaching?view=match-day`}><Swords size={20}/><span><small>Match Day</small><strong>{selectionReady ? 'Ready to open' : 'Selection required'}</strong><em>Scoring, events and review</em></span></Link>
      </div>
    </>}
    <style>{styles}</style>
  </section>
}

const styles = `
.coach-command-centre{margin-top:28px;padding:22px;border:1px solid #d9e2e9;border-radius:20px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.06);color:#111318}.coach-command-heading{margin-bottom:16px}.coach-command-heading span,.coach-command-primary span{color:#0783c9;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.coach-command-heading h2{margin:5px 0 2px;font:42px/.9 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.coach-command-heading p{margin:0;color:#687385;font-size:13px}.coach-command-loading,.coach-command-error{display:grid;place-items:center;min-height:150px;border-radius:13px;background:#f3f7fa;color:#687385;font-weight:800;text-align:center;padding:18px}.coach-command-error{color:#a1262f;background:#fff3f4}.coach-command-primary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:15px;padding:18px;border-radius:14px;background:linear-gradient(110deg,#0d141c,#172432);color:#fff}.coach-command-primary-icon{display:grid;place-items:center;width:50px;height:50px;border-radius:13px;background:#42b8ff;color:#071018}.coach-command-primary strong,.coach-command-primary p{display:block}.coach-command-primary strong{margin-top:4px;font-size:18px}.coach-command-primary p{margin:5px 0 0;color:#b9c6d1;font-size:12px}.coach-command-primary>a{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 13px;border-radius:10px;background:#42b8ff;color:#071018;text-decoration:none;font-size:11px;font-weight:950;text-transform:uppercase}.coach-command-status{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-top:10px}.coach-command-status>a{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:9px;padding:14px;border:1px solid #e0e7ec;border-radius:12px;color:#111318;text-decoration:none;background:#f8fafb}.coach-command-status>a>svg{color:#0783c9}.coach-command-status span{min-width:0}.coach-command-status small,.coach-command-status strong,.coach-command-status em{display:block}.coach-command-status small{color:#75808a;font-size:8px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.coach-command-status strong{margin-top:4px;overflow:hidden;text-overflow:ellipsis;font-size:13px;white-space:nowrap}.coach-command-status em{margin-top:3px;color:#7b8791;font-size:9px;font-style:normal;text-transform:capitalize}
@media(max-width:1100px){.coach-command-status{grid-template-columns:repeat(3,1fr)}}
@media(max-width:760px){.coach-command-centre{padding:17px;border-radius:18px}.coach-command-heading h2{font-size:36px}.coach-command-primary{grid-template-columns:auto minmax(0,1fr);padding:15px}.coach-command-primary>a{grid-column:1/-1}.coach-command-status{grid-template-columns:1fr 1fr}.coach-command-status>a{padding:12px}.coach-command-primary strong{font-size:16px}}
@media(max-width:420px){.coach-command-status{grid-template-columns:1fr}}
`