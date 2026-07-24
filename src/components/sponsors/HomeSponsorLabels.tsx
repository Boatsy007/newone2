import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'

type EntityKind = 'club' | 'player'
type EntityTarget = { key: string; kind: EntityKind; id: string; host: HTMLElement; slot: HTMLElement }
type Sponsor = { id: string; name: string; logoUrl: string | null; websiteUrl: string | null }
type Sponsorship = { status: string; startDate?: string | null; endDate?: string | null; ctaUrl?: string | null; sponsor: Sponsor | null }

const ACTIVE_STATUSES = new Set(['APPROVED', 'ACTIVE', 'PAYMENT_COMPLETE', 'RENEWAL_DUE'])
const cache = new Map<string, Promise<Sponsorship | null>>()

function sponsorFor(kind: EntityKind, id: string) {
  const key = `${kind}:${id}`
  const existing = cache.get(key)
  if (existing) return existing
  const request = fetch(`/api/${kind === 'club' ? 'clubs' : 'players'}/${encodeURIComponent(id)}/sponsors`)
    .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
    .then((payload: { data?: Sponsorship[] }) => {
      const now = Date.now()
      return (Array.isArray(payload.data) ? payload.data : []).find(deal => {
        if (!deal?.sponsor || !ACTIVE_STATUSES.has(deal.status)) return false
        const start = deal.startDate ? Date.parse(deal.startDate) : NaN
        const end = deal.endDate ? Date.parse(deal.endDate) : NaN
        return (!Number.isFinite(start) || start <= now) && (!Number.isFinite(end) || end >= now)
      }) ?? null
    })
    .catch(() => null)
  cache.set(key, request)
  return request
}

export default function HomeSponsorLabels() {
  const { pathname } = useLocation()
  const [targets, setTargets] = useState<EntityTarget[]>([])
  const [deals, setDeals] = useState<Record<string, Sponsorship | null>>({})

  useEffect(() => {
    if (pathname !== '/') { setTargets([]); setDeals({}); return }
    let cancelled = false
    let timer = 0

    const attach = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (cancelled) return
        const hosts = Array.from(document.querySelectorAll<HTMLElement>([
          '.pf-number-one',
          '.pf-club-card:not(.loading)',
          '.hmvp-card:not(.hmvp-skeleton)',
          '.pf-player-record-card',
          '.pf-record-card[href^="/player/"]',
          '.pf-goal-row',
        ].join(',')))
        const next: EntityTarget[] = []
        for (const host of hosts) {
          const entity = resolveEntity(host)
          if (!entity) continue
          const key = `${entity.kind}:${entity.id}`
          let slot = host.querySelector<HTMLElement>(':scope > [data-entity-sponsor-slot="true"]')
          if (!slot) {
            slot = document.createElement('span')
            slot.className = 'pf-card-sponsor-slot'
            slot.dataset.entitySponsorSlot = 'true'
            host.appendChild(slot)
          }
          next.push({ ...entity, key, host, slot })
        }
        setTargets(current => sameTargets(current, next) ? current : next)
      }, 30)
    }

    attach()
    const observer = new MutationObserver(attach)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      observer.disconnect()
      document.querySelectorAll<HTMLElement>('[data-entity-sponsor-slot="true"]').forEach(node => node.remove())
    }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/' || targets.length === 0) return
    let active = true
    const unique = [...new Map(targets.map(target => [target.key, target])).values()]
    void Promise.all(unique.map(async target => [target.key, await sponsorFor(target.kind, target.id)] as const)).then(rows => {
      if (active) setDeals(current => ({ ...current, ...Object.fromEntries(rows) }))
    })
    return () => { active = false }
  }, [pathname, targets])

  if (pathname !== '/') return null
  return <>
    {targets.map((target, index) => createPortal(<SponsorMark sponsorship={deals[target.key]} />, target.slot, `${target.key}-${index}`))}
    <style>{styles}</style>
  </>
}

function resolveEntity(host: HTMLElement): Pick<EntityTarget, 'kind' | 'id'> | null {
  const isPlayerCard = host.matches('.hmvp-card,.pf-player-record-card,.pf-record-card[href^="/player/"],.pf-goal-row')
  if (isPlayerCard) {
    const playerHref = (host.matches('a[href^="/player/"]') ? host : host.querySelector<HTMLAnchorElement>('a[href^="/player/"]'))?.getAttribute('href')
    const playerMatch = playerHref?.match(/^\/player\/([^/?#]+)/)
    if (playerMatch) return { kind: 'player', id: decodeURIComponent(playerMatch[1]) }
  }

  const clubHref = (host.matches('a[href^="/team/"]') ? host : host.querySelector<HTMLAnchorElement>('a[href^="/team/"]'))?.getAttribute('href')
  const clubMatch = clubHref?.match(/^\/team\/([^/?#]+)/)
  if (clubMatch) return { kind: 'club', id: decodeURIComponent(clubMatch[1]) }

  const playerHref = (host.matches('a[href^="/player/"]') ? host : host.querySelector<HTMLAnchorElement>('a[href^="/player/"]'))?.getAttribute('href')
  const playerMatch = playerHref?.match(/^\/player\/([^/?#]+)/)
  return playerMatch ? { kind: 'player', id: decodeURIComponent(playerMatch[1]) } : null
}

function SponsorMark({ sponsorship }: { sponsorship?: Sponsorship | null }) {
  const sponsor = sponsorship?.sponsor ?? null
  const href = sponsorship?.ctaUrl || sponsor?.websiteUrl || null
  const content = <>
    <span className="pf-card-sponsor-label">Sponsored by</span>
    <span className={`pf-card-sponsor-logo${sponsor ? ' has-sponsor' : ''}`}>
      {sponsor?.logoUrl ? <img src={sponsor.logoUrl} alt={`${sponsor.name} logo`} /> : <span>{sponsor?.name || 'Sponsor logo'}</span>}
    </span>
  </>
  if (!href) return <span className="pf-card-sponsor-mark">{content}</span>
  return <span className="pf-card-sponsor-mark is-linked" role="link" tabIndex={0} aria-label={`Visit ${sponsor?.name ?? 'sponsor'} website`}
    onClick={event => { event.preventDefault(); event.stopPropagation(); window.open(href, '_blank', 'noopener,noreferrer') }}
    onKeyDown={event => { if (event.key !== 'Enter' && event.key !== ' ') return; event.preventDefault(); event.stopPropagation(); window.open(href, '_blank', 'noopener,noreferrer') }}>
    {content}
  </span>
}

function sameTargets(current: EntityTarget[], next: EntityTarget[]) {
  return current.length === next.length && next.every((target, index) => current[index]?.key === target.key && current[index]?.slot === target.slot)
}

const styles = `
.pf-card-sponsor-slot{display:block;width:100%;margin-top:auto;padding-top:11px;box-sizing:border-box;position:relative;z-index:4}
.pf-card-sponsor-mark{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-width:0;color:#687385;text-decoration:none;font-family:Barlow,Inter,Arial,sans-serif}
.pf-card-sponsor-mark.is-linked{cursor:pointer}.pf-card-sponsor-label{flex:0 0 auto;font-size:8px!important;font-weight:900!important;letter-spacing:.13em!important;text-transform:uppercase!important;color:#7a8593!important;line-height:1!important;margin:0!important;padding:0!important;background:none!important}
.pf-card-sponsor-logo{display:grid!important;place-items:center;min-width:74px;max-width:112px;height:30px;padding:3px 7px;border:1px dashed #bac5cf;border-radius:6px;background:#f8fafb;color:#8b95a2!important;font-size:8px!important;font-weight:850!important;letter-spacing:.06em!important;text-transform:uppercase!important;line-height:1!important;overflow:hidden;box-sizing:border-box;margin:0!important}
.pf-card-sponsor-logo.has-sponsor{border-style:solid;background:#fff}.pf-card-sponsor-logo img{display:block;max-width:96px;width:auto;height:23px;object-fit:contain}.pf-card-sponsor-mark.is-linked:hover .pf-card-sponsor-logo{border-color:#42b8ff;box-shadow:0 0 0 2px rgba(66,184,255,.12)}
.pf-number-one>.pf-card-sponsor-slot{grid-column:1/-1;padding-top:5px}.pf-number-one .pf-card-sponsor-mark{justify-content:flex-end}.hmvp-card>.pf-card-sponsor-slot{padding-top:8px;margin-bottom:25px}.pf-goal-row>.pf-card-sponsor-slot{grid-column:1/-1}
@media(max-width:620px){.pf-card-sponsor-slot{padding-top:9px}.pf-card-sponsor-logo{min-width:68px;max-width:96px;height:27px}.pf-card-sponsor-logo img{max-width:82px;height:20px}}
`
