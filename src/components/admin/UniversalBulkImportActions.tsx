import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { saveImportHandoffBatch, type ImportHandoff, type ImportHandoffKind } from '../../lib/importHandoff'

type BatchKind = Exclude<ImportHandoffKind, 'ladder'>

type BatchGroup = {
  kind: BatchKind
  label: string
  count: number
  values: ImportHandoff[]
}

const labels: Record<BatchKind, string> = {
  results: 'results',
  fixtures: 'fixtures',
  goalKickers: 'goal kickers',
  club: 'club profiles',
  league: 'league profiles',
  players: 'player profiles',
}

const routeFor = (kind: BatchKind) => kind === 'results' || kind === 'fixtures'
  ? '/admin/match-images'
  : kind === 'goalKickers'
    ? '/admin/goal-kicker-images'
    : '/admin/profile-images'

export default function UniversalBulkImportActions() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [groups, setGroups] = useState<BatchGroup[]>([])

  useEffect(() => {
    if (pathname !== '/admin/universal-imports') {
      setTarget(null)
      setGroups([])
      return
    }

    let cancelled = false
    const sync = () => {
      if (cancelled) return
      const grid = document.querySelector<HTMLElement>('.universal-item-grid')
      if (!grid) {
        setTarget(null)
        setGroups([])
        return
      }

      let slot = document.getElementById('universal-bulk-import-actions')
      if (!slot) {
        slot = document.createElement('div')
        slot.id = 'universal-bulk-import-actions'
        grid.insertAdjacentElement('beforebegin', slot)
      }
      setTarget(slot)

      const grouped = new Map<BatchKind, ImportHandoff[]>()
      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.universal-item-card'))
      for (const card of cards) {
        const select = card.querySelector<HTMLSelectElement>('select')
        const image = card.querySelector<HTMLImageElement>('img')
        const name = card.querySelector<HTMLElement>('.universal-item-body > strong')?.textContent?.trim() || `import-${Date.now()}.png`
        const kind = select?.value as ImportHandoffKind | undefined
        if (!kind || kind === 'unknown' || kind === 'ladder' || !image?.src.startsWith('data:')) continue
        const values = grouped.get(kind as BatchKind) ?? []
        values.push({
          kind,
          name,
          type: image.src.match(/^data:([^;]+)/)?.[1] || 'image/png',
          dataUrl: image.src,
          createdAt: Date.now(),
        })
        grouped.set(kind as BatchKind, values)
      }

      setGroups(Array.from(grouped.entries()).map(([kind, values]) => ({
        kind,
        label: labels[kind],
        count: values.length,
        values,
      })))
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['value', 'src'] })
    document.addEventListener('change', sync)
    return () => {
      cancelled = true
      observer.disconnect()
      document.removeEventListener('change', sync)
      document.getElementById('universal-bulk-import-actions')?.remove()
      setTarget(null)
    }
  }, [pathname])

  if (!target || groups.length === 0) return null

  const openBatch = (group: BatchGroup) => {
    saveImportHandoffBatch(group.values)
    navigate(`${routeFor(group.kind)}?from=universal&type=${encodeURIComponent(group.kind)}&batch=${group.count}`)
  }

  return createPortal(<section className="universal-bulk-panel" aria-label="Bulk import actions">
    <div>
      <strong>Open classified images in bulk</strong>
      <span>Each button carries every image of that type into one review session.</span>
    </div>
    <div className="universal-bulk-buttons">
      {groups.map(group => <button key={group.kind} type="button" onClick={() => openBatch(group)}>
        Open all {group.label} <b>{group.count}</b>
      </button>)}
    </div>
    <style>{`
      .universal-bulk-panel{background:#050505;color:#fff;border-radius:18px;padding:18px;display:grid;gap:14px}.universal-bulk-panel>div:first-child{display:grid;gap:4px}.universal-bulk-panel strong{font-size:20px}.universal-bulk-panel span{color:#cbd2dc;font-size:13px}.universal-bulk-buttons{display:flex;gap:10px;flex-wrap:wrap}.universal-bulk-buttons button{border:0;border-radius:999px;min-height:46px;padding:11px 16px;background:#42b8ff;color:#050505;font:inherit;font-weight:950;cursor:pointer;display:inline-flex;align-items:center;gap:9px}.universal-bulk-buttons b{min-width:25px;height:25px;padding:0 7px;border-radius:999px;background:#050505;color:#fff;display:grid;place-items:center;font-size:12px}@media(max-width:680px){.universal-bulk-buttons{display:grid}.universal-bulk-buttons button{width:100%;justify-content:space-between}}
    `}</style>
  </section>, target)
}
