import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { goalKickerImageImports, type GoalKickerImportBatch } from '../../lib/goalKickerImageImports'

export default function GoalKickerImportHistory({ refreshKey, onMessage, onChanged }: { refreshKey: number; onMessage: (message: string) => void; onChanged: () => void }) {
  const [batches, setBatches] = useState<GoalKickerImportBatch[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try { setBatches(await goalKickerImageImports.listImports(75)) }
    catch (error) { onMessage(error instanceof Error ? error.message : String(error)) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [refreshKey])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return batches
    return batches.filter(batch => [batch.fileName, batch.leagueName, batch.season, batch.grade, ...batch.rows.flatMap(row => [row.playerName, row.clubName])].some(value => String(value ?? '').toLowerCase().includes(needle)))
  }, [batches, query])

  const undo = async (batch: GoalKickerImportBatch) => {
    const expected = `UNDO ${batch.fileName}`
    const confirmation = window.prompt(`Undo this screenshot import?\n\nThis restores every player to the exact state before this batch. It will be blocked if any player has a newer update.\n\nType: ${expected}`)
    if (confirmation == null) return
    setBusyId(batch.id)
    try {
      const result = await goalKickerImageImports.undoImport(batch.id, confirmation)
      onMessage(`Undid ${result.data.fileName}. Restored ${result.data.restoredRows} previous row${result.data.restoredRows === 1 ? '' : 's'} and removed ${result.data.notificationsRemoved} linked event${result.data.notificationsRemoved === 1 ? '' : 's'}.`)
      await load()
      onChanged()
    } catch (error) {
      onMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusyId(null)
    }
  }

  return <section style={{ display: 'grid', gap: 12 }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search filename, league, player or club" style={{ flex: '1 1 300px', border: '1px solid #dce3eb', borderRadius: 10, padding: '11px 12px', font: 'inherit' }} />
      <button type="button" onClick={() => void load()} style={{ border: 0, borderRadius: 999, background: '#42b8ff', color: '#050505', padding: '10px 15px', fontWeight: 900, cursor: 'pointer' }}>{loading ? 'Loading…' : 'Refresh'}</button>
    </div>

    {!loading && filtered.length === 0 && <div style={{ background: '#fff', border: '1px solid #dce3eb', borderRadius: 12, padding: 18 }}>No goal-kicker screenshot imports found.</div>}

    {filtered.map(batch => {
      const isOpen = expanded === batch.id
      const canUndo = batch.status === 'COMMITTED' && !batch.undoneAt && batch.imported > 0
      return <article key={batch.id} style={{ background: '#fff', border: '1px solid #dce3eb', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: 14 }}>
          <button type="button" onClick={() => setExpanded(isOpen ? null : batch.id)} style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 16 }}>{batch.fileName}</strong>
              <span style={{ background: batch.undoneAt ? '#eef2f6' : '#eaf7ff', color: batch.undoneAt ? '#65758b' : '#0878bd', borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 900 }}>{batch.undoneAt ? 'UNDONE' : batch.status}</span>
            </div>
            <div style={{ color: '#65758b', marginTop: 5, lineHeight: 1.45 }}>{batch.leagueName ?? 'Unknown league'} · {batch.season} · {batch.grade}</div>
            <div style={{ color: '#65758b', marginTop: 3, fontSize: 13 }}>{batch.imported} updated · {batch.skipped} skipped · {batch.warnings} warnings · {batch.duplicatesRemoved} duplicates removed · {new Date(batch.createdAt).toLocaleString('en-AU')}</div>
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {canUndo && <button type="button" disabled={busyId === batch.id} onClick={() => void undo(batch)} style={{ border: '1px solid #d43d3d', borderRadius: 999, background: '#fff', color: '#a51f1f', padding: '9px 12px', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}><RotateCcw size={15} />{busyId === batch.id ? 'Undoing…' : 'Undo import'}</button>}
            <button type="button" onClick={() => setExpanded(isOpen ? null : batch.id)} aria-label={isOpen ? 'Hide import rows' : 'Show import rows'} style={{ border: 0, width: 38, height: 38, borderRadius: 999, background: '#eef2f6', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>{isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
          </div>
        </div>

        {isOpen && <div style={{ borderTop: '1px solid #e8edf2', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead><tr>{['Status', 'Player', 'Club', 'Submitted', 'Saved', 'Change', 'Result'].map(label => <th key={label} style={{ textAlign: 'left', padding: 10, background: '#f6f8fa', borderBottom: '1px solid #e8edf2', fontSize: 12 }}>{label}</th>)}</tr></thead>
            <tbody>{batch.rows.map((row, index) => <tr key={`${batch.id}-${index}`}>
              <td style={cell}>{row.decision === 'skip' ? 'Skipped' : row.error ? 'Failed' : 'Imported'}</td>
              <td style={cell}><strong>{row.playerName}</strong></td>
              <td style={cell}>{row.clubName}</td>
              <td style={cell}>{row.goals} goals{row.matches != null ? ` · ${row.matches} matches` : ''}</td>
              <td style={cell}>{row.outcome ? `${row.outcome.savedGoals} goals` : '—'}</td>
              <td style={cell}>{row.outcome?.weeklyGoals ? `+${row.outcome.weeklyGoals}` : row.outcome?.unchanged ? 'No change' : '—'}</td>
              <td style={{ ...cell, color: row.error ? '#a51f1f' : row.warning ? '#7a5a00' : '#314052' }}>{row.error ?? row.warning ?? (row.outcome?.duplicatesRemoved ? `${row.outcome.duplicatesRemoved} duplicate${row.outcome.duplicatesRemoved === 1 ? '' : 's'} removed` : 'Saved')}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </article>
    })}
  </section>
}

const cell = { padding: 10, borderBottom: '1px solid #eef2f6', verticalAlign: 'top', fontSize: 13 } as const
