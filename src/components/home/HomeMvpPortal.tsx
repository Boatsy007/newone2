import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Medal, Share2 } from 'lucide-react'
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
      .catch(() => {
        if (active) setRows([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

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
    <section className="hmvp">
      <div className="hmvp-head">
        <div><small>PLAYFOOTY NATIONAL AWARD</small><h2>National MVP</h2></div>
        <Link to="/mvp">View full leaderboard <ArrowRight size={17} /></Link>
      </div>
      <div className="hmvp-grid" aria-busy={loading}>
        {loading
          ? Array.from({ length: 5 }, (_, index) => <MvpSkeleton key={index} />)
          : rows.map(row => {
              const playerPath = row.playerId ? `/player/${row.playerId}` : null
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
                <span className={`hmvp-rank r${row.rank}`}>{row.rank <= 3 ? <Medal size={15} /> : null}{row.rank}</span>
                <TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={64} />
                <strong>{playerPath ? <Link to={playerPath}>{row.playerName}</Link> : row.playerName}</strong>
                <small>{row.clubId ? <Link to={`/team/${row.clubId}`}>{row.clubName}</Link> : row.clubName}</small>
                <span className="hmvp-league"><Link to={`/league/${row.leagueId}`}>{row.leagueName}</Link></span>
                <b>{row.mvpPoints}</b>
                <em>MVP votes</em>
                <button type="button" className="hmvp-share" aria-label={`Share ${row.playerName} MVP card`} onClick={event => { event.stopPropagation(); void shareMvp(row) }}>
                  <Share2 size={13} /><span>Share</span>
                </button>
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
    <span className="hmvp-skeleton-rank" />
    <span className="hmvp-skeleton-logo" />
    <span className="hmvp-skeleton-line is-name" />
    <span className="hmvp-skeleton-line is-club" />
    <span className="hmvp-skeleton-line is-league" />
    <span className="hmvp-skeleton-score" />
    <span className="hmvp-skeleton-line is-label" />
  </article>
}

async function shareMvp(row: MvpEntry) {
  const url = `${window.location.origin}/mvp`
  const text = `${row.playerName} — ${row.mvpPoints} MVP votes for ${row.clubName}`
  try {
    if (navigator.share) {
      await navigator.share({ title: 'PlayFooty National MVP', text, url })
      return
    }
    await navigator.clipboard.writeText(`${text} ${url}`)
  } catch {}
}

const styles = `#pf-home-mvp-slot,#pf-home-player-records-slot{display:block;clear:both;position:relative;background:#fff;border-top:18px solid #eef3f7;padding-top:34px;box-sizing:border-box}#pf-home-mvp-slot{z-index:1}#pf-home-player-records-slot{z-index:0}#pf-home-records-slot>.pf-records-home+.pf-records-home{border-top:18px solid #eef3f7;padding-top:34px!important;box-sizing:border-box}.hmvp{width:min(1440px,calc(100% - 48px));margin:0 auto;padding:0 0 46px;font-family:Barlow,Inter,Arial,sans-serif}.hmvp-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:17px}.hmvp-head small{color:#148fd2;font-weight:900;letter-spacing:.15em}.hmvp-head h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(2.8rem,5vw,5rem);line-height:.88;margin:5px 0 0}.hmvp-head>a{display:inline-flex;align-items:center;gap:8px;color:#42b8ff;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:800}.hmvp-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;min-height:252px}.hmvp-card{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;background:#fff;color:#111318;border:1px solid #e3e7ec;border-radius:9px;padding:24px 13px 43px;min-width:0;min-height:252px;box-shadow:0 5px 16px rgba(17,24,39,.045);transition:transform .18s ease,border-color .18s ease;box-sizing:border-box}.hmvp-card.is-clickable{cursor:pointer}.hmvp-card.is-clickable:hover{transform:translateY(-2px);border-color:#b9dff5}.hmvp-card.is-clickable:focus-visible{outline:3px solid #42b8ff;outline-offset:3px}.hmvp-rank{position:absolute;left:0;top:0;width:40px;height:40px;border-radius:8px 0 8px 0;background:#42b8ff;color:#050505;display:flex;align-items:center;justify-content:center;gap:2px;font-family:'Bebas Neue',Impact,sans-serif;font-size:22px;border-right:1px solid rgba(0,0,0,.16);border-bottom:1px solid rgba(0,0,0,.2);box-shadow:inset 0 1px 1px rgba(255,255,255,.75),inset 0 -2px 4px rgba(0,0,0,.16),2px 3px 7px rgba(17,24,39,.15)}.hmvp-rank.r1{background:linear-gradient(135deg,#fff3a8 0%,#dcae22 31%,#fff082 53%,#a87200 100%);color:#2a1a00}.hmvp-rank.r2{background:linear-gradient(135deg,#ffffff 0%,#aeb8c2 31%,#eef2f5 54%,#77828d 100%);color:#182029}.hmvp-rank.r3{background:linear-gradient(135deg,#ffd0a0 0%,#b96b2e 31%,#e6a267 54%,#7d3e18 100%);color:#2c1205}.hmvp-card>strong{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:22px;line-height:1;margin-top:12px}.hmvp-card a{color:inherit;text-decoration:none}.hmvp-card a:hover{color:#42b8ff}.hmvp-card>small{color:#687385;margin-top:6px}.hmvp-league{font-size:10px;color:#87919e;margin-top:5px}.hmvp-card>b{font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;line-height:1;color:#42b8ff;margin-top:10px}.hmvp-card>em{font-style:normal;text-transform:uppercase;font-size:9px;letter-spacing:.12em;color:#687385}.hmvp-share{position:absolute;right:10px;bottom:9px;display:inline-flex;align-items:center;gap:5px;border:1px solid #d9e0e7;border-radius:999px;background:#fff;color:#111318;padding:6px 9px;font:800 9px/1 Barlow,Inter,Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;box-shadow:0 3px 8px rgba(17,24,39,.08)}.hmvp-share:hover{border-color:#42b8ff;color:#0783c9}.hmvp-card button:not(.hmvp-share),.hmvp-card .share-card,.hmvp-card [class*="share"]:not(.hmvp-share){display:none!important}.hmvp-skeleton{justify-content:flex-start;overflow:hidden}.hmvp-skeleton:after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.72),transparent);animation:hmvp-shimmer 1.35s infinite}.hmvp-skeleton-rank{position:absolute;left:0;top:0;width:40px;height:40px;border-radius:8px 0 8px 0;background:#dfe7ed}.hmvp-skeleton-logo{display:block;width:64px;height:64px;border-radius:50%;background:#e8edf1}.hmvp-skeleton-line,.hmvp-skeleton-score{display:block;background:#e8edf1;border-radius:999px}.hmvp-skeleton-line.is-name{width:72%;height:22px;margin-top:12px}.hmvp-skeleton-line.is-club{width:55%;height:12px;margin-top:9px}.hmvp-skeleton-line.is-league{width:68%;height:9px;margin-top:7px}.hmvp-skeleton-score{width:42px;height:42px;margin-top:12px;border-radius:8px}.hmvp-skeleton-line.is-label{width:48px;height:8px;margin-top:7px}.hmvp-empty{text-align:center;color:#687385;margin:0;padding:28px 0}.hmvp-grid:has(+.hmvp-empty){display:none}@keyframes hmvp-shimmer{100%{transform:translateX(100%)}}@media(prefers-reduced-motion:reduce){.hmvp-skeleton:after{animation:none}}@media(max-width:900px){.hmvp-grid{display:flex;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x mandatory;min-height:252px}.hmvp-card{min-width:220px;scroll-snap-align:start}}@media(max-width:620px){#pf-home-mvp-slot,#pf-home-player-records-slot{border-top-width:12px;padding-top:26px}#pf-home-records-slot>.pf-records-home+.pf-records-home{border-top-width:12px;padding-top:26px!important}.hmvp{width:calc(100% - 24px)}.hmvp-head{align-items:start}.hmvp-head>a{max-width:120px;text-align:right}.hmvp-card{min-width:195px}}`