import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'

type Health = {
  status: 'HEALTHY' | 'STALE' | 'NEEDS_REVIEW' | 'NO_RUN'
  healthy: boolean
  stale: boolean
  ageHours?: number | null
  run: { weekLabel: string | null; season: string; completedAt: string | null } | null
  integrity: {
    totalEntries: number
    eligibleClubs: number
    duplicateClubIds: string[]
    duplicateRanks: number[]
    excludedClubIds: string[]
    missingRanks: number[]
    invalidMovement: number
    healthy: boolean
  } | null
}

export default function RankingHealthPanel({ admin = false }: { admin?: boolean }) {
  const [data, setData] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/rankings/health')
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: Health }) => setData(payload.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
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

  return <section className={`ranking-health ${admin ? 'admin' : ''} ${data.healthy ? 'healthy' : 'warning'}`}>
    <div className="ranking-health-icon">{data.healthy ? <CheckCircle2 size={20}/> : <AlertTriangle size={20}/>}</div>
    <div className="ranking-health-copy">
      <strong>{data.healthy ? 'Rankings verified' : data.status === 'STALE' ? 'Rankings may be stale' : data.status === 'NO_RUN' ? 'No completed ranking run' : 'Rankings need review'}</strong>
      <span>{data.run ? `${data.run.weekLabel ?? data.run.season} · ${data.integrity?.totalEntries ?? 0} ranked clubs${data.ageHours != null ? ` · updated ${ageLabel(data.ageHours)}` : ''}` : 'A valid completed ranking run has not been found.'}</span>
      {admin && data.integrity && <small>{data.integrity.eligibleClubs} eligible clubs · {issues.length ? issues.join(' · ') : 'No duplicate, rank or movement issues detected.'}</small>}
    </div>
    {admin && <button type="button" onClick={load}><RefreshCw size={15}/> Recheck</button>}
    <style>{styles}</style>
  </section>
}

function ageLabel(hours: number) {
  if (hours < 1) return 'less than an hour ago'
  if (hours < 48) return `${Math.round(hours)} hours ago`
  return `${Math.round(hours / 24)} days ago`
}

const styles = `.ranking-health{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;border:1px solid #f1c36b;border-left:5px solid #e49b16;border-radius:10px;background:#fff8e8;padding:14px 16px;color:#5b3a00}.ranking-health.healthy{border-color:#b9ddc2;border-left-color:#22a447;background:#f2fbf4;color:#14532d}.ranking-health-icon{display:grid;place-items:center}.ranking-health-copy{min-width:0}.ranking-health-copy strong,.ranking-health-copy span,.ranking-health-copy small{display:block}.ranking-health-copy strong{font-size:14px}.ranking-health-copy span{margin-top:3px;font-size:12px}.ranking-health-copy small{margin-top:5px;color:#687385;font-size:11px}.ranking-health button{display:inline-flex;align-items:center;gap:6px;border:1px solid currentColor;border-radius:999px;background:transparent;padding:8px 11px;color:inherit;font-size:10px;font-weight:900;text-transform:uppercase;cursor:pointer}.ranking-health.admin{margin:16px 0}.ranking-health:not(.admin){margin:0 0 14px}@media(max-width:620px){.ranking-health{grid-template-columns:auto minmax(0,1fr)}.ranking-health button{grid-column:2;justify-self:start}}`
