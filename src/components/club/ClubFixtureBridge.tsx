import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'

type ClubPayload = {
  data?: {
    clubId: string
    clubName: string
    leagueId?: string | null
  }
}

type FixtureRow = {
  id: string
  sourceId?: string
  round?: string | number | null
  grade?: string | null
  matchDate?: string | null
  venue?: string | null
  homeClubId?: string | null
  awayClubId?: string | null
  homeClubName?: string
  awayClubName?: string
  homeName?: string
  awayName?: string
}

type LeaguePayload = { data?: { fixtures?: FixtureRow[] } }
type ClubFixturesPayload = { data?: FixtureRow[] }

const normalise = (value: string | null | undefined) => (value ?? '')
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/\b(seniors?|senior men|a grade|football club|fc)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

function belongsToClub(row: FixtureRow, clubId: string, clubName: string) {
  if (row.homeClubId === clubId || row.awayClubId === clubId) return true
  const target = normalise(clubName)
  return normalise(row.homeClubName ?? row.homeName) === target || normalise(row.awayClubName ?? row.awayName) === target
}

function isUpcoming(row: FixtureRow) {
  if (!row.matchDate) return true
  const time = Date.parse(row.matchDate)
  return Number.isNaN(time) || time >= Date.now() - 86400000
}

export default function ClubFixtureBridge() {
  const { pathname } = useLocation()
  const match = pathname.match(/^\/team\/([^/]+)$/)
  const clubId = match ? decodeURIComponent(match[1]) : ''
  const [clubName, setClubName] = useState('')
  const [rows, setRows] = useState<FixtureRow[]>([])
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setRows([])
    setClubName('')
    if (!clubId) return
    let active = true

    void Promise.allSettled([
      fetch(`/api/clubs/${encodeURIComponent(clubId)}`).then(response => response.ok ? response.json() as Promise<ClubPayload> : Promise.reject(new Error(`HTTP ${response.status}`))),
      fetch(`/api/clubs/${encodeURIComponent(clubId)}/fixtures?upcoming=true`).then(response => response.ok ? response.json() as Promise<ClubFixturesPayload> : Promise.reject(new Error(`HTTP ${response.status}`))),
    ]).then(async results => {
      if (!active) return
      const club = results[0].status === 'fulfilled' ? results[0].value.data : undefined
      const direct = results[1].status === 'fulfilled' && Array.isArray(results[1].value.data) ? results[1].value.data : []
      if (!club || direct.length > 0 || !club.leagueId) return
      setClubName(club.clubName)

      const response = await fetch(`/api/leagues/${encodeURIComponent(club.leagueId)}`)
      if (!response.ok) return
      const league = await response.json() as LeaguePayload
      if (!active) return
      const fixtures = Array.isArray(league.data?.fixtures) ? league.data.fixtures : []
      setRows(fixtures.filter(row => belongsToClub(row, club.clubId, club.clubName) && isUpcoming(row)).slice(0, 5))
    }).catch(() => undefined)

    return () => { active = false }
  }, [clubId])

  useEffect(() => {
    if (!clubId || rows.length === 0) { setTarget(null); return }
    let stopped = false
    const attach = () => {
      if (stopped) return
      const cards = Array.from(document.querySelectorAll<HTMLElement>('.club-live-card'))
      const card = cards.find(element => element.querySelector('h2')?.textContent?.trim().toLowerCase() === 'upcoming fixtures')
      if (!card) return
      card.classList.add('club-fixture-bridge-active')
      let node = card.querySelector<HTMLElement>(':scope > .club-fixture-bridge-slot')
      if (!node) {
        node = document.createElement('div')
        node.className = 'club-fixture-bridge-slot'
        card.appendChild(node)
      }
      setTarget(node)
    }
    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => {
      stopped = true
      observer.disconnect()
      document.querySelectorAll('.club-fixture-bridge-active').forEach(element => element.classList.remove('club-fixture-bridge-active'))
      setTarget(null)
    }
  }, [clubId, rows])

  if (!target || rows.length === 0) return null

  return createPortal(<>
    <div className="club-match-list club-fixture-bridge-list">
      {rows.map(row => {
        const id = row.sourceId ?? row.id.replace(/^football:/, '')
        const home = row.homeClubName ?? row.homeName ?? 'Home'
        const away = row.awayClubName ?? row.awayName ?? 'Away'
        const isHome = row.homeClubId === clubId || normalise(home) === normalise(clubName)
        return <Link key={row.id} to={`/match/fixture/${encodeURIComponent(id)}?source=football`}>
          <span className={isHome ? 'this-club' : ''}>{home}</span>
          <span className={!isHome ? 'this-club' : ''}>{away}</span>
          <small>{[row.round ?? row.grade, row.matchDate ? formatDate(row.matchDate) : null, row.venue].filter(Boolean).join(' · ')}</small>
        </Link>
      })}
    </div>
    <style>{`
      .club-fixture-bridge-active > .club-live-empty{display:none!important}
      .club-fixture-bridge-list{display:grid}
      .club-fixture-bridge-list>a{display:grid;grid-template-columns:minmax(0,1fr);gap:3px;padding:11px 0;border-top:1px solid #edf1f4;color:#111318;text-decoration:none}
      .club-fixture-bridge-list>a>span{font-size:13px;font-weight:800}
      .club-fixture-bridge-list>a>span.this-club{font-weight:950}
      .club-fixture-bridge-list>a>small{color:#687385;font-size:10px;margin-top:3px}
    `}</style>
  </>, target)
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(date)
}
