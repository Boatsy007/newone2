import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { fetchFootballRecords, recordLabels, type FootballRecordEntry, type RecordCategory } from '../../lib/footballRecords'

const categories: RecordCategory[] = ['highestScore', 'biggestMargin', 'mostGoals', 'closestMatch', 'lowestWinningScore', 'highestCombinedScore']

export default function HomeRecordsPortal() {
  const { pathname } = useLocation()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [records, setRecords] = useState<Array<{ category: RecordCategory; entry: FootballRecordEntry }>>([])

  useEffect(() => {
    if (pathname !== '/') { setTarget(null); return }
    let cancelled = false
    const attach = () => {
      if (cancelled) return
      const top = document.querySelector<HTMLElement>('.pf-top')
      if (!top) return
      let node = document.getElementById('pf-home-records-slot')
      if (!node) {
        node = document.createElement('div')
        node.id = 'pf-home-records-slot'
        top.insertAdjacentElement('afterend', node)
      }
      setTarget(node)
    }
    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { cancelled = true; observer.disconnect(); setTarget(null) }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/') return
    let active = true
    void fetchFootballRecords({ period: 'week', limit: 1 })
      .then(data => {
        if (!active) return
        setRecords(categories.flatMap(category => data.categories[category]?.[0] ? [{ category, entry: data.categories[category][0] }] : []))
      })
      .catch(() => { if (active) setRecords([]) })
    return () => { active = false }
  }, [pathname])

  if (!target || pathname !== '/' || records.length === 0) return null

  return createPortal(<section className="pf-records-home pf-shell">
    <div className="pf-records-head">
      <div><span>Across community football</span><h2>Footy records</h2></div>
      <Link to="/records">View all records <ArrowRight size={17} /></Link>
    </div>
    <div className="pf-records-strip">
      {records.map(({ category, entry }) => <Link key={category} to={entry.matchUrl} className="pf-record-card">
        <span>{recordLabels[category]} this week</span>
        <strong>{entry.valueLabel}</strong>
        <h3>{entry.clubName}</h3>
        <p>{entry.homeName} {entry.homePoints} — {entry.awayPoints} {entry.awayName}</p>
        <small>{entry.leagueName}{entry.round ? ` · ${entry.round}` : ''}</small>
      </Link>)}
    </div>
    <style>{`
      .pf-records-home{padding:0 0 46px;font-family:Barlow,Inter,Arial,sans-serif}.pf-records-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:17px}.pf-records-head>div>span{text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.16em;color:#0783c9}.pf-records-head h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(2.2rem,4vw,4rem);line-height:.88;margin:5px 0 0}.pf-records-head>a{display:inline-flex;align-items:center;gap:8px;color:#42b8ff;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:800}.pf-records-strip{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;scrollbar-width:none}.pf-records-strip::-webkit-scrollbar{display:none}.pf-record-card{flex:0 0 min(285px,80vw);scroll-snap-align:start;border:1px solid #e3e7ec;border-radius:9px;padding:20px;background:#050505;color:#fff;text-decoration:none;min-height:205px;display:flex;flex-direction:column}.pf-record-card>span{text-transform:uppercase;font-size:10px;letter-spacing:.13em;font-weight:900;color:#42b8ff}.pf-record-card>strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;line-height:1;margin-top:16px;color:#42b8ff}.pf-record-card h3{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:25px;line-height:1;margin:13px 0 5px}.pf-record-card p{font-size:13px;line-height:1.45;margin:0;color:#edf2f7}.pf-record-card small{margin-top:auto;padding-top:14px;color:#9ca7b5;font-size:11px}.pf-record-card:hover{transform:translateY(-2px)}@media(max-width:620px){.pf-records-home{padding-bottom:38px}.pf-records-head{align-items:flex-end}.pf-records-head h2{font-size:2.8rem}.pf-records-head>a{font-size:11px}.pf-record-card{flex-basis:82vw}}
    `}</style>
  </section>, target)
}
