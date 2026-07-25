import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { TeamLogo } from '../rankings/bits'
import { ClubMvpPanel } from '../mvp/MvpPanels'
import type { MvpEntry } from '../../pages/MvpLeaderboard'
import { fetchFootballRecords, recordLabels, type FootballRecordEntry, type RecordCategory } from '../../lib/footballRecords'
import { loadHomeCardLogoMaps } from '../../lib/homeCardLogos'

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

type PlayerBag = {
  playerId: string
  playerName: string
  clubName: string
  leagueName: string
  weeklyGoals: number
  playerUrl: string
}

type RecordPayload = { data?: { weekly?: PlayerBag[]; biggestBags?: PlayerBag[] } }
type RecordCategories = Partial<Record<RecordCategory, FootballRecordEntry[]>>
type LogoMaps = Awaited<ReturnType<typeof loadHomeCardLogoMaps>>

type LeaderRow = {
  key: string
  destination: string | null
  clubId: string | null
  name: string
  secondary: string
  detail: string
  clubName: string
  clubLogoUrl: string | null
  value: string
}

type LeaderCard = {
  title: string
  label: string
  href: string
  rows: LeaderRow[]
}

const RECORD_CATEGORIES: RecordCategory[] = ['highestScore', 'biggestMargin', 'highestCombinedScore', 'lowestScore']

export default function HomeMvpPortal() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [clubTarget, setClubTarget] = useState<HTMLElement | null>(null)
  const [clubName, setClubName] = useState('Club')
  const [mvpRows, setMvpRows] = useState<MvpEntry[]>([])
  const [goalRows, setGoalRows] = useState<GoalKickerRow[]>([])
  const [gpgRows, setGpgRows] = useState<GoalKickerRow[]>([])
  const [weeklyRows, setWeeklyRows] = useState<LeaderRow[]>([])
  const [yearlyRows, setYearlyRows] = useState<LeaderRow[]>([])
  const [loading, setLoading] = useState(true)
  const clubId = pathname.startsWith('/team/') ? decodeURIComponent(pathname.slice('/team/'.length)) : ''

  useEffect(() => {
    if (pathname !== '/') {
      setTarget(null)
      document.getElementById('pf-home-mvp-slot')?.remove()
      return
    }

    let active = true
    const hideLegacySection = (node: HTMLElement | null, marker: string) => {
      if (!node || node.closest('#pf-home-mvp-slot')) return
      node.dataset[marker] = 'true'
      node.style.display = 'none'
    }
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

      hideLegacySection(playerRecords, 'pfLegacyPlayerRecordsHidden')
      hideLegacySection(records, 'pfLegacyRecordsHidden')
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
      document.querySelectorAll<HTMLElement>('[data-pf-legacy-goal-hidden="true"],[data-pf-legacy-player-records-hidden="true"],[data-pf-legacy-records-hidden="true"]').forEach(section => {
        section.style.removeProperty('display')
        delete section.dataset.pfLegacyGoalHidden
        delete section.dataset.pfLegacyPlayerRecordsHidden
        delete section.dataset.pfLegacyRecordsHidden
      })
      setTarget(null)
      document.getElementById('pf-home-mvp-slot')?.remove()
    }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/') return
    let active = true
    setLoading(true)
    const season = new Date().getFullYear()

    void Promise.allSettled([
      fetch('/api/mvp?limit=5').then(response => response.ok ? response.json() as Promise<{ data?: MvpEntry[] }> : Promise.reject(new Error(`HTTP ${response.status}`))),
      fetch('/api/goal-kickers?sort=goals&limit=5').then(response => response.ok ? response.json() as Promise<{ data?: GoalKickerRow[] }> : Promise.reject(new Error(`HTTP ${response.status}`))),
      fetch('/api/goal-kickers?sort=gpg&limit=5').then(response => response.ok ? response.json() as Promise<{ data?: GoalKickerRow[] }> : Promise.reject(new Error(`HTTP ${response.status}`))),
      fetchFootballRecords({ period: 'week', limit: 20 }),
      fetchFootballRecords({ period: 'season', season, limit: 20 }),
      fetch('/api/goal-kickers/records?limit=20').then(response => response.ok ? response.json() as Promise<RecordPayload> : Promise.reject(new Error(`HTTP ${response.status}`))),
      loadHomeCardLogoMaps(),
    ]).then(results => {
      if (!active) return
      const [mvpResult, goalsResult, gpgResult, weekResult, seasonResult, playerRecordResult, logoResult] = results
      const mvp = mvpResult.status === 'fulfilled' ? mvpResult.value.data ?? [] : []
      const goals = goalsResult.status === 'fulfilled' ? goalsResult.value.data ?? [] : []
      const gpg = gpgResult.status === 'fulfilled' ? gpgResult.value.data ?? [] : []
      const week = weekResult.status === 'fulfilled' ? weekResult.value : null
      const yearly = seasonResult.status === 'fulfilled' ? seasonResult.value : null
      const playerRecords = playerRecordResult.status === 'fulfilled' ? playerRecordResult.value.data : undefined
      const logos = logoResult.status === 'fulfilled' ? logoResult.value : null

      setMvpRows(Array.isArray(mvp) ? mvp : [])
      setGoalRows(Array.isArray(goals) ? goals : [])
      setGpgRows(Array.isArray(gpg) ? gpg : [])
      setWeeklyRows(week && logos ? buildRecordRows(week.categories, playerRecords?.weekly?.[0], logos, 'week') : [])
      setYearlyRows(yearly && logos ? buildRecordRows(yearly.categories, playerRecords?.biggestBags?.[0], logos, 'year') : [])
    }).finally(() => { if (active) setLoading(false) })

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
      title: 'Goals', label: 'Goals', href: '/goal-kickers',
      rows: goalRows.slice(0, 5).map(row => ({ key: row.id, destination: `/player/${row.id}`, clubId: row.clubId, name: row.playerName, secondary: row.clubName, detail: row.leagueName, clubName: row.clubName, clubLogoUrl: row.clubLogoUrl, value: String(row.goals) })),
    },
    {
      title: 'MVP', label: 'MVP points', href: '/mvp',
      rows: mvpRows.slice(0, 5).map(row => ({ key: row.id, destination: row.playerId ? `/player/${row.playerId}` : null, clubId: row.clubId, name: row.playerName, secondary: row.clubName, detail: row.leagueName, clubName: row.clubName, clubLogoUrl: row.clubLogoUrl, value: String(row.mvpPoints) })),
    },
    {
      title: 'Goals per game', label: 'Goals / game', href: '/goal-kickers?sort=gpg',
      rows: gpgRows.slice(0, 5).map(row => ({ key: row.id, destination: `/player/${row.id}`, clubId: row.clubId, name: row.playerName, secondary: row.clubName, detail: row.leagueName, clubName: row.clubName, clubLogoUrl: row.clubLogoUrl, value: row.goalsPerGame == null ? '—' : row.goalsPerGame.toFixed(2) })),
    },
    { title: 'Weekly records', label: 'This week', href: '/records', rows: weeklyRows },
    { title: 'Yearly records', label: 'This season', href: '/records', rows: yearlyRows },
  ]

  return createPortal(
    <section className="pfleaders pf-shell">
      <div className="pfleaders-head"><div><span>National player and match leaders</span><h2>Top performers</h2></div></div>
      <div className="pfleaders-row" aria-busy={loading}>
        {loading
          ? Array.from({ length: 5 }, (_, index) => <LeaderSkeleton key={index} />)
          : cards.map(card => <LeaderBoardCard key={card.title} card={card} navigate={navigate} />)}
      </div>
      {!loading && cards.every(card => card.rows.length === 0) ? <p className="pfleaders-empty">Leaderboards are temporarily unavailable.</p> : null}
      <style>{styles}</style>
    </section>,
    target,
  )
}

function buildRecordRows(records: RecordCategories, playerBag: PlayerBag | undefined, logos: LogoMaps, period: 'week' | 'year'): LeaderRow[] {
  const rows: LeaderRow[] = []
  if (playerBag?.weeklyGoals) {
    const playerLogo = logos.byPlayerId.get(playerBag.playerId)
    const sameClub = playerLogo?.clubName.trim().toLowerCase() === playerBag.clubName.trim().toLowerCase()
    rows.push({
      key: `${period}-player-bag`, destination: playerBag.playerUrl, clubId: sameClub ? playerLogo?.clubId ?? null : null,
      name: playerBag.playerName, secondary: playerBag.clubName, detail: playerBag.leagueName, clubName: playerBag.clubName,
      clubLogoUrl: sameClub ? playerLogo?.logoUrl ?? null : null, value: `${playerBag.weeklyGoals} goals`,
    })
  }
  for (const category of RECORD_CATEGORIES) {
    const entry = records[category]?.[0]
    if (!entry) continue
    rows.push({
      key: `${period}-${category}`, destination: entry.matchUrl, clubId: entry.clubId ?? null,
      name: entry.clubName, secondary: `${entry.homeName} ${entry.homePoints}–${entry.awayPoints} ${entry.awayName}`,
      detail: `${recordLabels[category]} · ${entry.leagueName}${entry.round ? ` · ${entry.round}` : ''}`,
      clubName: entry.clubName, clubLogoUrl: entry.clubId ? logos.byClubId.get(entry.clubId) ?? null : null, value: entry.valueLabel,
    })
  }
  return rows.slice(0, 5)
}

function LeaderBoardCard({ card, navigate }: { card: LeaderCard; navigate: ReturnType<typeof useNavigate> }) {
  const leader = card.rows[0]
  return <article className="pfleaders-card" data-club-id={leader?.clubId ?? undefined}>
    <div className="pfleaders-card-title">{card.title}</div>
    {leader ? <>
      <button type="button" className="pfleaders-feature" onClick={() => leader.destination && navigate(leader.destination)} disabled={!leader.destination}>
        <span className="pfleaders-feature-copy"><strong>{leader.value}</strong><small>{card.label}</small><b>{leader.name}</b><em>{leader.secondary}</em></span>
        <span className="pfleaders-feature-logo" role="button" tabIndex={leader.clubId ? 0 : -1} onClick={event => { event.stopPropagation(); if (leader.clubId) navigate(`/team/${leader.clubId}`) }} onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && leader.clubId) { event.preventDefault(); event.stopPropagation(); navigate(`/team/${leader.clubId}`) } }}>
          <TeamLogo name={leader.clubName} src={leader.clubLogoUrl ?? undefined} size={88} />
        </span>
      </button>
      <div className="pfleaders-list">
        {card.rows.slice(1).map(row => <div className="pfleaders-list-row" key={row.key}>
          <button type="button" className="pfleaders-list-logo" onClick={() => row.clubId && navigate(`/team/${row.clubId}`)} disabled={!row.clubId}><TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={42} /></button>
          <button type="button" className="pfleaders-list-player" onClick={() => row.destination && navigate(row.destination)} disabled={!row.destination}><strong>{row.name}</strong><small>{row.secondary}</small></button>
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
.pfleaders{padding:0 0 48px;font-family:Barlow,Inter,Arial,sans-serif}.pfleaders-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:18px}.pfleaders-head span{color:#0783c9;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.pfleaders-head h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.5rem,5vw,4.8rem);line-height:.88;margin:6px 0 0;text-transform:uppercase}
.pfleaders-row{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 0 10px;scrollbar-width:none}.pfleaders-row::-webkit-scrollbar{display:none}.pfleaders-card{position:relative;display:flex;flex:0 0 min(370px,88vw);scroll-snap-align:start;flex-direction:column;min-width:0;overflow:hidden;border:1px solid #dce3eb;border-radius:14px;background:#fff;box-shadow:0 6px 18px rgba(17,24,39,.06)}
.pfleaders-card-title{padding:10px 16px;background:linear-gradient(90deg,#168fd4,#42b8ff);color:#fff;font-size:13px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.pfleaders-feature{position:relative;width:100%;min-height:205px;border:0;padding:24px 118px 22px 22px;background:linear-gradient(135deg,#07101d 0%,#14375d 55%,#1596da 100%);color:#fff;text-align:left;cursor:pointer}.pfleaders-feature:disabled{cursor:default}.pfleaders-feature-copy{display:flex;flex-direction:column;align-items:flex-start}.pfleaders-feature-copy>strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:58px;line-height:.85}.pfleaders-feature-copy>small{margin-top:5px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.72)}.pfleaders-feature-copy>b{margin-top:22px;font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;line-height:.95;text-transform:uppercase}.pfleaders-feature-copy>em{margin-top:6px;font-size:12px;font-style:normal;color:rgba(255,255,255,.72)}
.pfleaders-feature-logo{position:absolute;right:20px;bottom:18px;display:grid;place-items:center;width:94px;height:94px;border-radius:18px;background:rgba(255,255,255,.94);cursor:pointer}.pfleaders-feature-logo img{max-width:88px;max-height:88px;object-fit:contain}.pfleaders-list{display:flex;flex-direction:column}.pfleaders-list-row{display:grid;grid-template-columns:52px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:66px;padding:8px 16px;border-top:1px solid #e8edf2}.pfleaders-list-logo,.pfleaders-list-player{border:0;background:transparent;padding:0;text-align:left;cursor:pointer}.pfleaders-list-logo:disabled,.pfleaders-list-player:disabled{cursor:default}.pfleaders-list-logo{display:grid;place-items:center;width:44px;height:44px}.pfleaders-list-logo img{max-width:42px;max-height:42px;object-fit:contain}.pfleaders-list-player{display:flex;flex-direction:column;min-width:0}.pfleaders-list-player strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#111318;font-size:15px}.pfleaders-list-player small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px;color:#748091;font-size:10px}.pfleaders-list-row>b{max-width:92px;text-align:right;font-size:18px;color:#111318}.pfleaders-full{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:auto;padding:15px;border-top:1px solid #e3e8ed;color:#0b5ca8;text-decoration:none;font-weight:900}.pfleaders-full:hover{color:#0783c9}.pfleaders-card-empty,.pfleaders-empty{padding:36px;text-align:center;color:#687385}.pfleaders-skeleton{min-height:520px;padding:18px;gap:12px}.pfleaders-skeleton span{display:block;height:54px;border-radius:10px;background:#e9eef2}.pfleaders-skeleton span:first-child{height:190px}
@media(min-width:1180px){.pfleaders-card{flex-basis:calc((100% - 32px)/3)}}
@media(max-width:620px){#pf-home-mvp-slot{border-top-width:12px;padding-top:26px}.pfleaders{width:calc(100% - 24px);padding-bottom:38px}.pfleaders-head h2{font-size:3.1rem}.pfleaders-card{flex-basis:88vw}.pfleaders-feature{min-height:190px;padding:22px 106px 20px 18px}.pfleaders-feature-copy>strong{font-size:52px}.pfleaders-feature-copy>b{font-size:27px}.pfleaders-feature-logo{right:14px;bottom:16px;width:86px;height:86px}.pfleaders-feature-logo img{max-width:80px;max-height:80px}.pfleaders-list-row{padding-left:12px;padding-right:12px}.pfleaders-list-row>b{font-size:16px;max-width:78px}}
`