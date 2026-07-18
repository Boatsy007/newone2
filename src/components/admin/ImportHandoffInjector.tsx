import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { consumeImportHandoff, handoffToFile, type ImportHandoffKind } from '../../lib/importHandoff'

function acceptedKinds(pathname: string): ImportHandoffKind[] {
  if (pathname === '/admin/match-images') return ['results', 'fixtures']
  if (pathname === '/admin/goal-kicker-images') return ['goalKickers']
  if (pathname === '/admin/profile-images') return ['club', 'league', 'players']
  if (pathname === '/admin') return ['ladder']
  return []
}

export default function ImportHandoffInjector() {
  const { pathname } = useLocation()

  useEffect(() => {
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

      const handoff = consumeImportHandoff(accepted)
      if (!handoff) return
      const file = handoffToFile(handoff)
      const transfer = new DataTransfer()
      transfer.items.add(file)
      input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }

    window.setTimeout(inject, 0)
    return () => { cancelled = true }
  }, [pathname])

  return null
}
