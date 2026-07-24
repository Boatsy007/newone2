import { Router } from 'express'
import { prisma } from '../db/client.js'
import { requireAdminKey } from '../api/middleware/auth.js'

const router = Router()
router.use(requireAdminKey)

const MAX_PHOTO_BYTES = 6 * 1024 * 1024
const PHOTO_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
let schemaReady: Promise<void> | null = null

async function ensureSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "player_profile_details" (
      "playerId" TEXT PRIMARY KEY,
      "bio" TEXT,
      "primaryPosition" TEXT,
      "secondaryPosition" TEXT,
      "gamesPlayed" INTEGER,
      "jumperNumber" INTEGER,
      "photoUrl" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await prisma.$executeRawUnsafe('ALTER TABLE "player_profile_details" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT')
  })().catch(error => { schemaReady = null; throw error })
  return schemaReady
}

type DetailRow = {
  playerId: string
  bio: string | null
  primaryPosition: string | null
  secondaryPosition: string | null
  gamesPlayed: number | null
  jumperNumber: number | null
  photoUrl: string | null
  createdAt: Date
  updatedAt: Date
}

router.get('/', async (_req, res) => {
  try {
    await ensureSchema()
    const rows = await prisma.footballGoalKicker.findMany({
      orderBy: [{ playerName: 'asc' }, { season: 'desc' }],
      take: 10000,
      select: {
        id: true, playerId: true, playerName: true, clubId: true, clubName: true,
        leagueId: true, leagueName: true, season: true, grade: true, matches: true, goals: true,
        club: { select: { logoUrl: true, state: { select: { code: true } } } },
      },
    })
    const detailRows = await prisma.$queryRawUnsafe<DetailRow[]>('SELECT * FROM "player_profile_details"')
    const details = new Map(detailRows.map(row => [row.playerId, row]))
    res.json({ data: rows.map(row => ({
      ...row,
      state: row.club?.state?.code ?? null,
      clubLogoUrl: row.club?.logoUrl ?? null,
      details: details.get(row.id) ?? null,
    })) })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

router.get('/:id', async (req, res) => {
  try {
    await ensureSchema()
    const profile = await prisma.footballGoalKicker.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true, playerId: true, playerName: true, clubId: true, clubName: true,
        leagueId: true, leagueName: true, season: true, grade: true, matches: true, goals: true,
        club: { select: { logoUrl: true, state: { select: { code: true } } } },
      },
    })
    if (!profile) return res.status(404).json({ error: 'Player not found' })
    const details = await prisma.$queryRawUnsafe<DetailRow[]>(
      'SELECT * FROM "player_profile_details" WHERE "playerId" = $1::text LIMIT 1',
      profile.id,
    )
    res.json({ data: { ...profile, state: profile.club?.state?.code ?? null, clubLogoUrl: profile.club?.logoUrl ?? null, details: details[0] ?? null } })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    await ensureSchema()
    const playerId = String(req.params.id)
    const exists = await prisma.footballGoalKicker.findUnique({ where: { id: playerId }, select: { id: true } })
    if (!exists) return res.status(404).json({ error: 'Player not found' })
    const body = (req.body ?? {}) as Record<string, unknown>
    const gamesPlayed = body.gamesPlayed === '' || body.gamesPlayed == null ? null : Number(body.gamesPlayed)
    const jumperNumber = body.jumperNumber === '' || body.jumperNumber == null ? null : Number(body.jumperNumber)
    if (gamesPlayed != null && (!Number.isInteger(gamesPlayed) || gamesPlayed < 0)) return res.status(400).json({ error: 'Games played must be a whole number of 0 or more' })
    if (jumperNumber != null && (!Number.isInteger(jumperNumber) || jumperNumber < 0 || jumperNumber > 999)) return res.status(400).json({ error: 'Jumper number must be between 0 and 999' })
    const existing = await prisma.$queryRawUnsafe<DetailRow[]>('SELECT * FROM "player_profile_details" WHERE "playerId"=$1::text LIMIT 1', playerId)
    const rows = await prisma.$queryRawUnsafe<DetailRow[]>(
      `INSERT INTO "player_profile_details"
        ("playerId","bio","primaryPosition","secondaryPosition","gamesPlayed","jumperNumber","photoUrl","createdAt","updatedAt")
       VALUES ($1::text,$2::text,$3::text,$4::text,$5::int,$6::int,$7::text,NOW(),NOW())
       ON CONFLICT ("playerId") DO UPDATE SET
        "bio"=EXCLUDED."bio",
        "primaryPosition"=EXCLUDED."primaryPosition",
        "secondaryPosition"=EXCLUDED."secondaryPosition",
        "gamesPlayed"=EXCLUDED."gamesPlayed",
        "jumperNumber"=EXCLUDED."jumperNumber",
        "photoUrl"=EXCLUDED."photoUrl",
        "updatedAt"=NOW()
       RETURNING *`,
      playerId,
      body.bio == null ? existing[0]?.bio ?? null : String(body.bio).trim() || null,
      body.primaryPosition == null ? existing[0]?.primaryPosition ?? null : String(body.primaryPosition).trim() || null,
      body.secondaryPosition == null ? existing[0]?.secondaryPosition ?? null : String(body.secondaryPosition).trim() || null,
      body.gamesPlayed === undefined ? existing[0]?.gamesPlayed ?? null : gamesPlayed,
      body.jumperNumber === undefined ? existing[0]?.jumperNumber ?? null : jumperNumber,
      body.photoUrl === undefined ? existing[0]?.photoUrl ?? null : String(body.photoUrl || '').trim() || null,
    )
    res.json({ data: rows[0] })
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

router.post('/:id/photo', async (req, res) => {
  try {
    await ensureSchema()
    const playerId = String(req.params.id)
    const player = await prisma.footballGoalKicker.findUnique({ where: { id: playerId }, select: { id: true } })
    if (!player) return res.status(404).json({ error: 'Player not found' })
    const body = (req.body ?? {}) as Record<string, unknown>
    const contentType = typeof body.contentType === 'string' ? body.contentType : 'image/jpeg'
    if (!PHOTO_TYPES.has(contentType)) return res.status(400).json({ error: 'Use a PNG, JPG or WEBP player photo' })
    const raw = typeof body.dataUrl === 'string' ? body.dataUrl : ''
    if (!raw) return res.status(400).json({ error: 'Player photo required' })
    const buffer = Buffer.from(raw.includes(',') ? raw.split(',').pop()! : raw, 'base64')
    if (!buffer.length || buffer.length > MAX_PHOTO_BYTES) return res.status(400).json({ error: 'Player photo must be 6 MB or smaller' })
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    if (!supabaseUrl || !serviceKey) return res.status(400).json({ error: 'Supabase Storage is not configured' })
    const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const path = `player-photos/${playerId}/${Date.now()}.${extension}`
    const bucket = process.env.SUPABASE_LOGO_BUCKET || 'playfooty-logos'
    const upload = await fetch(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'content-type': contentType, 'x-upsert': 'true' },
      body: buffer,
    })
    if (!upload.ok) throw new Error(`Player photo upload failed: HTTP ${upload.status}`)
    const photoUrl = `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${path}`
    const rows = await prisma.$queryRawUnsafe<DetailRow[]>(
      `INSERT INTO "player_profile_details" ("playerId","photoUrl","createdAt","updatedAt") VALUES ($1::text,$2::text,NOW(),NOW())
       ON CONFLICT ("playerId") DO UPDATE SET "photoUrl"=EXCLUDED."photoUrl","updatedAt"=NOW() RETURNING *`,
      playerId,
      photoUrl,
    )
    res.json({ data: rows[0] })
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

export { router as adminPlayersRouter }
