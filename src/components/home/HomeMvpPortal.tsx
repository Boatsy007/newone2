import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { TeamLogo } from '../rankings/bits'
import { ClubMvpPanel } from '../mvp/MvpPanels'
import type { MvpEntry } from '../../pages/MvpLeaderboard'

type GoalKickerRow = {
  id: string
  playerId: string
  rank: number
  playerName: string
  clubName: string
  clubId: string | null
  clubLogoUrl: string | null
  leagueName: string
  leagueId: string | null
  goals: number
  matches: number | null
  goalsPerGame: number | null
}

type LeaderRow = {
  key: string
  playerId: string | null
  playerName: string
  clubId: string | null
  clubName: string
  clubLogoUrl: string | null
  leagueName: string
  value: string
}

type LeaderCard = {
  title: string
  label: string
  href: string
  rows: LeaderRow[]
}

export default function HomeMvpPortal() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [clubTarget, setClubTarget] = useState<HTMLElement | null>(null)
  const [clubName, setClubName] = useState('Club')
  const [mvpRows, setMvpRows] = useState<MvpEntry[]>([])
  const [goalRows, setGoalRows] = useState<GoalKickerRow[]>([])
  const [gpgRows, setGpgRows] = useState<GoalKickerRow[]>([])
  const [loading, setLoading] = useState(true)
  const clubId = pathname.startsWith('/team/') ? decodeURIComponent(pathname.slice('/team/'.length)) : ''

  useEffect(() => {
    if (pathname !== '/') {
      setTarget(null)
      document.getElementById('pf-home-mvp-slot')?.remove()
      return
    }

    let active = true
    const attach = () => {
      if (!active) return
      const playerRecords = document.getElementById('pf-home-player-records-slot')
      const records = document.getElementById('pf-home-records-slot')
      const top = document.querySelector<HTMLElement>('.pf-top')
      const anchor = playerRecords ?? records ?? top
      if (!anchor) return

      let slot = document.getElementById('pf-home-mvp-slot')
      if (!slot) {
        slot = document.createElement('div')
        slot.id = 'pf-home-mvp-slot'
      }

      if (playerRecords?.parentElement) {
        if (slot.nextElementSibling !== playerRecords) playerRecords.parentElement.insertBefore(slot, playerRecords)
      } else if (records?.parentElement) {
        if (slot.nextElementSibling !== records) records.parentElement.insertBefore(slot, records)
      } else if (top && slot.previousElementSibling !== top) {
        top.insertAdjacentElement('afterend', slot)
      }

      document.querySelectorAll<HTMLElement>('.pf-goal-row').forEach(row => {
        const section = row.closest<HTMLElement>('section')
        if (section && !section.closest('#pf-home-mvp-slot')) {
          section.dataset.pfLegacyGoalHidden = 'true'
          section.style.display = 'none'
        }
      })
      setTarget(slot)
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      active = false
      observer.disconnect()
      document.querySelectorAll<HTMLElement>('[data-pf-legacy-goal-hidden="true"]').forEach(section => {
        section.style.removeProperty('display')
        delete section.dataset.pfLegacyGoalHidden
      })
      setTarget(null)
      document.getElementById('pf-home-mvp-slot')?.remove()
    }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/') return
    let active = true
    setLoading(true)
    Promise.all([
      fetch('/api/mvp?limit=5').then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))),
      fetch('/api/goal-kickers?sort=goals&limit=5').then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))),
      fetch('/api/goal-kickers?sort=gpg&limit=5').then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))),
    ])
      .then(([mvp, goals, gpg]: [{ data?: MvpEntry[] }, { data?: GoalKickerRow[] }, { data?: GoalKickerRow[] }]) => {
        if (!active) return
        setMvpRows(Array.isArray(mvp.data) ? mvp.data : [])
        setGoalRows(Array.isArray(goals.data) ? goals.data : [])
        setGpgRows(Array.isArray(gpg.data) ? gpg.data : [])
      })
      .catch(() => {
        if (!active) return
        setMvpRows([])
        setGoalRows([])
        setGpgRows([])
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [pathname])

  useEffect(() => {
    if (!clubId) {
      setClubTarget(null)
      document.getElementById('pf-club-mvp-slot')?.remove()
      return
    }

    let active = true
    fetch(`/api/clubs/${encodeURIComponent(clubId)}`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: { clubName?: string } }) => {
        if (active && payload.data?.clubName) setClubName(payload.data.clubName)
      })
      .catch(() => {})

    const attach = () => {
      if (!active) return
      const host = document.querySelector<HTMLElement>('.club-profile-main')
      if (!host) return
      let slot = document.getElementById('pf-club-mvp-slot')
      if (!slot) {
        slot = document.createElement('div')
        slot.id = 'pf-club-mvp-slot'
      }
      if (host.firstElementChild && slot.previousElementSibling !== host.firstElementChild) {
        host.firstElementChild.insertAdjacentElement('afterend', slot)
      } else if (!slot.parentElement) {
        host.append(slot)
      }
      setClubTarget(slot)
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      active = false
      observer.disconnect()
      setClubTarget(null)
      document.getElementById('pf-club-mvp-slot')?.remove()
    }
  }, [clubId])

  if (clubId && clubTarget) return createPortal(<ClubMvpPanel clubId={clubId} clubName={clubName} />, clubTarget)
  if (!target) return null

  const cards: LeaderCard[] = [
    {
      title: 'Goals',
      label: 'Goals',
      href: '/goal-kickers',
      rows: goalRows.slice(0, 5).map(row => ({ key: row.id, playerId: row.id, playerName: row.playerName, clubId: row.clubId, clubName: row.clubName, clubLogoUrl: row.clubLogoUrl, leagueName: row.leagueName, value: String(row.goals) })),
    },
    {
      title: 'MVP',
      label: 'MVP points',
      href: '/mvp',
      rows: mvpRows.slice(0, 5).map(row => ({ key: row.id, playerId: row.playerId, playerName: row.playerName, clubId: row.clubId, clubName: row.clubName, clubLogoUrl: row.clubLogoUrl, leagueName: row.leagueName, value: String(row.mvpPoints) })),
    },
    {
      title: 'Goals per game',
      label: 'Goals / game',
      href: '/goal-kickers?sort=gpg',
      rows: gpgRows.slice(0, 5).map(row => ({ key: row.id, playerId: row.id, playerName: row.playerName, clubId: row.clubId, clubName: row.clubName, clubLogoUrl: row.clubLogoUrl, leagueName: row.leagueName, value: row.goalsPerGame == null ? '—' : row.goalsPerGame.toFixed(2) })),
    },
  ]

  return createPortal(
    <section className="pfleaders pf-shell">
      <div className="pfleaders-head">
        <div><span>National player leaders</span><h2>Top performers</h2></div>
      </div>
      <div className="pfleaders-row" aria-busy={loading}>
        {loading
          ? Array.from({ length: 3 }, (_, index) => <LeaderSkeleton key={index} />)
          : cards.map(card => <LeaderBoardCard key={card.title} card={card} navigate={navigate} />)}
      </div>
      {!loading && cards.every(card => card.rows.length === 0) ? <p className="pfleaders-empty">Player leaderboards are temporarily unavailable.</p> : null}
      <style>{styles}</style>
    </section>,
    target,
  )
}

function LeaderBoardCard({ card, navigate }: { card: LeaderCard; navigate: ReturnType<typeof useNavigate> }) {
  const leader = card.rows[0]
  return <article className="pfleaders-card pfhmvp-card" data-player-id={leader?.playerId ?? undefined} data-club-id={leader?.clubId ?? undefined}>
    <div className="pfleaders-card-title">{card.title}</div>
    {leader ? <>
      <button type="button" className="pfleaders-feature" onClick={() => leader.playerId && navigate(`/player/${leader.playerId}`)} disabled={!leader.playerId}>
        <span className="pfleaders-feature-copy"><strong>{leader.value}</strong><small>{card.label}</small><b>{leader.playerName}</b><em>{leader.clubName}</em></span>
        <span className="pfleaders-feature-logo" role="button" tabIndex={leader.clubId ? 0 : -1} onClick={event => { event.stopPropagation(); if (leader.clubId) navigate(`/team/${leader.clubId}`) }} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && leader.clubId) { event.preventDefault(); event.stopPropagation(); navigate(`/team/${leader.clubId}`) } }}>
          <TeamLogo name={leader.clubName} src={leader.clubLogoUrl ?? undefined} size={88} />
        </span>
      </button>
      <div className="pfleaders-list">
        {card.rows.slice(1).map(row => <div className="pfleaders-list-row" key={row.key}>
          <button type="button" className="pfleaders-list-logo" onClick={() => row.clubId && navigate(`/team/${row.clubId}`)} disabled={!row.clubId}><TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={42} /></button>
          <button type="button" className="pfleaders-list-player" onClick={() => row.playerId && navigate(`/player/${row.playerId}`)} disabled={!row.playerId}><strong>{row.playerName}</strong><small>{row.clubName}</small></button>
          <b>{row.value}</b>
        </div>)}
      </div>
      <Link className="pfleaders-full" to={card.href}>Full table <ArrowRight size={17} /></Link>
    </> : <div className="pfleaders-card-empty">No data available</div>}
  </article>
}

function LeaderSkeleton() {
  return <article className="pfleaders-card pfleaders-skeleton" aria-hidden="true"><span /><span /><span /><span /><span /></article>
}

const styles = `
#pf-home-mvp-slot{display:block;clear:both;position:relative;background:#fff;border-top:18px solid #eef3f7;padding-top:34px;box-sizing:border-box}
.pfleaders{padding:0 0 48px;font-family:Barlow,Inter,Arial,sans-serif}
.pfleaders-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:18px}.pfleaders-head span{color:#0783c9;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.pfleaders-head h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.5rem,5vw,4.8rem);line-height:.88;margin:6px 0 0;text-transform:uppercase}
.pfleaders-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:stretch}.pfleaders-card{position:relative;display:flex;flex-direction:column;min-width:0;overflow:hidden;border:1px solid #dce3eb;border-radius:14px;background:#fff;box-shadow:0 6px 18px rgba(17,24,39,.06)}
.pfleaders-card-title{padding:10px 16px;background:linear-gradient(90deg,#168fd4,#42b8ff);color:#fff;font-size:13px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
.pfleaders-feature{position:relative;width:100%;min-height:205px;border:0;padding:24px 118px 22px 22px;background:linear-gradient(135deg,#07101d 0%,#14375d 55%,#1596da 100%);color:#fff;text-align:left;cursor:pointer}.pfleaders-feature:disabled{cursor:default}.pfleaders-feature-copy{display:flex;flex-direction:column;align-items:flex-start}.pfleaders-feature-copy>strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:58px;line-height:.85}.pfleaders-feature-copy>small{margin-top:5px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.72)}.pfleaders-feature-copy>b{margin-top:22px;font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;line-height:.95;text-transform:uppercase}.pfleaders-feature-copy>em{margin-top:6px;font-size:12px;font-style:normal;color:rgba(255,255,255,.72)}
.pfleaders-feature-logo{position:absolute;right:20px;bottom:18px;display:grid;place-items:center;width:94px;height:94px;border-radius:18px;background:rgba(255,255,255,.94);cursor:pointer}.pfleaders-feature-logo img{max-width:88px;max-height:88px;object-fit:contain}
.pfleaders-list{display:flex;flex-direction:column}.pfleaders-list-row{display:grid;grid-template-columns:52px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:66px;padding:8px 16px;border-top:1px solid #e8edf2}.pfleaders-list-logo,.pfleaders-list-player{border:0;background:transparent;padding:0;text-align:left;cursor:pointer}.pfleaders-list-logo:disabled,.pfleaders-list-player:disabled{cursor:default}.pfleaders-list-logo{display:grid;place-items:center;width:44px;height:44px}.pfleaders-list-logo img{max-width:42px;max-height:42px;object-fit:contain}.pfleaders-list-player{display:flex;flex-direction:column;min-width:0}.pfleaders-list-player strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#111318;font-size:15px}.pfleaders-list-player small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px;color:#748091;font-size:10px}.pfleaders-list-row>b{font-size:20px;color:#111318}
.pfleaders-full{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:auto;padding:15px;border-top:1px solid #e3e8ed;color:#0b5ca8;text-decoration:none;font-weight:900}.pfleaders-full:hover{color:#0783c9}.pfleaders-card-empty,.pfleaders-empty{padding:36px;text-align:center;color:#687385}
.pfleaders-skeleton{min-height:520px;padding:18px;gap:12px}.pfleaders-skeleton span{display:block;height:54px;border-radius:10px;background:#e9eef2}.pfleaders-skeleton span:first-child{height:190px}
@media(max-width:980px){.pfleaders-row{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;scrollbar-width:none}.pfleaders-row::-webkit-scrollbar{display:none}.pfleaders-card{flex:0 0 min(360px,88vw);scroll-snap-align:start}}
@media(max-width:620px){#pf-home-mvp-slot{border-top-width:12px;padding-top:26px}.pfleaders{width:calc(100% - 24px);padding-bottom:38px}.pfleaders-head h2{font-size:3.1rem}.pfleaders-feature{min-height:190px;padding:22px 106px 20px 18px}.pfleaders-feature-copy>strong{font-size:52px}.pfleaders-feature-copy>b{font-size:27px}.pfleaders-feature-logo{right:14px;bottom:16px;width:86px;height:86px}.pfleaders-feature-logo img{max-width:80px;max-height:80px}.pfleaders-list-row{padding-left:12px;padding-right:12px}}
`
