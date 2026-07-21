import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'

type Sponsor = {
  id: string
  name: string
  logoUrl: string | null
  websiteUrl: string | null
}

type Sponsorship = {
  status: string
  startDate?: string | null
  endDate?: string | null
  ctaUrl?: string | null
  sponsor: Sponsor | null
}

type Inventory = {
  id: string
  placement: string
  sponsorship: Sponsorship | null
}

type SponsorPlacement = {
  placement: string
  label: string
  targetId: string
  selector: string
}

const placements: SponsorPlacement[] = [
  { placement: 'HOMEPAGE_TOP_20', label: 'Presented by', targetId: 'pf-home-sponsor-top-20', selector: '.pf-top .pf-section-head > div:first-child, .pf-top .pf-section-head' },
  { placement: 'HOMEPAGE_GOAL_KICKERS', label: 'Powered by', targetId: 'pf-home-sponsor-goal-kickers', selector: '.pf-player-records-head > div:first-child' },
  { placement: 'HOMEPAGE_WEEKLY_RECORDS', label: 'Brought to you by', targetId: 'pf-home-sponsor-weekly', selector: '.pf-records-home.is-weekly .pf-records-head > div:first-child' },
  { placement: 'HOMEPAGE_YEARLY_RECORDS', label: 'Presented by', targetId: 'pf-home-sponsor-yearly', selector: '.pf-records-home.is-yearly .pf-records-head > div:first-child' },
]

const ACTIVE_STATUSES = new Set(['APPROVED', 'ACTIVE', 'PAYMENT_COMPLETE', 'RENEWAL_DUE'])

export default function HomeSponsorLabels() {
  const { pathname } = useLocation()
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [targets, setTargets] = useState<Record<string, HTMLElement>>({})

  useEffect(() => {
    if (pathname !== '/') {
      setInventory([])
      return
    }
    let active = true
    fetch('/api/commercial/inventory')
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: Inventory[] }) => {
        if (active) setInventory(Array.isArray(payload.data) ? payload.data : [])
      })
      .catch(() => { if (active) setInventory([]) })
    return () => { active = false }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/') {
      setTargets({})
      return
    }

    let cancelled = false
    const attach = () => {
      if (cancelled) return
      const next: Record<string, HTMLElement> = {}
      for (const config of placements) {
        const heading = document.querySelector<HTMLElement>(config.selector)
        if (!heading) continue
        let node = document.getElementById(config.targetId)
        if (!node) {
          node = document.createElement('span')
          node.id = config.targetId
          node.className = 'pf-home-sponsor-slot'
          heading.appendChild(node)
        }
        next[config.placement] = node
      }
      setTargets(current => {
        const currentKeys = Object.keys(current)
        const nextKeys = Object.keys(next)
        if (currentKeys.length === nextKeys.length && nextKeys.every(key => current[key] === next[key])) return current
        return next
      })
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelled = true
      observer.disconnect()
      setTargets({})
    }
  }, [pathname])

  const activeByPlacement = useMemo(() => {
    const now = Date.now()
    const map = new Map<string, Sponsorship>()
    for (const row of inventory) {
      const deal = row.sponsorship
      if (!deal?.sponsor?.name || !ACTIVE_STATUSES.has(deal.status)) continue
      const starts = deal.startDate ? new Date(deal.startDate).getTime() : null
      const ends = deal.endDate ? new Date(deal.endDate).getTime() : null
      if (starts != null && Number.isFinite(starts) && starts > now) continue
      if (ends != null && Number.isFinite(ends) && ends < now) continue
      if (!map.has(row.placement)) map.set(row.placement, deal)
    }
    return map
  }, [inventory])

  if (pathname !== '/') return null

  return <>
    {placements.map(config => {
      const target = targets[config.placement]
      const deal = activeByPlacement.get(config.placement)
      if (!target || !deal?.sponsor) return null
      return createPortal(<SponsorMark label={config.label} sponsorship={deal} />, target)
    })}
    <style>{`
      .pf-home-sponsor-slot{display:block}
      .pf-home-sponsor-mark{display:inline-flex;align-items:center;gap:8px;margin-top:8px;color:#687385;text-decoration:none;font-family:Barlow,Inter,Arial,sans-serif;max-width:100%}
      .pf-home-sponsor-mark>span{font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;white-space:nowrap}
      .pf-home-sponsor-mark>strong{color:#111318;font-size:12px;font-weight:900;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pf-home-sponsor-mark img{display:block;width:auto;max-width:64px;height:22px;object-fit:contain}
      a.pf-home-sponsor-mark:hover strong{color:#0783c9}
      .pf-records-home.is-weekly .pf-home-sponsor-mark{color:#075b88}
      .pf-records-home.is-weekly .pf-home-sponsor-mark>strong{color:#050505}
      @media(max-width:620px){.pf-home-sponsor-mark{gap:6px;margin-top:7px}.pf-home-sponsor-mark>span{font-size:8px}.pf-home-sponsor-mark>strong{font-size:11px}.pf-home-sponsor-mark img{max-width:52px;height:19px}}
    `}</style>
  </>
}

function SponsorMark({ label, sponsorship }: { label: string; sponsorship: Sponsorship }) {
  const sponsor = sponsorship.sponsor!
  const href = sponsorship.ctaUrl || sponsor.websiteUrl
  const content = <>
    <span>{label}</span>
    {sponsor.logoUrl && <img src={sponsor.logoUrl} alt="" />}
    <strong>{sponsor.name}</strong>
  </>

  return href
    ? <a className="pf-home-sponsor-mark" href={href} target="_blank" rel="noreferrer sponsored">{content}</a>
    : <span className="pf-home-sponsor-mark">{content}</span>
}
