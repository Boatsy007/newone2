import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Database, History, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import SavedGoalKickerRecords from './SavedGoalKickerRecords'
import GoalKickerImportHistory from './GoalKickerImportHistory'

export default function GoalKickerMistakeManager() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'records' | 'history'>('records')
  const [refreshKey, setRefreshKey] = useState(0)
  const [message, setMessage] = useState('')

  if (pathname !== '/admin/goal-kicker-images') return null

  return <>
    <button type="button" onClick={() => setOpen(true)} style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 70, border: 0, borderRadius: 999, background: '#050505', color: '#fff', padding: '12px 16px', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 12px 30px rgba(0,0,0,.24)', cursor: 'pointer' }}>
      <Database size={17} /> Manage records & imports
    </button>
    {open && createPortal(<div role="dialog" aria-modal="true" aria-label="Manage goal-kicker records and imports" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(5,5,5,.68)', padding: 18, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '20px auto', background: '#eef2f6', borderRadius: 20, padding: 16, boxShadow: '0 24px 70px rgba(0,0,0,.32)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div><strong style={{ fontSize: 20 }}>Goal-kicker data management</strong><div style={{ color: '#65758b', marginTop: 3 }}>Delete one saved mistake or review and safely undo an entire screenshot import.</div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close goal-kicker management" style={{ border: 0, width: 40, height: 40, borderRadius: 999, background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={20} /></button>
        </header>

        <nav style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setTab('records')} style={tabButton(tab === 'records')}><Database size={16} />Saved records</button>
          <button type="button" onClick={() => setTab('history')} style={tabButton(tab === 'history')}><History size={16} />Import history & undo</button>
        </nav>

        {message && <div style={{ background: '#fff8dc', border: '1px solid #ead994', borderRadius: 12, padding: 12, marginBottom: 12 }}>{message}</div>}
        {tab === 'records'
          ? <SavedGoalKickerRecords leagueId="" season={new Date().getFullYear().toString()} refreshKey={refreshKey} onMessage={setMessage} />
          : <GoalKickerImportHistory refreshKey={refreshKey} onMessage={setMessage} onChanged={() => setRefreshKey(value => value + 1)} />}
      </div>
    </div>, document.body)}
  </>
}

function tabButton(active: boolean) {
  return {
    border: active ? '1px solid #050505' : '1px solid #dce3eb',
    borderRadius: 999,
    background: active ? '#050505' : '#fff',
    color: active ? '#fff' : '#314052',
    padding: '10px 14px',
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  } as const
}
