import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Save, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getKey } from '../lib/admin'

type LeagueRow = {
  id: string
  name: string
  shortName?: string | null
  state: string
  strength: number
  automaticStrength: number
  strengthScore: number
  strengthTier: number
  strengthConfidence: number
  needsStrengthReview: boolean
}

export default function AdminLeagueStrengths() {
  const [rows, setRows] = useState<LeagueRow[]>([])
  const [original, setOriginal] = useState<Record<string, number>>({})
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const request = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { ...(options.headers ?? {}), authorization: `Bearer ${getKey()}` },
    })
    const payload = await response.json().catch(() => ({})) as any
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
    return payload
  }

  const load = async () => {
    setLoading(true); setError('')
    try {
      const payload = await request('/admin/league-strengths')
      const data = Array.isArray(payload.data) ? payload.data as LeagueRow[] : []
      setRows(data)
      setOriginal(Object.fromEntries(data.map(row => [row.id, row.strength])))
    } catch (reason) {
      setError(readError(reason))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return rows
    return rows.filter(row => `${row.name} ${row.shortName ?? ''} ${row.state}`.toLowerCase().includes(text))
  }, [query, rows])

  const changed = rows.filter(row => original[row.id] !== row.strength)

  const setStrength = (id: string, value: string) => {
    const number = Number(value)
    setRows(current => current.map(row => row.id === id ? { ...row, strength: Number.isFinite(number) ? number : row.strength } : row))
  }

  const publish = async () => {
    const invalid = rows.find(row => !Number.isFinite(row.strength) || row.strength < 1 || row.strength > 5)
    if (invalid) return setError(`${invalid.name} must have a strength from 1 to 5.`)
    if (!changed.length) return setMessage('No league strengths have changed.')
    if (!window.confirm(`Publish ${changed.length} league strength change${changed.length === 1 ? '' : 's'} and recalculate the national rankings now?`)) return

    setSaving(true); setError(''); setMessage('')
    try {
      const payload = await request('/admin/league-strengths/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates: changed.map(row => ({ leagueId: row.id, strength: row.strength })) }),
      })
      setOriginal(Object.fromEntries(rows.map(row => [row.id, row.strength])))
      setMessage(payload.message || 'League strengths published successfully.')
      await load()
    } catch (reason) {
      setError(readError(reason))
    } finally {
      setSaving(false)
    }
  }

  return <main className="ls-page"><div className="ls-shell">
    <header className="ls-hero">
      <Link to="/admin"><ArrowLeft size={16} /> Admin</Link>
      <span>Ranking controls</span>
      <h1>League Strengths</h1>
      <p>Edit every active football league from one page. Publish once to save the changes and recalculate national rankings.</p>
    </header>

    {error && <div className="ls-alert error">{error}</div>}
    {message && <div className="ls-alert success">{message}</div>}

    <section className="ls-toolbar">
      <label><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search leagues or states" /></label>
      <div><strong>{rows.length}</strong><span>active football leagues</span></div>
      <div><strong>{changed.length}</strong><span>changes ready</span></div>
    </section>

    <section className="ls-card">
      {loading ? <div className="ls-state">Loading league strengths…</div> : <>
        <div className="ls-head"><span>League</span><span>State</span><span>Automatic</span><span>Strength 1–5</span><span>Status</span></div>
        <div className="ls-list">
          {filtered.map(row => {
            const dirty = original[row.id] !== row.strength
            return <div className={`ls-row${dirty ? ' dirty' : ''}`} key={row.id}>
              <div><strong>{row.name}</strong>{row.shortName && <small>{row.shortName}</small>}</div>
              <b>{row.state}</b>
              <span>{row.automaticStrength.toFixed(1)}</span>
              <label className="strength-input"><input type="number" min="1" max="5" step="0.1" value={row.strength} onChange={event => setStrength(row.id, event.target.value)} /><small>/ 5</small></label>
              <em>{dirty ? 'Changed' : row.needsStrengthReview ? 'Needs review' : 'Current'}</em>
            </div>
          })}
          {!filtered.length && <div className="ls-state">No leagues match your search.</div>}
        </div>
      </>}
    </section>

    <div className="ls-publish"><div><strong>{changed.length} change{changed.length === 1 ? '' : 's'} ready</strong><span>Publishing also runs the existing national rankings recalculation.</span></div><button disabled={saving || loading || changed.length === 0} onClick={() => void publish()}><Save size={17} />{saving ? 'Publishing and recalculating…' : 'Publish all changes'}</button></div>
  </div><style>{styles}</style></main>
}

const readError = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)
const styles = `.ls-page{min-height:100vh;background:#eef3f7;padding:22px;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.ls-shell{max-width:1180px;margin:auto}.ls-hero{background:#050505;color:#fff;padding:28px;border-radius:18px}.ls-hero>a{display:inline-flex;align-items:center;gap:6px;color:#42b8ff;text-decoration:none;font-weight:900}.ls-hero>span{display:block;margin-top:18px;color:#42b8ff;text-transform:uppercase;font-size:10px;font-weight:950;letter-spacing:.16em}.ls-hero h1{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:64px;line-height:.9;margin:7px 0}.ls-hero p{margin:0;color:#c9d1db}.ls-alert{padding:13px 15px;border-radius:10px;margin-top:12px;font-weight:850}.ls-alert.error{background:#fff0f0;color:#b42318;border:1px solid #ffc9c9}.ls-alert.success{background:#eafbf1;color:#087443;border:1px solid #b7ebcd}.ls-toolbar{display:grid;grid-template-columns:minmax(260px,1fr) auto auto;gap:12px;margin-top:14px}.ls-toolbar>label,.ls-toolbar>div{background:#fff;border:1px solid #dce3e9;border-radius:12px;padding:12px 14px}.ls-toolbar>label{display:flex;align-items:center;gap:8px}.ls-toolbar input{border:0;outline:0;width:100%;font:inherit}.ls-toolbar>div{min-width:145px}.ls-toolbar strong,.ls-toolbar span{display:block}.ls-toolbar strong{font-size:20px}.ls-toolbar span{font-size:10px;text-transform:uppercase;color:#687385;font-weight:900}.ls-card{background:#fff;border:1px solid #dce3e9;border-radius:14px;margin-top:14px;overflow:hidden}.ls-head,.ls-row{display:grid;grid-template-columns:minmax(260px,1.7fr) 80px 110px 150px 120px;gap:12px;align-items:center}.ls-head{padding:11px 16px;background:#071018;color:#fff;text-transform:uppercase;font-size:10px;font-weight:950;letter-spacing:.08em}.ls-row{padding:12px 16px;border-top:1px solid #edf0f3}.ls-row:first-child{border-top:0}.ls-row.dirty{background:#f3fbff}.ls-row strong,.ls-row small{display:block}.ls-row small{color:#687385;margin-top:3px}.ls-row>b{font-size:12px}.ls-row>span{font-weight:850;color:#687385}.strength-input{display:flex;align-items:center;gap:6px}.strength-input input{width:88px;border:1px solid #bfcbd5;border-radius:8px;padding:10px;font:inherit;font-weight:950}.strength-input small{margin:0}.ls-row em{font-style:normal;font-size:10px;text-transform:uppercase;font-weight:950;color:#687385}.ls-row.dirty em{color:#168fd2}.ls-state{padding:34px;text-align:center;color:#687385;font-weight:850}.ls-publish{position:sticky;bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:20px;background:#050505;color:#fff;border-radius:14px;padding:15px 17px;margin-top:14px;box-shadow:0 12px 30px rgba(0,0,0,.2)}.ls-publish strong,.ls-publish span{display:block}.ls-publish span{color:#aeb9c4;font-size:12px;margin-top:3px}.ls-publish button{border:0;border-radius:9px;background:#42b8ff;color:#050505;padding:13px 18px;font-weight:950;display:flex;align-items:center;gap:8px;cursor:pointer}.ls-publish button:disabled{opacity:.5;cursor:not-allowed}@media(max-width:760px){.ls-page{padding:10px}.ls-hero h1{font-size:48px}.ls-toolbar{grid-template-columns:1fr 1fr}.ls-toolbar>label{grid-column:1/-1}.ls-head{display:none}.ls-row{grid-template-columns:1fr 70px;gap:9px}.ls-row>div{grid-column:1/-1}.ls-row>span{display:none}.strength-input{justify-self:end}.ls-publish{align-items:stretch;flex-direction:column}.ls-publish button{justify-content:center;width:100%}}`
