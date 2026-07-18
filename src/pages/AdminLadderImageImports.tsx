import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft, CheckCircle2, RefreshCw, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { admin, getKey, type AdminClub, type FootballLeague, type OcrPreview, type OcrRow } from '../lib/admin'
import { consumeImportHandoff } from '../lib/importHandoff'

const BLUE = '#42b8ff'
const INK = '#0c0e13'
const LINE = '#dce3eb'
const MUTED = '#687385'
const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

const field: CSSProperties = {
  width: '100%', border: `1px solid ${LINE}`, borderRadius: 12, padding: '11px 12px',
  font: 'inherit', background: '#fff', boxSizing: 'border-box', minWidth: 0,
}

function detectedDetails(value: string | null) {
  const raw = value?.trim() || ''
  const year = raw.match(/(?:,|\s)\s*((?:19|20)\d{2})\s*$/)?.[1] || String(new Date().getFullYear())
  const name = raw.replace(/(?:,|\s)\s*(?:19|20)\d{2}\s*$/, '').trim()
  return { name, year }
}

type CommitResponse = {
  data: {
    leagueId: string
    league: string
    teams: number
    createdLeague: boolean
    createdClubs: number
    season: string
    grade: string
  }
  note?: string
}

export default function AdminLadderImageImports() {
  const [leagues, setLeagues] = useState<FootballLeague[]>([])
  const [clubs, setClubs] = useState<AdminClub[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [createLeague, setCreateLeague] = useState(false)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [newLeagueState, setNewLeagueState] = useState('')
  const [newLeagueSeason, setNewLeagueSeason] = useState(String(new Date().getFullYear()))
  const [image, setImage] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<OcrPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refreshReferenceData = () => Promise.all([
    admin.listFootballLeagues().then(setLeagues),
    admin.listClubs().then(setClubs),
  ]).catch(() => undefined)

  useEffect(() => {
    void refreshReferenceData()
    const handoff = consumeImportHandoff(['ladder'])
    if (handoff) {
      setImage(handoff.dataUrl)
      setFileName(handoff.name)
      void analyse(handoff.dataUrl)
    }
  }, [])

  const analyse = async (source = image) => {
    if (!source) return setError('Choose a ladder screenshot first.')
    setBusy(true); setError(''); setMessage('Reading ladder screenshot…')
    try {
      const result = await admin.ocrParse(source, leagueId || undefined)
      setPreview(result)
      const detected = detectedDetails(result.detectedLeague)
      setNewLeagueName(detected.name)
      setNewLeagueSeason(detected.year)
      if (result.matchedLeagueId) {
        setLeagueId(result.matchedLeagueId)
        setCreateLeague(false)
      } else {
        setLeagueId('')
        setCreateLeague(true)
      }
      setMessage(`Extracted ${result.rows.length} ladder rows. Review every row before approval.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setMessage('')
    } finally { setBusy(false) }
  }

  const updateRow = (index: number, patch: Partial<OcrRow>) => {
    setPreview(current => current ? {
      ...current,
      rows: current.rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row),
    } : current)
  }

  const approve = async () => {
    if (!preview) return
    if (createLeague && !newLeagueName.trim()) return setError('Enter the new league name before approving.')
    if (createLeague && !newLeagueState) return setError('Select the new league state before approving.')
    if (!createLeague && !leagueId) return setError('Choose an existing league or select Create new league.')
    if (preview.rows.some(row => !row.team.trim())) return setError('Every approved row must have a team name.')

    setCommitting(true)
    setError('')
    setMessage(createLeague ? 'Creating the league, clubs and ladder in one transaction…' : 'Safely committing approved ladder…')

    try {
      const grade = preview.detectedGrade?.trim() || 'A Grade'
      const entries = preview.rows.map(row => ({
        clubId: row.match.clubId || null,
        team: row.team.trim(),
        position: row.position,
        played: row.played,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        percentage: row.percentage,
        points: row.points,
      }))

      const response = await fetch('/admin/ocr/commit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${getKey()}` },
        body: JSON.stringify({
          leagueId: createLeague ? undefined : leagueId,
          newLeague: createLeague ? {
            name: newLeagueName.trim(),
            stateCode: newLeagueState,
            season: newLeagueSeason.trim() || String(new Date().getFullYear()),
            grade,
          } : undefined,
          season: newLeagueSeason.trim() || undefined,
          grade,
          entries,
          importId: preview.importId,
        }),
      })
      const payload = await response.json() as CommitResponse & { error?: string }
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)

      setLeagueId(payload.data.leagueId)
      setCreateLeague(false)
      await refreshReferenceData()
      setMessage(payload.note || `Approved ${payload.data.teams} ladder rows for ${payload.data.league}. Created ${payload.data.createdClubs} new clubs.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setMessage('')
    } finally {
      setCommitting(false)
    }
  }

  const clubOptions = useMemo(() => clubs
    .map(club => ({ id: club.id, name: club.name }))
    .sort((a, b) => a.name.localeCompare(b.name)), [clubs])

  return <main className="ladder-page">
    <div className="ladder-shell">
      <header className="ladder-hero">
        <Link to="/admin/universal-imports"><ArrowLeft size={18}/>Back to Universal Imports</Link>
        <h1>Ladder OCR review</h1>
        <p>Extract, match, review and safely approve ladder rows. Nothing updates until you approve.</p>
      </header>

      <section className="ladder-controls">
        <label><span>Import destination</span><select style={field} value={createLeague ? '__new__' : leagueId} onChange={event => {
          if (event.target.value === '__new__') { setCreateLeague(true); setLeagueId('') }
          else { setCreateLeague(false); setLeagueId(event.target.value) }
        }}><option value="">Choose existing league</option><option value="__new__">＋ Create new league from OCR</option>{leagues.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}</select></label>
        <label className="ladder-file"><UploadCloud size={22}/><span>{fileName || 'Choose ladder screenshot'}</span><input hidden type="file" accept="image/*" onChange={event => {
          const file = event.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            const value = String(reader.result)
            setImage(value)
            setFileName(file.name)
            setPreview(null)
            void analyse(value)
          }
          reader.onerror = () => setError('Could not read that image.')
          reader.readAsDataURL(file)
          event.currentTarget.value = ''
        }}/></label>
        <button onClick={() => void analyse()} disabled={busy || !image}><RefreshCw size={17}/>{busy ? 'Analysing…' : 'Analyse again'}</button>
      </section>

      {createLeague && <section className="new-league-card">
        <header><strong>New league detected</strong><span>The league, approved clubs and ladder will be created together only after approval.</span></header>
        <div className="new-league-fields">
          <label><span>League name</span><input style={field} value={newLeagueName} onChange={event => setNewLeagueName(event.target.value)}/></label>
          <label><span>State</span><select style={field} value={newLeagueState} onChange={event => setNewLeagueState(event.target.value)}><option value="">Select state</option>{STATES.map(state => <option key={state} value={state}>{state}</option>)}</select></label>
          <label><span>Season</span><input style={field} value={newLeagueSeason} onChange={event => setNewLeagueSeason(event.target.value)}/></label>
          <label><span>Grade</span><input style={field} value={preview?.detectedGrade || 'A Grade'} readOnly/></label>
        </div>
      </section>}

      {image && <section className="ladder-source"><img src={image} alt="Selected ladder screenshot"/><div><strong>{fileName}</strong><span>{preview ? `${preview.rows.length} extracted rows · ${preview.uncertain} uncertain` : 'Waiting for OCR analysis'}</span></div></section>}
      {message && <div className="ladder-message">{message}</div>}
      {error && <div className="ladder-error">{error}</div>}

      {preview && <section className="ladder-review">
        <header><div><h2>Review extracted rows</h2><p>Detected: {preview.detectedLeague || 'Unknown league'}{preview.detectedGrade ? ` · ${preview.detectedGrade}` : ''}</p></div><span>{Math.round((preview.confidence || 0) * 100)}% confidence</span></header>
        <div className="ladder-rows">{preview.rows.map((row, index) => <article key={`${row.team}-${index}`} className={!row.match.confident ? 'uncertain' : ''}>
          <div className="row-title"><b>{index + 1}</b><input style={field} value={row.team} onChange={event => updateRow(index, { team: event.target.value })}/></div>
          <label><span>Club action</span><select style={field} value={row.match.clubId || '__create__'} onChange={event => {
            const club = clubOptions.find(item => item.id === event.target.value)
            updateRow(index, { match: { clubId: club?.id || null, matchedName: club?.name || null, score: club ? 1 : 0, confident: Boolean(club) } })
          }}><option value="__create__">＋ Create new club: {row.team}</option>{clubOptions.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
          <div className="row-stats">
            <NumberField label="Pos" value={row.position} change={value => updateRow(index, { position: value })}/>
            <NumberField label="P" value={row.played} change={value => updateRow(index, { played: value })}/>
            <NumberField label="W" value={row.wins} change={value => updateRow(index, { wins: value })}/>
            <NumberField label="L" value={row.losses} change={value => updateRow(index, { losses: value })}/>
            <NumberField label="D" value={row.draws} change={value => updateRow(index, { draws: value })}/>
            <NumberField label="%" value={row.percentage} change={value => updateRow(index, { percentage: value })} step="0.01"/>
            <NumberField label="Pts" value={row.points} change={value => updateRow(index, { points: value })}/>
          </div>
          <small>{row.match.clubId ? `Use existing club: ${row.match.matchedName}` : `Create new club from approved row: ${row.team}`}</small>
        </article>)}</div>
        <button className="approve" onClick={() => void approve()} disabled={committing}><CheckCircle2 size={19}/>{committing ? 'Committing…' : `${createLeague ? 'Create league and ' : ''}approve ${preview.rows.length} rows`}</button>
      </section>}
    </div>
    <style>{`
      *{box-sizing:border-box}.ladder-page{min-height:100vh;background:#eef2f6;padding:24px;font-family:Inter,system-ui,sans-serif;color:${INK}}.ladder-shell{max-width:1180px;margin:auto;display:grid;gap:16px}.ladder-hero{background:#050505;color:#fff;border-radius:20px;padding:28px}.ladder-hero a{color:${BLUE};text-decoration:none;display:inline-flex;gap:8px;align-items:center;font-weight:900}.ladder-hero h1{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(42px,7vw,76px);line-height:.9;margin:18px 0 8px}.ladder-hero p{color:#cbd2dc;margin:0;line-height:1.5}.ladder-controls{background:#fff;border:1px solid ${LINE};border-radius:18px;padding:16px;display:grid;grid-template-columns:minmax(240px,1fr) minmax(250px,1fr) auto;gap:12px;align-items:end}.ladder-controls label,.new-league-fields label{display:grid;gap:7px}.ladder-controls label>span,.new-league-fields label>span{font-size:11px;text-transform:uppercase;font-weight:900;color:${MUTED}}.ladder-file{border:1px dashed #83cfff;border-radius:12px;padding:12px;color:#0783c9;cursor:pointer;display:flex!important;align-items:center;gap:9px!important;min-height:47px}.ladder-file span{font-size:14px!important;text-transform:none!important;color:${INK}!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ladder-controls button,.approve{border:0;border-radius:999px;background:${BLUE};color:#050505;font-weight:950;min-height:47px;padding:11px 18px;display:inline-flex;align-items:center;justify-content:center;gap:8px}.new-league-card{background:#fff;border:2px solid ${BLUE};border-radius:18px;padding:17px;display:grid;gap:14px}.new-league-card header strong,.new-league-card header span{display:block}.new-league-card header strong{font-size:20px}.new-league-card header span{color:${MUTED};margin-top:4px}.new-league-fields{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px}.ladder-source{background:#fff;border:1px solid ${LINE};border-radius:16px;padding:12px;display:grid;grid-template-columns:110px 1fr;gap:14px;align-items:center}.ladder-source img{width:110px;height:90px;object-fit:contain;background:#edf1f5;border-radius:10px}.ladder-source strong,.ladder-source span{display:block}.ladder-source span{color:${MUTED};margin-top:5px}.ladder-message,.ladder-error{padding:14px;border-radius:13px;font-weight:800}.ladder-message{background:#eaf8ef;color:#126b3c}.ladder-error{background:#fff1f1;color:#a52222}.ladder-review{background:#fff;border:1px solid ${LINE};border-radius:18px;overflow:hidden}.ladder-review>header{padding:18px;display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid ${LINE}}.ladder-review h2,.ladder-review p{margin:0}.ladder-review p{color:${MUTED};margin-top:5px}.ladder-review>header>span{background:#eaf7ff;border-radius:999px;padding:8px 11px;height:max-content;font-weight:900}.ladder-rows{display:grid;gap:10px;padding:14px}.ladder-rows article{border:1px solid ${LINE};border-radius:14px;padding:13px;display:grid;gap:11px}.ladder-rows article.uncertain{border-color:#e7b64f;background:#fffaf0}.row-title{display:grid;grid-template-columns:34px 1fr;gap:8px;align-items:center}.row-title b{width:32px;height:32px;display:grid;place-items:center;background:${BLUE};border-radius:8px}.ladder-rows label{display:grid;gap:6px}.ladder-rows label span{font-size:10px;text-transform:uppercase;font-weight:900;color:${MUTED}}.row-stats{display:grid;grid-template-columns:repeat(7,minmax(62px,1fr));gap:7px}.row-stats label{min-width:0}.ladder-rows small{color:${MUTED}}.approve{margin:0 14px 16px;width:calc(100% - 28px);min-height:52px}.ladder-controls button:disabled,.approve:disabled{opacity:.55}
      @media(max-width:760px){.ladder-page{padding:12px}.ladder-hero{padding:18px 16px;border-radius:17px}.ladder-hero h1{font-size:40px}.ladder-controls,.new-league-fields{grid-template-columns:1fr}.ladder-controls button{width:100%}.ladder-source{grid-template-columns:82px 1fr}.ladder-source img{width:82px;height:72px}.ladder-review>header{align-items:flex-start}.row-stats{grid-template-columns:repeat(4,1fr)}.ladder-rows{padding:10px}.approve{position:sticky;bottom:8px;z-index:5}}
    `}</style>
  </main>
}

function NumberField({ label, value, change, step }: { label: string; value?: number; change: (value?: number) => void; step?: string }) {
  return <label><span>{label}</span><input style={field} type="number" step={step} value={value ?? ''} onChange={event => change(event.target.value === '' ? undefined : Number(event.target.value))}/></label>
}
