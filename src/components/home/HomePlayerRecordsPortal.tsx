import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { TeamLogo } from '../rankings/bits'
import { loadHomeCardLogoMaps, playerClubLeagueKey } from '../../lib/homeCardLogos'

type PlayerRecord = {
  rank: number
  playerId: string
  playerRowId?: string
  playerName: string
  clubId?: string | null
  clubName: string
  leagueId?: string | null
  leagueName: string
  goals: number
  matches?: number | null
  goalsPerGame?: number | null
  weeklyGoals?: number
  milestone?: 50 | 100
  milestoneMatches?: number
  playerUrl: string
}

type Payload = {
  data?: {
    weekly?: PlayerRecord[]
    biggestBags?: PlayerRecord[]
    seasonLeaders?: PlayerRecord[]
    goalsPerGameLeaders?: PlayerRecord[]
    fastestTo50?: PlayerRecord[]
    fastestTo100?: PlayerRecord[]
  }
}

type PlayerLogo = { clubId: string | null; clubName: string; leagueName: string; logoUrl: string | null }

type RecordCard = {
  key: string
  kicker: string
  value: string
  unit: string
  name: string
  clubId: string | null
  club: string
  leagueId: string | null
  league: string
  url: string
  logoUrl: string | null
}

export default function HomePlayerRecordsPortal() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [cards, setCards] = useState<RecordCard[]>([])

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
    void Promise.all([
      fetch('/api/goal-kickers/records?limit=10').then(response => response.ok ? response.json() as Promise<Payload> : Promise.reject(new Error(`HTTP ${response.status}`))),
      loadHomeCardLogoMaps(),
    ])
      .then(([payload, logoMaps]) => {
        if (!active) return
        setCards(buildTopFiveCards(payload.data, logoMaps.byPlayerId, logoMaps.byPlayerClubLeague))
      })
      .catch(() => { if (active) setCards([]) })
    return () => { active = false }
  }, [pathname])

  if (!target || pathname !== '/' || cards.length === 0) return null

  return createPortal(<section className="pf-player-records-home pf-shell">
    <div className="pf-player-records-head">
      <div><span>National season leaders</span><h2>Goal kickers</h2></div>
      <Link to="/goal-kickers">View goal kickers <ArrowRight size={17} /></Link>
    </div>
    <div className="pf-player-records-strip">
      {cards.map(card => {
        const clubPath = card.clubId ? `/team/${card.clubId}` : null
        return <article
          key={card.key}
          className="pf-player-record-card"
          role="link"
          tabIndex={0}
          aria-label={`Open ${card.name} player profile`}
          onClick={event => {
            if ((event.target as HTMLElement).closest('a,button')) return
            navigate(card.url)
          }}
          onKeyDown={event => {
            if ((event.target as HTMLElement).closest('a,button')) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              navigate(card.url)
            }
          }}
        >
          {clubPath
            ? <Link to={clubPath} className="pf-player-record-logo" aria-label={`Open ${card.club} club page`}><TeamLogo name={card.club} src={card.logoUrl ?? undefined} size={52} /></Link>
            : <span className="pf-player-record-logo"><TeamLogo name={card.club} src={card.logoUrl ?? undefined} size={52} /></span>}
          <span>{card.kicker}</span>
          <strong>{card.value}<small>{card.unit}</small></strong>
          <h3><Link to={card.url}>{card.name}</Link></h3>
          <p>{clubPath ? <Link to={clubPath}>{card.club}</Link> : card.club}</p>
          <small>{card.leagueId ? <Link to={`/league/${card.leagueId}`}>{card.league}</Link> : card.league}</small>
        </article>
      })}
    </div>
    <style>{`
      .pf-player-records-home{padding:0 0 46px;font-family:Barlow,Inter,Arial,sans-serif}.pf-player-records-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:17px}.pf-player-records-head>div>span{text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.16em;color:#0783c9}.pf-player-records-head h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(2.2rem,4vw,4rem);line-height:.88;margin:5px 0 0}.pf-player-records-head>a{display:inline-flex;align-items:center;gap:8px;color:#42b8ff;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:800}.pf-player-records-strip{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;scrollbar-width:none}.pf-player-records-strip::-webkit-scrollbar{display:none}.pf-player-record-card{position:relative;flex:0 0 min(285px,80vw);scroll-snap-align:start;border:1px solid #e3e7ec;border-radius:9px;padding:20px;background:#fff;color:#111318;min-height:205px;display:flex;flex-direction:column;box-shadow:0 5px 16px rgba(17,24,39,.045);cursor:pointer;box-sizing:border-box}.pf-player-record-logo{position:absolute;right:18px;top:18px;display:grid;place-items:center;width:56px;height:56px;border-radius:8px;z-index:2}.pf-player-record-logo img{max-width:52px;max-height:52px;object-fit:contain}.pf-player-record-logo:hover{transform:scale(1.05)}.pf-player-record-card>span:not(.pf-player-record-logo){max-width:calc(100% - 72px);text-transform:uppercase;font-size:10px;letter-spacing:.13em;font-weight:900;color:#0783c9}.pf-player-record-card>strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:46px;line-height:1;margin-top:16px;color:#0783c9}.pf-player-record-card>strong small{font-family:Barlow,Inter,Arial,sans-serif;font-size:12px;margin-left:7px;text-transform:uppercase;letter-spacing:.08em;color:#687385}.pf-player-record-card h3{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:25px;line-height:1;margin:13px 0 5px}.pf-player-record-card p{font-size:13px;line-height:1.45;margin:0;color:#303741}.pf-player-record-card>small{margin-top:auto;padding-top:14px;color:#687385;font-size:11px}.pf-player-record-card a{color:inherit;text-decoration:none}.pf-player-record-card h3 a:hover,.pf-player-record-card p a:hover,.pf-player-record-card>small a:hover{color:#0783c9}.pf-player-record-card:hover{transform:translateY(-2px)}.pf-player-record-card:focus-visible,.pf-player-record-logo:focus-visible{outline:3px solid #42b8ff;outline-offset:3px}@media(max-width:620px){#pf-home-mvp-slot{padding-top:22px!important}#pf-home-player-records-slot{border-top-width:10px!important;padding-top:22px!important}.hmvp{padding-bottom:26px!important}.hmvp-strip{min-height:224px!important}.hmvp-card{min-height:224px!important;padding-top:20px!important;padding-bottom:42px!important}.hmvp-head{margin-bottom:14px!important}.pf-player-records-home{padding-bottom:30px}.pf-player-records-head{align-items:flex-end;margin-bottom:14px}.pf-player-records-head h2{font-size:2.8rem}.pf-player-records-head>a{font-size:11px}.pf-player-record-card{flex-basis:82vw;min-height:190px;padding:18px}.pf-player-record-logo{right:16px;top:16px}.pf-player-record-card>strong{margin-top:13px}.pf-player-record-card h3{margin-top:11px}.pf-player-record-card>small{padding-top:11px}}
    `}</style>
  </section>, target)
}

function buildTopFiveCards(data: Payload['data'], playerLogos: Map<string, PlayerLogo>, exactLogos: Map<string, PlayerLogo>): RecordCard[] {
  return (data?.seasonLeaders ?? [])
    .slice(0, 5)
    .map((row, index) => toCard(
      `season-${row.playerId}-${row.rank}`,
      `National goal kicker · #${row.rank || index + 1}`,
      row.goals,
      row.goals === 1 ? 'goal' : 'goals',
      row,
      playerLogos,
      exactLogos,
    ))
}

function toCard(
  key: string,
  kicker: string,
  value: string | number,
  unit: string,
  row: PlayerRecord,
  playerLogos: Map<string, PlayerLogo>,
  exactLogos: Map<string, PlayerLogo>,
): RecordCard {
  const byId = playerLogos.get(row.playerId)
  const byExactIdentity = exactLogos.get(playerClubLeagueKey(row.playerName, row.clubName, row.leagueName))
  const resolved = byId?.clubName.trim().toLowerCase() === row.clubName.trim().toLowerCase() ? byId : byExactIdentity
  return {
    key,
    kicker,
    value: String(value),
    unit,
    name: row.playerName,
    clubId: row.clubId ?? resolved?.clubId ?? null,
    club: row.clubName,
    leagueId: row.leagueId ?? null,
    league: row.leagueName,
    url: row.playerUrl,
    logoUrl: resolved?.logoUrl ?? null,
  }
}