import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function AdminPlayerSponsorLinks() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (pathname !== '/admin') return
    let timer = 0
    const attach = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>('.table tbody tr'))
        for (const row of rows) {
          const publicLink = row.querySelector<HTMLAnchorElement>('a[href^="/player/"]')
          if (!publicLink) continue
          const match = publicLink.getAttribute('href')?.match(/^\/player\/([^/?#]+)/)
          if (!match) continue
          const cell = publicLink.closest('td')
          if (!cell || cell.querySelector('.admin-player-sponsor-link')) continue
          const playerName = row.querySelector('td strong')?.textContent?.trim() || 'Player'
          const button = document.createElement('button')
          button.type = 'button'
          button.className = 'admin-player-sponsor-link'
          button.textContent = 'Manage sponsor'
          button.addEventListener('click', event => {
            event.preventDefault()
            navigate(`/admin/player-sponsors/${encodeURIComponent(decodeURIComponent(match[1]))}?name=${encodeURIComponent(playerName)}`)
          })
          cell.appendChild(button)
        }
      }, 60)
    }
    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => { window.clearTimeout(timer); observer.disconnect() }
  }, [navigate, pathname])

  return <style>{`.admin-player-sponsor-link{display:block;margin-top:7px;border:0;border-radius:999px;background:#42b8ff;color:#050505;padding:7px 10px;font:900 10px/1 Barlow,Inter,Arial,sans-serif;text-transform:uppercase;cursor:pointer;white-space:nowrap}`}</style>
}
