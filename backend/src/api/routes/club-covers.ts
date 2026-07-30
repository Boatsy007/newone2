import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { requireAdminKey } from '../middleware/auth.js'
import { authenticateClubUser, membershipForClub, roleCan, auditMembership } from '../../auth/club-auth.js'

const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const maxBytes = 10 * 1024 * 1024

type CoverRow = { coverPhotoUrl: string | null }

async function readCover(clubId: string) {
  const rows = await prisma.$queryRawUnsafe<CoverRow[]>(
    'SELECT "coverPhotoUrl" FROM "club_profiles" WHERE "clubId" = $1 LIMIT 1',
    clubId,
  )
  return rows[0]?.coverPhotoUrl ?? null
}

async function writeCover(clubId: string, value: string | null) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "club_profiles" ("id", "clubId", "coverPhotoUrl", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, now(), now())
     ON CONFLICT ("clubId") DO UPDATE SET "coverPhotoUrl" = EXCLUDED."coverPhotoUrl", "updatedAt" = now()`,
    clubId,
    value,
  )
}

async function clubExists(clubId: string) {
  return Boolean(await prisma.club.findFirst({ where: { id: clubId, archivedAt: null }, select: { id: true } }))
}

async function uploadCover(clubId: string, body: any) {
  const contentType = String(body?.contentType ?? '')
  if (!imageTypes.has(contentType)) throw new Error('Use a PNG, JPG or WEBP image')
  const raw = String(body?.dataUrl ?? '')
  const base64 = raw.includes(',') ? raw.split(',').pop() ?? '' : raw
  const buffer = Buffer.from(base64, 'base64')
  if (!buffer.length || buffer.length > maxBytes) throw new Error('Cover photo must be between 1 byte and 10 MB')

  const storageUrl = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  const bucket = process.env.SUPABASE_NEWS_BUCKET || process.env.SUPABASE_LOGO_BUCKET || 'playfooty-logos'
  if (!storageUrl || !key) throw new Error('Photo storage is not configured')

  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
  const path = `club-covers/${clubId}/${Date.now()}.${ext}`
  const response = await fetch(`${storageUrl}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': contentType, 'x-upsert': 'true' },
    body: buffer,
  })
  if (!response.ok) throw new Error(`Cover photo upload failed: HTTP ${response.status}`)
  const publicUrl = `${storageUrl}/storage/v1/object/public/${bucket}/${path}`
  await writeCover(clubId, publicUrl)
  return publicUrl
}

const publicRouter = Router()
publicRouter.get('/:clubId', async (req, res) => {
  try {
    if (!await clubExists(req.params.clubId)) return res.status(404).json({ error: 'Club not found' })
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
    res.json({ data: { clubId: req.params.clubId, coverPhotoUrl: await readCover(req.params.clubId) } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load club cover photo', detail: String(error) })
  }
})

const clubPortalRouter = Router()
clubPortalRouter.use('/:clubId', async (req: any, res, next) => {
  await authenticateClubUser(req, res, async () => {
    const membership = await membershipForClub(req.clubUser.id, String(req.params.clubId))
    if (!membership || membership.status !== 'ACTIVE' || !roleCan(membership.role, 'profile')) {
      return res.status(403).json({ error: 'You do not have permission to manage this club cover photo' })
    }
    res.locals.clubMembership = membership
    next()
  })
})
clubPortalRouter.get('/:clubId', async (req, res) => {
  try { res.json({ data: { coverPhotoUrl: await readCover(req.params.clubId) } }) }
  catch (error) { res.status(500).json({ error: 'Unable to load club cover photo', detail: String(error) }) }
})
clubPortalRouter.post('/:clubId', async (req: any, res) => {
  try {
    const before = await readCover(req.params.clubId)
    const coverPhotoUrl = await uploadCover(req.params.clubId, req.body)
    const membership = res.locals.clubMembership
    await auditMembership(membership.id, req.params.clubId, req.clubUser.id, 'COVER_PHOTO_UPDATED', req.clubUser.id, { before, after: coverPhotoUrl })
    res.status(201).json({ data: { coverPhotoUrl }, message: 'Cover photo uploaded and published' })
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to upload cover photo' }) }
})
clubPortalRouter.delete('/:clubId', async (req: any, res) => {
  try {
    const before = await readCover(req.params.clubId)
    await writeCover(req.params.clubId, null)
    const membership = res.locals.clubMembership
    await auditMembership(membership.id, req.params.clubId, req.clubUser.id, 'COVER_PHOTO_REMOVED', req.clubUser.id, { before })
    res.json({ data: { coverPhotoUrl: null }, message: 'Cover photo removed. The default club hero has been restored.' })
  } catch (error) { res.status(500).json({ error: 'Unable to remove cover photo', detail: String(error) }) }
})

const adminRouter = Router()
adminRouter.use(requireAdminKey)
adminRouter.get('/', async (_req, res) => {
  try {
    const clubs = await prisma.club.findMany({ where: { sport: 'FOOTBALL', archivedAt: null, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, logoUrl: true, state: { select: { code: true } } } })
    const covers = await prisma.$queryRawUnsafe<Array<{ clubId: string; coverPhotoUrl: string | null }>>('SELECT "clubId", "coverPhotoUrl" FROM "club_profiles" WHERE "coverPhotoUrl" IS NOT NULL')
    const byClub = new Map(covers.map(row => [row.clubId, row.coverPhotoUrl]))
    res.json({ data: clubs.map(club => ({ ...club, state: club.state.code, coverPhotoUrl: byClub.get(club.id) ?? null })) })
  } catch (error) { res.status(500).json({ error: 'Unable to load club covers', detail: String(error) }) }
})
adminRouter.post('/:clubId', async (req, res) => {
  try {
    if (!await clubExists(req.params.clubId)) return res.status(404).json({ error: 'Club not found' })
    const coverPhotoUrl = await uploadCover(req.params.clubId, req.body)
    res.status(201).json({ data: { coverPhotoUrl }, message: 'Club cover photo published' })
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to upload cover photo' }) }
})
adminRouter.delete('/:clubId', async (req, res) => {
  try {
    await writeCover(req.params.clubId, null)
    res.json({ data: { coverPhotoUrl: null }, message: 'Cover photo removed. The default club hero has been restored.' })
  } catch (error) { res.status(500).json({ error: 'Unable to remove cover photo', detail: String(error) }) }
})

export { publicRouter as clubCoversRouter, clubPortalRouter as clubPortalCoversRouter, adminRouter as adminClubCoversRouter }
