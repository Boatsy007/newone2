import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()

type PlayerProfileDetail = {
  playerId: string
  bio: string | null
  primaryPosition: string | null
  secondaryPosition: string | null
  gamesPlayed: number | null
  jumperNumber: number | null
  photoUrl: string | null
}

router.get('/:id', publicRateLimit, async (req, res) => {
  try {
    const table = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT to_regclass('public.player_profile_details') IS NOT NULL AS "exists"`,
    )
    if (!table[0]?.exists) {
      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
      return res.json({ data: null })
    }

    const rows = await prisma.$queryRawUnsafe<PlayerProfileDetail[]>(
      `SELECT "playerId","bio","primaryPosition","secondaryPosition","gamesPlayed","jumperNumber","photoUrl"
       FROM "player_profile_details"
       WHERE "playerId" = $1::text
       LIMIT 1`,
      String(req.params.id),
    )

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
    res.json({ data: rows[0] ?? null })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

export { router as playerProfileDetailsRouter }
