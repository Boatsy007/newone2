import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft, CheckCircle2, ImagePlus, Trash2, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { admin, getKey, setKey, type AdminClub, type FootballLeague } from '../lib/admin'
import { matchImageImports, type MatchImageKind, type MatchImagePreview, type MatchImageRow } from '../lib/matchImageImports'
import { consumeImportHandoff, handoffToFile } from '../lib/importHandoff'

type Item = {
  id: string
  file: File
  url: string
  kind: MatchImageKind
  status: 'ready' | 'analysing' | 'review' | 'committing' | 'failed' | 'committed'
  preview?: MatchImagePreview
  error?: string
}

type ReviewRow = MatchImageRow & {
  decision: 'import' | 'skip'
  homeClubId: string
  awayClubId: string
}

const BLUE = '#42b8ff'
const INK = '#0c0e13'
const LINE = '#dce3eb'
const MUTED = '#687385'
const input: CSSProperties = {
  width: '100%', padding: '10px 11px', border: `1px solid ${LINE}`, borderRadius: 10,
  font: 'inherit', boxSizing: 'border-box', minWidth: 0, background: '#fff',
}

export default function AdminMatchImageImports() {
  const [authed, setAuthed] = useState(Boolean(getKey()))
  const [key, setLocalKey] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [leagues, setLeagues] = useState<FootballLeague[]>([])
  const [clubs, setClubs] = useState<AdminClub[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState('2026')
  const [grade, setGrade] = useState('Senior Football')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authed) return
    void admin.listFootballLeagues().then(setLeagues).catch(cause => setError(readError(cause)))
  }, [authed])

  useEffect(() => {
    if (!authed) return
    void admin.listClubs(leagueId || undefined).then(setClubs).catch(cause => setError(readError(cause)))
  }, [authed, leagueId])

  useEffect(() => {
    if (!authed) return
    const handoff = consumeImportHandoff(['results', 'fixtures'])
    if (!handoff) return
    const file = handoffToFile(handoff)
    const item: Item = {
      id: `handoff-${Date.now()}`,
      file,
      url: handoff.dataUrl,
      kind: handoff.kind as MatchImageKind,
      status: 'ready',
    }
    setItems([item])
    setMessage(`${handoff.kind === 'results' ? 'Result' : 'Fixture'} screenshot received. Reading it now…`)
    void analyseItems([item])
  }, [authed])

  const analyseItems = async (targets = items.filter(item => item.status === 'ready' || item.status === 'failed')) => {
    if (!targets.length) return setError('Add at least one screenshot first.')
    setBusy(true); setError('')
    for (const item of targets) {
      setItems(current => current.map(value => value.id === item.id ? { ...value, status: 'analysing', error: undefined } : value))
      try {
        const image = item.url.startsWith('data:') ? item.url : await fileDataUrl(item.file)
        const preview = await matchImageImports.parse(image, item.kind, leagueId || undefined)
        setItems(current => current.map(value => value.id === item.id ? { ...value, status: 'review', preview, error: undefined } : value))
        if (!leagueId && preview.matchedLeagueId) setLeagueId(preview.matchedLeagueId)
        if (preview.season) setSeason(preview.season)
        if (preview.grade) setGrade(preview.grade)
        setMessage(`Extracted ${preview.rows.length} ${item.kind === 'fixtures' ? 'fixture' : 'result'} row${preview.rows.length === 1 ? '' : 's'}. Review every row before approval.`)
      } catch (cause) {
        const detail = readError(cause)
        setItems(current => current.map(value => value.id === item.id ? { ...value, status: 'failed', error: detail } : value))
        setError(detail)
      }
    }
    setBusy(false)
  }

  const addFiles = (files: FileList) => {
    const added = Array.from(files).filter(file => !file.type || file.type.startsWith('image/')).map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      kind: 'fixtures' as MatchImageKind,
      status: 'ready' as const,
    }))
    if (!added.length) return setError('Choose image files only.')
    setItems(current => [...current, ...added])
    setError('')
  }

  const replacePreview = (id: string, preview: MatchImagePreview) => {
    setItems(current => current.map(item => item.id === id ? { ...item, preview } : item))
  }

  const commit = async (item: Item) => {
    if (!item.preview || item.status === 'committing' || item.status === 'committed') return
    if (!leagueId) {
      const detail = 'Choose the league before approving fixtures.'
      setItems(current => current.map(value => value.id === item.id ? { ...value, status: 'failed', error: detail } : value))
      return setError(detail)
    }
    const rows = (item.preview.rows as ReviewRow[])
      .filter(row => (row.decision ?? 'import') === 'import')
      .map(row => ({
        ...row,
        homeClubId: row.homeClubId || row.homeMatch.clubId,
        awayClubId: row.awayClubId || row.awayMatch.clubId,
        createHomeClub: !(row.homeClubId || row.homeMatch.clubId),
        createAwayClub: !(row.awayClubId || row.awayMatch.clubId),
      }))

    let validationError = ''
    if (!rows.length) validationError = 'No approved rows to import.'
    else if (rows.some(row => !row.homeTeam.trim() || !row.awayTeam.trim())) validationError = 'Every approved fixture needs both team names.'
    else if (item.kind === 'results' && rows.some(row => !Number.isFinite(row.homeScore) || !Number.isFinite(row.awayScore))) validationError = 'Every approved result needs both total scores.'
    if (validationError) {
      setItems(current => current.map(value => value.id === item.id ? { ...value, status: 'failed', error: validationError } : value))
      return setError(validationError)
    }

    setBusy(true)
    setError('')
    setMessage('')
    setItems(current => current.map(value => value.id === item.id ? { ...value, status: 'committing', error: undefined } : value))
    try {
      const result = await matchImageImports.commit({ kind: item.kind, leagueId, season, grade, rows })
      setItems(current => current.map(value => value.id === item.id ? { ...value, status: 'committed', error: undefined } : value))
      const created = Number(result.createdClubs ?? 0)
      setMessage(`${item.file.name}: complete — ${rows.length} ${item.kind} row${rows.length === 1 ? '' : 's'} published${created ? ` · ${created} new club${created === 1 ? '' : 's'} created` : ''}.`)
      void admin.listClubs(leagueId).then(setClubs)
    } catch (cause) {
      const detail = readError(cause)
      setItems(current => current.map(value => value.id === item.id ? { ...value, status: 'failed', error: detail } : value))
      setError(`${item.file.name}: incomplete — ${detail}`)
      setMessage('')
    } finally {
      setBusy(false)
    }
  }

  if (!authed) return <div className="match-login"><div><h1>Match image imports</h1><input style={input} type="password" value={key} onChange={event => setLocalKey(event.target.value)}/><button className="primary" onClick={() => { if (key.trim()) { setKey(key.trim()); setAuthed(true) } }}>Open</button></div></div>

  return <main className="match-page"><div className="match-shell">
    <header className="match-hero"><Link to="/admin/universal-imports"><ArrowLeft size={17}/>Back to Universal Imports</Link><h1>Fixtures & results OCR</h1><p>Read screenshots, review every match and publish only approved rows.</p></header>

    <section className="match-settings">
      <label><span>League</span><select style={input} value={leagueId} onChange={event => setLeagueId(event.target.value)}><option value="">Auto-detect / choose league</option>{leagues.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}</select></label>
      <label><span>Season</span><input style={input} value={season} onChange={event => setSeason(event.target.value)}/></label>
      <label><span>Grade</span><input style={input} value={grade} onChange={event => setGrade(event.target.value)}/></label>
    </section>

    <label className="match-drop"><div><UploadCloud size={40}/><h2>Choose fixture or result screenshots</h2><p>Images remain review-only until you approve them.</p><span className="primary">Select images</span></div><input hidden type="file" accept="image/*" multiple onChange={event => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = '' }}/></label>

    {items.length > 0 && <><section className="match-images">{items.map(item => <article key={item.id} className={`match-image-card ${item.status}`}><img src={item.url} alt="Selected match screenshot"/><div><strong>{item.file.name}</strong><select style={input} value={item.kind} disabled={busy || item.status === 'committed'} onChange={event => setItems(current => current.map(value => value.id === item.id ? { ...value, kind: event.target.value as MatchImageKind, status: 'ready', preview: undefined, error: undefined } : value))}><option value="fixtures">Fixtures</option><option value="results">Results</option></select><small>{statusLabel(item)}{item.error ? ` — ${item.error}` : ''}</small>{item.status !== 'committed' && <button className="secondary" disabled={busy} onClick={() => setItems(current => current.filter(value => value.id !== item.id))}><Trash2 size={15}/>Remove</button>}</div></article>)}</section><button className="primary analyse" disabled={busy} onClick={() => void analyseItems()}><ImagePlus size={17}/>{busy ? 'Working…' : 'Analyse screenshots'}</button></>}

    {message && <div className="match-message">{message}</div>}
    {error && <div className="match-error">{error}</div>}
    {items.map(item => item.preview && item.status !== 'committed' ? <Review key={item.id} item={item} clubs={clubs} onChange={preview => replacePreview(item.id, preview)} onCommit={() => void commit(item)} busy={busy}/> : null)}
  </div><style>{`
    *{box-sizing:border-box}.match-page{min-height:100vh;background:#eef2f6;padding:24px;font-family:Inter,system-ui,sans-serif;color:${INK}}.match-shell{max-width:1180px;margin:auto;display:grid;gap:16px}.match-hero{background:#050505;color:#fff;border-radius:20px;padding:28px}.match-hero a{color:${BLUE};text-decoration:none;display:inline-flex;align-items:center;gap:7px;font-weight:900}.match-hero h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(42px,7vw,74px);line-height:.92;text-transform:uppercase;margin:18px 0 7px}.match-hero p{margin:0;color:#cbd2dc}.match-settings{background:#fff;border:1px solid ${LINE};border-radius:17px;padding:16px;display:grid;grid-template-columns:2fr 1fr 1fr;gap:11px}.match-settings label,.fixture-card label{display:grid;gap:6px}.match-settings span,.fixture-card label>span{font-size:10px;text-transform:uppercase;font-weight:900;color:${MUTED}}.match-drop{min-height:180px;border:2px dashed #92cfee;border-radius:18px;background:#f7fcff;display:grid;place-items:center;text-align:center;padding:22px;cursor:pointer}.match-drop h2{margin:8px 0 3px}.match-drop p{margin:0 0 16px;color:${MUTED}}.primary,.secondary{border:0;border-radius:999px;padding:11px 16px;font-weight:950;display:inline-flex;justify-content:center;align-items:center;gap:7px;cursor:pointer}.primary:disabled,.secondary:disabled{cursor:not-allowed;opacity:.6}.primary{background:${BLUE};color:#050505}.secondary{background:#eef2f6;color:${INK}}.analyse{width:100%;min-height:50px}.match-images{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.match-images article{background:#fff;border:1px solid ${LINE};border-radius:15px;overflow:hidden}.match-images article.committed{border-color:#54b979;background:#f2fbf5}.match-images article.failed{border-color:#d96868;background:#fff7f7}.match-images img{width:100%;height:155px;object-fit:contain;background:#edf1f5}.match-images article>div{padding:13px;display:grid;gap:9px}.match-images small{color:${MUTED};font-weight:800}.match-images article.committed small{color:#126b3c}.match-images article.failed small{color:#a52222}.match-message,.match-error{padding:14px;border-radius:12px;font-weight:800}.match-message{background:#eaf8ef;color:#126b3c}.match-error{background:#fff1f1;color:#a52222}.review-card{background:#fff;border:1px solid ${LINE};border-radius:18px;overflow:hidden}.review-card.committing{opacity:.78}.review-card.failed{border-color:#d96868}.review-head{padding:16px;display:flex;justify-content:space-between;gap:12px;align-items:center;border-bottom:1px solid ${LINE}}.review-head p{margin:4px 0 0;color:${MUTED}}.fixture-list{padding:13px;display:grid;gap:11px}.fixture-card{border:1px solid ${LINE};border-radius:14px;padding:13px;display:grid;gap:11px}.fixture-card.uncertain{border-color:#e7b64f;background:#fffaf0}.fixture-top{display:flex;gap:9px;align-items:center}.fixture-top b{display:grid;place-items:center;width:31px;height:31px;background:${BLUE};border-radius:8px}.fixture-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.fixture-teams{display:grid;grid-template-columns:1fr 1fr;gap:9px}.team-box{border:1px solid #e7ebf0;border-radius:12px;padding:10px;display:grid;gap:8px}.team-box strong{font-size:13px}.score-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.confidence{color:${MUTED};font-size:12px}.approve{margin:0 13px 15px;width:calc(100% - 26px);min-height:52px}.match-login{min-height:100vh;display:grid;place-items:center;background:#050505;padding:20px}.match-login>div{background:#fff;padding:24px;border-radius:18px;width:min(100%,420px);display:grid;gap:12px}.match-login .primary{width:100%}
    @media(max-width:760px){.match-page{padding:12px}.match-hero{padding:18px 16px;border-radius:17px}.match-hero h1{font-size:40px}.match-settings,.fixture-meta,.fixture-teams{grid-template-columns:1fr}.match-images{grid-template-columns:1fr}.review-head{align-items:flex-start;flex-direction:column}.review-head .primary{width:100%}.score-grid{grid-template-columns:repeat(3,1fr)}.approve{position:sticky;bottom:8px;z-index:5}}
  `}</style></main>
}

function Review({ item, clubs, onChange, onCommit, busy }: { item: Item; clubs: AdminClub[]; onChange: (preview: MatchImagePreview) => void; onCommit: () => void; busy: boolean }) {
  const preview = item.preview!
  const rows = useMemo(() => (preview.rows as ReviewRow[]).map(row => ({
    ...row,
    decision: row.decision ?? 'import',
    homeClubId: row.homeClubId ?? row.homeMatch.clubId ?? '',
    awayClubId: row.awayClubId ?? row.awayMatch.clubId ?? '',
  })), [preview])
  const patch = (index: number, value: Partial<ReviewRow>) => onChange({ ...preview, rows: rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...value } : row) })
  const active = rows.filter(row => row.decision === 'import')
  const uncertain = active.filter(row => !row.homeClubId || !row.awayClubId).length
  const committing = item.status === 'committing'

  return <section className={`review-card ${item.status}`}><header className="review-head"><div><strong>{item.file.name}</strong><p>{preview.league ?? 'Unknown league'} · {preview.grade ?? 'Unknown grade'} · {rows.length} matches · {uncertain} new/unmatched clubs</p></div>{item.status === 'failed' && <strong>Incomplete</strong>}</header><div className="fixture-list">{rows.map((row, index) => <article className={`fixture-card${(!row.homeClubId || !row.awayClubId) ? ' uncertain' : ''}`} key={`${row.homeTeam}-${row.awayTeam}-${index}`}>
    <div className="fixture-top"><b>{index + 1}</b><select style={input} value={row.decision} disabled={committing} onChange={event => patch(index, { decision: event.target.value as 'import' | 'skip' })}><option value="import">Approve row</option><option value="skip">Reject row</option></select></div>
    <div className="fixture-meta"><Field label="Round"><input style={input} type="number" value={row.round ?? ''} disabled={committing} onChange={event => patch(index, { round: numberValue(event.target.value) })}/></Field><Field label="Date"><input style={input} type="date" value={row.matchDate ?? ''} disabled={committing} onChange={event => patch(index, { matchDate: event.target.value || null })}/></Field><Field label="Time"><input style={input} value={row.matchTime ?? ''} disabled={committing} onChange={event => patch(index, { matchTime: event.target.value || null })}/></Field><Field label="Venue"><input style={input} value={row.venue ?? ''} disabled={committing} onChange={event => patch(index, { venue: event.target.value || null })}/></Field></div>
    <div className="fixture-teams"><TeamEditor side="Home" name={row.homeTeam} clubId={row.homeClubId} clubs={clubs} goals={row.homeGoals} behinds={row.homeBehinds} score={row.homeScore} showScore={item.kind === 'results'} onName={homeTeam => patch(index, { homeTeam })} onClub={homeClubId => patch(index, { homeClubId })} onScore={value => patch(index, value)}/><TeamEditor side="Away" name={row.awayTeam} clubId={row.awayClubId} clubs={clubs} goals={row.awayGoals} behinds={row.awayBehinds} score={row.awayScore} showScore={item.kind === 'results'} onName={awayTeam => patch(index, { awayTeam })} onClub={awayClubId => patch(index, { awayClubId })} onScore={value => patch(index, value)}/></div>
    <small className="confidence">OCR match confidence: {Math.round(((row.homeMatch.score + row.awayMatch.score) / 2) * 100)}% · Unmatched teams will be created only when this row is approved.</small>
  </article>)}</div><button className="primary approve" disabled={busy || committing} onClick={onCommit}>{committing ? 'Publishing…' : item.status === 'failed' ? `Retry incomplete import (${active.length})` : `Approve and publish ${active.length} ${item.kind}`}</button></section>
}

function TeamEditor({ side, name, clubId, clubs, goals, behinds, score, showScore, onName, onClub, onScore }: { side: 'Home' | 'Away'; name: string; clubId: string; clubs: AdminClub[]; goals?: number; behinds?: number; score?: number; showScore: boolean; onName: (value: string) => void; onClub: (value: string) => void; onScore: (value: Partial<ReviewRow>) => void }) {
  const prefix = side === 'Home' ? 'home' : 'away'
  return <div className="team-box"><strong>{side} team</strong><Field label="Extracted name"><input style={input} value={name} onChange={event => onName(event.target.value)}/></Field><Field label="Club action"><select style={input} value={clubId || '__create__'} onChange={event => onClub(event.target.value === '__create__' ? '' : event.target.value)}><option value="__create__">＋ Create new club: {name}</option>{clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}</select></Field>{showScore && <div className="score-grid"><Field label="Goals"><input style={input} type="number" value={goals ?? ''} onChange={event => onScore({ [`${prefix}Goals`]: numberValue(event.target.value) } as Partial<ReviewRow>)}/></Field><Field label="Behinds"><input style={input} type="number" value={behinds ?? ''} onChange={event => onScore({ [`${prefix}Behinds`]: numberValue(event.target.value) } as Partial<ReviewRow>)}/></Field><Field label="Total"><input style={input} type="number" value={score ?? ''} onChange={event => onScore({ [`${prefix}Score`]: numberValue(event.target.value) } as Partial<ReviewRow>)}/></Field></div>}</div>
}

function statusLabel(item: Item) {
  if (item.status === 'committed') return 'Complete'
  if (item.status === 'committing') return 'Publishing…'
  if (item.status === 'failed') return 'Incomplete'
  if (item.status === 'review') return 'Ready to publish'
  if (item.status === 'analysing') return 'Analysing…'
  return 'Ready'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span>{label}</span>{children}</label> }
const numberValue = (value: string) => value === '' ? undefined : Number(value)
const readError = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
function fileDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) }) }
