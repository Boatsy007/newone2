import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  consumeImportHandoff,
  consumeImportHandoffBatch,
  handoffToFile,
  type ImportHandoffKind,
} from '../../lib/importHandoff'

function acceptedKinds(pathname: string): ImportHandoffKind[] {
  if (pathname === '/admin/match-images') return ['results', 'fixtures']
  if (pathname === '/admin/goal-kicker-images') return ['goalKickers']
  if (pathname === '/admin/profile-images') return ['club', 'league', 'players']
  return []
}

export default function ImportHandoffInjector() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (pathname === '/admin') {
      const raw = sessionStorage.getItem('playfooty_import_handoff')
      if (raw) {
        try {
          const handoff = JSON.parse(raw) as { kind?: string; createdAt?: number }
          if (handoff.kind === 'ladder' && Date.now() - Number(handoff.createdAt || 0) < 30 * 60 * 1000) {
            navigate('/admin/ladder-images?from=universal&type=ladder', { replace: true })
            return
          }
        } catch {
          sessionStorage.removeItem('playfooty_import_handoff')
        }
      }
    }

    const accepted = acceptedKinds(pathname)
    if (!accepted.length) return

    let cancelled = false
    let attempts = 0
    const inject = () => {
      if (cancelled) return
      const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*="image"]')
      if (!input) {
        attempts += 1
        if (attempts < 40) window.setTimeout(inject, 100)
        return
      }

      const batch = consumeImportHandoffBatch(accepted)
      const single = consumeImportHandoff(accepted)
      const handoffs = batch.length ? batch : single ? [single] : []
      if (!handoffs.length) return

      const transfer = new DataTransfer()
      for (const handoff of handoffs) transfer.items.add(handoffToFile(handoff))
      input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }

    window.setTimeout(inject, 0)
    return () => { cancelled = true }
  }, [navigate, pathname])

  return null
}
