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
  width: '100%', padding: '10px 11px', border: '1px solid #dce3eb',
  borderRadius: 10, font: 'inherit', boxSizing: 'border-box',
}
const button = (dark = false): CSSProperties => ({
  border: 0, borderRadius: 999, padding: '11px 16px',
  background: dark ? '#050505' : '#42b8ff', color: dark ? '#fff' : '#050505',
  fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
  gap: 7, justifyContent: 'center',
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

  if (!authed) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#050505' }}>
    <div style={{ background: '#fff', padding: 24, borderRadius: 18, width: 'min(92vw,420px)' }}>
      <h1>Universal imports</h1>
      <input style={input} type="password" value={key} onChange={event => setLocalKey(event.target.value)} />
      <button style={{ ...button(), width: '100%', marginTop: 12 }} onClick={() => { if (key.trim()) { setKey(key.trim()); setAuthed(true) } }}>Open</button>
    </div>
  </div>

  return <main style={{ minHeight: '100vh', background: '#eef2f6', padding: 24, fontFamily: 'Inter,system-ui,sans-serif' }}>
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'grid', gap: 18 }}>
      <header style={{ background: '#050505', color: '#fff', borderRadius: 20, padding: 28 }}>
        <Link to="/admin" style={{ color: '#42b8ff', textDecoration: 'none', display: 'inline-flex', gap: 7, alignItems: 'center' }}><ArrowLeft size={16} />Back to Control Centre</Link>
        <h1 style={{ fontSize: 'clamp(42px,7vw,84px)', margin: '12px 0 6px', textTransform: 'uppercase' }}>Universal image imports</h1>
        <p>Upload a mixed batch, classify it automatically, then carry each screenshot into its protected review-and-approval workflow.</p>
      </header>

      <label style={{ minHeight: 190, border: '2px dashed #92cfee', borderRadius: 18, background: '#f7fcff', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24, cursor: 'pointer' }}>
        <div><UploadCloud size={44} /><h2>Choose mixed screenshots</h2><span style={button()}>Select images</span></div>
        <input hidden type="file" accept="image/*" multiple onChange={event => { if (event.target.files) add(event.target.files); event.currentTarget.value = '' }} />
      </label>

      {items.length > 0 && <>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{Object.entries(counts).map(([kind, count]) => <span key={kind} style={{ background: '#fff', padding: '8px 12px', borderRadius: 999, border: '1px solid #dce3eb' }}>{kind}: {count}</span>)}</div>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          {items.map(item => <article key={item.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #dce3eb' }}>
            <img src={item.url} alt="Import screenshot" style={{ width: '100%', height: 165, objectFit: 'cover' }} />
            <div style={{ padding: 14, display: 'grid', gap: 8 }}>
              <strong>{item.file.name}</strong>
              <select style={input} value={item.kind} onChange={event => setItems(previous => previous.map(value => value.id === item.id ? { ...value, kind: event.target.value as Kind, status: 'classified' } : value))}>
                {['unknown', 'ladder', 'results', 'fixtures', 'goalKickers', 'club', 'league', 'players'].map(kind => <option key={kind} value={kind}>{kind}</option>)}
              </select>
              <small>{item.status}{item.status === 'classified' ? ` · ${Math.round(item.confidence * 100)}% · ${item.reason}` : ''}{item.error ? ` · ${item.error}` : ''}</small>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={button(true)} disabled={busy} onClick={() => setItems(previous => previous.map(value => value.id === item.id ? { ...value, status: 'ready', error: undefined } : value))}><RefreshCw size={14} />Retry</button>
                <button style={button()} disabled={item.kind === 'unknown'} onClick={() => void openImporter(item)}>Open importer</button>
              </div>
            </div>
          </article>)}
        </section>
        <button style={button()} disabled={busy} onClick={() => void classify()}>{busy ? 'Classifying…' : 'Automatically classify batch'}</button>
      </>}

      {msg && <div style={{ background: '#fff8dc', padding: 14, borderRadius: 12 }}>{msg}</div>}

      <section style={{ background: '#fff', borderRadius: 18, padding: 18 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div><h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><History size={20} />Import history</h2><p>Committed imports and OCR previews, with audit-safe correction guidance.</p></div>
          <button style={button(true)} onClick={() => void loadHistory()}><RefreshCw size={14} />Refresh</button>
        </header>
        <div style={{ overflow: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead><tr>{['When', 'Type', 'Status', 'Import', 'Details', 'Confidence', 'Correction / revert path'].map(heading => <th key={heading} style={{ padding: 10, textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>{heading}</th>)}</tr></thead>
          <tbody>{history.map(row => <tr key={`${row.kind}-${row.id}`}>
            <td style={{ padding: 10, borderBottom: '1px solid #eef2f6' }}>{new Date(row.createdAt).toLocaleString('en-AU')}</td><td>{row.kind}</td><td>{row.status}</td><td>{row.title}</td><td>{row.detail}</td><td>{row.confidence == null ? '—' : `${Math.round(row.confidence * 100)}%`}</td><td>{row.revert}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
    </div>
  </main>
}

function dataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
