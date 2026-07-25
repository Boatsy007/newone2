import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Share2 } from 'lucide-react'
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
    <section className="pfhmvp pf-shell">
      <div className="pfhmvp-head">
        <div><span>PlayFooty national award</span><h2>National MVP</h2></div>
        <Link to="/mvp">View full leaderboard <ArrowRight size={17} /></Link>
      </div>
      <div className="pfhmvp-strip" aria-busy={loading}>
        {loading
          ? Array.from({ length: 5 }, (_, index) => <MvpSkeleton key={index} />)
          : rows.map(row => {
              const playerPath = row.playerId ? `/player/${row.playerId}` : null
              const clubPath = row.clubId ? `/team/${row.clubId}` : null
              return <article
                key={row.id}
                className={`pfhmvp-card${playerPath ? ' is-clickable' : ''}`}
                data-player-id={row.playerId ?? undefined}
                data-club-id={row.clubId ?? undefined}
                role={playerPath ? 'link' : undefined}
                tabIndex={playerPath ? 0 : undefined}
                aria-label={playerPath ? `Open ${row.playerName} player profile` : undefined}
                onClick={() => { if (playerPath) navigate(playerPath) }}
                onKeyDown={event => {
                  if (!playerPath || (event.key !== 'Enter' && event.key !== ' ')) return
                  event.preventDefault()
                  navigate(playerPath)
                }}
              >
                <button
                  type="button"
                  className="pfhmvp-logo"
                  disabled={!clubPath}
                  aria-label={clubPath ? `Open ${row.clubName} club profile` : `${row.clubName} logo`}
                  onClick={event => {
                    event.stopPropagation()
                    if (clubPath) navigate(clubPath)
                  }}
                >
                  <TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={52} />
                </button>
                <span className="pfhmvp-kicker">National MVP · #{row.rank}</span>
                <strong className="pfhmvp-score">{row.mvpPoints}<small>MVP points</small></strong>
                <h3>{row.playerName}</h3>
                <p>{row.clubName}</p>
                <small className="pfhmvp-meta">{row.leagueName} · {row.bp} BP</small>
                <button
                  type="button"
                  className="pfhmvp-share"
                  aria-label={`Share ${row.playerName} MVP card`}
                  onClick={event => {
                    event.stopPropagation()
                    void shareMvp(row, playerPath)
                  }}
                >
                  <Share2 size={14} /><span>Share</span>
                </button>
              </article>
            })}
      </div>
      {!loading && rows.length === 0 ? <p className="pfhmvp-empty">MVP standings are temporarily unavailable.</p> : null}
      <style>{styles}</style>
    </section>,
    target,
  )
}

function MvpSkeleton() {
  return <article className="pfhmvp-card pfhmvp-skeleton" aria-hidden="true">
    <span className="pfhmvp-skeleton-logo" />
    <span className="pfhmvp-skeleton-line kicker" />
    <span className="pfhmvp-skeleton-score" />
    <span className="pfhmvp-skeleton-line name" />
    <span className="pfhmvp-skeleton-line club" />
  </article>
}

async function shareMvp(row: MvpEntry, playerPath: string | null) {
  const url = `${window.location.origin}${playerPath ?? '/mvp'}`
  const text = `${row.playerName} — ${row.mvpPoints} MVP points for ${row.clubName}`
  try {
    if (navigator.share) {
      await navigator.share({ title: 'PlayFooty National MVP', text, url })
      return
    }
    await navigator.clipboard.writeText(`${text} ${url}`)
  } catch {}
}

const styles = `
#pf-home-mvp-slot,#pf-home-player-records-slot{display:block;clear:both;position:relative;background:#fff;border-top:18px solid #eef3f7;padding-top:34px;box-sizing:border-box}
#pf-home-mvp-slot{z-index:1}#pf-home-player-records-slot{z-index:0}
.pfhmvp{padding:0 0 46px;font-family:Barlow,Inter,Arial,sans-serif}
.pfhmvp-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:17px}
.pfhmvp-head>div>span{text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.16em;color:#0783c9}
.pfhmvp-head h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(2.2rem,4vw,4rem);line-height:.88;margin:5px 0 0}
.pfhmvp-head>a{display:inline-flex;align-items:center;gap:8px;color:#42b8ff;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:800}
.pfhmvp-strip{display:flex!important;grid-template-columns:none!important;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 0 8px;scrollbar-width:none}
.pfhmvp-strip::-webkit-scrollbar{display:none}
.pfhmvp-card{position:relative!important;flex:0 0 min(285px,80vw)!important;width:auto!important;scroll-snap-align:start;border:1px solid #e3e7ec;border-radius:9px;padding:22px 20px 52px;background:#fff;color:#111318;min-height:225px;display:flex!important;align-items:stretch!important;text-align:left!important;flex-direction:column;box-shadow:0 5px 16px rgba(17,24,39,.045);transition:transform .18s ease,border-color .18s ease;box-sizing:border-box;overflow:hidden}
.pfhmvp-card.is-clickable{cursor:pointer}
.pfhmvp-logo{position:absolute!important;right:18px!important;top:18px!important;bottom:auto!important;left:auto!important;display:grid!important;place-items:center!important;width:56px!important;height:56px!important;min-width:56px!important;min-height:56px!important;padding:0!important;margin:0!important;border:0!important;border-radius:8px!important;background:transparent!important;color:inherit!important;box-shadow:none!important;transform:none!important;z-index:2!important;cursor:pointer!important}
.pfhmvp-logo:disabled{cursor:default!important}.pfhmvp-logo img{max-width:52px;max-height:52px;object-fit:contain}
.pfhmvp-kicker{display:block!important;max-width:calc(100% - 72px);text-transform:uppercase;font-size:10px!important;letter-spacing:.13em;font-weight:900;color:#0783c9!important;visibility:visible!important;opacity:1!important}
.pfhmvp-score{display:block!important;font-family:'Bebas Neue',Impact,sans-serif;font-size:46px!important;line-height:1;margin-top:18px;color:#0783c9!important;visibility:visible!important;opacity:1!important}
.pfhmvp-score small{font-family:Barlow,Inter,Arial,sans-serif;font-size:12px;margin-left:7px;text-transform:uppercase;letter-spacing:.08em;color:#687385}
.pfhmvp-card h3{display:block!important;visibility:visible!important;opacity:1!important;font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:25px!important;line-height:1;margin:14px 0 5px!important;color:#111318!important}
.pfhmvp-card p{display:block!important;visibility:visible!important;opacity:1!important;font-size:13px!important;line-height:1.45;margin:0!important;color:#303741!important}
.pfhmvp-meta{display:block!important;visibility:visible!important;opacity:1!important;margin-top:auto;padding-top:14px;padding-right:76px;color:#687385!important;font-size:11px!important}
.pfhmvp-share{position:absolute!important;right:12px!important;bottom:12px!important;top:auto!important;left:auto!important;display:inline-flex!important;align-items:center!important;gap:5px!important;width:auto!important;height:auto!important;min-width:0!important;min-height:0!important;margin:0!important;padding:7px 10px!important;border:1px solid #d9e0e7!important;border-radius:999px!important;background:#fff!important;color:#111318!important;box-shadow:0 3px 8px rgba(17,24,39,.08)!important;font:800 9px/1 Barlow,Inter,Arial,sans-serif!important;text-transform:uppercase!important;letter-spacing:.04em!important;transform:none!important;z-index:3!important;cursor:pointer!important}
.pfhmvp-share:hover{border-color:#42b8ff!important;color:#0783c9!important}
.pfhmvp-card:hover{transform:translateY(-2px);border-color:#b9dff5}.pfhmvp-card:focus-visible,.pfhmvp-logo:focus-visible,.pfhmvp-share:focus-visible{outline:3px solid #42b8ff;outline-offset:3px}
.pfhmvp-empty{text-align:center;color:#687385;margin:0;padding:28px 0}
.pfhmvp-skeleton{overflow:hidden}.pfhmvp-skeleton:after{content:'';position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.72),transparent);animation:pfhmvp-shimmer 1.35s infinite}
.pfhmvp-skeleton-logo{position:absolute;right:18px;top:18px;width:52px;height:52px;border-radius:50%;background:#e8edf1}.pfhmvp-skeleton-line,.pfhmvp-skeleton-score{display:block;background:#e8edf1;border-radius:999px}.pfhmvp-skeleton-line.kicker{width:45%;height:10px}.pfhmvp-skeleton-score{width:90px;height:46px;margin-top:20px;border-radius:7px}.pfhmvp-skeleton-line.name{width:70%;height:25px;margin-top:13px}.pfhmvp-skeleton-line.club{width:52%;height:12px;margin-top:8px}
@keyframes pfhmvp-shimmer{100%{transform:translateX(100%)}}@media(prefers-reduced-motion:reduce){.pfhmvp-skeleton:after{animation:none}}
@media(max-width:620px){#pf-home-mvp-slot,#pf-home-player-records-slot{border-top-width:10px;padding-top:22px}.pfhmvp{padding-bottom:30px}.pfhmvp-head{align-items:flex-end;margin-bottom:14px}.pfhmvp-head h2{font-size:2.8rem}.pfhmvp-head>a{font-size:11px;max-width:125px;text-align:right}.pfhmvp-card{flex-basis:82vw!important;min-height:225px;padding:22px 18px 52px}.pfhmvp-logo{right:16px!important;top:16px!important}.pfhmvp-score{margin-top:18px}.pfhmvp-card h3{margin-top:13px!important}.pfhmvp-meta{padding-top:11px;padding-right:72px}.pfhmvp-share{right:10px!important;bottom:10px!important}}
`
