import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
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
  updatedAt: Date
}

router.get('/:id', publicRateLimit, async (req, res) => {
  try {
    await ensureSchema()
    const rows = await prisma.$queryRawUnsafe<DetailRow[]>(
      `SELECT "playerId","bio","primaryPosition","secondaryPosition","gamesPlayed","jumperNumber","photoUrl","updatedAt"
       FROM "player_profile_details" WHERE "playerId"=$1::text LIMIT 1`,
      String(req.params.id),
    )
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
    res.json({ data: rows[0] ?? null })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

export { router as playerDetailsRouter }
