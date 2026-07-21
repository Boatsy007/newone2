/*
 * Sponsorship & commercial public API (Phase B8) — additive.
 * Public reads remain available; commercial writes are admin-gated.
 */
import { Router } from 'express'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { cachePublic } from '../middleware/cache-middleware.js'
import { attachActor, requireAdminActor } from '../middleware/permissions.js'
import { listSponsors, getSponsor, createSponsor, updateSponsor, softDeleteSponsor } from '../../commercial/sponsors.service.js'
import { createSponsorship, transition, softDeleteSponsorship, getClubSponsorships, getLeagueSponsorships, type SponsorshipStatus } from '../../commercial/sponsorships.service.js'
import { listInventory, createInventory, bookInventory, releaseInventory } from '../../commercial/inventory.service.js'
import { listTiers, addCustomTier } from '../../commercial/tiers.service.js'
import { setPremium, getPremium, listPremium } from '../../commercial/premium.service.js'
import { commercialReports } from '../../commercial/reports.service.js'
import { runCommercialSweep } from '../../commercial/index.js'
import { prisma } from '../../db/client.js'
import { logger } from '../../utils/logger.js'

const LOGO_BUCKET = process.env.SUPABASE_LOGO_BUCKET || 'playfooty-logos'
const MAX_LOGO_BYTES = 5 * 1024 * 1024
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'])
const LOGO_EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }

function cleanFileName(value: unknown, fallback: string) {
  return (typeof value === 'string' ? value : fallback).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || fallback
}

function decodeSponsorLogo(body: Record<string, unknown>) {
  const contentType = typeof body.contentType === 'string' ? body.contentType.trim() : 'image/png'
  if (!LOGO_TYPES.has(contentType)) throw new Error('Unsupported logo type. Use PNG, JPG, WEBP or SVG.')
  const raw = typeof body.dataUrl === 'string' ? body.dataUrl : typeof body.base64 === 'string' ? body.base64 : ''
  if (!raw) throw new Error('Logo file data required')
  const base64 = raw.includes(',') ? raw.split(',').pop()! : raw
  const buffer = Buffer.from(base64, 'base64')
  if (!buffer.length) throw new Error('Logo file is empty')
  if (buffer.length > MAX_LOGO_BYTES) throw new Error('Logo must be 5MB or smaller')
  return { buffer, contentType, fileName: cleanFileName(body.fileName, `logo.${LOGO_EXT[contentType] ?? 'png'}`) }
}

async function uploadSponsorLogo(sponsorId: string, body: Record<string, unknown>) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase Storage is not configured.')
  const sponsor = await prisma.commercialSponsor.findUnique({ where: { id: sponsorId }, select: { id: true, logoUrl: true, deletedAt: true } })
  if (!sponsor || sponsor.deletedAt) throw new Error('Sponsor not found')
  const { buffer, contentType, fileName } = decodeSponsorLogo(body)
  const path = `sponsor-logos/${sponsorId}/${Date.now()}-${fileName}`
  const upload = await fetch(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${LOGO_BUCKET}/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': contentType, 'x-upsert': 'true' },
    body: buffer,
  })
  if (!upload.ok) throw new Error(`Sponsor logo upload failed: HTTP ${upload.status}`)
  const logoUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${LOGO_BUCKET}/${path}`
  return prisma.commercialSponsor.update({ where: { id: sponsorId }, data: { logoUrl, squareLogoUrl: logoUrl } })
}

const sponsors = Router()
sponsors.use(attachActor)
sponsors.get('/', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await listSponsors({ state: req.query.state as string | undefined, industry: req.query.industry as string | undefined, status: req.query.status as string | undefined }) })
})
sponsors.get('/:id', publicRateLimit, cachePublic(300), async (req, res) => {
  const sponsor = await getSponsor(String(req.params.id))
  if (!sponsor) return res.status(404).json({ error: 'sponsor not found' })
  res.json({ data: sponsor })
})
sponsors.post('/', requireAdminActor, async (req, res) => {
  const result = await createSponsor((req.body ?? {}) as Record<string, unknown>, 'admin')
  res.status(result.ok ? 201 : 400).json(result.ok ? { data: result.sponsor } : { error: result.error })
})
sponsors.patch('/:id', requireAdminActor, async (req, res) => {
  const result = await updateSponsor(String(req.params.id), (req.body ?? {}) as Record<string, unknown>, 'admin')
  res.status(result.ok ? 200 : 400).json(result.ok ? { data: result.sponsor } : { error: result.error })
})
sponsors.post('/:id/logo', requireAdminActor, async (req, res) => {
  try { res.json({ data: await uploadSponsorLogo(String(req.params.id), (req.body ?? {}) as Record<string, unknown>) }) }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : String(error) }) }
})
sponsors.delete('/:id/logo', requireAdminActor, async (req, res) => {
  const sponsor = await prisma.commercialSponsor.findUnique({ where: { id: String(req.params.id) }, select: { id: true, deletedAt: true } })
  if (!sponsor || sponsor.deletedAt) return res.status(404).json({ error: 'sponsor not found' })
  res.json({ data: await prisma.commercialSponsor.update({ where: { id: sponsor.id }, data: { logoUrl: null, squareLogoUrl: null } }) })
})
sponsors.delete('/:id', requireAdminActor, async (req, res) => {
  const result = await softDeleteSponsor(String(req.params.id), 'admin')
  res.status(result.ok ? 200 : 404).json(result.ok ? { data: { archived: true } } : { error: result.error })
})

const commercial = Router()
commercial.use(attachActor)
commercial.get('/reports', requireAdminActor, async (_req, res) => { res.json({ data: await commercialReports() }) })
commercial.post('/sponsorships', requireAdminActor, async (req, res) => {
  const result = await createSponsorship((req.body ?? {}) as Record<string, unknown>, 'admin')
  res.status(result.ok ? 201 : 400).json(result.ok ? { data: result.sponsorship } : { error: result.error })
})
commercial.patch('/sponsorships/:id', requireAdminActor, async (req, res) => {
  const body = (req.body ?? {}) as { status?: SponsorshipStatus; note?: string }
  if (!body.status) return res.status(400).json({ error: 'status required' })
  const result = await transition(String(req.params.id), body.status, { note: body.note, performedBy: 'admin' })
  res.status(result.status).json(result.ok ? { data: result.sponsorship } : { error: result.error })
})
commercial.delete('/sponsorships/:id', requireAdminActor, async (req, res) => {
  const result = await softDeleteSponsorship(String(req.params.id), 'admin')
  res.status(result.ok ? 200 : 404).json(result.ok ? { data: { archived: true } } : { error: result.error })
})
commercial.get('/inventory', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await listInventory({ placement: req.query.placement as string | undefined, availableOnly: req.query.available === 'true' }) })
})
commercial.post('/inventory', requireAdminActor, async (req, res) => {
  const result = await createInventory((req.body ?? {}) as Record<string, unknown>, 'admin')
  res.status(result.ok ? 201 : 400).json(result.ok ? { data: result.inventory } : { error: result.error })
})
commercial.post('/inventory/:id/book', requireAdminActor, async (req, res) => {
  const body = (req.body ?? {}) as { sponsorshipId?: string; start?: string; end?: string }
  if (!body.sponsorshipId) return res.status(400).json({ error: 'sponsorshipId required' })
  const result = await bookInventory(String(req.params.id), body.sponsorshipId, { start: body.start, end: body.end, performedBy: 'admin' })
  res.status(result.ok ? 200 : 400).json(result.ok ? { data: result.inventory } : { error: result.error })
})
commercial.post('/inventory/:id/release', requireAdminActor, async (req, res) => {
  const result = await releaseInventory(String(req.params.id), 'admin')
  res.status(result.ok ? 200 : 404).json(result.ok ? { data: result.inventory } : { error: result.error })
})
commercial.get('/tiers', publicRateLimit, cachePublic(3600), async (_req, res) => { res.json({ data: await listTiers() }) })
commercial.post('/tiers', requireAdminActor, async (req, res) => {
  const result = await addCustomTier((req.body ?? {}) as Record<string, unknown>, 'admin')
  res.status(result.ok ? 201 : 400).json(result.ok ? { data: result.tier } : { error: result.error })
})
commercial.get('/premium', requireAdminActor, async (req, res) => {
  res.json({ data: await listPremium({ scope: req.query.scope as 'CLUB' | 'LEAGUE' | undefined, status: req.query.status as string | undefined }) })
})
commercial.get('/premium/:scope/:entityId', publicRateLimit, cachePublic(300), async (req, res) => {
  const scope = String(req.params.scope).toUpperCase()
  if (scope !== 'CLUB' && scope !== 'LEAGUE') return res.status(400).json({ error: 'scope must be club|league' })
  res.json({ data: await getPremium(scope, String(req.params.entityId)) })
})
commercial.post('/premium/:scope/:entityId', requireAdminActor, async (req, res) => {
  const scope = String(req.params.scope).toUpperCase()
  if (scope !== 'CLUB' && scope !== 'LEAGUE') return res.status(400).json({ error: 'scope must be club|league' })
  res.json({ data: await setPremium(scope, String(req.params.entityId), (req.body ?? {}) as Record<string, unknown>, 'admin') })
})
commercial.post('/sweep', requireAdminActor, async (req, res) => {
  try { res.json({ data: await runCommercialSweep({ seed: (req.body as { seed?: boolean })?.seed, performedBy: 'admin' }) }) }
  catch (error) { logger.error('commercial sweep', { detail: String(error) }); res.status(500).json({ error: 'sweep failed' }) }
})

const commercialClub = Router()
commercialClub.get('/:id/sponsors', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await getClubSponsorships(String(req.params.id), req.query.all !== 'true') })
})
const commercialLeague = Router()
commercialLeague.get('/:id/sponsors', publicRateLimit, cachePublic(300), async (req, res) => {
  res.json({ data: await getLeagueSponsorships(String(req.params.id), req.query.all !== 'true') })
})

export { sponsors as sponsorsRouter, commercial as commercialRouter, commercialClub as commercialClubRouter, commercialLeague as commercialLeagueRouter }
