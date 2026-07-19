import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { Award, Trophy } from 'lucide-react'

type Achievement = {
  id: string
  type: string
  title: string
  body: string
  label: string
  value: string
  playerName: string
  clubName: string
  leagueName: string
  playerUrl: string
  createdAt: string
}

export default function GoalKickerAchievementsPortal() {
  const { pathname } = useLocation()
  const context = useMemo(() => {
    const player = pathname.match(/^\/player\/([^/]+)/)
    if (player) return { key: 'playerRowId', id: decodeURIComponent(player[1]), heading: 'Player achievements' }
    const club = pathname.match(/^\/team\/([^/]+)/)
    if (club) return { key: 'clubId', id: decodeURIComponent(club[1]), heading: 'Goal-kicking achievements' }
    const league = pathname.match(/^\/league\/([^/]+)/)
    if (league) return { key: 'leagueId', id: decodeURIComponent(league[1]), heading: 'League player achievements' }
    return null
  }, [pathname])
  const [items, setItems] = useState<Achievement[]>([])
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!context) { setItems([]); return }
    let active = true
    const query = new URLSearchParams({ [context.key]: context.id })
    fetch(`/api/goal-kickers/achievements?${query}`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: Achievement[] }) => { if (active) setItems(Array.isArray(payload.data) ? payload.data : []) })
      .catch(() => { if (active) setItems([]) })
    return () => { active = false }
  }, [context])

  useEffect(() => {
    if (!context || items.length === 0) { setTarget(null); document.getElementById('pf-goal-achievements-slot')?.remove(); return }
    let active = true
    const attach = () => {
      if (!active) return
      const main = document.querySelector<HTMLElement>('main')
      if (!main) return
      let slot = document.getElementById('pf-goal-achievements-slot')
      if (!slot) {
        slot = document.createElement('div')
        slot.id = 'pf-goal-achievements-slot'
        main.appendChild(slot)
      }
      setTarget(slot)
    }
    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { active = false; observer.disconnect(); setTarget(null); document.getElementById('pf-goal-achievements-slot')?.remove() }
  }, [context, items.length])

  if (!context || !target || items.length === 0) return null
  return createPortal(<section className="pf-achievements-section">
    <div className="pf-achievements-shell">
      <header><span><Award size={15} /> Automatically detected</span><h2>{context.heading}</h2><p>Milestones and records created from approved goal-kicker updates.</p></header>
      <div className="pf-achievements-grid">
        {items.slice(0, 12).map(item => <article key={item.id}>
          <div className="pf-achievement-icon"><Trophy size={20} /></div>
          <div className="pf-achievement-copy"><span>{item.label}</span><h3>{item.title}</h3><p>{item.body}</p><small>{formatDate(item.createdAt)}</small></div>
          <strong>{item.value}</strong>
          <Link to={item.playerUrl}>View player</Link>
        </article>)}
      </div>
    </div>
    <style>{`
      .pf-achievements-section{background:#f3f5f7;padding:0 16px 48px}.pf-achievements-shell{width:min(1180px,100%);margin:0 auto;border:1px solid #dfe5eb;border-radius:14px;background:#fff;box-shadow:0 7px 24px rgba(17,24,39,.06);overflow:hidden}.pf-achievements-shell>header{padding:24px;border-bottom:1px solid #e5e9ee}.pf-achievements-shell>header>span{display:flex;align-items:center;gap:7px;color:#168fd2;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.pf-achievements-shell h2{margin:7px 0 5px;font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;line-height:.9;text-transform:uppercase;color:#111318}.pf-achievements-shell header p{margin:0;color:#687385;font-size:14px}.pf-achievements-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#e5e9ee}.pf-achievements-grid article{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:start;padding:20px;background:#fff}.pf-achievement-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:50%;background:#fff1be;color:#a46600}.pf-achievement-copy{min-width:0}.pf-achievement-copy>span{display:block;color:#168fd2;font-size:10px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.pf-achievement-copy h3{margin:5px 0;color:#111318;font-size:18px;line-height:1.12}.pf-achievement-copy p{margin:0;color:#687385;font-size:13px;line-height:1.45}.pf-achievement-copy small{display:block;margin-top:8px;color:#8a94a3;font-size:11px;font-weight:800}.pf-achievements-grid article>strong{color:#111318;font-family:'Bebas Neue',Impact,sans-serif;font-size:28px;white-space:nowrap}.pf-achievements-grid article>a{grid-column:2/4;justify-self:start;color:#087fbf;font-size:11px;font-weight:950;text-decoration:none;text-transform:uppercase;letter-spacing:.08em}@media(max-width:720px){.pf-achievements-section{padding:0 12px 36px}.pf-achievements-grid{grid-template-columns:1fr}.pf-achievements-shell>header{padding:20px}.pf-achievements-grid article{padding:17px}.pf-achievements-shell h2{font-size:36px}}
    `}</style>
  </section>, target)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
