import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Database, ExternalLink, RefreshCw, Search, Server, ShieldCheck, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getKey } from '../lib/admin'

const BLUE = '#35b6ff'
const BLACK = '#050505'
const LINE = '#dce3eb'
const MUTED = '#687385'

type Sample = { id: string; name: string }
type HealthReport = { generatedAt: string; counts: Record<string, number>; samples: Record<string, Sample[]> }
type DuplicateReport = { duplicateClubs?: unknown[]; duplicateLeagues?: unknown[]; duplicateLeagueSources?: unknown[] }
type Snapshot = { id: string; counts: string; createdAt: string }
type Probe = { label: string; path: string; status: 'checking' | 'healthy' | 'warning' | 'failed'; code?: number; latency?: number; detail?: string }

type LoadState = {
  report: HealthReport | null
  duplicates: DuplicateReport | null
  history: Snapshot[]
  error: string
  loading: boolean
}

const initialState: LoadState = { report: null, duplicates: null, history: [], error: '', loading: true }

const probes = [
  { label: 'API health', path: '/health' },
  { label: 'National rankings', path: '/api/rankings' },
  { label: 'League directory', path: '/api/leagues' },
  { label: 'Goal kickers', path: '/api/goal-kickers?mode=raw&limit=1' },
  { label: 'Published news', path: '/api/news?limit=1' },
  { label: 'Highlights', path: '/api/highlights' },
  { label: 'Unified search', path: '/api/search?q=football' },
  { label: 'Dynamic sitemap', path: '/sitemap.xml' },
]

async function adminJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { authorization: `Bearer ${getKey()}` } })
  const payload = await response.json().catch(() => ({})) as { data?: T; error?: string }
  if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`)
  return payload.data as T
}

export default function AdminHealth() {
  const [state, setState] = useState<LoadState>(initialState)
  const [routeProbes, setRouteProbes] = useState<Probe[]>(probes.map(probe => ({ ...probe, status: 'checking' })))

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.head.appendChild(document.createElement('meta'))
    meta.name = 'robots'
    const previous = meta.content
    meta.content = 'noindex,nofollow'
    document.title = 'System Health | PlayFooty Control Centre'
    return () => { meta.content = previous }
  }, [])

  const runPublicProbes = useCallback(async () => {
    setRouteProbes(probes.map(probe => ({ ...probe, status: 'checking' })))
    const checked = await Promise.all(probes.map(async probe => {
      const started = performance.now()
      try {
        const response = await fetch(probe.path, { cache: 'no-store', headers: { accept: probe.path.endsWith('.xml') ? 'application/xml,text/xml,*/*' : 'application/json,*/*' } })
        const latency = Math.round(performance.now() - started)
        const contentType = response.headers.get('content-type') ?? ''
        const expected = probe.path.endsWith('.xml') ? contentType.includes('xml') : (contentType.includes('json') || probe.path === '/health')
        return {
          ...probe,
          status: response.ok && expected ? (latency > 2500 ? 'warning' : 'healthy') : 'failed',
          code: response.status,
          latency,
          detail: !expected ? `Unexpected content type: ${contentType || 'unknown'}` : latency > 2500 ? 'Slow response' : undefined,
        } as Probe
      } catch (error) {
        return { ...probe, status: 'failed', detail: error instanceof Error ? error.message : 'Request failed' } as Probe
      }
    }))
    setRouteProbes(checked)
  }, [])

  const load = useCallback(async () => {
    setState(previous => ({ ...previous, loading: true, error: '' }))
    try {
      const [report, duplicates, history] = await Promise.all([
        adminJson<HealthReport>('/admin/quality/health?store=true'),
        adminJson<DuplicateReport>('/admin/quality/duplicates'),
        adminJson<Snapshot[]>('/admin/quality/health/history'),
      ])
      setState({ report, duplicates, history, error: '', loading: false })
    } catch (error) {
      setState(previous => ({ ...previous, loading: false, error: error instanceof Error ? error.message : 'Health checks failed' }))
    }
    await runPublicProbes()
  }, [runPublicProbes])

  useEffect(() => { void load() }, [load])

  const counts = state.report?.counts ?? {}
  const issueTotal = useMemo(() => Object.values(counts).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0), [counts])
  const failedRoutes = routeProbes.filter(probe => probe.status === 'failed').length
  const warningRoutes = routeProbes.filter(probe => probe.status === 'warning').length
  const healthyRoutes = routeProbes.filter(probe => probe.status === 'healthy').length
  const duplicateCount = (state.duplicates?.duplicateClubs?.length ?? 0) + (state.duplicates?.duplicateLeagues?.length ?? 0) + (state.duplicates?.duplicateLeagueSources?.length ?? 0)

  return <main className="health-page">
    <style>{styles}</style>
    <header className="health-topbar">
      <Link to="/admin"><ArrowLeft size={18}/>Control Centre</Link>
      <button type="button" onClick={() => void load()} disabled={state.loading}><RefreshCw size={17} className={state.loading ? 'spin' : ''}/>{state.loading ? 'Running checks' : 'Run checks'}</button>
    </header>

    <section className="health-hero">
      <span>PRODUCTION HARDENING</span>
      <h1>System Health</h1>
      <p>Live route checks and read-only database integrity checks for the systems currently powering PlayFooty.</p>
    </section>

    {state.error && <div className="health-error"><XCircle size={20}/><div><strong>Health report unavailable</strong><span>{state.error}</span></div></div>}

    <section className="health-summary">
      <Summary label="Healthy routes" value={healthyRoutes} icon={<CheckCircle2/>} state="good" />
      <Summary label="Route warnings" value={warningRoutes} icon={<AlertTriangle/>} state={warningRoutes ? 'warn' : 'good'} />
      <Summary label="Failed routes" value={failedRoutes} icon={<XCircle/>} state={failedRoutes ? 'bad' : 'good'} />
      <Summary label="Data issues" value={issueTotal} icon={<Database/>} state={issueTotal ? 'warn' : 'good'} />
      <Summary label="Duplicate risks" value={duplicateCount} icon={<ShieldCheck/>} state={duplicateCount ? 'warn' : 'good'} />
    </section>

    <section className="health-grid">
      <article className="health-card routes-card">
        <div className="health-card-title"><div><Server/><span><strong>Live production routes</strong><small>Real requests from the deployed admin session</small></span></div><span>{healthyRoutes}/{routeProbes.length} healthy</span></div>
        <div className="probe-list">{routeProbes.map(probe => <div className="probe" key={probe.path}>
          <StatusIcon status={probe.status}/>
          <div><strong>{probe.label}</strong><small>{probe.path}{probe.detail ? ` · ${probe.detail}` : ''}</small></div>
          <span>{probe.status === 'checking' ? 'Checking' : `${probe.code ?? '—'}${probe.latency != null ? ` · ${probe.latency}ms` : ''}`}</span>
          <a href={probe.path} target="_blank" rel="noreferrer" aria-label={`Open ${probe.label}`}><ExternalLink size={15}/></a>
        </div>)}</div>
      </article>

      <article className="health-card">
        <div className="health-card-title"><div><Database/><span><strong>Database integrity</strong><small>Current unresolved issue counts</small></span></div><span>{state.report ? new Date(state.report.generatedAt).toLocaleString('en-AU') : 'Loading'}</span></div>
        <div className="count-list">{Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, value]) => <div key={key}><span>{labelOf(key)}</span><strong className={value > 0 ? 'issue' : ''}>{value}</strong></div>)}</div>
        {!state.loading && Object.keys(counts).length === 0 && !state.error && <div className="health-empty">No health counters were returned.</div>}
      </article>
    </section>

    <section className="health-grid">
      <article className="health-card">
        <div className="health-card-title"><div><Search/><span><strong>Issue samples</strong><small>Up to ten affected records per category</small></span></div></div>
        <div className="sample-groups">{Object.entries(state.report?.samples ?? {}).filter(([, rows]) => rows.length > 0).map(([key, rows]) => <section key={key}><h2>{labelOf(key)}</h2>{rows.map(row => <Link key={`${key}-${row.id}`} to={entityPath(key, row.id)}><span>{row.name}</span><small>{row.id}</small></Link>)}</section>)}</div>
        {!state.loading && Object.values(state.report?.samples ?? {}).every(rows => rows.length === 0) && <div className="health-empty">No sampled data issues.</div>}
      </article>

      <article className="health-card">
        <div className="health-card-title"><div><ShieldCheck/><span><strong>Health history</strong><small>Latest stored integrity snapshots</small></span></div><span>{state.history.length} snapshots</span></div>
        <div className="history-list">{state.history.slice(0, 12).map(snapshot => {
          let total = 0
          try { total = Object.values(JSON.parse(snapshot.counts) as Record<string, number>).reduce((sum, value) => sum + value, 0) } catch { total = 0 }
          return <div key={snapshot.id}><span>{new Date(snapshot.createdAt).toLocaleString('en-AU')}</span><strong>{total} issues</strong></div>
        })}</div>
        {!state.loading && state.history.length === 0 && <div className="health-empty">No stored health history yet. Running this page stores the first snapshot.</div>}
      </article>
    </section>
  </main>
}

function Summary({ label, value, icon, state }: { label: string; value: number; icon: React.ReactNode; state: 'good' | 'warn' | 'bad' }) {
  return <article className={`health-stat ${state}`}>{icon}<span>{label}</span><strong>{value}</strong></article>
}

function StatusIcon({ status }: { status: Probe['status'] }) {
  if (status === 'healthy') return <CheckCircle2 className="status-good" size={20}/>
  if (status === 'warning') return <AlertTriangle className="status-warn" size={20}/>
  if (status === 'failed') return <XCircle className="status-bad" size={20}/>
  return <RefreshCw className="spin status-pending" size={20}/>
}

function labelOf(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, character => character.toUpperCase())
}

function entityPath(group: string, id: string) {
  if (/league|sync|confidence|eligibility/i.test(group)) return `/league/${id}`
  return `/team/${id}`
}

const styles = `
.health-page{min-height:100vh;background:#eef2f6;color:#111318;font-family:Barlow,Inter,Arial,sans-serif;padding-bottom:60px}.health-topbar{position:sticky;top:0;z-index:20;height:70px;padding:0 clamp(14px,4vw,38px);display:flex;align-items:center;justify-content:space-between;background:#fff;border-bottom:1px solid ${LINE}}.health-topbar a,.health-topbar button{display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:11px 16px;text-decoration:none;font-weight:900;text-transform:uppercase}.health-topbar a{color:#111318;background:#eef2f6}.health-topbar button{background:${BLUE};color:${BLACK};cursor:pointer}.health-topbar button:disabled{opacity:.65}.health-hero{max-width:1400px;margin:24px auto 0;padding:clamp(28px,6vw,58px);border-radius:24px;background:${BLACK};color:#fff}.health-hero>span{color:${BLUE};font-size:11px;font-weight:950;letter-spacing:.17em}.health-hero h1{margin:10px 0 12px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4.4rem,10vw,8rem);line-height:.82;text-transform:uppercase}.health-hero p{max-width:760px;margin:0;color:#c9d1db;font-size:17px;line-height:1.5}.health-error,.health-summary,.health-grid{max-width:1400px;margin:16px auto 0}.health-error{display:flex;gap:12px;padding:16px;border:1px solid #efb6b8;border-radius:16px;background:#fff1f1;color:#9d171d}.health-error strong,.health-error span{display:block}.health-error span{margin-top:3px;font-size:13px}.health-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.health-stat{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px;padding:17px;border:1px solid ${LINE};border-radius:17px;background:#fff}.health-stat svg{grid-row:1/3}.health-stat span{color:${MUTED};font-size:10px;font-weight:950;text-transform:uppercase}.health-stat strong{font-size:34px;line-height:1}.health-stat.good svg{color:#128a4a}.health-stat.warn svg{color:#b26a00}.health-stat.bad svg{color:#d71920}.health-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}.health-card{min-width:0;padding:20px;border:1px solid ${LINE};border-radius:20px;background:#fff}.health-card-title{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:15px;border-bottom:1px solid #edf1f5}.health-card-title>div{display:flex;gap:10px}.health-card-title svg{color:${BLUE}}.health-card-title strong,.health-card-title small{display:block}.health-card-title small,.health-card-title>span{margin-top:3px;color:${MUTED};font-size:11px}.probe-list,.count-list,.history-list{display:grid}.probe{display:grid;grid-template-columns:22px 1fr auto 28px;align-items:center;gap:10px;padding:13px 2px;border-bottom:1px solid #edf1f5}.probe strong,.probe small{display:block}.probe small{margin-top:3px;color:${MUTED};font-size:11px;word-break:break-word}.probe>span{font-size:11px;font-weight:900;color:${MUTED}}.probe a{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#edf7ff;color:#111318}.status-good{color:#128a4a!important}.status-warn{color:#b26a00!important}.status-bad{color:#d71920!important}.status-pending{color:${MUTED}!important}.count-list>div,.history-list>div{display:flex;justify-content:space-between;gap:14px;padding:12px 2px;border-bottom:1px solid #edf1f5}.count-list span,.history-list span{color:#4f5a68}.count-list strong.issue{color:#b26a00}.sample-groups{display:grid;gap:18px;margin-top:14px}.sample-groups h2{margin:0 0 8px;font-size:13px;text-transform:uppercase}.sample-groups section{display:grid;gap:7px}.sample-groups a{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #e5eaf0;border-radius:10px;color:#111318;text-decoration:none}.sample-groups a small{color:${MUTED};overflow:hidden;text-overflow:ellipsis}.health-empty{padding:30px 10px;text-align:center;color:${MUTED}}.spin{animation:health-spin .8s linear infinite}@keyframes health-spin{to{transform:rotate(360deg)}}
@media(max-width:1050px){.health-summary{grid-template-columns:repeat(3,1fr)}.health-grid{grid-template-columns:1fr}.health-hero,.health-error,.health-summary,.health-grid{margin-left:14px;margin-right:14px}}
@media(max-width:620px){.health-summary{grid-template-columns:1fr 1fr}.health-stat:last-child{grid-column:1/-1}.health-hero{padding:32px 22px}.health-hero h1{font-size:4.6rem}.health-card{padding:15px}.probe{grid-template-columns:22px 1fr auto}.probe>a{display:none}.probe>span{font-size:10px}.health-card-title{display:grid}.health-topbar{height:64px}.health-topbar a,.health-topbar button{padding:10px 12px;font-size:11px}}
`
