import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { TeamLogo } from '../rankings/bits'
import { ClubMvpPanel } from '../mvp/MvpPanels'
import type { MvpEntry } from '../../pages/MvpLeaderboard'

export default function HomeMvpPortal() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [clubTarget, setClubTarget] = useState<HTMLElement | null>(null)
  const [clubName, setClubName] = useState('Club')
  const [rows, setRows] = useState<MvpEntry[]>([])
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
      setTarget(slot)
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      active = false
      observer.disconnect()
      setTarget(null)
      document.getElementById('pf-home-mvp-slot')?.remove()
    }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/') return
    let active = true
    setLoading(true)
    fetch('/api/mvp?limit=5')
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: MvpEntry[] }) => {
        if (active) setRows(Array.isArray(payload.data) ? payload.data : [])
      })
      .catch(() => { if (active) setRows([]) })
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

  return createPortal(
    <section className="hmvp pf-shell">
      <div className="hmvp-head">
        <div><span>PlayFooty national award</span><h2>National MVP</h2></div>
        <Link to="/mvp">View full leaderboard <ArrowRight size={17} /></Link>
      </div>
      <div className="hmvp-strip" aria-busy={loading}>
        {loading
          ? Array.from({ length: 5 }, (_, index) => <MvpSkeleton key={index} />)
          : rows.map(row => {
              const playerPath = row.playerId ? `/player/${row.playerId}` : null
              const clubPath = row.clubId ? `/team/${row.clubId}` : null
              return <article
                key={row.id}
                className={`hmvp-card${playerPath ? ' is-clickable' : ''}`}
                role={playerPath ? 'link' : undefined}
                tabIndex={playerPath ? 0 : undefined}
                aria-label={playerPath ? `Open ${row.playerName} player profile` : undefined}
                onClick={event => {
                  if (!playerPath || (event.target as HTMLElement).closest('a,button')) return
                  navigate(playerPath)
                }}
                onKeyDown={event => {
                  if (!playerPath || (event.target as HTMLElement).closest('a,button')) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(playerPath)
                  }
                }}
              >
                {clubPath
                  ? <Link className="hmvp-logo" to={clubPath} aria-label={`Open ${row.clubName} club page`}><TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={52} /></Link>
                  : <span className="hmvp-logo"><TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={52} /></span>}
                <span>National MVP · #{row.rank}</span>
                <strong>{row.mvpPoints}<small>MVP points</small></strong>
                <h3>{playerPath ? <Link to={playerPath}>{row.playerName}</Link> : row.playerName}</h3>
                <p>{clubPath ? <Link to={clubPath}>{row.clubName}</Link> : row.clubName}</p>
                <small><Link to={`/league/${row.leagueId}`}>{row.leagueName}</Link> · {row.bp} BP</small>
              </article>
            })}
      </div>
      {!loading && rows.length === 0 ? <p className="hmvp-empty">MVP standings are temporarily unavailable.</p> : null}
      <style>{styles}</style>
    </section>,
    target,
  )
}

function MvpSkeleton() {
  return <article className="hmvp-card hmvp-skeleton" aria-hidden="true">
    <span className="hmvp-skeleton-logo" />
    <span className="hmvp-skeleton-line kicker" />
    <span className="hmvp-skeleton-score" />
    <span className="hmvp-skeleton-line name" />
    <span className="hmvp-skeleton-line club" />
  </article>
}

const styles = `
#pf-home-mvp-slot,#pf-home-player-records-slot{display:block;clear:both;position:relative;background:#fff;border-top:18px solid #eef3f7;padding-top:34px;box-sizing:border-box}
#pf-home-mvp-slot{z-index:1}#pf-home-player-records-slot{z-index:0}
.hmvp{padding:0 0 46px;font-family:Barlow,Inter,Arial,sans-serif}
.hmvp-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:17px}
.hmvp-head>div>span{text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.16em;color:#0783c9}
.hmvp-head h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(2.2rem,4vw,4rem);line-height:.88;margin:5px 0 0}
.hmvp-head>a{display:inline-flex;align-items:center;gap:8px;color:#42b8ff;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:800}
.hmvp-strip{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;scrollbar-width:none}
.hmvp-strip::-webkit-scrollbar{display:none}
.hmvp-card{position:relative;flex:0 0 min(285px,80vw);scroll-snap-align:start;border:1px solid #e3e7ec;border-radius:9px;padding:20px;background:#fff;color:#111318;text-decoration:none;min-height:205px;display:flex;flex-direction:column;box-shadow:0 5px 16px rgba(17,24,39,.045);transition:transform .18s ease,border-color .18s ease;box-sizing:border-box}
.hmvp-card.is-clickable{cursor:pointer}
.hmvp-logo{position:absolute;right:18px;top:18px;display:grid;place-items:center;width:56px;height:56px;border-radius:8px;z-index:2}
.hmvp-logo img{max-width:52px;max-height:52px;object-fit:contain}
.hmvp-logo:hover{transform:scale(1.05)}
.hmvp-card>span:not(.hmvp-logo){max-width:calc(100% - 72px);text-transform:uppercase;font-size:10px;letter-spacing:.13em;font-weight:900;color:#0783c9}
.hmvp-card>strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:46px;line-height:1;margin-top:16px;color:#0783c9}
.hmvp-card>strong small{font-family:Barlow,Inter,Arial,sans-serif;font-size:12px;margin-left:7px;text-transform:uppercase;letter-spacing:.08em;color:#687385}
.hmvp-card h3{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:25px;line-height:1;margin:13px 0 5px}
.hmvp-card p{font-size:13px;line-height:1.45;margin:0;color:#303741}
.hmvp-card>small{margin-top:auto;padding-top:14px;color:#687385;font-size:11px}
.hmvp-card a{color:inherit;text-decoration:none}
.hmvp-card h3 a:hover,.hmvp-card p a:hover,.hmvp-card>small a:hover{color:#0783c9}
.hmvp-card:hover{transform:translateY(-2px);border-color:#b9dff5}
.hmvp-card:focus-visible,.hmvp-logo:focus-visible{outline:3px solid #42b8ff;outline-offset:3px}
.hmvp-empty{text-align:center;color:#687385;margin:0;padding:28px 0}
.hmvp-skeleton{overflow:hidden}
.hmvp-skeleton:after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.72),transparent);animation:hmvp-shimmer 1.35s infinite}
.hmvp-skeleton-logo{position:absolute;right:18px;top:18px;width:52px;height:52px;border-radius:50%;background:#e8edf1}
.hmvp-skeleton-line,.hmvp-skeleton-score{display:block;background:#e8edf1;border-radius:999px}
.hmvp-skeleton-line.kicker{width:45%;height:10px}.hmvp-skeleton-score{width:90px;height:46px;margin-top:20px;border-radius:7px}.hmvp-skeleton-line.name{width:70%;height:25px;margin-top:13px}.hmvp-skeleton-line.club{width:52%;height:12px;margin-top:8px}
@keyframes hmvp-shimmer{100%{transform:translateX(100%)}}
@media(prefers-reduced-motion:reduce){.hmvp-skeleton:after{animation:none}}
@media(max-width:620px){#pf-home-mvp-slot,#pf-home-player-records-slot{border-top-width:10px;padding-top:22px}.hmvp{padding-bottom:30px}.hmvp-head{align-items:flex-end;margin-bottom:14px}.hmvp-head h2{font-size:2.8rem}.hmvp-head>a{font-size:11px;max-width:125px;text-align:right}.hmvp-card{flex-basis:82vw;min-height:190px;padding:18px}.hmvp-logo{right:16px;top:16px}.hmvp-card>strong{margin-top:13px}.hmvp-card h3{margin-top:11px}.hmvp-card>small{padding-top:11px}}
`