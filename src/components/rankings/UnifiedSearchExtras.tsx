import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, FileText, Search, Trophy, Video } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type SearchData = {
  clubs: { id: string; name: string; state: string; leagueName?: string | null; aliases?: string[]; href: string }[]
  players: { id: string; name: string; clubName: string; leagueName: string; goals: number; href: string }[]
  matches: { id: string; kind: string; title: string; leagueName: string; date?: string | null; round?: string | null; href: string }[]
  news: { id: string; title: string; summary: string; category: string; href: string }[]
  highlights: { id: string; title: string; clubName: string; leagueName?: string | null; winner: boolean; weekKey: string; href: string }[]
  records: { id: string; title: string; summary: string; href: string }[]
}
type SearchPayload = { data?: Partial<SearchData>; meta?: { partial?: string[] } }
const EMPTY: SearchData = { clubs: [], players: [], matches: [], news: [], highlights: [], records: [] }
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export default function UnifiedSearchExtras() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [data, setData] = useState<SearchData>(EMPTY)
  const [partial, setPartial] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let input: HTMLInputElement | null = null
    let timer = 0
    let controller: AbortController | null = null

    function run() {
      window.clearTimeout(timer)
      controller?.abort()
      const nextQuery = input?.value.trim() ?? ''
      setQuery(nextQuery)
      if (nextQuery.length < 2) {
        setData(EMPTY)
        setPartial([])
        return
      }
      timer = window.setTimeout(() => {
        controller = new AbortController()
        fetch(`/api/search?q=${encodeURIComponent(nextQuery)}`, { signal: controller.signal })
          .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
          .then((payload: SearchPayload) => {
            const value = payload.data ?? {}
            setData({
              clubs: value.clubs ?? [],
              players: value.players ?? [],
              matches: value.matches ?? [],
              news: value.news ?? [],
              highlights: value.highlights ?? [],
              records: value.records ?? [],
            })
            setPartial(payload.meta?.partial ?? [])
          })
          .catch(error => {
            if ((error as Error).name !== 'AbortError') {
              setData(EMPTY)
              setPartial(['all'])
            }
          })
      }, 230)
    }

    function attach() {
      const content = document.querySelector<HTMLElement>('.pf-search-content')
      const nextInput = document.querySelector<HTMLInputElement>('.pf-search-field input')
      if (!content || !nextInput) {
        setTarget(null)
        setData(EMPTY)
        setQuery('')
        return
      }
      let slot = document.getElementById('pf-unified-search-extras')
      if (!slot) {
        slot = document.createElement('div')
        slot.id = 'pf-unified-search-extras'
        content.appendChild(slot)
      }
      setTarget(slot)
      if (input === nextInput) return
      input?.removeEventListener('input', run)
      input = nextInput
      input.addEventListener('input', run)
      run()
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      input?.removeEventListener('input', run)
      window.clearTimeout(timer)
      controller?.abort()
      document.getElementById('pf-unified-search-extras')?.remove()
    }
  }, [])

  useEffect(() => {
    const dialog = target?.closest<HTMLElement>('.pf-search-dialog')
    if (!dialog) return
    const onKey = (event: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return
      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('.pf-search-result,.pf-search-shortcuts button,.pf-search-suggestions button'))
      if (!buttons.length) return
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'Enter' && current >= 0) {
        event.preventDefault()
        buttons[current].click()
        return
      }
      event.preventDefault()
      const next = event.key === 'ArrowUp' ? (current <= 0 ? buttons.length - 1 : current - 1) : (current + 1) % buttons.length
      buttons[next].focus()
    }
    dialog.addEventListener('keydown', onKey)
    return () => dialog.removeEventListener('keydown', onKey)
  }, [target])

  const aliasClubs = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    return data.clubs.filter(club => !normalize(club.name).includes(q) && (club.aliases ?? []).some(alias => normalize(alias).includes(q)))
  }, [data.clubs, query])

  const hasExtras = aliasClubs.length + data.players.length + data.matches.length + data.news.length + data.highlights.length + data.records.length > 0

  useEffect(() => {
    const content = target?.closest<HTMLElement>('.pf-search-content')
    if (!content) return
    const emptyState = Array.from(content.querySelectorAll<HTMLElement>('.pf-search-status')).find(node => node.textContent?.includes('No matches'))
    if (!emptyState) return
    const previous = emptyState.style.display
    if (hasExtras) emptyState.style.display = 'none'
    return () => { emptyState.style.display = previous }
  }, [target, hasExtras])

  if (!target) return null
  const go = (href: string) => {
    document.querySelector<HTMLButtonElement>('.pf-search-header>button')?.click()
    navigate(href)
  }

  return createPortal(<>
    {partial.length > 0 && <div className="pf-unified-warning">Some search sources are temporarily unavailable. Remaining results are shown.</div>}
    {aliasClubs.length > 0 && <Group title="Club alias matches">{aliasClubs.map(row => <Row key={row.id} title={row.name} detail={`${row.leagueName ?? 'Community football club'} · ${row.state}`} metric="Alias" icon={<Search size={19}/>} onClick={() => go(row.href)}/>)}</Group>}
    {data.players.length > 0 && <Group title="Direct player profiles">{data.players.map(row => <Row key={row.id} title={row.name} detail={`${row.clubName} · ${row.leagueName}`} metric={`${row.goals} goals`} icon={<Trophy size={19}/>} onClick={() => go(row.href)}/>)}</Group>}
    {data.matches.length > 0 && <Group title="Matches">{data.matches.map(row => <Row key={`${row.kind}-${row.id}`} title={row.title} detail={`${row.leagueName}${row.round ? ` · ${row.round}` : ''}${row.date ? ` · ${dateLabel(row.date)}` : ''}`} metric={row.kind === 'result' ? 'Final' : 'Fixture'} icon={<CalendarDays size={19}/>} onClick={() => go(row.href)}/>)}</Group>}
    {data.highlights.length > 0 && <Group title="Highlights">{data.highlights.map(row => <Row key={row.id} title={row.title} detail={`${row.clubName}${row.leagueName ? ` · ${row.leagueName}` : ''}`} metric={row.winner ? 'Winner' : row.weekKey} icon={<Video size={19}/>} onClick={() => go(row.href)}/>)}</Group>}
    {data.news.length > 0 && <Group title="Indexed news">{data.news.map(row => <Row key={row.id} title={row.title} detail={row.summary} metric={row.category} icon={<FileText size={19}/>} onClick={() => go(row.href)}/>)}</Group>}
    {data.records.length > 0 && <Group title="Records">{data.records.map(row => <Row key={row.id} title={row.title} detail={row.summary} icon={<Trophy size={19}/>} onClick={() => go(row.href)}/>)}</Group>}
    {(hasExtras || partial.length > 0) && <style>{`.pf-unified-warning{margin:12px 0 0;padding:10px 12px;border:1px solid #e9c467;border-radius:8px;background:#fff8e5;color:#75520c;font-size:12px;font-weight:850}.pf-unified-icon{flex:0 0 auto;display:grid;place-items:center;width:46px;height:46px;border-radius:7px;background:#eef8ff;color:#111318}@media(max-width:720px){#pf-unified-search-extras .pf-search-group>div{grid-template-columns:1fr}#pf-unified-search-extras .pf-search-result{min-height:70px}}`}</style>}
  </>, target)
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="pf-search-group"><h3>{title}</h3><div>{children}</div></section>
}
function Row({ title, detail, metric, icon, onClick }: { title: string; detail: string; metric?: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" className="pf-search-result" onClick={onClick}><span className="pf-unified-icon">{icon}</span><span><strong>{title}</strong><small>{detail}</small></span>{metric && <em>{metric}</em>}</button>
}
function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
