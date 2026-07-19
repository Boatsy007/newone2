import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Database, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import SavedGoalKickerRecords from './SavedGoalKickerRecords'

export default function GoalKickerMistakeManager() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [refreshKey] = useState(0)
  const [message, setMessage] = useState('')

  if (pathname !== '/admin/goal-kicker-images') return null

  return <>
    <button type="button" onClick={() => setOpen(true)} style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 70, border: 0, borderRadius: 999, background: '#050505', color: '#fff', padding: '12px 16px', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 12px 30px rgba(0,0,0,.24)', cursor: 'pointer' }}>
      <Database size={17} /> Manage saved records
    </button>
    {open && createPortal(<div role="dialog" aria-modal="true" aria-label="Manage saved goal-kicker records" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(5,5,5,.68)', padding: 18, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '20px auto', background: '#eef2f6', borderRadius: 20, padding: 16, boxShadow: '0 24px 70px rgba(0,0,0,.32)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div><strong style={{ fontSize: 20 }}>Correct a committed mistake</strong><div style={{ color: '#65758b', marginTop: 3 }}>Delete only the incorrect row, then reimport the corrected screenshot.</div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close saved records" style={{ border: 0, width: 40, height: 40, borderRadius: 999, background: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={20} /></button>
        </header>
        {message && <div style={{ background: '#fff8dc', border: '1px solid #ead994', borderRadius: 12, padding: 12, marginBottom: 12 }}>{message}</div>}
        <SavedGoalKickerRecords leagueId="" season={new Date().getFullYear().toString()} refreshKey={refreshKey} onMessage={setMessage} />
      </div>
    </div>, document.body)}
  </>
}
