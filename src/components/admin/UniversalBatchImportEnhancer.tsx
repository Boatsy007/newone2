import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { saveImportHandoffBatch, type ImportHandoff, type ImportHandoffKind } from '../../lib/importHandoff'

const BATCH_KINDS: ImportHandoffKind[] = ['results', 'fixtures', 'goalKickers', 'club', 'league', 'players']

const LABELS: Record<ImportHandoffKind, string> = {
  ladder: 'ladders',
  results: 'results',
  fixtures: 'fixtures',
  goalKickers: 'goal kickers',
  club: 'club profiles',
  league: 'league profiles',
  players: 'player profiles',
}

const routeFor = (kind: ImportHandoffKind) => {
  if (kind === 'results' || kind === 'fixtures') return '/admin/match-images'
  if (kind === 'goalKickers') return '/admin/goal-kicker-images'
  if (kind === 'club' || kind === 'league' || kind === 'players') return '/admin/profile-images'
  return '/admin/ladder-images'
}

function collect(kind: ImportHandoffKind): ImportHandoff[] {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.universal-item-card'))
  const values: ImportHandoff[] = []

  cards.forEach((card, index) => {
    const cardKind = card.querySelector<HTMLSelectElement>('select')?.value
    const image = card.querySelector<HTMLImageElement>('img')?.src ?? ''
    if (cardKind !== kind || !image.startsWith('data:')) return

    const name = card.querySelector<HTMLElement>('.universal-item-body > strong')?.textContent?.trim()
      || `import-${index + 1}.png`
    const type = image.match(/^data:([^;]+)/)?.[1] || 'image/png'
    values.push({ kind, name, type, dataUrl: image, createdAt: Date.now() })
  })

  return values
}

export default function UniversalBatchImportEnhancer() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (pathname !== '/admin/universal-imports') return
    const observer = new MutationObserver(() => setRevision(value => value + 1))
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    const onChange = () => setRevision(value => value + 1)
    document.addEventListener('change', onChange)
    return () => {
      observer.disconnect()
      document.removeEventListener('change', onChange)
    }
  }, [pathname])

  const groups = useMemo(() => {
    if (pathname !== '/admin/universal-imports') return []
    return BATCH_KINDS.map(kind => ({ kind, count: collect(kind).length })).filter(group => group.count > 0)
  }, [pathname, revision])

  if (pathname !== '/admin/universal-imports' || groups.length === 0) return null

  const openBatch = (kind: ImportHandoffKind) => {
    const handoffs = collect(kind)
    if (!handoffs.length) return
    saveImportHandoffBatch(handoffs)
    navigate(`${routeFor(kind)}?from=universal&type=${encodeURIComponent(kind)}&batch=${handoffs.length}`)
  }

  return <aside className="universal-bulk-panel" aria-label="Bulk import actions">
    <strong>Open classified images in bulk</strong>
    <span>Each button carries every image of that type into one review session.</span>
    <div>
      {groups.map(group => <button key={group.kind} type="button" onClick={() => openBatch(group.kind)}>
        Open all {LABELS[group.kind]} <b>{group.count}</b>
      </button>)}
    </div>
    <style>{`
      .universal-bulk-panel{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:1000;width:min(920px,calc(100% - 24px));background:#050505;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:16px;box-shadow:0 22px 55px rgba(0,0,0,.35);font-family:Inter,system-ui,sans-serif}
      .universal-bulk-panel>strong{display:block;font-size:18px;text-transform:uppercase}.universal-bulk-panel>span{display:block;color:#cbd2dc;margin-top:4px;font-size:13px}.universal-bulk-panel>div{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.universal-bulk-panel button{border:0;border-radius:999px;background:#42b8ff;color:#050505;padding:11px 15px;font-weight:950;cursor:pointer}.universal-bulk-panel button b{display:inline-grid;place-items:center;min-width:24px;height:24px;margin-left:7px;padding:0 7px;border-radius:999px;background:#050505;color:#fff}
      @media(max-width:720px){.universal-bulk-panel{bottom:8px;padding:13px}.universal-bulk-panel>div{display:grid}.universal-bulk-panel button{width:100%;min-height:46px}}
    `}</style>
  </aside>
}
