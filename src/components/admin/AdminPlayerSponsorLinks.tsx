import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { getKey } from '../../lib/admin'

type PlayerRow = {
  id: string
  playerName: string
  clubId: string | null
  clubName: string
  leagueId: string | null
  leagueName: string
  state: string | null
}

export default function AdminPlayerSponsorLinks() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [state, setState] = useState('ALL')
  const [leagueId, setLeagueId] = useState('')
  const [clubId, setClubId] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (pathname !== '/admin' || !getKey()) { setPlayers([]); return }
    let active = true
    void fetch('/admin/players', { headers: { authorization: `Bearer ${getKey()}` } })
      .then(async response => {
        const payload = await response.json() as { data?: PlayerRow[]; error?: string }
        if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
        return Array.isArray(payload.data) ? payload.data : []
      })
      .then(rows => { if (active) setPlayers(rows) })
      .catch(() => { if (active) setPlayers([]) })
    return () => { active = false }
  }, [pathname])

  const leagues = useMemo(() => [...new Map(players.filter(row => state === 'ALL' || row.state === state).filter(row => row.leagueId).map(row => [row.leagueId!, { id: row.leagueId!, name: row.leagueName }])).values()].sort((a, b) => a.name.localeCompare(b.name)), [players, state])
  const clubs = useMemo(() => [...new Map(players.filter(row => (state === 'ALL' || row.state === state) && (!leagueId || row.leagueId === leagueId)).filter(row => row.clubId).map(row => [row.clubId!, { id: row.clubId!, name: row.clubName }])).values()].sort((a, b) => a.name.localeCompare(b.name)), [players, state, leagueId])

  useEffect(() => {
    if (pathname !== '/admin') { setHost(null); return }
    let timer = 0
    const attach = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const table = document.querySelector<HTMLTableElement>('.table')
        if (!table) { setHost(null); return }
        const card = table.closest<HTMLElement>('.card')
        if (!card) return
        let target = card.querySelector<HTMLElement>(':scope > .admin-player-filter-host')
        if (!target) {
          target = document.createElement('div')
          target.className = 'admin-player-filter-host'
          card.insertBefore(target, table)
        }
        setHost(current => current === target ? current : target)

        const byId = new Map(players.map(player => [player.id, player]))
        for (const row of Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'))) {
          const publicLink = row.querySelector<HTMLAnchorElement>('a[href^="/player/"]')
          const match = publicLink?.getAttribute('href')?.match(/^\/player\/([^/?#]+)/)
          if (!publicLink || !match) continue
          const id = decodeURIComponent(match[1])
          const player = byId.get(id)
          const playerName = player?.playerName || row.querySelector('td strong')?.textContent?.trim() || ''
          const visible = (!query || playerName.toLowerCase().includes(query.toLowerCase()))
            && (state === 'ALL' || player?.state === state)
            && (!leagueId || player?.leagueId === leagueId)
            && (!clubId || player?.clubId === clubId)
          row.style.display = visible ? '' : 'none'
          const cell = publicLink.closest('td')
          if (!cell) continue
          publicLink.textContent = 'View profile'
          let edit = cell.querySelector<HTMLButtonElement>('.admin-player-sponsor-link')
          if (!edit) {
            edit = document.createElement('button')
            edit.type = 'button'
            edit.className = 'admin-player-sponsor-link'
            cell.appendChild(edit)
          }
          edit.textContent = 'Edit player'
          edit.onclick = event => {
            event.preventDefault()
            navigate(`/admin/player-sponsors/${encodeURIComponent(id)}?name=${encodeURIComponent(playerName)}`)
          }
        }
      }, 50)
    }
    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      document.querySelectorAll<HTMLTableRowElement>('.table tbody tr').forEach(row => { row.style.display = '' })
      document.querySelectorAll<HTMLElement>('.admin-player-filter-host').forEach(node => node.remove())
    }
  }, [navigate, pathname, players, state, leagueId, clubId, query])

  if (!host || pathname !== '/admin') return <style>{styles}</style>
  return <>{createPortal(<div className="admin-player-filters">
    <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search player" />
    <select value={state} onChange={event => { setState(event.target.value); setLeagueId(''); setClubId('') }}>
      <option value="ALL">All states</option>{['ACT','NSW','NT','QLD','SA','TAS','VIC','WA'].map(code => <option key={code} value={code}>{code}</option>)}
    </select>
    <select value={leagueId} onChange={event => { setLeagueId(event.target.value); setClubId('') }}><option value="">All leagues</option>{leagues.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}</select>
    <select value={clubId} onChange={event => setClubId(event.target.value)}><option value="">All clubs</option>{clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}</select>
  </div>, host)}<style>{styles}</style></>
}

const styles = `.admin-player-filter-host{margin-bottom:15px}.admin-player-filters{display:grid;grid-template-columns:minmax(180px,1.3fr) repeat(3,minmax(145px,1fr));gap:9px}.admin-player-filters input,.admin-player-filters select{width:100%;border:1px solid #dce3eb;border-radius:11px;background:#fff;padding:11px 12px;font:inherit;box-sizing:border-box}.admin-player-sponsor-link{display:block;margin-top:7px;border:0;border-radius:999px;background:#42b8ff;color:#050505;padding:7px 10px;font:900 10px/1 Barlow,Inter,Arial,sans-serif;text-transform:uppercase;cursor:pointer;white-space:nowrap}@media(max-width:820px){.admin-player-filters{grid-template-columns:1fr 1fr}}@media(max-width:520px){.admin-player-filters{grid-template-columns:1fr}}`
