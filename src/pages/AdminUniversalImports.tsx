import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft, History, RefreshCw, UploadCloud } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { getKey, setKey } from '../lib/admin'
import { saveImportHandoff, type ImportHandoffKind } from '../lib/importHandoff'

type Kind = ImportHandoffKind | 'unknown'
type Item = {
  id: string
  file: File
  url: string
  status: 'ready' | 'classifying' | 'classified' | 'failed'
  kind: Kind
  confidence: number
  reason: string
  error?: string
}
type HistoryRow = {
  id: string
  kind: string
  status: string
  title: string
  detail: string
  confidence: number | null
  createdAt: string
  committedAt: string | null
  revert: string
}

const input: CSSProperties = {
  width: '100%',
  padding: '12px 13px',
  border: '1px solid #dce3eb',
  borderRadius: 12,
  font: 'inherit',
  boxSizing: 'border-box',
  background: '#fff',
}

const button = (dark = false): CSSProperties => ({
  border: 0,
  borderRadius: 999,
  minHeight: 46,
  padding: '11px 16px',
  background: dark ? '#050505' : '#42b8ff',
  color: dark ? '#fff' : '#050505',
  fontWeight: 900,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  justifyContent: 'center',
})

const routeFor = (kind: Kind) => kind === 'ladder' ? '/admin' :
  kind === 'results' || kind === 'fixtures' ? '/admin/match-images' :
  kind === 'goalKickers' ? '/admin/goal-kicker-images' :
  kind === 'club' || kind === 'league' || kind === 'players' ? '/admin/profile-images' : '/admin'

export default function AdminUniversalImports() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(!!getKey())
  const [key, setLocalKey] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const loadHistory = () => fetch('/admin/universal-imports/history', {
    headers: { authorization: `Bearer ${getKey()}` },
  }).then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then((response: { data: HistoryRow[] }) => setHistory(response.data))
    .catch(() => setHistory([]))

  useEffect(() => { if (authed) void loadHistory() }, [authed])
  useEffect(() => () => items.forEach(item => URL.revokeObjectURL(item.url)), [items])

  const add = (files: FileList) => setItems(previous => [
    ...previous,
    ...Array.from(files).filter(file => file.type.startsWith('image/')).map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      status: 'ready' as const,
      kind: 'unknown' as const,
      confidence: 0,
      reason: '',
    })),
  ])

  const classify = async () => {
    if (!items.length) return setMsg('Add at least one screenshot.')
    setBusy(true)
    for (const item of items.filter(value => value.status === 'ready' || value.status === 'failed')) {
      setItems(previous => previous.map(value => value.id === item.id ? { ...value, status: 'classifying', error: undefined } : value))
      try {
        const image = await dataUrl(item.file)
        const response = await fetch('/admin/universal-imports/classify', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${getKey()}` },
          body: JSON.stringify({ image }),
        })
        const payload = await response.json() as { data?: { kind: Kind; confidence: number; reason: string }; error?: string }
        if (!response.ok || !payload.data) throw new Error(payload.error ?? `HTTP ${response.status}`)
        setItems(previous => previous.map(value => value.id === item.id ? {
          ...value,
          status: 'classified',
          kind: payload.data!.kind,
          confidence: payload.data!.confidence,
          reason: payload.data!.reason,
        } : value))
      } catch (error) {
        setItems(previous => previous.map(value => value.id === item.id ? {
          ...value,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        } : value))
      }
    }
    setBusy(false)
    setMsg('Classification complete. Review the detected type, then open the protected importer. Nothing has been committed.')
  }

  const openImporter = async (item: Item) => {
    if (item.kind === 'unknown') return
    try {
      const image = await dataUrl(item.file)
      saveImportHandoff({
        kind: item.kind,
        name: item.file.name,
        type: item.file.type,
        dataUrl: image,
        createdAt: Date.now(),
      })
      navigate(`${routeFor(item.kind)}?from=universal&type=${encodeURIComponent(item.kind)}`)
    } catch (error) {
      setMsg(error instanceof Error ? error.message : String(error))
    }
  }

  const counts = useMemo(() => items.reduce<Record<string, number>>((result, item) => {
    result[item.kind] = (result[item.kind] ?? 0) + 1
    return result
  }, {}), [items])

  if (!authed) return <div className="universal-login-shell">
    <div className="universal-login-card">
      <h1>Universal imports</h1>
      <input style={input} type="password" value={key} onChange={event => setLocalKey(event.target.value)} />
      <button style={{ ...button(), width: '100%', marginTop: 12 }} onClick={() => { if (key.trim()) { setKey(key.trim()); setAuthed(true) } }}>Open</button>
    </div>
    <ResponsiveStyles />
  </div>

  return <main className="universal-page">
    <div className="universal-shell">
      <header className="universal-hero">
        <Link to="/admin" className="universal-back"><ArrowLeft size={18} />Back to Control Centre</Link>
        <h1>Universal image imports</h1>
        <p>Upload a mixed batch, classify it automatically, then carry each screenshot into its protected review-and-approval workflow.</p>
      </header>

      <label className="universal-dropzone">
        <div className="universal-dropzone-content">
          <UploadCloud size={46} />
          <h2>Choose mixed screenshots</h2>
          <p>Select one image or a full batch.</p>
          <span className="universal-select-button">Select images</span>
        </div>
        <input hidden type="file" accept="image/*" multiple onChange={event => { if (event.target.files) add(event.target.files); event.currentTarget.value = '' }} />
      </label>

      {items.length > 0 && <>
        <div className="universal-counts">{Object.entries(counts).map(([kind, count]) => <span key={kind}>{kind}: {count}</span>)}</div>

        <section className="universal-item-grid">
          {items.map(item => <article key={item.id} className="universal-item-card">
            <img src={item.url} alt="Import screenshot" />
            <div className="universal-item-body">
              <strong>{item.file.name}</strong>
              <select style={input} value={item.kind} onChange={event => setItems(previous => previous.map(value => value.id === item.id ? { ...value, kind: event.target.value as Kind, status: 'classified' } : value))}>
                {['unknown', 'ladder', 'results', 'fixtures', 'goalKickers', 'club', 'league', 'players'].map(kind => <option key={kind} value={kind}>{kind}</option>)}
              </select>
              <small>{item.status}{item.status === 'classified' ? ` · ${Math.round(item.confidence * 100)}% · ${item.reason}` : ''}{item.error ? ` · ${item.error}` : ''}</small>
              <div className="universal-item-actions">
                <button style={button(true)} disabled={busy} onClick={() => setItems(previous => previous.map(value => value.id === item.id ? { ...value, status: 'ready', error: undefined } : value))}><RefreshCw size={14} />Retry</button>
                <button style={button()} disabled={item.kind === 'unknown'} onClick={() => void openImporter(item)}>Open importer</button>
              </div>
            </div>
          </article>)}
        </section>

        <button className="universal-classify-button" disabled={busy} onClick={() => void classify()}>{busy ? 'Classifying…' : 'Automatically classify batch'}</button>
      </>}

      {msg && <div className="universal-message">{msg}</div>}

      <section className="universal-history">
        <header className="universal-history-head">
          <div>
            <h2><History size={22} />Import history</h2>
            <p>Committed imports and OCR previews, with audit-safe correction guidance.</p>
          </div>
          <button style={button(true)} onClick={() => void loadHistory()}><RefreshCw size={14} />Refresh</button>
        </header>

        <div className="universal-history-desktop">
          <table>
            <thead><tr>{['When', 'Type', 'Status', 'Import', 'Details', 'Confidence', 'Correction / revert path'].map(heading => <th key={heading}>{heading}</th>)}</tr></thead>
            <tbody>{history.map(row => <tr key={`${row.kind}-${row.id}`}>
              <td>{new Date(row.createdAt).toLocaleString('en-AU')}</td><td>{row.kind}</td><td>{row.status}</td><td>{row.title}</td><td>{row.detail}</td><td>{row.confidence == null ? '—' : `${Math.round(row.confidence * 100)}%`}</td><td>{row.revert}</td>
            </tr>)}</tbody>
          </table>
        </div>

        <div className="universal-history-mobile">
          {history.length ? history.map(row => <article key={`${row.kind}-${row.id}`} className="universal-history-card">
            <div className="universal-history-card-top">
              <strong>{row.title}</strong>
              <span>{row.status}</span>
            </div>
            <dl>
              <div><dt>Type</dt><dd>{row.kind}</dd></div>
              <div><dt>When</dt><dd>{new Date(row.createdAt).toLocaleString('en-AU')}</dd></div>
              <div><dt>Confidence</dt><dd>{row.confidence == null ? '—' : `${Math.round(row.confidence * 100)}%`}</dd></div>
            </dl>
            <p>{row.detail}</p>
            <small>{row.revert}</small>
          </article>) : <div className="universal-history-empty">No imports recorded yet.</div>}
        </div>
      </section>
    </div>
    <ResponsiveStyles />
  </main>
}

function ResponsiveStyles() {
  return <style>{`
    *{box-sizing:border-box}.universal-page{min-height:100vh;background:#eef2f6;padding:24px;font-family:Inter,system-ui,sans-serif;overflow-x:hidden}.universal-shell{width:100%;max-width:1400px;margin:0 auto;display:grid;gap:18px}.universal-hero{background:#050505;color:#fff;border-radius:20px;padding:28px;overflow:hidden}.universal-back{color:#42b8ff;text-decoration:none;display:inline-flex;gap:7px;align-items:center;font-weight:800}.universal-hero h1{font-size:clamp(42px,7vw,84px);line-height:.95;margin:18px 0 10px;text-transform:uppercase;overflow-wrap:anywhere}.universal-hero p{max-width:900px;margin:0;color:#e6e9ee;font-size:18px;line-height:1.5}.universal-dropzone{min-height:190px;border:2px dashed #92cfee;border-radius:18px;background:#f7fcff;display:grid;place-items:center;text-align:center;padding:24px;cursor:pointer}.universal-dropzone-content{display:grid;justify-items:center;gap:8px;max-width:420px}.universal-dropzone h2{margin:4px 0 0}.universal-dropzone p{margin:0;color:#687385}.universal-select-button{border-radius:999px;min-height:48px;padding:12px 22px;background:#42b8ff;color:#050505;font-weight:900;display:inline-flex;align-items:center;justify-content:center}.universal-counts{display:flex;gap:8px;flex-wrap:wrap}.universal-counts span{background:#fff;padding:8px 12px;border-radius:999px;border:1px solid #dce3eb;font-weight:800}.universal-item-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.universal-item-card{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #dce3eb;min-width:0}.universal-item-card>img{width:100%;height:165px;object-fit:cover;display:block}.universal-item-body{padding:14px;display:grid;gap:10px;min-width:0}.universal-item-body strong{overflow-wrap:anywhere}.universal-item-body small{color:#687385;line-height:1.4}.universal-item-actions{display:flex;gap:8px}.universal-item-actions button{flex:1}.universal-classify-button{border:0;border-radius:999px;min-height:50px;padding:12px 18px;background:#42b8ff;color:#050505;font-weight:900;cursor:pointer;width:max-content}.universal-message{background:#fff8dc;padding:14px;border-radius:12px;line-height:1.45}.universal-history{background:#fff;border-radius:18px;padding:18px;min-width:0}.universal-history-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.universal-history-head h2{margin:0;display:flex;align-items:center;gap:8px}.universal-history-head p{margin:8px 0 0;color:#687385}.universal-history-desktop{overflow:auto;margin-top:12px}.universal-history-desktop table{width:100%;border-collapse:collapse;min-width:900px}.universal-history-desktop th,.universal-history-desktop td{padding:10px;text-align:left;border-bottom:1px solid #eef2f6;vertical-align:top}.universal-history-mobile{display:none}.universal-login-shell{min-height:100vh;display:grid;place-items:center;background:#050505;padding:16px}.universal-login-card{background:#fff;padding:24px;border-radius:18px;width:min(92vw,420px)}
    @media(max-width:700px){.universal-page{padding:14px 12px 28px}.universal-shell{gap:14px}.universal-hero{border-radius:18px;padding:18px 16px}.universal-back{font-size:14px}.universal-hero h1{font-size:38px;line-height:.95;margin:18px 0 10px}.universal-hero p{font-size:15px;line-height:1.45}.universal-dropzone{min-height:210px;padding:20px 16px;border-radius:16px}.universal-dropzone-content{width:100%}.universal-select-button{width:100%;margin-top:6px}.universal-item-grid{grid-template-columns:1fr}.universal-item-card>img{height:190px}.universal-item-actions{display:grid;grid-template-columns:1fr 1fr}.universal-classify-button{width:100%}.universal-history{padding:16px;border-radius:16px}.universal-history-head{align-items:flex-start}.universal-history-head>button{min-width:46px;padding:11px}.universal-history-head>button svg{margin:0}.universal-history-desktop{display:none}.universal-history-mobile{display:grid;gap:10px;margin-top:16px}.universal-history-card{border:1px solid #dce3eb;border-radius:14px;padding:14px;display:grid;gap:12px}.universal-history-card-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.universal-history-card-top strong{overflow-wrap:anywhere}.universal-history-card-top span{background:#eef3f7;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:900;white-space:nowrap}.universal-history-card dl{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0}.universal-history-card dl div:last-child{grid-column:1/-1}.universal-history-card dt{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#687385;font-weight:900}.universal-history-card dd{margin:3px 0 0;font-size:13px}.universal-history-card p{margin:0;line-height:1.45}.universal-history-card small{color:#687385;line-height:1.4}.universal-history-empty{padding:20px 0;color:#687385;text-align:center}}
    @media(max-width:390px){.universal-hero h1{font-size:34px}.universal-item-actions{grid-template-columns:1fr}.universal-history-head p{font-size:13px}.universal-history-head>button{font-size:0}.universal-history-head>button svg{width:18px;height:18px}}
  `}</style>
}

function dataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
