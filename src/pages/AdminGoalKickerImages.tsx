import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowLeft, CheckCircle2, Trash2, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { admin, getKey, setKey, type AdminClub, type FootballLeague } from '../lib/admin'
import {
  goalKickerImageImports,
  type GoalKickerCommitIssue,
  type GoalKickerImagePreview,
  type GoalKickerImageRow,
} from '../lib/goalKickerImageImports'
import { consumeImportHandoff, handoffToFile } from '../lib/importHandoff'

type ReviewRow = GoalKickerImageRow & { decision: 'import' | 'skip'; clubId: string }
type Item = {
  id: string
  file: File
  url: string
  status: 'ready' | 'analysing' | 'review' | 'failed' | 'committed'
  preview?: GoalKickerImagePreview
  error?: string
}

type CommitFeedback = {
  errors: GoalKickerCommitIssue[]
  warnings: GoalKickerCommitIssue[]
}

const input: CSSProperties = {
  width: '100%',
  padding: '10px 11px',
  border: '1px solid #dce3eb',
  borderRadius: 10,
  font: 'inherit',
  boxSizing: 'border-box',
}

const button = (dark = false): CSSProperties => ({
  border: 0,
  borderRadius: 999,
  padding: '11px 16px',
  background: dark ? '#050505' : '#42b8ff',
  color: dark ? '#fff' : '#050505',
  fontWeight: 900,
  cursor: 'pointer',
})

export default function AdminGoalKickerImages() {
  const [authed, setAuthed] = useState(!!getKey())
  const [key, setLocalKey] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [leagues, setLeagues] = useState<FootballLeague[]>([])
  const [clubs, setClubs] = useState<AdminClub[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [season, setSeason] = useState('2026')
  const [grade, setGrade] = useState('Senior Football')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [feedback, setFeedback] = useState<CommitFeedback>({ errors: [], warnings: [] })

  useEffect(() => {
    if (!authed) return
    void admin.listFootballLeagues().then(setLeagues)
    void admin.listClubs().then(setClubs)
  }, [authed])

  useEffect(() => {
    if (!authed) return
    const handoff = consumeImportHandoff(['goalKickers'])
    if (!handoff) return
    const file = handoffToFile(handoff)
    setItems(previous => [
      ...previous,
      { id: `handoff-${Date.now()}`, file, url: URL.createObjectURL(file), status: 'ready' },
    ])
    setMsg('Screenshot received from Universal Imports. Review it, then analyse.')
  }, [authed])

  const add = (files: FileList) => {
    setItems(previous => [
      ...previous,
      ...Array.from(files)
        .filter(file => file.type.startsWith('image/'))
        .map(file => ({
          id: `${Date.now()}-${Math.random()}`,
          file,
          url: URL.createObjectURL(file),
          status: 'ready' as const,
        })),
    ])
  }

  const analyse = async () => {
    if (!items.length) {
      setMsg('Add at least one screenshot.')
      return
    }
    setFeedback({ errors: [], warnings: [] })
    setBusy(true)
    for (const item of items.filter(entry => entry.status === 'ready' || entry.status === 'failed')) {
      setItems(previous => previous.map(entry => entry.id === item.id
        ? { ...entry, status: 'analysing', error: undefined }
        : entry))
      try {
        const image = await fileDataUrl(item.file)
        const preview = await goalKickerImageImports.parse(image, leagueId || undefined)
        setItems(previous => previous.map(entry => entry.id === item.id
          ? { ...entry, status: 'review', preview }
          : entry))
        if (!leagueId && preview.matchedLeagueId) setLeagueId(preview.matchedLeagueId)
        if (preview.season) setSeason(preview.season)
        if (preview.grade) setGrade(preview.grade)
      } catch (error) {
        setItems(previous => previous.map(entry => entry.id === item.id
          ? { ...entry, status: 'failed', error: error instanceof Error ? error.message : String(error) }
          : entry))
      }
    }
    setBusy(false)
  }

  const replacePreview = (id: string, preview: GoalKickerImagePreview) => {
    setItems(previous => previous.map(item => item.id === id ? { ...item, preview } : item))
  }

  const commit = async (item: Item) => {
    if (!item.preview) return
    const reviewRows = (item.preview.rows as ReviewRow[]).map(row => {
      const clubId = row.clubId || row.clubMatch.clubId
      const warning = !clubId
        ? 'Club match required'
        : row.goals < 0
          ? 'Invalid goals'
          : row.playerMatch
            ? `Updates existing ${row.playerMatch.goals} goals`
            : 'Creates player record'
      return {
        playerId: row.playerMatch?.playerId ?? null,
        playerName: row.playerName.trim(),
        clubName: row.clubName.trim(),
        clubId,
        goals: Number(row.goals),
        matches: row.matches == null ? null : Number(row.matches),
        decision: row.decision ?? 'import',
        confidence: Number.isFinite(row.clubMatch.score) ? row.clubMatch.score : null,
        warning,
      }
    })
    const rows = reviewRows
      .filter(row => row.decision === 'import')
      .map(({ decision: _decision, confidence: _confidence, warning: _warning, ...row }) => row)

    if (!leagueId) return setMsg('Choose the league before committing.')
    if (!rows.length) return setMsg('No approved players to import.')
    if (rows.some(row => !row.playerName || !row.clubName || !row.clubId || !Number.isFinite(row.goals) || row.goals < 0)) {
      return setMsg('Every approved row needs a player, matched club and valid goal total.')
    }
    const keys = rows.map(row => `${row.playerName.toLowerCase()}|${row.clubId}`)
    if (new Set(keys).size !== keys.length) return setMsg('Duplicate player and club rows must be skipped or corrected.')
    if (!window.confirm(`Update ${rows.length} goal-kicker records for ${season} ${grade}?`)) return

    setBusy(true)
    setFeedback({ errors: [], warnings: [] })
    try {
      const image = await fileDataUrl(item.file)
      const result = await goalKickerImageImports.commit({
        leagueId,
        season,
        grade,
        fileName: item.file.name,
        image,
        uncertainCount: item.preview.uncertain,
        rows,
        reviewRows,
      })
      const errors = result.errors ?? []
      const warnings = result.warnings ?? []
      setFeedback({ errors, warnings })

      if (result.data.errors === 0) {
        setItems(previous => previous.map(entry => entry.id === item.id
          ? { ...entry, status: 'committed' }
          : entry))
      }

      const parts = [`Updated ${result.data.imported} goal-kicker record${result.data.imported === 1 ? '' : 's'}`]
      if (result.data.weeklyChanges > 0) parts.push(`${result.data.weeklyChanges} weekly change${result.data.weeklyChanges === 1 ? '' : 's'} recorded`)
      if (result.data.errors > 0) parts.push(`${result.data.errors} failed`)
      if (result.data.warnings > 0) parts.push(`${result.data.warnings} warning${result.data.warnings === 1 ? '' : 's'}`)
      if (result.data.batchId) parts.push('audit batch saved')
      setMsg(`${parts.join(' · ')}.`)
    } catch (error) {
      setMsg(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  if (!authed) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#050505' }}>
      <div style={{ background: '#fff', padding: 24, borderRadius: 18, width: 'min(92vw,420px)' }}>
        <h1>Goal-kicker image imports</h1>
        <input style={input} type="password" value={key} onChange={event => setLocalKey(event.target.value)} />
        <button style={{ ...button(), width: '100%', marginTop: 12 }} onClick={() => {
          if (key.trim()) {
            setKey(key.trim())
            setAuthed(true)
          }
        }}>Open</button>
      </div>
    </div>
  }

  return <main style={{ minHeight: '100vh', background: '#eef2f6', padding: 24, fontFamily: 'Inter,system-ui,sans-serif' }}>
    <div style={{ maxWidth: 1380, margin: '0 auto', display: 'grid', gap: 18 }}>
      <header style={{ background: '#050505', color: '#fff', borderRadius: 20, padding: 28 }}>
        <Link to="/admin" style={{ color: '#42b8ff', textDecoration: 'none', display: 'inline-flex', gap: 7, alignItems: 'center' }}>
          <ArrowLeft size={16} />Back to Control Centre
        </Link>
        <h1 style={{ fontSize: 'clamp(42px,7vw,84px)', margin: '12px 0 6px', textTransform: 'uppercase' }}>Goal-kicker images</h1>
        <p>Upload screenshots, match players and clubs, review every total, then explicitly update the website.</p>
      </header>

      <section style={{ background: '#fff', borderRadius: 16, padding: 18, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
        <label>League<select style={input} value={leagueId} onChange={event => setLeagueId(event.target.value)}>
          <option value="">Auto-detect / choose</option>
          {leagues.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}
        </select></label>
        <label>Season<input style={input} value={season} onChange={event => setSeason(event.target.value)} /></label>
        <label>Grade<input style={input} value={grade} onChange={event => setGrade(event.target.value)} /></label>
      </section>

      <label style={{ minHeight: 200, border: '2px dashed #92cfee', borderRadius: 18, background: '#f7fcff', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24, cursor: 'pointer' }}>
        <div><UploadCloud size={44} /><h2>Choose goal-kicker screenshots</h2><span style={button()}>Select images</span></div>
        <input hidden type="file" accept="image/*" multiple onChange={event => {
          if (event.target.files) add(event.target.files)
          event.currentTarget.value = ''
        }} />
      </label>

      {items.length > 0 && <>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          {items.map(item => <article key={item.id} style={{ background: '#fff', borderRadius: 15, overflow: 'hidden', border: '1px solid #dce3eb' }}>
            <img src={item.url} alt="Goal-kicker screenshot" style={{ width: '100%', height: 150, objectFit: 'cover' }} />
            <div style={{ padding: 13, display: 'grid', gap: 9 }}>
              <strong>{item.file.name}</strong>
              <small>{item.status}{item.error ? ` — ${item.error}` : ''}</small>
              <button style={button(true)} disabled={busy} onClick={() => setItems(previous => previous.filter(entry => entry.id !== item.id))}>
                <Trash2 size={14} /> Remove
              </button>
            </div>
          </article>)}
        </section>
        <button style={button()} disabled={busy} onClick={analyse}>{busy ? 'Analysing…' : 'Analyse screenshots'}</button>
      </>}

      {msg && <div style={{ background: '#fff8dc', padding: 14, borderRadius: 12 }}>{msg}</div>}
      <CommitFeedbackPanel feedback={feedback} />

      {items.map(item => item.preview
        ? <Review key={item.id} item={item} clubs={clubs} onChange={preview => replacePreview(item.id, preview)} onCommit={() => commit(item)} busy={busy} />
        : null)}
    </div>
  </main>
}

function CommitFeedbackPanel({ feedback }: { feedback: CommitFeedback }) {
  if (feedback.errors.length === 0 && feedback.warnings.length === 0) return null
  return <section style={{ display: 'grid', gap: 10 }}>
    {feedback.errors.length > 0 && <div style={{ background: '#fff0f0', color: '#9f1c1c', border: '1px solid #f3c2c2', borderRadius: 12, padding: 14 }}>
      <strong>Failed player rows</strong>
      <ul>{feedback.errors.map((issue, index) => <li key={`${issue.playerName}-${index}`}><b>{issue.playerName}:</b> {issue.error ?? 'Unknown error'}</li>)}</ul>
    </div>}
    {feedback.warnings.length > 0 && <div style={{ background: '#fff8dc', color: '#705500', border: '1px solid #ead994', borderRadius: 12, padding: 14 }}>
      <strong>Saved with warnings</strong>
      <ul>{feedback.warnings.map((issue, index) => <li key={`${issue.playerName}-${index}`}><b>{issue.playerName}:</b> {issue.warning ?? 'Unknown warning'}</li>)}</ul>
    </div>}
  </section>
}

function Review({ item, clubs, onChange, onCommit, busy }: {
  item: Item
  clubs: AdminClub[]
  onChange: (preview: GoalKickerImagePreview) => void
  onCommit: () => void
  busy: boolean
}) {
  const preview = item.preview!
  const rows = (preview.rows as ReviewRow[]).map(row => ({
    ...row,
    decision: row.decision ?? 'import',
    clubId: row.clubId ?? row.clubMatch.clubId ?? '',
  }))
  const patch = (index: number, value: Partial<ReviewRow>) => {
    onChange({ ...preview, rows: rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...value } : row) })
  }
  const active = rows.filter(row => row.decision === 'import')
  const unmatched = active.filter(row => !row.clubId).length

  return <section style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', border: '1px solid #dce3eb' }}>
    <header style={{ padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <div>
        <strong>{item.file.name}</strong>
        <div>{preview.league ?? 'Unknown league'} · {preview.grade} · {preview.season} · {rows.length} players · {unmatched} unmatched</div>
      </div>
      <button style={button()} disabled={busy || item.status === 'committed'} onClick={onCommit}>
        {item.status === 'committed' ? <><CheckCircle2 size={16} /> Updated</> : `Approve & update ${active.length}`}
      </button>
    </header>
    <div style={{ overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
        <thead><tr>{['Action', 'Player name', 'Extracted club', 'Matched club', 'Existing player record', 'Goals', 'Matches', 'Confidence', 'Warning'].map(heading => <th key={heading} style={{ padding: 9, textAlign: 'left', borderTop: '1px solid #e8edf2', borderBottom: '1px solid #e8edf2' }}>{heading}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => {
          const warning = !row.clubId
            ? 'Club match required'
            : row.goals < 0
              ? 'Invalid goals'
              : row.playerMatch
                ? `Updates existing ${row.playerMatch.goals} goals`
                : 'Creates player record'
          return <tr key={index} style={{ opacity: row.decision === 'skip' ? .45 : 1 }}>
            <td><select style={input} value={row.decision} onChange={event => patch(index, { decision: event.target.value as 'import' | 'skip' })}><option value="import">Import</option><option value="skip">Skip</option></select></td>
            <td><input style={input} value={row.playerName} onChange={event => patch(index, { playerName: event.target.value })} /></td>
            <td><input style={input} value={row.clubName} onChange={event => patch(index, { clubName: event.target.value })} /></td>
            <td><select style={{ ...input, minWidth: 210 }} value={row.clubId} onChange={event => patch(index, { clubId: event.target.value })}><option value="">Choose club</option>{clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}</select></td>
            <td>{row.playerMatch ? `${row.playerMatch.playerName} · ${row.playerMatch.clubName}` : 'New record'}</td>
            <td><input style={input} type="number" min={0} value={row.goals} onChange={event => patch(index, { goals: Number(event.target.value) })} /></td>
            <td><input style={input} type="number" min={0} value={row.matches ?? ''} onChange={event => patch(index, { matches: event.target.value === '' ? undefined : Number(event.target.value) })} /></td>
            <td>{Math.round(row.clubMatch.score * 100)}%</td>
            <td>{warning}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </section>
}

function fileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
