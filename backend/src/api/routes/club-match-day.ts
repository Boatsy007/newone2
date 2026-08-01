import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership } from '../../auth/club-auth.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
let ready: Promise<void> | null = null

async function ensureTable() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_match_day_state (
        club_id TEXT NOT NULL,
        sheet_id TEXT NOT NULL,
        state JSONB NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_by TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (club_id, sheet_id)
      )
    `).then(async () => {
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_match_day_updated_idx ON club_match_day_state (club_id, updated_at DESC)`)
    }).catch(error => { ready = null; throw error })
  }
  return ready
}

function validState(value: unknown, sheetId: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const state = value as Record<string, unknown>
  return state.sheetId === sheetId
    && Number.isInteger(state.quarter)
    && Array.isArray(state.slots)
    && Array.isArray(state.events)
}

router.use(publicRateLimit)
router.use(authenticateClubUser)
router.use('/clubs/:clubId', requireActiveClubMembership)

router.get('/clubs/:clubId/sheets/:sheetId', async (req, res) => {
  try {
    await ensureTable()
    const rows = await prisma.$queryRawUnsafe<Array<{state: unknown; version: number; updatedAt: Date; updatedBy: string | null}>>(`
      SELECT state, version, updated_at AS "updatedAt", updated_by AS "updatedBy"
      FROM club_match_day_state
      WHERE club_id = $1 AND sheet_id = $2
      LIMIT 1
    `, req.params.clubId, req.params.sheetId)
    const row = rows[0]
    res.json({ data: row ? { state: row.state, version: row.version, updatedAt: row.updatedAt, updatedBy: row.updatedBy } : null })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load Match Day state', detail: error instanceof Error ? error.message : String(error) })
  }
})

router.put('/clubs/:clubId/sheets/:sheetId', async (req, res) => {
  try {
    const state = req.body?.state
    if (!validState(state, req.params.sheetId)) return res.status(400).json({ error: 'A valid Match Day state is required' })
    await ensureTable()
    const rows = await prisma.$queryRawUnsafe<Array<{version: number; updatedAt: Date}>>(`
      INSERT INTO club_match_day_state (club_id, sheet_id, state, version, updated_by, updated_at)
      VALUES ($1, $2, $3::jsonb, 1, $4, NOW())
      ON CONFLICT (club_id, sheet_id) DO UPDATE SET
        state = EXCLUDED.state,
        version = club_match_day_state.version + 1,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING version, updated_at AS "updatedAt"
    `, req.params.clubId, req.params.sheetId, JSON.stringify(state), req.clubUser!.id)
    res.json({ data: { state, version: rows[0]?.version ?? 1, updatedAt: rows[0]?.updatedAt ?? new Date() }, message: 'Match Day saved' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to save Match Day state', detail: error instanceof Error ? error.message : String(error) })
  }
})

router.delete('/clubs/:clubId/sheets/:sheetId', async (req, res) => {
  try {
    await ensureTable()
    await prisma.$executeRawUnsafe(`DELETE FROM club_match_day_state WHERE club_id = $1 AND sheet_id = $2`, req.params.clubId, req.params.sheetId)
    res.json({ data: { deleted: true }, message: 'Match Day reset' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to reset Match Day state', detail: error instanceof Error ? error.message : String(error) })
  }
})

export { router as clubMatchDayRouter }
