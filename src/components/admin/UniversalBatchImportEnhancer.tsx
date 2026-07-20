import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { saveImportHandoffBatch, type ImportHandoff, type ImportHandoffKind } from '../../lib/importHandoff'

const routeFor = (kind: ImportHandoffKind) => kind === 'results' || kind === 'fixtures'
  ? '/admin/match-images'
  : kind === 'goalKickers'
    ? '/admin/goal-kicker-images'
    : kind === 'club' || kind === 'league' || kind === 'players'
      ? '/admin/profile-images'
      : '/admin/ladder-images'

const supportedBatchKinds: ImportHandoffKind[] = ['results', 'fixtures', 'goalKickers', 'club', 'league', 'players']

function isKind(value: string): value is ImportHandoffKind {
  return ['ladder', ...supportedBatchKinds].includes(value as ImportHandoffKind)
}

export default function UniversalBatchImportEnhancer() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (pathname !== '/admin/universal-imports') return

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.universal-item-actions button:last-child') : null
      if (!target) return
      const card = target.closest<HTMLElement>('.universal-item-card')
      const selectedKind = card?.querySelector<HTMLSelectElement>('select')?.value ?? ''
      if (!isKind(selectedKind) || selectedKind === 'ladder') return

      const handoffs: ImportHandoff[] = Array.from(document.querySelectorAll<HTMLElement>('.universal-item-card')).flatMap((item, index) => {
        const kind = item.querySelector<HTMLSelectElement>('select')?.value ?? ''
        const image = item.querySelector<HTMLImageElement>('img')?.src ?? ''
        const name = item.querySelector<HTMLElement>('.universal-item-body > strong')?.textContent?.trim() || `import-${index + 1}.png`
        if (kind !== selectedKind || !image.startsWith('data:')) return []
        const type = image.match(/^data:([^;]+)/)?.[1] || 'image/png'
        return [{ kind: selectedKind, name, type, dataUrl: image, createdAt: Date.now() }]
      })

      if (handoffs.length < 2) return
      event.preventDefault()
      event.stopPropagation()
      saveImportHandoffBatch(handoffs)
      navigate(`${routeFor(selectedKind)}?from=universal&type=${encodeURIComponent(selectedKind)}&batch=${handoffs.length}`)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [navigate, pathname])

  return null
}
