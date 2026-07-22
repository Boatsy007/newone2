import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

type ExcludedClub = {
  clubId: string
  clubName: string
  leagueId: string | null
  leagueName: string | null
  state: string | null
  reason: string
}

type Health = {
  status: 'HEALTHY' | 'STALE' | 'NEEDS_REVIEW' | 'NO_RUN'
  healthy: boolean
  stale: boolean
  ageHours?: number | null
  run: { weekLabel: string | null; season: string; completedAt: string | null } | null
  integrity: {
    totalEntries: number
    eligibleClubs: number
    candidateClubs?: number
    duplicateClubIds: string[]
    duplicateRanks: number[]
    excludedClubIds: string[]
    excludedClubs?: ExcludedClub[]
    missingRanks: number[]
    invalidMovement: number
    healthy: boolean
  } | null
}

export default function RankingHealthPanel({ admin = false }: { admin?: boolean }) {
  const [data, setData] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [showExcluded, setShowExcluded] = useState(false)
  const [filter, setFilter] = useState('')

  const load = () => {
    setLoading(true)
    fetch('/api/rankings/health', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: Health }) => setData(payload.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  const excluded = data?.integrity?.excludedClubs ?? []
  const shownExcluded = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return excluded
    return excluded.filter(row => `${row.clubName} ${row.leagueName ?? ''} ${row.state ?? ''} ${row.reason}`.toLowerCase().includes(query))
  }, [excluded, filter])

  if (loading) return admin ? <div className="ranking-health admin">Checking ranking integrity…</div> : null
  if (!data) return admin ? <div className="ranking-health admin warning">Ranking integrity check unavailable.</div> : null
  if (!admin && data.healthy) return null

  const issues = data.integrity ? [
    data.integrity.duplicateClubIds.length ? `${data.integrity.duplicateClubIds.length} duplicate club entries` : null,
    data.integrity.duplicateRanks.length ? `${data.integrity.duplicateRanks.length} duplicated ranks` : null,
    data.integrity.missingRanks.length ? `${data.integrity.missingRanks.length} missing rank positions` : null,
    data.integrity.invalidMovement ? `${data.integrity.invalidMovement} movement mismatches` : null,
    data.integrity.excludedClubIds.length ? `${data.integrity.excludedClubIds.length} eligible clubs excluded` : null,
  ].filter(Boolean) as string[] : []

  return <>
    <section className={`ranking-health ${admin ? 'admin' : ''} ${data.healthy ? 'healthy' : 'warning'}`}>
      <div className="ranking-health-icon">{data.healthy ? <CheckCircle2 size={20}/> : <AlertTriangle size={20}/>}</div>
      <div className="ranking-health-copy">
        <strong>{data.healthy ? 'Rankings verified' : data.status === 'STALE' ? 'Rankings may be stale' : data.status === 'NO_RUN' ? 'No completed ranking run' : 'Rankings need review'}</strong>
        <span>{data.run ? `${data.run.weekLabel ?? data.run.season} · ${data.integrity?.totalEntries ?? 0} ranked clubs${data.ageHours != null ? ` · updated ${ageLabel(data.ageHours)}` : ''}` : 'A valid completed ranking run has not been found.'}</span>
        {admin && data.integrity && <small>{data.integrity.eligibleClubs} currently eligible clubs{data.integrity.candidateClubs != null ? ` · ${data.integrity.candidateClubs - data.integrity.eligibleClubs} other club profiles not eligible for this run` : ''}{issues.length ? ` · ${issues.join(' · ')}` : ' · no duplicate, rank or movement issues detected.'}</small>}
      </div>
      {admin && <div className="ranking-health-actions">
        {excluded.length > 0 && <button type="button" onClick={() => setShowExcluded(value => !value)}>{showExcluded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>} {showExcluded ? 'Hide excluded clubs' : `View excluded clubs (${excluded.length})`}</button>}
        <button type="button" onClick={load}><RefreshCw size={15}/> Recheck</button>
      </div>}
      <style>{styles}</style>
    </section>
    {admin && showExcluded && <section className="ranking-exclusions">
      <header>
        <div><strong>Clubs not included in the current ranking</strong><span>These are not automatically safe to delete. Review the reason beside each club first.</span></div>
        <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Search club, league or reason" />
      </header>
      <div className="ranking-exclusion-list">
        {shownExcluded.map(row => <article key={row.clubId}>
          <div><strong>{row.clubName}</strong><span>{row.leagueName ?? 'No league'}{row.state ? ` · ${row.state}` : ''}</span></div>
          <b>{row.reason}</b>
          <a href={`/team/${encodeURIComponent(row.clubId)}`} target="_blank" rel="noreferrer">View club</a>
        </article>)}
        {shownExcluded.length === 0 && <p>No excluded clubs match that search.</p>}
      </div>
    </section>}
  </>
}

function ageLabel(hours: number) {
  if (hours < 1) return 'less than an hour ago'
  if (hours < 48) return `${Math.round(hours)} hours ago`
  return `${Math.round(hours / 24)} days ago`
}

const styles = `.ranking-health{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;border:1px solid #f1c36b;border-left:5px solid #e49b16;border-radius:10px;background:#fff8e8;padding:14px 16px;color:#5b3a00}.ranking-health.healthy{border-color:#b9ddc2;border-left-color:#22a447;background:#f2fbf4;color:#14532d}.ranking-health-icon{display:grid;place-items:center}.ranking-health-copy{min-width:0}.ranking-health-copy strong,.ranking-health-copy span,.ranking-health-copy small{display:block}.ranking-health-copy strong{font-size:14px}.ranking-health-copy span{margin-top:3px;font-size:12px}.ranking-health-copy small{margin-top:5px;color:#687385;font-size:11px}.ranking-health-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.ranking-health button{display:inline-flex;align-items:center;gap:6px;border:1px solid currentColor;border-radius:999px;background:transparent;padding:8px 11px;color:inherit;font-size:10px;font-weight:900;text-transform:uppercase;cursor:pointer}.ranking-health.admin{margin:16px 0}.ranking-health:not(.admin){margin:0 0 14px}.ranking-exclusions{margin:-6px 0 16px;border:1px solid #dce3eb;border-radius:14px;background:#fff;overflow:hidden}.ranking-exclusions>header{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,340px);gap:14px;align-items:center;padding:16px;border-bottom:1px solid #e8edf2}.ranking-exclusions header strong,.ranking-exclusions header span{display:block}.ranking-exclusions header span{margin-top:4px;color:#687385;font-size:12px}.ranking-exclusions input{width:100%;border:1px solid #dce3eb;border-radius:10px;padding:10px 12px;font:inherit}.ranking-exclusion-list{max-height:520px;overflow:auto}.ranking-exclusion-list article{display:grid;grid-template-columns:minmax(180px,1fr) minmax(220px,1.4fr) auto;gap:14px;align-items:center;padding:13px 16px;border-bottom:1px solid #edf1f5}.ranking-exclusion-list article:last-child{border-bottom:0}.ranking-exclusion-list article strong,.ranking-exclusion-list article span{display:block}.ranking-exclusion-list article span{margin-top:3px;color:#687385;font-size:11px}.ranking-exclusion-list article b{font-size:12px;color:#8a4b00}.ranking-exclusion-list article a{border:1px solid #dce3eb;border-radius:999px;padding:7px 10px;color:#111;text-decoration:none;font-size:10px;font-weight:900;text-transform:uppercase}.ranking-exclusion-list>p{padding:20px;color:#687385}@media(max-width:760px){.ranking-health{grid-template-columns:auto minmax(0,1fr)}.ranking-health-actions{grid-column:2;justify-content:flex-start}.ranking-exclusions>header{grid-template-columns:1fr}.ranking-exclusion-list article{grid-template-columns:1fr}.ranking-exclusion-list article a{width:fit-content}}`
