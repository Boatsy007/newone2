import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Trash2 } from 'lucide-react'
import { goalKickerImageImports, type SavedGoalKickerRecord } from '../../lib/goalKickerImageImports'

type Props = {
  leagueId: string
  season: string
  refreshKey: number
  onMessage: (message: string) => void
}

const fieldStyle = {
  width: '100%',
  padding: '10px 11px',
  border: '1px solid #dce3eb',
  borderRadius: 10,
  font: 'inherit',
  boxSizing: 'border-box' as const,
}

export default function SavedGoalKickerRecords({ leagueId, season, refreshKey, onMessage }: Props) {
  const [rows, setRows] = useState<SavedGoalKickerRecord[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setRows(await goalKickerImageImports.listRecords(leagueId || undefined, season || undefined))
    } catch (error) {
      onMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [leagueId, season, refreshKey])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(row => `${row.playerName} ${row.clubName} ${row.leagueName} ${row.grade}`.toLowerCase().includes(needle))
  }, [query, rows])

  const remove = async (row: SavedGoalKickerRecord) => {
    const phrase = `DELETE ${row.playerName}`
    const confirmation = window.prompt(
      `Delete ${row.playerName} — ${row.clubName} — ${row.goals} goals?\n\nThis removes the saved player row and its linked goal-kicker history/feed events.\n\nType exactly: ${phrase}`,
    )
    if (confirmation == null) return
    if (confirmation !== phrase) {
      onMessage(`Nothing deleted. Confirmation must be exactly: ${phrase}`)
      return
    }

    setDeletingId(row.id)
    try {
      const result = await goalKickerImageImports.deleteRecord(row.id, confirmation)
      setRows(previous => previous.filter(entry => entry.id !== row.id))
      onMessage(`Deleted ${result.data.playerName}. Removed ${result.data.notificationsRemoved} linked history/feed event${result.data.notificationsRemoved === 1 ? '' : 's'}.`)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setDeletingId(null)
    }
  }

  return <section style={{ background: '#fff', borderRadius: 18, border: '1px solid #dce3eb', overflow: 'hidden' }}>
    <header style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0 }}>Saved goal-kicker records</h2>
        <p style={{ margin: '5px 0 0', color: '#65758b' }}>Use this only to remove an incorrectly approved player row. Reimport the corrected screenshot afterward.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} style={{ border: '1px solid #cfd8e3', borderRadius: 999, background: '#fff', padding: '9px 13px', fontWeight: 800, display: 'inline-flex', gap: 7, alignItems: 'center', cursor: 'pointer' }}>
        <RefreshCw size={15} /> {loading ? 'Loading…' : 'Refresh'}
      </button>
    </header>

    <div style={{ padding: '0 18px 16px', position: 'relative' }}>
      <Search size={17} style={{ position: 'absolute', left: 30, top: 12, color: '#78879a' }} />
      <input style={{ ...fieldStyle, paddingLeft: 38 }} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search player, club, league or grade" />
    </div>

    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
        <thead><tr>{['Player', 'Club', 'League', 'Season / grade', 'Goals', 'Matches', 'Imported', 'Action'].map(label => <th key={label} style={{ padding: 11, textAlign: 'left', background: '#f5f8fb', borderTop: '1px solid #e4eaf0', borderBottom: '1px solid #e4eaf0' }}>{label}</th>)}</tr></thead>
        <tbody>
          {filtered.map(row => <tr key={row.id}>
            <td style={cell}><strong>{row.playerName}</strong></td>
            <td style={cell}>{row.clubName}</td>
            <td style={cell}>{row.leagueName}</td>
            <td style={cell}>{row.season} · {row.grade}</td>
            <td style={cell}><strong>{row.goals}</strong></td>
            <td style={cell}>{row.matches ?? '—'}</td>
            <td style={cell}>{new Date(row.importedAt).toLocaleDateString('en-AU')}</td>
            <td style={cell}><button type="button" disabled={deletingId === row.id} onClick={() => void remove(row)} style={{ border: '1px solid #d83b3b', color: '#a71919', background: '#fff5f5', borderRadius: 8, padding: '8px 10px', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><Trash2 size={14} />{deletingId === row.id ? 'Deleting…' : 'Delete mistake'}</button></td>
          </tr>)}
          {!loading && filtered.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#65758b' }}>No saved records match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>
}

const cell = { padding: 11, borderBottom: '1px solid #edf1f5', verticalAlign: 'middle' as const }
