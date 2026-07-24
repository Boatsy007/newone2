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
  selector: string
  slug: string
}

const placements: SponsorPlacement[] = [
  { placement: 'HOMEPAGE_HERO', selector: '.pf-number-one', slug: 'hero' },
  { placement: 'HOMEPAGE_TOP_20', selector: '.pf-club-card:not(.loading)', slug: 'top-20' },
  { placement: 'HOMEPAGE_MVP', selector: '.hmvp-card:not(.hmvp-skeleton)', slug: 'mvp' },
  { placement: 'HOMEPAGE_GOAL_KICKERS', selector: '.pf-player-record-card,.pf-goal-row', slug: 'goal-kickers' },
  { placement: 'HOMEPAGE_WEEKLY_RECORDS', selector: '.pf-records-home.is-weekly .pf-record-card', slug: 'weekly' },
  { placement: 'HOMEPAGE_YEARLY_RECORDS', selector: '.pf-records-home.is-yearly .pf-record-card', slug: 'yearly' },
  { placement: 'HOMEPAGE_FEATURES', selector: '.pf-feature-panel', slug: 'features' },
  { placement: 'HOMEPAGE_LATEST_NEWS', selector: '.pf-news-list .pf-promo-row', slug: 'latest-news' },
]

const ACTIVE_STATUSES = new Set(['APPROVED', 'ACTIVE', 'PAYMENT_COMPLETE', 'RENEWAL_DUE'])

export default function HomeSponsorLabels() {
  const { pathname } = useLocation()
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [targets, setTargets] = useState<Record<string, HTMLElement[]>>({})

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
      const next: Record<string, HTMLElement[]> = {}

      for (const config of placements) {
        const hosts = Array.from(document.querySelectorAll<HTMLElement>(config.selector))
        const slots = hosts.map((host, index) => {
          const key = `${config.slug}-${index}`
          let slot = host.querySelector<HTMLElement>(`:scope > [data-home-sponsor-key="${key}"]`)
          if (!slot) {
            slot = document.createElement('span')
            slot.className = 'pf-card-sponsor-slot'
            slot.dataset.homeSponsorKey = key
            slot.dataset.homeSponsorSlot = 'true'
            host.appendChild(slot)
          }
          return slot
        })
        next[config.placement] = slots
      }

      setTargets(current => sameTargets(current, next) ? current : next)
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelled = true
      observer.disconnect()
      document.querySelectorAll<HTMLElement>('[data-home-sponsor-slot="true"]').forEach(node => node.remove())
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
    {placements.flatMap(config => {
      const deal = activeByPlacement.get(config.placement)
      return (targets[config.placement] ?? []).map((target, index) => createPortal(
        <SponsorMark sponsorship={deal} />,
        target,
        `${config.placement}-${index}`,
      ))
    })}
    <style>{styles}</style>
  </>
}

function SponsorMark({ sponsorship }: { sponsorship?: Sponsorship }) {
  const sponsor = sponsorship?.sponsor ?? null
  const href = sponsorship?.ctaUrl || sponsor?.websiteUrl || null
  const content = <>
    <span className="pf-card-sponsor-label">Sponsored by</span>
    <span className={`pf-card-sponsor-logo${sponsor ? ' has-sponsor' : ''}`}>
      {sponsor?.logoUrl
        ? <img src={sponsor.logoUrl} alt={`${sponsor.name} logo`} />
        : <span>{sponsor?.name || 'Sponsor logo'}</span>}
    </span>
  </>

  if (!href) return <span className="pf-card-sponsor-mark">{content}</span>

  return <span
    className="pf-card-sponsor-mark is-linked"
    role="link"
    tabIndex={0}
    aria-label={`Visit ${sponsor?.name ?? 'sponsor'} website`}
    onClick={event => {
      event.preventDefault()
      event.stopPropagation()
      window.open(href, '_blank', 'noopener,noreferrer')
    }}
    onKeyDown={event => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      window.open(href, '_blank', 'noopener,noreferrer')
    }}
  >{content}</span>
}

function sameTargets(current: Record<string, HTMLElement[]>, next: Record<string, HTMLElement[]>) {
  const currentKeys = Object.keys(current)
  const nextKeys = Object.keys(next)
  if (currentKeys.length !== nextKeys.length) return false
  return nextKeys.every(key => {
    const before = current[key] ?? []
    const after = next[key] ?? []
    return before.length === after.length && after.every((node, index) => before[index] === node)
  })
}

const styles = `
  .pf-card-sponsor-slot{display:block;width:100%;margin-top:auto;padding-top:11px;box-sizing:border-box;position:relative;z-index:4}
  .pf-card-sponsor-mark{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-width:0;color:#687385;text-decoration:none;font-family:Barlow,Inter,Arial,sans-serif}
  .pf-card-sponsor-mark.is-linked{cursor:pointer}
  .pf-card-sponsor-label{flex:0 0 auto;font-size:8px!important;font-weight:900!important;letter-spacing:.13em!important;text-transform:uppercase!important;color:#7a8593!important;line-height:1!important;margin:0!important;padding:0!important;background:none!important}
  .pf-card-sponsor-logo{display:grid!important;place-items:center;min-width:74px;max-width:112px;height:30px;padding:3px 7px;border:1px dashed #bac5cf;border-radius:6px;background:#f8fafb;color:#8b95a2!important;font-size:8px!important;font-weight:850!important;letter-spacing:.06em!important;text-transform:uppercase!important;line-height:1!important;overflow:hidden;box-sizing:border-box;margin:0!important}
  .pf-card-sponsor-logo.has-sponsor{border-style:solid;background:#fff}
  .pf-card-sponsor-logo img{display:block;max-width:96px;width:auto;height:23px;object-fit:contain}
  .pf-card-sponsor-mark.is-linked:hover .pf-card-sponsor-logo{border-color:#42b8ff;box-shadow:0 0 0 2px rgba(66,184,255,.12)}
  .pf-number-one>.pf-card-sponsor-slot{grid-column:1/-1;padding-top:5px}
  .pf-number-one .pf-card-sponsor-mark{justify-content:flex-end}
  .pf-feature-panel>.pf-card-sponsor-slot{position:absolute;left:29px;right:29px;bottom:18px;width:auto;padding-top:0;z-index:5}
  .pf-feature-panel .pf-card-sponsor-label{color:rgba(255,255,255,.68)!important}
  .pf-feature-panel .pf-card-sponsor-logo{background:rgba(255,255,255,.96);border-color:rgba(255,255,255,.5)}
  .pf-goal-row>.pf-card-sponsor-slot,.pf-news-list .pf-promo-row>.pf-card-sponsor-slot{grid-column:1/-1}
  .pf-records-home.is-weekly .pf-card-sponsor-label{color:rgba(5,5,5,.66)!important}
  .pf-records-home.is-weekly .pf-card-sponsor-logo{background:rgba(255,255,255,.82);border-color:rgba(5,5,5,.35);color:#34404b!important}
  .hmvp-card>.pf-card-sponsor-slot{padding-top:8px;margin-bottom:25px}
  @media(max-width:620px){
    .pf-card-sponsor-slot{padding-top:9px}
    .pf-card-sponsor-logo{min-width:68px;max-width:96px;height:27px}
    .pf-card-sponsor-logo img{max-width:82px;height:20px}
    .pf-feature-panel>.pf-card-sponsor-slot{left:18px;right:18px;bottom:13px}
  }
`
