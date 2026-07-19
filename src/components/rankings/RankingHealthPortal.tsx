import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import RankingHealthPanel from './RankingHealthPanel'

export default function RankingHealthPortal() {
  const { pathname } = useLocation()
  const publicPage = pathname === '/rankings'
  const adminPage = pathname.startsWith('/admin')
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!publicPage && !adminPage) { setTarget(null); document.getElementById('pf-ranking-health-slot')?.remove(); return }
    let active = true
    const attach = () => {
      if (!active) return
      const host = publicPage
        ? document.querySelector<HTMLElement>('.rankings-page')
        : document.querySelector<HTMLElement>('main')
      if (!host) return
      let slot = document.getElementById('pf-ranking-health-slot')
      if (!slot) {
        slot = document.createElement('div')
        slot.id = 'pf-ranking-health-slot'
        slot.className = publicPage ? 'pf-ranking-health-public' : 'pf-ranking-health-admin'
        if (publicPage) {
          const header = host.querySelector('.rankings-header')
          header?.insertAdjacentElement('afterend', slot)
          if (!header) host.prepend(slot)
        } else {
          host.prepend(slot)
        }
      }
      setTarget(slot)
    }
    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { active = false; observer.disconnect(); setTarget(null); document.getElementById('pf-ranking-health-slot')?.remove() }
  }, [pathname, publicPage, adminPage])

  if (!target) return null
  return createPortal(<><RankingHealthPanel admin={adminPage}/><style>{`.pf-ranking-health-public{max-width:1180px;margin:16px auto 0;padding:0 20px}.pf-ranking-health-admin{max-width:1180px;margin:0 auto;padding:0 20px}@media(max-width:620px){.pf-ranking-health-public,.pf-ranking-health-admin{padding:0 12px}}`}</style></>, target)
}
