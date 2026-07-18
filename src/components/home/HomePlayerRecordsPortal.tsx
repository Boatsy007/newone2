import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

type WeeklyLeader = {
  rank: number
  playerId: string
  playerName: string
  clubName: string
  leagueName: string
  weeklyGoals: number
  goals: number
  playerUrl: string
}

type SeasonLeader = {
  rank: number
  playerId: string
  playerName: string
  clubName: string
  leagueName: string
  goals: number
  goalsPerGame: number | null
  playerUrl: string
}

type Payload = {
  data?: {
    weekly?: WeeklyLeader[]
    seasonLeaders?: SeasonLeader[]
  }
}

export default function HomePlayerRecordsPortal() {
  const { pathname } = useLocation()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [weekly, setWeekly] = useState<WeeklyLeader[]>([])
  const [season, setSeason] = useState<SeasonLeader[]>([])

  useEffect(() => {
    if (pathname !== '/') { setTarget(null); return }
    let cancelled = false
    const attach = () => {
      if (cancelled) return
      const records = document.getElementById('pf-home-records-slot')
      const top = document.querySelector<HTMLElement>('.pf-top')
      const anchor = records ?? top
      if (!anchor) return
      let node = document.getElementById('pf-home-player-records-slot')
      if (!node) {
        node = document.createElement('div')
        node.id = 'pf-home-player-records-slot'
        anchor.insertAdjacentElement('afterend', node)
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
    void fetch('/api/goal-kickers/records?limit=5')
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: Payload) => {
        if (!active) return
        setWeekly(Array.isArray(payload.data?.weekly) ? payload.data!.weekly! : [])
        setSeason(Array.isArray(payload.data?.seasonLeaders) ? payload.data!.seasonLeaders! : [])
      })
      .catch(() => { if (active) { setWeekly([]); setSeason([]) } })
    return () => { active = false }
  }, [pathname])

  if (!target || pathname !== '/' || (weekly.length === 0 && season.length === 0)) return null

  const cards = [
    ...weekly.slice(0, 3).map(row => ({
      key: `weekly-${row.playerId}`,
      kicker: row.rank === 1 ? 'Most goals this week' : `Weekly goals · #${row.rank}`,
      value: `${row.weeklyGoals}`,
      unit: row.weeklyGoals === 1 ? 'goal' : 'goals',
      name: row.playerName,
      club: row.clubName,
      league: row.leagueName,
      url: row.playerUrl,
    })),
    ...season.slice(0, weekly.length > 0 ? 3 : 5).map(row => ({
      key: `season-${row.playerId}`,
      kicker: row.rank === 1 ? 'Season goal leader' : `Season goals · #${row.rank}`,
      value: `${row.goals}`,
      unit: 'goals',
      name: row.playerName,
      club: row.clubName,
      league: row.leagueName,
      url: row.playerUrl,
    })),
  ].slice(0, 6)

  return createPortal(<section className="pf-player-records-home pf-shell">
    <div className="pf-player-records-head">
      <div><span>Individual performances</span><h2>Player records</h2></div>
      <Link to="/goal-kickers">View goal kickers <ArrowRight size={17} /></Link>
    </div>
    <div className="pf-player-records-strip">
      {cards.map(card => <Link key={card.key} to={card.url} className="pf-player-record-card">
        <span>{card.kicker}</span>
        <strong>{card.value}<small>{card.unit}</small></strong>
        <h3>{card.name}</h3>
        <p>{card.club}</p>
        <small>{card.league}</small>
      </Link>)}
    </div>
    <style>{`
      .pf-player-records-home{padding:0 0 46px;font-family:Barlow,Inter,Arial,sans-serif}.pf-player-records-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:17px}.pf-player-records-head>div>span{text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.16em;color:#0783c9}.pf-player-records-head h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(2.2rem,4vw,4rem);line-height:.88;margin:5px 0 0}.pf-player-records-head>a{display:inline-flex;align-items:center;gap:8px;color:#42b8ff;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:800}.pf-player-records-strip{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;scrollbar-width:none}.pf-player-records-strip::-webkit-scrollbar{display:none}.pf-player-record-card{flex:0 0 min(285px,80vw);scroll-snap-align:start;border:1px solid #e3e7ec;border-radius:9px;padding:20px;background:#fff;color:#111318;text-decoration:none;min-height:205px;display:flex;flex-direction:column;box-shadow:0 5px 16px rgba(17,24,39,.045)}.pf-player-record-card>span{text-transform:uppercase;font-size:10px;letter-spacing:.13em;font-weight:900;color:#0783c9}.pf-player-record-card>strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:46px;line-height:1;margin-top:16px;color:#0783c9}.pf-player-record-card>strong small{font-family:Barlow,Inter,Arial,sans-serif;font-size:12px;margin-left:7px;text-transform:uppercase;letter-spacing:.08em;color:#687385}.pf-player-record-card h3{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:25px;line-height:1;margin:13px 0 5px}.pf-player-record-card p{font-size:13px;line-height:1.45;margin:0;color:#303741}.pf-player-record-card>small{margin-top:auto;padding-top:14px;color:#687385;font-size:11px}.pf-player-record-card:hover{transform:translateY(-2px)}@media(max-width:620px){.pf-player-records-home{padding-bottom:38px}.pf-player-records-head{align-items:flex-end}.pf-player-records-head h2{font-size:2.8rem}.pf-player-records-head>a{font-size:11px}.pf-player-record-card{flex-basis:82vw}}
    `}</style>
  </section>, target)
}
