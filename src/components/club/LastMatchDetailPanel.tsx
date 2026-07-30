import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

type MatchRow = {
  id: string
  sourceId?: string
  matchDate?: string | null
  homePoints?: number
  awayPoints?: number
  homeScore?: number
  awayScore?: number
}

type LinkedPlayer = { playerName?: string; playerId?: string | null }
type GoalKicker = LinkedPlayer & { goals?: number }
type MatchDetail = {
  homeQuarterScores?: Array<string | null>
  awayQuarterScores?: Array<string | null>
  homeBestPlayerLinks?: LinkedPlayer[]
  awayBestPlayerLinks?: LinkedPlayer[]
  homeBestPlayers?: string[]
  awayBestPlayers?: string[]
  homeGoalKickers?: GoalKicker[]
  awayGoalKickers?: GoalKicker[]
}

const score = (row: MatchRow, side: 'home' | 'away') => Number(side === 'home' ? row.homePoints ?? row.homeScore : row.awayPoints ?? row.awayScore)
const dateValue = (value?: string | null) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0 }

export default function LastMatchDetailPanel({ clubId }: { clubId: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [detail, setDetail] = useState<MatchDetail | null>(null)

  useEffect(() => {
    let mount: HTMLElement | null = null
    let observer: MutationObserver | null = null
    const attach = () => {
      const card = document.querySelector<HTMLElement>('.club-last-result-card')
      const link = card?.querySelector<HTMLElement>('.club-last-result-link')
      if (!card || !link) return false
      mount = card.querySelector<HTMLElement>('[data-last-match-details]')
      if (!mount) {
        mount = document.createElement('div')
        mount.dataset.lastMatchDetails = 'true'
        card.insertBefore(mount, link)
      }
      setTarget(mount)
      return true
    }
    if (!attach()) {
      observer = new MutationObserver(() => { if (attach()) observer?.disconnect() })
      observer.observe(document.body, { childList: true, subtree: true })
    }
    return () => { observer?.disconnect(); mount?.remove(); setTarget(null) }
  }, [clubId])

  useEffect(() => {
    let active = true
    setDetail(null)
    void fetch(`/api/clubs/${encodeURIComponent(clubId)}/results`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: MatchRow[] }) => {
        const rows = Array.isArray(payload.data) ? payload.data : []
        const latest = rows
          .filter(row => Number.isFinite(score(row, 'home')) && Number.isFinite(score(row, 'away')))
          .sort((a, b) => dateValue(b.matchDate) - dateValue(a.matchDate))[0]
        if (!latest) return null
        const resultId = latest.sourceId ?? latest.id.replace(/^football:/, '')
        return fetch(`/api/match-details/football/${encodeURIComponent(resultId)}`)
          .then(response => response.ok ? response.json() : null)
      })
      .then((payload: { data?: MatchDetail | null } | null) => { if (active) setDetail(payload?.data ?? null) })
      .catch(() => { if (active) setDetail(null) })
    return () => { active = false }
  }, [clubId])

  const hasDetail = useMemo(() => Boolean(detail && (
    detail.homeQuarterScores?.some(Boolean) || detail.awayQuarterScores?.some(Boolean) ||
    detail.homeBestPlayerLinks?.length || detail.awayBestPlayerLinks?.length ||
    detail.homeBestPlayers?.length || detail.awayBestPlayers?.length ||
    detail.homeGoalKickers?.length || detail.awayGoalKickers?.length
  )), [detail])

  if (!target || !detail || !hasDetail) return null

  const homeBest = detail.homeBestPlayerLinks?.length ? detail.homeBestPlayerLinks : (detail.homeBestPlayers ?? []).map(playerName => ({ playerName }))
  const awayBest = detail.awayBestPlayerLinks?.length ? detail.awayBestPlayerLinks : (detail.awayBestPlayers ?? []).map(playerName => ({ playerName }))

  return createPortal(<div className="club-last-detail-panel">
    {(detail.homeQuarterScores?.some(Boolean) || detail.awayQuarterScores?.some(Boolean)) && <section className="club-last-quarters">
      <h3>Quarter scores</h3>
      <div className="club-last-quarter-head"><span>Team</span>{[1,2,3,4].map(q => <b key={q}>Q{q}</b>)}</div>
      <QuarterRow label="Home" values={detail.homeQuarterScores}/>
      <QuarterRow label="Away" values={detail.awayQuarterScores}/>
    </section>}
    <div className="club-last-detail-grid">
      <DetailColumn title="Best players" home={homeBest} away={awayBest} kind="players"/>
      <DetailColumn title="Goal kickers" home={detail.homeGoalKickers ?? []} away={detail.awayGoalKickers ?? []} kind="kickers"/>
    </div>
    <style>{styles}</style>
  </div>, target)
}

function QuarterRow({ label, values = [] }: { label: string; values?: Array<string | null> }) {
  return <div className="club-last-quarter-row"><strong>{label}</strong>{[0,1,2,3].map(index => <span key={index}>{values[index] || '—'}</span>)}</div>
}

function DetailColumn({ title, home, away, kind }: { title: string; home: Array<LinkedPlayer | GoalKicker>; away: Array<LinkedPlayer | GoalKicker>; kind: 'players' | 'kickers' }) {
  if (!home.length && !away.length) return null
  return <section className="club-last-detail-column"><h3>{title}</h3><TeamList label="Home" rows={home} kind={kind}/><TeamList label="Away" rows={away} kind={kind}/></section>
}

function TeamList({ label, rows, kind }: { label: string; rows: Array<LinkedPlayer | GoalKicker>; kind: 'players' | 'kickers' }) {
  if (!rows.length) return null
  return <div className="club-last-team-list"><strong>{label}</strong><p>{rows.map((row, index) => {
    const name = String(row.playerName ?? '').trim()
    const goals = kind === 'kickers' ? Number((row as GoalKicker).goals ?? 0) : null
    const content = <>{name}{goals != null && goals > 0 ? ` ${goals}` : ''}</>
    return <span key={`${name}-${index}`}>{row.playerId ? <Link to={`/player/${encodeURIComponent(row.playerId)}`}>{content}</Link> : content}</span>
  })}</p></div>
}

const styles = `
.club-last-detail-panel{padding:14px 16px 16px;border-top:1px solid #e1e6eb;background:#f8fafb;color:#111318}.club-last-detail-panel h3{margin:0 0 8px;font-size:10px;font-weight:950;letter-spacing:.13em;text-transform:uppercase;color:var(--club-primary,#168fd2)}
.club-last-quarters{padding-bottom:12px;border-bottom:1px solid #e1e6eb}.club-last-quarter-head,.club-last-quarter-row{display:grid;grid-template-columns:minmax(72px,1.5fr) repeat(4,minmax(42px,1fr));align-items:center;gap:5px}.club-last-quarter-head{color:#687385;font-size:9px;text-transform:uppercase}.club-last-quarter-head b,.club-last-quarter-row span{text-align:center}.club-last-quarter-row{margin-top:5px}.club-last-quarter-row strong{font-size:11px}.club-last-quarter-row span{padding:5px 3px;border-radius:5px;background:#fff;border:1px solid #e3e8ed;font-size:11px;font-weight:800}
.club-last-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.club-last-detail-column{min-width:0;padding:10px;border:1px solid #e3e8ed;border-radius:8px;background:#fff}.club-last-team-list+.club-last-team-list{margin-top:8px;padding-top:8px;border-top:1px solid #edf1f4}.club-last-team-list>strong{display:block;margin-bottom:3px;color:#687385;font-size:9px;text-transform:uppercase}.club-last-team-list p{display:flex;flex-wrap:wrap;gap:3px 8px;margin:0;font-size:10px;line-height:1.35}.club-last-team-list p span:not(:last-child):after{content:'·';margin-left:8px;color:#a4acb7}.club-last-team-list a{color:inherit;text-decoration:none;font-weight:850}.club-last-team-list a:hover{color:var(--club-primary,#168fd2)}
@media(max-width:520px){.club-last-detail-panel{padding:12px}.club-last-detail-grid{grid-template-columns:1fr;gap:8px}.club-last-quarter-head,.club-last-quarter-row{grid-template-columns:minmax(58px,1.2fr) repeat(4,minmax(36px,1fr));gap:4px}.club-last-quarter-row span{font-size:10px}}
`
