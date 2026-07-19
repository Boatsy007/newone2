import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { fetchFootballRecords, recordLabels, type FootballRecordEntry, type RecordCategory } from '../../lib/footballRecords'

const categories: RecordCategory[] = ['highestScore', 'biggestMargin', 'closestMatch', 'highestCombinedScore', 'lowestScore']

type PlayerBag = { playerId: string; playerName: string; clubName: string; leagueName: string; weeklyGoals: number; playerUrl: string }
type GoalKickerRow = { id: string; playerName: string; clubId: string | null; clubName: string; leagueId: string | null; leagueName: string; season: string; goals: number }
type RecordCard = { key: string; label: string; value: string; title: string; detail: string; footer: string; url: string }
type RecordCategories = Partial<Record<RecordCategory, FootballRecordEntry[]>>
type RecordSectionVariant = 'weekly' | 'yearly'

type PlayerRecordPayload = { data?: { weekly?: PlayerBag[]; biggestBags?: PlayerBag[] } }
type LadderPayload = { data?: GoalKickerRow[] }

export default function HomeRecordsPortal() {
  const { pathname } = useLocation()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [weekly, setWeekly] = useState<RecordCard[]>([])
  const [yearly, setYearly] = useState<RecordCard[]>([])
  const [weeklyEyebrow, setWeeklyEyebrow] = useState('Weekly records across community football')

  useEffect(() => {
    if (pathname !== '/') { setTarget(null); return }
    let cancelled = false
    const attach = () => {
      if (cancelled) return
      const playerRecords = document.getElementById('pf-home-player-records-slot')
      const top = document.querySelector<HTMLElement>('.pf-top')
      const anchor = playerRecords ?? top
      if (!anchor) return
      let node = document.getElementById('pf-home-records-slot')
      if (!node) { node = document.createElement('div'); node.id = 'pf-home-records-slot' }
      if (node.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', node)
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
    const season = new Date().getFullYear()

    void Promise.allSettled([
      fetchFootballRecords({ period: 'week', limit: 20 }),
      fetchFootballRecords({ period: 'season', season, limit: 20 }),
      fetch('/api/goal-kickers/records?limit=20').then(response => response.ok ? response.json() as Promise<PlayerRecordPayload> : Promise.reject(new Error(`HTTP ${response.status}`))),
      fetch('/api/goal-kickers?mode=raw&limit=500').then(response => response.ok ? response.json() as Promise<LadderPayload> : Promise.reject(new Error(`HTTP ${response.status}`))),
    ]).then(results => {
      if (!active) return
      const [weekResult, seasonResult, playerResult, ladderResult] = results
      const weekData = weekResult.status === 'fulfilled' ? weekResult.value : null
      const seasonData = seasonResult.status === 'fulfilled' ? seasonResult.value : null
      const playerPayload = playerResult.status === 'fulfilled' ? playerResult.value : undefined
      const ladderPayload = ladderResult.status === 'fulfilled' ? ladderResult.value : undefined
      const weeklyBag = Array.isArray(playerPayload?.data?.weekly) ? playerPayload.data.weekly[0] : undefined
      const savedYearlyBag = Array.isArray(playerPayload?.data?.biggestBags) ? playerPayload.data.biggestBags[0] : undefined
      const ladderRows = Array.isArray(ladderPayload?.data) ? ladderPayload.data : []
      const yearlyBag = savedYearlyBag ?? inferBiggestBag(ladderRows)

      if (weekData) {
        const currentWeekCards = buildCards(weekData.categories, 'this week', weeklyBag, true)
        if (currentWeekCards.length > 0) {
          setWeekly(currentWeekCards)
          setWeeklyEyebrow(formatWeekRange(weekData.weekStart, weekData.weekEnd) ?? 'Weekly records across community football')
        } else if (seasonData) {
          const latest = latestCompletedWeek(seasonData.categories)
          setWeekly(buildCards(latest.categories, 'in the latest week', weeklyBag, true))
          setWeeklyEyebrow(latest.label ?? 'Latest completed week across community football')
        }
      } else if (seasonData) {
        const latest = latestCompletedWeek(seasonData.categories)
        setWeekly(buildCards(latest.categories, 'in the latest week', weeklyBag, true))
        setWeeklyEyebrow(latest.label ?? 'Latest completed week across community football')
      }

      if (seasonData) setYearly(buildCards(seasonData.categories, 'this year', yearlyBag, true))
    })

    return () => { active = false }
  }, [pathname])

  if (!target || pathname !== '/' || (weekly.length === 0 && yearly.length === 0)) return null

  return createPortal(<>
    <RecordSection title="This Week in Footy" eyebrow={weeklyEyebrow} cards={weekly} variant="weekly" />
    <RecordSection title="Yearly records" eyebrow="Season records across community football" cards={yearly} variant="yearly" />
    <style>{`
      .pf-data-grid>.pf-list-card:first-child{display:none!important}.pf-data-grid{grid-template-columns:1fr!important}
      .pf-records-home{padding:0 0 46px;font-family:Barlow,Inter,Arial,sans-serif}.pf-records-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:17px}.pf-records-head>div>span{text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.16em;color:#0783c9}.pf-records-head h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(2.2rem,4vw,4rem);line-height:.88;margin:5px 0 0}.pf-records-head>a{display:inline-flex;align-items:center;gap:8px;color:#42b8ff;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:800}.pf-records-strip{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;scrollbar-width:none}.pf-records-strip::-webkit-scrollbar{display:none}.pf-record-card{flex:0 0 min(285px,80vw);scroll-snap-align:start;border:1px solid #e3e7ec;border-radius:9px;padding:20px;background:#050505;color:#fff;text-decoration:none;min-height:205px;display:flex;flex-direction:column;transition:transform .18s ease}.pf-record-card>span{text-transform:uppercase;font-size:10px;letter-spacing:.13em;font-weight:900;color:#42b8ff}.pf-record-card>strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;line-height:1;margin-top:16px;color:#42b8ff}.pf-record-card h3{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:25px;line-height:1;margin:13px 0 5px}.pf-record-card p{font-size:13px;line-height:1.45;margin:0;color:#edf2f7}.pf-record-card small{margin-top:auto;padding-top:14px;color:#9ca7b5;font-size:11px}.pf-record-card:hover{transform:translateY(-2px)}
      .pf-records-home.is-weekly .pf-record-card{background:#42b8ff;color:#050505;border-color:#159fe9;box-shadow:0 12px 30px rgba(45,170,245,.16)}.pf-records-home.is-weekly .pf-record-card>span{align-self:flex-start;background:#050505;color:#fff;border-radius:999px;padding:7px 10px;line-height:1}.pf-records-home.is-weekly .pf-record-card>strong{color:#050505}.pf-records-home.is-weekly .pf-record-card p{color:#fff;font-weight:600}.pf-records-home.is-weekly .pf-record-card small{color:rgba(5,5,5,.72);font-weight:700}.pf-records-home.is-weekly .pf-records-head>a{color:#0783c9}
      @media(max-width:620px){.pf-records-home{padding-bottom:38px}.pf-records-head{align-items:flex-end}.pf-records-head h2{font-size:2.8rem}.pf-records-head>a{font-size:11px}.pf-record-card{flex-basis:82vw}}
    `}</style>
  </>, target)
}

function inferBiggestBag(rows: GoalKickerRow[]): PlayerBag | undefined {
  const groups = new Map<string, GoalKickerRow[]>()
  for (const row of rows) {
    const key = `${row.season}:${row.leagueId ?? row.leagueName.toLowerCase()}:${row.clubId ?? row.clubName.toLowerCase()}:${row.playerName.toLowerCase()}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  let best: PlayerBag | undefined
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => b.goals - a.goals)
    const latest = ordered[0]
    const previous = ordered.find(row => row.goals < latest.goals)
    if (!latest || !previous) continue
    const goals = latest.goals - previous.goals
    if (goals <= 0 || (best && best.weeklyGoals >= goals)) continue
    best = { playerId: latest.id, playerName: latest.playerName, clubName: latest.clubName, leagueName: latest.leagueName, weeklyGoals: goals, playerUrl: `/player/${encodeURIComponent(latest.id)}` }
  }
  return best
}

function latestCompletedWeek(records: RecordCategories): { categories: RecordCategories; label: string | null } {
  const allEntries = Object.values(records).flatMap(entries => entries ?? []).filter(entry => entry.matchDate)
  const latestDate = allEntries.reduce<Date | null>((latest, entry) => {
    const date = entry.matchDate ? new Date(entry.matchDate) : null
    return !date || Number.isNaN(date.getTime()) ? latest : !latest || date > latest ? date : latest
  }, null)
  const result: RecordCategories = {}
  if (!latestDate) return { categories: result, label: null }
  const range = weekRange(latestDate)
  for (const category of Object.keys(records) as RecordCategory[]) {
    result[category] = (records[category] ?? []).filter(entry => entry.matchDate && new Date(entry.matchDate) >= range.start && new Date(entry.matchDate) < range.end).slice(0, 1)
  }
  return { categories: result, label: formatWeekRange(range.start.toISOString(), range.end.toISOString()) }
}

function weekRange(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

function formatWeekRange(startValue: string | null, endValue: string | null) {
  if (!startValue || !endValue) return null
  const start = new Date(startValue)
  const end = new Date(endValue)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  end.setDate(end.getDate() - 1)
  const format = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' })
  return `${format.format(start)}–${format.format(end)} · Weekly records across community football`
}

function buildCards(records: RecordCategories, periodLabel: string, playerBag?: PlayerBag, playerFirst = false): RecordCard[] {
  const recordCards = categories.filter(category => !playerFirst || category !== 'closestMatch').flatMap(category => {
    const entry = records[category]?.[0]
    return entry ? [{ key: `${periodLabel}-${category}`, label: `${recordLabels[category]} ${periodLabel}`, value: entry.valueLabel, title: entry.clubName, detail: `${entry.homeName} ${entry.homePoints} — ${entry.awayPoints} ${entry.awayName}`, footer: `${entry.leagueName}${entry.round ? ` · ${entry.round}` : ''}`, url: entry.matchUrl }] : []
  })
  const playerCard = playerBag?.weeklyGoals ? { key: `${periodLabel}-player-bag`, label: `Most goals by a player ${periodLabel}`, value: `${playerBag.weeklyGoals} goals`, title: playerBag.playerName, detail: playerBag.clubName, footer: playerBag.leagueName, url: playerBag.playerUrl } : null
  return playerCard ? playerFirst ? [playerCard, ...recordCards] : [...recordCards, playerCard] : recordCards
}

function RecordSection({ title, eyebrow, cards, variant }: { title: string; eyebrow: string; cards: RecordCard[]; variant: RecordSectionVariant }) {
  if (!cards.length) return null
  return <section className={`pf-records-home pf-shell is-${variant}`}><div className="pf-records-head"><div><span>{eyebrow}</span><h2>{title}</h2></div><Link to="/records">View all records <ArrowRight size={17} /></Link></div><div className="pf-records-strip">{cards.map(card => <Link key={card.key} to={card.url} className="pf-record-card"><span>{card.label}</span><strong>{card.value}</strong><h3>{card.title}</h3><p>{card.detail}</p><small>{card.footer}</small></Link>)}</div></section>
}
