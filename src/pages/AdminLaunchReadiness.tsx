import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, RefreshCw, Rocket, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getKey } from '../lib/admin'
import { loadAdminOperationsState, saveAdminOperationsState } from '../lib/adminOperationsState'

type Check = { id: string; label: string; detail: string; path?: string; automatic?: boolean }
type ProbeState = Record<string, 'checking' | 'pass' | 'fail'>

const checks: Check[] = [
  { id: 'health', label: 'Public API health responds', detail: 'Production health endpoint is reachable.', path: '/health', automatic: true },
  { id: 'rankings', label: 'National rankings load', detail: 'Current completed ranking run is publicly available.', path: '/api/rankings', automatic: true },
  { id: 'search', label: 'Unified search responds', detail: 'Cross-platform search returns a valid response.', path: '/api/search?q=football', automatic: true },
  { id: 'sitemap', label: 'Dynamic sitemap loads', detail: 'Search engines can retrieve the current sitemap.', path: '/sitemap.xml', automatic: true },
  { id: 'legal', label: 'Legal and support pages are published', detail: 'Privacy, terms, disclaimer, guidelines and support routes are reachable.', path: '/privacy', automatic: true },
  { id: 'backup', label: 'Database backup and restore process reviewed', detail: 'Confirm the latest backup, retention period and a documented restore procedure.' },
  { id: 'secrets', label: 'Production secrets reviewed', detail: 'Confirm required credentials exist, are scoped correctly and are not stored in source control.' },
  { id: 'analytics', label: 'Analytics and error monitoring reviewed', detail: 'Confirm production traffic and errors can be observed without collecting unnecessary personal information.' },
  { id: 'support', label: 'Support inbox is monitored', detail: 'Confirm hello@playfooty.com.au can receive requests and has an owner.' },
  { id: 'imports', label: 'Admin import runbook reviewed', detail: 'Confirm OCR approval, undo, correction and failed-import recovery steps are understood.' },
  { id: 'content', label: 'Publishing and moderation owners confirmed', detail: 'Confirm responsibility for news, highlights, corrections and urgent safety issues.' },
  { id: 'mobile', label: 'Final mobile spot-check completed', detail: 'Review home, rankings, club, league, player, match, news, highlights, search and admin on a real phone.' },
]

const STORAGE = 'playfooty_launch_readiness_v1'
const STATE_KEY = 'launch-readiness'

export default function AdminLaunchReadiness() {
  const [manual, setManual] = useState<Record<string, boolean>>({})
  const [manualReady, setManualReady] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [probes, setProbes] = useState<ProbeState>({})
  const [running, setRunning] = useState(false)
  const authed = Boolean(getKey())

  useEffect(() => {
    document.title = 'Launch Readiness | PlayFooty Control Centre'
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.head.appendChild(document.createElement('meta'))
    robots.name = 'robots'; const previous = robots.content; robots.content = 'noindex,nofollow'
    return () => { robots.content = previous }
  }, [])

  useEffect(() => {
    if (!authed) return
    let active = true
    loadAdminOperationsState<Record<string, boolean>>(STATE_KEY).then(async row => {
      let next = row.value && typeof row.value === 'object' ? row.value : null
      if (!next) {
        try { next = JSON.parse(localStorage.getItem(STORAGE) ?? '{}') as Record<string, boolean> } catch { next = {} }
        if (Object.keys(next).length) await saveAdminOperationsState(STATE_KEY, next)
      }
      if (active) {
        setManual(next || {})
        setManualReady(true)
        localStorage.removeItem(STORAGE)
      }
    }).catch(error => {
      if (active) {
        setSaveError(error instanceof Error ? error.message : 'Unable to load shared launch checklist')
        setManualReady(true)
      }
    })
    return () => { active = false }
  }, [authed])

  const run = async () => {
    setRunning(true)
    const automated = checks.filter(check => check.automatic && check.path)
    setProbes(Object.fromEntries(automated.map(check => [check.id, 'checking'])))
    const results = await Promise.all(automated.map(async check => {
      try {
        const response = await fetch(check.path!, { cache: 'no-store', headers: { accept: check.path!.endsWith('.xml') ? 'application/xml,text/xml,*/*' : '*/*' } })
        const contentType = response.headers.get('content-type') ?? ''
        const validType = check.path!.endsWith('.xml') ? contentType.includes('xml') : !contentType.includes('text/html') || check.id === 'legal'
        return [check.id, response.ok && validType ? 'pass' : 'fail'] as const
      } catch { return [check.id, 'fail'] as const }
    }))
    setProbes(Object.fromEntries(results)); setRunning(false)
  }

  useEffect(() => { void run() }, [])

  const toggle = (id: string) => {
    const next = { ...manual, [id]: !manual[id] }
    setManual(next)
    setSaveError('')
    void saveAdminOperationsState(STATE_KEY, next).catch(error => setSaveError(error instanceof Error ? error.message : 'Unable to save shared launch checklist'))
  }
  const complete = useMemo(() => checks.filter(check => check.automatic ? probes[check.id] === 'pass' : manual[check.id]).length, [manual, probes])
  const blocked = Object.values(probes).some(value => value === 'fail')

  if (!authed) return <main className="launch-login"><style>{styles}</style><section><ShieldCheck size={34}/><h1>Admin key required</h1><p>Open the Control Centre and enter the admin key before viewing launch operations.</p><Link to="/admin">Open Control Centre</Link></section></main>

  return <main className="launch-page"><style>{styles}</style>
    <header><Link to="/admin/health"><ArrowLeft size={17}/>System Health</Link><button onClick={() => void run()} disabled={running}><RefreshCw size={17} className={running ? 'spin' : ''}/>{running ? 'Checking' : 'Run automated checks'}</button></header>
    <section className="launch-hero"><span>OPERATIONS</span><h1>Launch Readiness</h1><p>Automated production verification plus the manual owner checks required before announcing PlayFooty publicly.</p></section>
    <section className="launch-summary"><article><Rocket/><span>Completed</span><strong>{complete}/{checks.length}</strong></article><article className={blocked ? 'blocked' : ''}><ShieldCheck/><span>Launch status</span><strong>{blocked ? 'Blocked' : complete === checks.length ? 'Ready' : 'In review'}</strong></article></section>
    {saveError&&<div className="launch-save-error">{saveError}</div>}
    <section className="launch-list">{checks.map(check => {
      const state = check.automatic ? probes[check.id] : manual[check.id] ? 'pass' : 'open'
      return <article key={check.id} className={state === 'fail' ? 'failed' : ''}>
        <button type="button" onClick={() => !check.automatic && toggle(check.id)} disabled={check.automatic || !manualReady} aria-label={`${check.label}: ${state}`}>
          {state === 'pass' ? <CheckCircle2/> : state === 'checking' ? <RefreshCw className="spin"/> : <Circle/>}
        </button>
        <div><strong>{check.label}</strong><p>{check.detail}</p><small>{check.automatic ? `Automated · ${state === 'checking' ? 'checking' : state === 'pass' ? 'passed' : state === 'fail' ? 'failed' : 'not run'}` : manualReady ? 'Manual owner confirmation · shared across administrators' : 'Loading shared confirmation…'}</small></div>
        {check.path && <a href={check.path} target="_blank" rel="noreferrer"><ExternalLink size={16}/></a>}
      </article>
    })}</section>
  </main>
}

const styles = `.launch-page,.launch-login{min-height:100vh;background:#eef2f6;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.launch-page>header{position:sticky;top:0;z-index:10;height:70px;padding:0 clamp(14px,4vw,38px);display:flex;align-items:center;justify-content:space-between;background:#fff;border-bottom:1px solid #dce3eb}.launch-page header a,.launch-page header button,.launch-login a{display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:11px 16px;text-decoration:none;font-weight:950;text-transform:uppercase}.launch-page header a{background:#eef2f6;color:#111318}.launch-page header button,.launch-login a{background:#35b6ff;color:#050505;cursor:pointer}.launch-hero,.launch-summary,.launch-list,.launch-save-error{width:min(1120px,calc(100% - 28px));margin:18px auto 0}.launch-hero{padding:clamp(32px,7vw,62px);border-radius:23px;background:#050505;color:#fff}.launch-hero>span{color:#35b6ff;font-size:11px;font-weight:950;letter-spacing:.17em}.launch-hero h1{margin:9px 0 12px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4rem,10vw,7.5rem);line-height:.82;text-transform:uppercase}.launch-hero p{max-width:760px;margin:0;color:#cbd3dd;font-size:17px;line-height:1.55}.launch-summary{display:grid;grid-template-columns:1fr 1fr;gap:13px}.launch-summary article{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px;padding:19px;border:1px solid #dce3eb;border-radius:17px;background:#fff}.launch-summary svg{grid-row:1/3;color:#128a4a}.launch-summary span{color:#687385;font-size:10px;font-weight:950;text-transform:uppercase}.launch-summary strong{font-size:30px}.launch-summary .blocked svg,.launch-summary .blocked strong{color:#d71920}.launch-save-error{padding:12px 14px;border:1px solid #e7a8ab;border-radius:12px;background:#fff2f2;color:#b31219;font-weight:850}.launch-list{display:grid;gap:10px;padding-bottom:60px}.launch-list article{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;padding:17px;border:1px solid #dce3eb;border-radius:16px;background:#fff}.launch-list article.failed{border-color:#e8aeb1;background:#fff6f6}.launch-list article>button{display:grid;place-items:center;width:42px;height:42px;border:0;border-radius:50%;background:#eef8ff;color:#0783c9;cursor:pointer}.launch-list article>button:disabled{cursor:default}.launch-list article>div strong{font-size:17px}.launch-list article p{margin:4px 0;color:#586370;line-height:1.45}.launch-list article small{color:#84909e;font-weight:800}.launch-list article>a{color:#0783c9}.launch-login{display:grid;place-items:center;padding:20px}.launch-login section{width:min(480px,100%);padding:34px;border-radius:20px;background:#050505;color:#fff;text-align:center}.launch-login h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:3.2rem;text-transform:uppercase}.launch-login p{color:#cbd3dd;line-height:1.5}.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:650px){.launch-summary{grid-template-columns:1fr}.launch-list article{grid-template-columns:auto 1fr}.launch-list article>a{grid-column:2}.launch-page>header{gap:8px}.launch-page header a,.launch-page header button{padding:9px 11px;font-size:11px}}`
