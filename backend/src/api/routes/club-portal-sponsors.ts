import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, membershipForClub, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'
import { createSponsor, updateSponsor } from '../../commercial/sponsors.service.js'
import { createSponsorship, softDeleteSponsorship } from '../../commercial/sponsorships.service.js'

const router = Router()
const EDITABLE_STATUSES = ['PENDING', 'REJECTED', 'VERIFICATION_REQUIRED']
const LOGO_BUCKET = process.env.SUPABASE_LOGO_BUCKET || 'playfooty-logos'
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'])
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

type LegacySponsorRow = {
  id: string
  scope: string
  clubId: string | null
  leagueId: string | null
  name: string
  websiteUrl: string | null
  logoUrl: string | null
  description: string | null
  tier: string | null
  startDate: Date | null
  endDate: Date | null
  displayOrder: number
  createdAt: Date
  updatedAt: Date
}

function requireSponsorPermission(req: any, res: any, next: any) {
  const membership = res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
  if (!membership || !roleCan(membership.role, 'sponsors')) {
    return res.status(403).json({ error: 'Your club role cannot manage sponsors' })
  }
  next()
}

async function ownedDeal(clubId: string, id: string) {
  return prisma.sponsorship.findFirst({
    where: { id, clubId, deletedAt: null },
    include: { sponsor: true },
  })
}

router.use(authenticateClubUser)
router.use('/clubs/:clubId', requireActiveClubMembership)

router.get('/clubs/:clubId/sponsors', async (req, res) => {
  const clubId = req.params.clubId

  const commercialRows = await prisma.sponsorship.findMany({
    where: { clubId, deletedAt: null },
    include: { sponsor: true },
    orderBy: [{ displayPriority: 'desc' }, { createdAt: 'desc' }],
  }).catch(() => [])

  const legacyRows = await prisma.$queryRawUnsafe<LegacySponsorRow[]>(`
    SELECT
      id,
      scope,
      "clubId",
      "leagueId",
      name,
      "websiteUrl",
      "logoUrl",
      description,
      tier,
      "startDate",
      "endDate",
      "displayOrder",
      "createdAt",
      "updatedAt"
    FROM sponsors
    WHERE "clubId" = $1
      AND scope = 'CLUB'
      AND active = true
      AND "deletedAt" IS NULL
    ORDER BY "displayOrder" ASC, "createdAt" DESC
  `, clubId).catch(() => [])

  const commercialNames = new Set(
    commercialRows.map(row => row.sponsor.name.trim().toLowerCase()),
  )
  const legacyMapped = legacyRows
    .filter(row => !commercialNames.has(row.name.trim().toLowerCase()))
    .map(row => ({
      id: `legacy:${row.id}`,
      sponsorId: row.id,
      scope: row.scope,
      clubId: row.clubId,
      leagueId: row.leagueId,
      package: 'CLUB_PARTNER',
      tier: row.tier ?? 'CLUB',
      status: 'APPROVED',
      startDate: row.startDate,
      endDate: row.endDate,
      displayPriority: row.displayOrder,
      bannerPosition: 'CLUB_PROFILE',
      ctaLabel: 'Visit sponsor',
      ctaUrl: row.websiteUrl,
      notes: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sponsor: {
        id: row.id,
        name: row.name,
        businessName: row.name,
        logoUrl: row.logoUrl,
        websiteUrl: row.websiteUrl,
        email: null,
        phone: null,
        description: row.description,
        industry: null,
      },
    }))

  res.json({ data: [...commercialRows, ...legacyMapped] })
})

router.post('/clubs/:clubId/sponsors', requireSponsorPermission, async (req, res) => {
  try {
    const club = await prisma.club.findFirst({
      where: { id: req.params.clubId, archivedAt: null },
      select: { id: true, name: true, state: { select: { code: true } } },
    })
    if (!club) return res.status(404).json({ error: 'Club not found' })

    const body = (req.body ?? {}) as Record<string, unknown>
    const name = String(body.name ?? '').trim()
    if (!name) return res.status(400).json({ error: 'Sponsor name is required' })

    const actor = `club:${req.clubUser!.id}`
    const created = await createSponsor({
      name,
      businessName: String(body.businessName ?? name),
      websiteUrl: body.websiteUrl || null,
      email: body.email || null,
      phone: body.phone || null,
      description: body.description || null,
      industry: body.industry || null,
      state: club.state.code,
      tier: body.tier || 'CLUB',
      status: 'PENDING',
    }, actor)
    if (!created.ok) return res.status(400).json({ error: created.error })

    const deal = await createSponsorship({
      sponsorId: created.sponsor.id,
      scope: 'CLUB',
      clubId: club.id,
      package: body.package || 'CLUB_PARTNER',
      tier: body.tier || 'CLUB',
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      displayPriority: Number(body.displayPriority ?? 0),
      bannerPosition: body.bannerPosition || 'CLUB_PROFILE',
      ctaLabel: body.ctaLabel || 'Visit sponsor',
      ctaUrl: body.ctaUrl || body.websiteUrl || null,
      notes: body.notes || null,
      currency: 'AUD',
    }, actor)
    if (!deal.ok) return res.status(400).json({ error: deal.error })

    res.status(201).json({
      data: { ...deal.sponsorship, sponsor: created.sponsor },
      message: 'Sponsor saved for PlayFooty approval',
    })
  } catch (error) {
    res.status(500).json({ error: 'Unable to create sponsor', detail: String(error) })
  }
})

router.patch('/clubs/:clubId/sponsors/:id', requireSponsorPermission, async (req, res) => {
  try {
    const deal = await ownedDeal(req.params.clubId, req.params.id)
    if (!deal) return res.status(404).json({ error: 'Sponsorship not found' })
    if (!EDITABLE_STATUSES.includes(deal.status)) {
      return res.status(409).json({ error: 'Approved or active sponsorships must be changed by PlayFooty Admin' })
    }

    const body = (req.body ?? {}) as Record<string, unknown>
    const actor = `club:${req.clubUser!.id}`
    const sponsorFields: Record<string, unknown> = {}
    for (const key of ['name', 'businessName', 'websiteUrl', 'email', 'phone', 'description', 'industry', 'facebookUrl', 'instagramUrl', 'brandPrimary', 'brandSecondary']) {
      if (key in body) sponsorFields[key] = body[key] || null
    }
    if (Object.keys(sponsorFields).length) {
      const updated = await updateSponsor(deal.sponsorId, sponsorFields, actor)
      if (!updated.ok) return res.status(400).json({ error: updated.error })
    }

    const updates: Record<string, unknown> = {}
    for (const key of ['package', 'tier', 'bannerPosition', 'ctaLabel', 'ctaUrl', 'notes']) {
      if (key in body) updates[key] = body[key] || null
    }
    if ('startDate' in body) updates.startDate = body.startDate ? new Date(String(body.startDate)) : null
    if ('endDate' in body) updates.endDate = body.endDate ? new Date(String(body.endDate)) : null
    if ('displayPriority' in body) updates.displayPriority = Number(body.displayPriority ?? 0)

    const saved = Object.keys(updates).length
      ? await prisma.sponsorship.update({ where: { id: deal.id }, data: updates })
      : deal
    const sponsor = await prisma.commercialSponsor.findUnique({ where: { id: deal.sponsorId } })
    res.json({ data: { ...saved, sponsor }, message: 'Sponsor changes saved' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to update sponsor', detail: String(error) })
  }
})

router.post('/clubs/:clubId/sponsors/:id/logo', requireSponsorPermission, async (req, res) => {
  try {
    const deal = await ownedDeal(req.params.clubId, req.params.id)
    if (!deal) return res.status(404).json({ error: 'Sponsorship not found' })
    if (!EDITABLE_STATUSES.includes(deal.status)) {
      return res.status(409).json({ error: 'Approved or active sponsor logos must be changed by PlayFooty Admin' })
    }

    const body = (req.body ?? {}) as Record<string, unknown>
    const contentType = String(body.contentType ?? 'image/png')
    if (!IMAGE_TYPES.has(contentType)) return res.status(400).json({ error: 'Use PNG, JPG, WEBP or SVG' })

    const raw = String(body.dataUrl ?? body.base64 ?? '')
    const base64 = raw.includes(',') ? raw.split(',').pop()! : raw
    const buffer = Buffer.from(base64, 'base64')
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Sponsor logo must be between 1 byte and 5 MB' })
    }

    const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
    if (!url || !key) return res.status(503).json({ error: 'Sponsor image storage is not configured' })

    const path = `sponsor-logos/${deal.sponsorId}/${Date.now()}.${EXT[contentType] ?? 'png'}`
    const upload = await fetch(`${url}/storage/v1/object/${LOGO_BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        apikey: key,
        'content-type': contentType,
        'x-upsert': 'true',
      },
      body: buffer,
    })
    if (!upload.ok) return res.status(400).json({ error: `Logo upload failed: HTTP ${upload.status}` })

    const logoUrl = `${url}/storage/v1/object/public/${LOGO_BUCKET}/${path}`
    const sponsor = await prisma.commercialSponsor.update({
      where: { id: deal.sponsorId },
      data: { logoUrl, squareLogoUrl: logoUrl },
    })
    res.json({ data: sponsor, message: 'Sponsor logo uploaded' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to upload sponsor logo', detail: String(error) })
  }
})

router.delete('/clubs/:clubId/sponsors/:id', requireSponsorPermission, async (req, res) => {
  try {
    const deal = await ownedDeal(req.params.clubId, req.params.id)
    if (!deal) return res.status(404).json({ error: 'Sponsorship not found' })
    if (!EDITABLE_STATUSES.includes(deal.status)) {
      return res.status(409).json({ error: 'Approved or active sponsorships must be archived by PlayFooty Admin' })
    }

    const result = await softDeleteSponsorship(deal.id, `club:${req.clubUser!.id}`)
    res.status(result.ok ? 200 : 404).json(result.ok ? { data: { archived: true } } : { error: result.error })
  } catch (error) {
    res.status(500).json({ error: 'Unable to archive sponsor', detail: String(error) })
  }
})

export { router as clubPortalSponsorsRouter }
