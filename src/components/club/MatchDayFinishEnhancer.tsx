import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, LoaderCircle, Printer, Trophy } from 'lucide-react'
import ClubCoachingCommandCentre from './ClubCoachingCommandCentre'

type Session = { access_token: string }
type Slot = { clubPlayerId: string; playerName: string; jumperNumber: number | null; positionCode: string; onGround: boolean; plusMinus: number }
type MatchEvent = { id: string; quarter: number; seconds: number; kind: 'SCORE' | 'SWAP' | 'QUARTER'; label: string; delta?: number }
type MatchState = {
  sheetId: string
  quarter: number
  elapsed: number
  runningSince: number | null
  homeGoals: number
  homeBehinds: number
  awayGoals: number
  awayBehinds: number
  slots: Slot[]
  events: MatchEvent[]
  finishedAt?: string | null
}
type Sheet = { id: string; roundLabel: string; opponentName: string | null; matchDate: string | null }

const SESSION_KEY = 'playfooty.clubPortal.session.v1'

function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as Session : null
  } catch {
    return null
  }
}

function total(goals: number, behinds: number) {
  return goals * 6 + behinds
}

function formatTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

export default function MatchDayFinishEnhancer() {
  const { pathname, search } = useLocation()
  const routeMatch = pathname.match(/^\/club-portal\/([^/]+)/)
  const clubId = routeMatch?.[1] ?? ''
  const coachingRoute = /^\/club-portal\/[^/]+\/coaching\/?$/.test(pathname)
  const coachingOverview = coachingRoute && !new URLSearchParams(search).get('view')

  const [host, setHost] = useState<HTMLElement | null>(null)
  const [summaryHost, setSummaryHost] = useState<HTMLElement | null>(null)
  const [state, setState] = useState<MatchState | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [coachingLoading, setCoachingLoading] = useState(false)
  const coachingStartedAt = useRef(0)
  const session = useMemo(() => getSession(), [pathname])

  useEffect(() => {
    if (!coachingRoute) {
      setCoachingLoading(false)
      return
    }

    coachingStartedAt.current = Date.now()
    setCoachingLoading(true)

    let settled = false
    let observer: MutationObserver | null = null
    let fallbackTimer = 0
    let minimumTimer = 0
    let initialTimer = 0

    const finish = () => {
      if (settled) return
      settled = true
      observer?.disconnect()
      window.clearTimeout(fallbackTimer)
      const remaining = Math.max(0, 700 - (Date.now() - coachingStartedAt.current))
      minimumTimer = window.setTimeout(() => setCoachingLoading(false), remaining)
    }

    const check = () => {
      const workspace = document.querySelector('.coach-workspace')
      const loadingState = document.querySelector('.coach-state')
      if (workspace && !loadingState) finish()
    }

    observer = new MutationObserver(check)
    observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    initialTimer = window.setTimeout(check, 100)
    fallbackTimer = window.setTimeout(finish, 15000)

    return () => {
      settled = true
      observer?.disconnect()
      window.clearTimeout(initialTimer)
      window.clearTimeout(fallbackTimer)
      window.clearTimeout(minimumTimer)
    }
  }, [coachingRoute, pathname, search])

  useEffect(() => {
    if (!clubId || !session) return

    let active = true

    const attach = () => {
      const page = document.querySelector<HTMLElement>('.md')
      const picker = document.querySelector<HTMLSelectElement>('.md-picker select')
      const clock = document.querySelector<HTMLElement>('.md-clock')
      if (!page || !picker || !clock) return false

      let buttonHost = document.getElementById('pf-match-finish-host')
      if (!buttonHost) {
        buttonHost = document.createElement('div')
        buttonHost.id = 'pf-match-finish-host'
        clock.appendChild(buttonHost)
      }

      let nextSummary = document.getElementById('pf-match-summary-host')
      if (!nextSummary) {
        nextSummary = document.createElement('div')
        nextSummary.id = 'pf-match-summary-host'
        document.querySelector('.md-picker')?.insertAdjacentElement('afterend', nextSummary)
      }

      if (active) {
        setHost(buttonHost)
        setSummaryHost(nextSummary)
      }
      return true
    }

    const read = async () => {
      const sheetId = document.querySelector<HTMLSelectElement>('.md-picker select')?.value
      if (!sheetId) return

      try {
        const headers: Record<string, string> = { authorization: `Bearer ${session.access_token}` }
        const [stateResponse, sheetsResponse] = await Promise.all([
          fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`, { headers }),
          fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`, { headers }),
        ])
        const statePayload = await stateResponse.json().catch(() => ({}))
        const sheetsPayload = await sheetsResponse.json().catch(() => ({}))
        if (!active) return

        setState(stateResponse.ok ? (statePayload.data?.state ?? null) : null)
        const sheets = Array.isArray(sheetsPayload.data) ? sheetsPayload.data as Sheet[] : []
        setSheet(sheets.find(item => item.id === sheetId) ?? null)
      } catch {
        // Match Day enhancer remains optional if its supporting request fails.
      }
    }

    const tick = () => {
      if (attach()) void read()
    }

    tick()
    const timer = window.setInterval(tick, 2500)

    return () => {
      active = false
      window.clearInterval(timer)
      document.getElementById('pf-match-finish-host')?.remove()
      document.getElementById('pf-match-summary-host')?.remove()
      document.body.classList.remove('pf-match-finished')
    }
  }, [clubId, session])

  useEffect(() => {
    document.body.classList.toggle('pf-match-finished', Boolean(state?.finishedAt))
    return () => document.body.classList.remove('pf-match-finished')
  }, [state?.finishedAt])

  async function finishMatch() {
    if (!state || !sheet || !session || busy) return
    if (!window.confirm('Finish this match and create the game summary? The public live match will close.')) return

    setBusy(true)
    setError('')
    try {
      const elapsed = state.elapsed + (state.runningSince ? Math.floor((Date.now() - state.runningSince) / 1000) : 0)
      const finished: MatchState = {
        ...state,
        elapsed,
        runningSince: null,
        finishedAt: new Date().toISOString(),
        events: [{ id: crypto.randomUUID(), quarter: 4, seconds: elapsed, kind: 'QUARTER', label: 'Match finished' }, ...state.events],
      }
      const headers: Record<string, string> = {
        authorization: `Bearer ${session.access_token}`,
        'content-type': 'application/json',
      }

      const saved = await fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(state.sheetId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ state: finished }),
      })
      const savedPayload = await saved.json().catch(() => ({}))
      if (!saved.ok) throw new Error(savedPayload.error || 'Unable to finish match')

      await fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          teamSheetId: state.sheetId,
          roundLabel: sheet.roundLabel,
          opponentName: sheet.opponentName,
          matchDate: sheet.matchDate,
          quarter: 4,
          elapsedSeconds: elapsed,
          clockRunning: false,
          homeGoals: state.homeGoals,
          homeBehinds: state.homeBehinds,
          awayGoals: state.awayGoals,
          awayBehinds: state.awayBehinds,
          status: 'HIDDEN',
          lastEvent: 'Full time',
        }),
      })
      setState(finished)
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to finish match')
    } finally {
      setBusy(false)
    }
  }

  const quarterFour = state?.quarter === 4 && !state.finishedAt
  const coachingLoader = coachingLoading ? createPortal(
    <div className="pf-coaching-loading" role="status" aria-live="polite">
      <div>
        <LoaderCircle size={36}/>
        <span>PLAYFOOTY COACHING</span>
        <strong>Loading Coaching</strong>
        <p>Preparing your coaching command centre and weekly football data.</p>
      </div>
    </div>,
    document.body,
  ) : null

  return <>
    {coachingOverview && clubId && <ClubCoachingCommandCentre clubId={clubId}/>} 
    {coachingLoader}
    {host && state && quarterFour && createPortal(
      <button className="pf-finish-match" onClick={finishMatch} disabled={busy}>
        <Trophy size={18}/>{busy ? 'Finishing…' : 'Finish match'}
      </button>,
      host,
    )}
    {summaryHost && state?.finishedAt && createPortal(
      <GameSummary state={state} opponent={sheet?.opponentName || 'Opposition'} clubId={clubId}/>,
      summaryHost,
    )}
    {error && host && createPortal(<span className="pf-finish-error">{error}</span>, host)}
    <style>{styles}</style>
  </>
}

function GameSummary({ state, opponent, clubId }: { state: MatchState; opponent: string; clubId: string }) {
  const home = total(state.homeGoals, state.homeBehinds)
  const away = total(state.awayGoals, state.awayBehinds)
  const result = home === away
    ? 'Draw'
    : home > away
      ? `Your team won by ${home - away} point${home - away === 1 ? '' : 's'}`
      : `${opponent} won by ${away - home} point${away - home === 1 ? '' : 's'}`
  const swaps = state.events.filter(event => event.kind === 'SWAP').length
  const scores = state.events.filter(event => event.kind === 'SCORE').length
  const leaders = [...state.slots].sort((left, right) => right.plusMinus - left.plusMinus)

  return <section className="pf-game-summary">
    <header><CheckCircle2 size={28}/><span>Full time</span><h2>Game summary</h2><p>{result}</p></header>
    <div className="pf-final-score">
      <div><strong>Your team</strong><b>{state.homeGoals}.{state.homeBehinds}</b><em>{home}</em></div>
      <span>FINAL</span>
      <div><strong>{opponent}</strong><b>{state.awayGoals}.{state.awayBehinds}</b><em>{away}</em></div>
    </div>
    <div className="pf-summary-metrics">
      <article><b>{formatTime(state.elapsed)}</b><span>Final-quarter time</span></article>
      <article><b>{scores}</b><span>Scoring events</span></article>
      <article><b>{swaps}</b><span>Player swaps</span></article>
      <article><b>{state.events.length}</b><span>Total actions</span></article>
    </div>
    <section className="pf-summary-players">
      <h3>Player plus/minus</h3>
      {leaders.map(slot => <div key={slot.clubPlayerId}>
        <span>{slot.jumperNumber ? `${slot.jumperNumber}. ` : ''}{slot.playerName}</span>
        <b className={slot.plusMinus > 0 ? 'positive' : slot.plusMinus < 0 ? 'negative' : ''}>{slot.plusMinus > 0 ? '+' : ''}{slot.plusMinus}</b>
      </div>)}
    </section>
    <footer>
      <Link to={`/club-portal/${clubId}/media`}>Open Media Centre</Link>
      <Link to={`/club-portal/${clubId}/coaching`}>Return to coaching</Link>
      <button onClick={() => window.print()}><Printer size={16}/>Print summary</button>
    </footer>
  </section>
}

const styles = `
.pf-coaching-loading{position:fixed;inset:0;z-index:100700;display:grid;place-items:center;padding:22px;background:rgba(238,243,247,.94);backdrop-filter:blur(8px)}
.pf-coaching-loading>div{width:min(390px,calc(100vw - 36px));box-sizing:border-box;display:flex;flex-direction:column;align-items:center;padding:30px 24px;border:1px solid #d9e2e9;border-radius:20px;background:#fff;text-align:center;box-shadow:0 24px 70px rgba(15,23,42,.18)}
.pf-coaching-loading svg{color:#42b8ff;animation:pf-coaching-spin .8s linear infinite}
.pf-coaching-loading span{margin-top:16px;color:#0783c9;font-size:9px;font-weight:950;letter-spacing:.17em}
.pf-coaching-loading strong{margin-top:7px;font:36px/1 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}
.pf-coaching-loading p{margin:9px 0 0;color:#687385;font-size:13px;line-height:1.45}
@keyframes pf-coaching-spin{to{transform:rotate(360deg)}}
#pf-match-finish-host{display:contents}
.pf-finish-match{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;border:0!important;border-radius:9px!important;padding:11px 14px!important;background:#df2f36!important;color:#fff!important;font-weight:950!important;text-transform:uppercase}
.pf-finish-error{display:block;color:#b4232d;font-size:10px;font-weight:850}
.pf-match-finished .md-control,.pf-match-finished .md-layout{display:none!important}
.pf-game-summary{margin-top:14px;padding:18px;border:1px solid #dce4ea;border-radius:16px;background:#fff}
.pf-game-summary>header{text-align:center}.pf-game-summary>header svg{color:#20b96f}.pf-game-summary>header span{display:block;margin-top:5px;color:#df2f36;font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.pf-game-summary>header h2{margin:3px 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:48px;text-transform:uppercase}.pf-game-summary>header p{margin:0;color:#5f6b76;font-weight:900}
.pf-final-score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin:18px 0;padding:18px;border-radius:14px;background:#111c26;color:#fff;text-align:center}.pf-final-score div{display:grid}.pf-final-score b{font-family:'Bebas Neue',Impact,sans-serif;font-size:38px}.pf-final-score em{font-family:'Bebas Neue',Impact,sans-serif;font-size:58px;line-height:.9;font-style:normal}.pf-final-score>span{color:#7ed3ff;font-size:11px;font-weight:950}
.pf-summary-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.pf-summary-metrics article{padding:12px;border-radius:10px;background:#eef3f7;text-align:center}.pf-summary-metrics b,.pf-summary-metrics span{display:block}.pf-summary-metrics b{font-size:24px}.pf-summary-metrics span{font-size:8px;font-weight:900;text-transform:uppercase;color:#6e7983}
.pf-summary-players{margin-top:12px;padding:14px;border:1px solid #e0e6eb;border-radius:12px}.pf-summary-players h3{margin:0 0 8px;font-family:'Bebas Neue',Impact,sans-serif;font-size:29px;text-transform:uppercase}.pf-summary-players>div{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid #edf0f2}
.pf-game-summary footer{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap}.pf-game-summary footer a,.pf-game-summary footer button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:9px;padding:12px 14px;background:#e7edf2;color:#111;text-decoration:none;font-weight:950;text-transform:uppercase}.pf-game-summary footer a:first-child{background:#1689c7;color:#fff}.pf-game-summary footer button{background:#21c879}
@media(max-width:650px){.pf-coaching-loading{padding-bottom:calc(96px + env(safe-area-inset-bottom))}.pf-coaching-loading>div{padding:27px 20px}.pf-game-summary{padding:13px}.pf-final-score{gap:6px;padding:13px 7px}.pf-final-score em{font-size:44px}.pf-summary-metrics{grid-template-columns:1fr 1fr}.pf-game-summary footer{flex-direction:column;align-items:stretch}}
`
