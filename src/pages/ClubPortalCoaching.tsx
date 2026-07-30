import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CalendarCheck, ClipboardList, ShieldCheck, Trophy, Users, Workflow } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { TeamLogo } from '../components/rankings/bits'

type CoachingDashboard = {
  club: { id: string; name: string; logoUrl: string | null; primaryColour: string | null; leagueName: string | null; season: string | null; grade: string | null }
  membership: { role: string; permissions: { teamSelection: boolean; view: boolean } }
  teamSelection: { roundLabel: string; opponentName: string | null; matchDate: string | null; status: string; playerCount: number } | null
}

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

function roleLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, character => character.toUpperCase())
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Date not scheduled'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date not scheduled' : date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function ClubPortalCoaching() {
  const { clubId = '' } = useParams()
  const [data, setData] = useState<CoachingDashboard | null>(null)
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
    void fetch(`/api/club-portal/clubs/${encodeURIComponent(clubId)}/dashboard`, {
      headers: { authorization: `Bearer ${current.access_token}` },
    }).then(async response => {
      const payload = await response.json() as { data?: CoachingDashboard; error?: string }
      if (!response.ok) throw new Error(payload.error || 'Unable to load coaching workspace')
      if (active) setData(payload.data ?? null)
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load coaching workspace')
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [clubId])

  const accent = data?.club.primaryColour || '#2daaf5'

  return <><Nav/><main className="coach-workspace">
    {loading ? <div className="coach-state">Loading coaching workspace…</div> : error || !data ? <section className="coach-error"><ShieldCheck size={40}/><h1>Club access required</h1><p>{error || 'This coaching workspace is unavailable.'}</p><Link to="/club-portal">Return to Club Portal <ArrowRight size={16}/></Link></section> : <>
      <header className="coach-hero" style={{ '--coach-accent': accent } as React.CSSProperties}>
        <div className="coach-club"><TeamLogo name={data.club.name} src={data.club.logoUrl ?? undefined} size={78}/><div><span>Coaching workspace</span><h1>{data.club.name}</h1><p>{[data.club.leagueName, data.club.season, data.club.grade, roleLabel(data.membership.role)].filter(Boolean).join(' · ')}</p></div></div>
        <div className="coach-hero-links"><Link to={`/club-portal/${data.club.id}`}>Club dashboard</Link><Link to={`/team/${data.club.id}`}>Public profile <ArrowRight size={15}/></Link></div>
      </header>

      <section className="coach-week">
        <div><span>This week</span><h2>{data.teamSelection?.roundLabel || 'Prepare the next match'}</h2><p>{data.teamSelection ? `${data.teamSelection.opponentName ? `v ${data.teamSelection.opponentName}` : 'Opponent not set'} · ${dateLabel(data.teamSelection.matchDate)}` : 'Start with player availability, then prepare and publish the team.'}</p></div>
        <div className="coach-week-status"><strong>{data.teamSelection?.playerCount ?? 0}</strong><span>selected players</span><b>{data.teamSelection?.status ?? 'NOT STARTED'}</b></div>
      </section>

      <section className="coach-tools">
        <div className="coach-section-head"><span>Coach operations</span><h2>Weekly workflow</h2></div>
        <div className="coach-tool-grid">
          <Tool to={`/club-portal/${data.club.id}/availability`} icon={CalendarCheck} title="Player availability" copy="Collect responses and see who is available before selection." />
          <Tool to={`/club-portal/${data.club.id}/team-selection`} icon={Trophy} title="Team selection" copy="Prepare, save and publish the current team sheet." />
          <Tool to={`/club-portal/${data.club.id}/whiteboard`} icon={Workflow} title="Coaching whiteboard" copy="Plan positions, structures and match-day movements." />
          <Tool to={`/club-portal/${data.club.id}/users`} icon={Users} title="Coaching access" copy="Club administrators can manage coach and staff access." />
        </div>
      </section>

      <section className="coach-principles">
        <ClipboardList size={26}/><div><span>One club workspace</span><h2>No duplicate coaching system</h2><p>Availability, selection and the whiteboard continue using their existing club records and URLs. This dashboard is the coaching entry point, not a second source of truth.</p></div>
      </section>
    </>}
  </main><Footer/><style>{styles}</style></>
}

function Tool({ to, icon: Icon, title, copy }: { to: string; icon: typeof Trophy; title: string; copy: string }) {
  return <Link to={to}><Icon size={25}/><div><strong>{title}</strong><span>{copy}</span></div><ArrowRight size={18}/></Link>
}

const styles = `
.coach-workspace{min-height:75vh;background:#eef3f7;padding:28px clamp(14px,4vw,42px) 60px;color:#111318}.coach-workspace>*{max-width:1240px;margin-left:auto;margin-right:auto}.coach-state,.coach-error{min-height:55vh;display:grid;place-items:center;text-align:center}.coach-error{align-content:center}.coach-error h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:54px;margin:12px 0 0;text-transform:uppercase}.coach-error p{color:#687385}.coach-error a{display:inline-flex;align-items:center;gap:7px;color:#111;text-decoration:none;font-weight:900}.coach-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:28px;border-radius:20px;background:linear-gradient(115deg,#0c1118,#17212d);color:#fff;border-left:6px solid var(--coach-accent)}.coach-club{display:flex;align-items:center;gap:18px;min-width:0}.coach-club span,.coach-section-head span,.coach-principles span{color:#77cfff;font-size:11px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.coach-club h1{margin:5px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(3rem,7vw,5rem);line-height:.85;text-transform:uppercase}.coach-club p{margin:0;color:#b8c3cf}.coach-hero-links{display:flex;gap:9px;flex-wrap:wrap}.coach-hero-links a{padding:11px 14px;border:1px solid rgba(255,255,255,.22);border-radius:999px;color:#fff;text-decoration:none;font-size:12px;font-weight:900;display:flex;gap:7px;align-items:center}.coach-week,.coach-principles{margin-top:16px;padding:22px;background:#fff;border:1px solid #dde4ea;border-radius:15px;box-shadow:0 8px 24px rgba(15,23,42,.045)}.coach-week{display:flex;align-items:center;justify-content:space-between;gap:24px}.coach-week>div:first-child span{color:#0783c9;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.coach-week h2,.coach-section-head h2,.coach-principles h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;line-height:.95}.coach-week h2{font-size:38px;margin:5px 0 6px}.coach-week p,.coach-principles p{margin:0;color:#687385;line-height:1.55}.coach-week-status{display:grid;grid-template-columns:auto auto;align-items:center;gap:3px 12px;min-width:190px}.coach-week-status strong{grid-row:1/3;font-family:'Bebas Neue',Impact,sans-serif;font-size:52px;line-height:.8;color:var(--coach-accent)}.coach-week-status span{color:#687385;font-size:12px;font-weight:800}.coach-week-status b{font-size:10px;letter-spacing:.08em}.coach-tools{margin-top:22px}.coach-section-head{margin-bottom:12px}.coach-section-head h2{font-size:38px;margin:5px 0 0}.coach-tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.coach-tool-grid>a{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;padding:20px;background:#fff;border:1px solid #dde4ea;border-radius:15px;box-shadow:0 8px 24px rgba(15,23,42,.045);color:#111;text-decoration:none}.coach-tool-grid>a:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(15,23,42,.08)}.coach-tool-grid strong,.coach-tool-grid span{display:block}.coach-tool-grid strong{font-size:17px}.coach-tool-grid span{margin-top:4px;color:#687385;font-size:13px;line-height:1.4}.coach-principles{display:flex;align-items:flex-start;gap:14px}.coach-principles h2{font-size:30px;margin:5px 0 7px}@media(max-width:760px){.coach-workspace{padding:16px 12px 40px}.coach-hero,.coach-week{align-items:flex-start;flex-direction:column}.coach-hero{padding:20px;border-radius:15px}.coach-club{align-items:flex-start}.coach-club h1{font-size:42px}.coach-hero-links{width:100%}.coach-hero-links a{justify-content:center;flex:1}.coach-week-status{width:100%}.coach-tool-grid{grid-template-columns:1fr}.coach-tool-grid>a{padding:17px}.coach-principles{padding:18px}}
`