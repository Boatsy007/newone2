/**
 * Advertising inventory service (Phase B8).
 * Bookable platform placements only. Entity cards use their club/player sponsor.
 */
import { prisma } from '../db/client.js'
import { logCommercialAction } from './audit.js'

export const PLACEMENTS = [
  { placement: 'HOMEPAGE_HERO', label: 'Homepage Hero' },
  { placement: 'HOMEPAGE_TOP_20', label: 'National Top 20' },
  { placement: 'HOMEPAGE_GOAL_KICKERS', label: 'Homepage Goal Kickers' },
  { placement: 'HOMEPAGE_WEEKLY_RECORDS', label: 'This Week in Footy' },
  { placement: 'HOMEPAGE_YEARLY_RECORDS', label: 'Yearly Records' },
  { placement: 'HOMEPAGE_SIDEBAR', label: 'Homepage Sidebar' },
  { placement: 'RANKINGS_SIDEBAR', label: 'Rankings Sidebar' },
  { placement: 'LEAGUE_PAGE', label: 'League Page' },
  { placement: 'CLUB_PAGE', label: 'Club Page' },
  { placement: 'NEWS_PAGE', label: 'News Page' },
  { placement: 'CHAMPIONSHIP_PAGE', label: 'Championship Page' },
  { placement: 'SEARCH_PAGE', label: 'Search Page' },
  { placement: 'STATISTICS_PAGE', label: 'Statistics Page' },
]

export async function seedInventory(): Promise<{ seeded: number }> {
  let seeded = 0
  for (const p of PLACEMENTS) {
    const exists = await prisma.adInventory.findFirst({ where: { placement: p.placement, label: p.label } })
    if (exists) continue
    await prisma.adInventory.create({ data: { placement: p.placement, label: p.label } })
    seeded++
  }
  return { seeded }
}

export async function listInventory(opts: { placement?: string; availableOnly?: boolean } = {}) {
  const rows = await prisma.adInventory.findMany({
    where: { deletedAt: null, ...(opts.placement ? { placement: opts.placement } : {}), ...(opts.availableOnly ? { available: true } : {}) },
    orderBy: [{ placement: 'asc' }, { priority: 'desc' }],
  })
  const sponsorshipIds = [...new Set(rows.map(row => row.activeSponsorshipId).filter((id): id is string => Boolean(id)))]
  if (sponsorshipIds.length === 0) return rows.map(row => ({ ...row, sponsorship: null }))
  const sponsorships = await prisma.sponsorship.findMany({ where: { id: { in: sponsorshipIds }, deletedAt: null } })
  const sponsorIds = [...new Set(sponsorships.map(deal => deal.sponsorId))]
  const sponsors = sponsorIds.length ? await prisma.commercialSponsor.findMany({ where: { id: { in: sponsorIds }, deletedAt: null }, select: { id: true, name: true, logoUrl: true, websiteUrl: true, tier: true } }) : []
  const sponsorById = new Map(sponsors.map(sponsor => [sponsor.id, sponsor]))
  const sponsorshipById = new Map(sponsorships.map(deal => [deal.id, { ...deal, sponsor: sponsorById.get(deal.sponsorId) ?? null }]))
  return rows.map(row => ({ ...row, sponsorship: row.activeSponsorshipId ? sponsorshipById.get(row.activeSponsorshipId) ?? null : null }))
}

export async function createInventory(body: Record<string, unknown>, performedBy = 'admin') {
  if (!body.placement || !body.label) return { ok: false as const, error: 'placement and label required' }
  const row = await prisma.adInventory.create({ data: { placement: String(body.placement), label: String(body.label), priority: Number(body.priority ?? 0), rotationGroup: (body.rotationGroup as string) ?? null, maxRotation: Number(body.maxRotation ?? 1), notes: (body.notes as string) ?? null } })
  await logCommercialAction('CREATE_INVENTORY', 'AdInventory', row.id, { placement: row.placement }, { performedBy })
  return { ok: true as const, inventory: row }
}

export async function bookInventory(inventoryId: string, sponsorshipId: string, opts: { start?: string; end?: string; performedBy?: string } = {}) {
  const inv = await prisma.adInventory.findUnique({ where: { id: inventoryId } })
  if (!inv || inv.deletedAt) return { ok: false as const, error: 'inventory not found' }
  const deal = await prisma.sponsorship.findUnique({ where: { id: sponsorshipId }, select: { id: true, deletedAt: true } })
  if (!deal || deal.deletedAt) return { ok: false as const, error: 'sponsorship not found' }
  const row = await prisma.adInventory.update({ where: { id: inventoryId }, data: { activeSponsorshipId: sponsorshipId, available: false, bookingStart: opts.start ? new Date(opts.start) : null, bookingEnd: opts.end ? new Date(opts.end) : null } })
  await logCommercialAction('BOOK_INVENTORY', 'AdInventory', inventoryId, { sponsorshipId }, { performedBy: opts.performedBy })
  return { ok: true as const, inventory: row }
}

export async function releaseInventory(inventoryId: string, performedBy = 'admin') {
  const inv = await prisma.adInventory.findUnique({ where: { id: inventoryId } })
  if (!inv) return { ok: false as const, error: 'inventory not found' }
  const row = await prisma.adInventory.update({ where: { id: inventoryId }, data: { activeSponsorshipId: null, available: true, bookingStart: null, bookingEnd: null } })
  await logCommercialAction('RELEASE_INVENTORY', 'AdInventory', inventoryId, { released: true }, { performedBy })
  return { ok: true as const, inventory: row }
}
