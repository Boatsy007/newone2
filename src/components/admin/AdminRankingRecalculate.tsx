import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getKey } from '../../lib/admin'

export default function AdminRankingRecalculate() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setVisible(window.location.pathname === '/admin')
    sync()
    window.addEventListener('popstate', sync)
    const timer = window.setInterval(sync, 500)
    return () => {
      window.removeEventListener('popstate', sync)
      window.clearInterval(timer)
    }
  }, [])

  if (!visible || !getKey()) return null

  const recalculate = async () => {
    if (busy) return
    const confirmed = window.confirm(
      'Recalculate every national club ranking using the current verified ladder data? Results and fixtures will not be deleted or changed.',
    )
    if (!confirmed) return

    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/admin/platform/recalculate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${getKey()}`,
        },
      })
      const payload = await response.json().catch(() => ({})) as {
        data?: { clubsRanked?: number }
        error?: string
      }
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
      const count = payload.data?.clubsRanked
      setMessage(`Rankings recalculated${typeof count === 'number' ? ` for ${count} clubs` : ''}.`)
      window.setTimeout(() => setMessage(null), 6000)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ranking recalculation failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', right: 18, bottom: 220, zIndex: 95, display: 'grid', justifyItems: 'end', gap: 8 }}>
      {message && (
        <div style={{ maxWidth: 310, borderRadius: 12, background: '#050505', color: '#fff', padding: '10px 13px', fontWeight: 800, boxShadow: '0 10px 30px rgba(0,0,0,.25)' }}>
          {message}
        </div>
      )}
      <button
        type="button"
        onClick={() => void recalculate()}
        disabled={busy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 58,
          border: 0,
          borderRadius: 999,
          padding: '0 22px',
          background: '#35b6ff',
          color: '#050505',
          fontWeight: 950,
          textTransform: 'uppercase',
          letterSpacing: '.035em',
          cursor: busy ? 'wait' : 'pointer',
          boxShadow: '0 12px 30px rgba(0,0,0,.24)',
        }}
      >
        <RefreshCw size={21} className={busy ? 'pf-ranking-spin' : undefined} />
        {busy ? 'Recalculating…' : 'Recalculate rankings'}
        <style>{`@keyframes pf-ranking-spin{to{transform:rotate(360deg)}}.pf-ranking-spin{animation:pf-ranking-spin .8s linear infinite}`}</style>
      </button>
    </div>
  )
}
