import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership } from '../../auth/club-auth.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
let ready: Promise<void> | null = null

async function ensureTable() {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS club_operations_state (
        club_id TEXT PRIMARY KEY,
        volunteers JSONB NOT NULL DEFAULT '[]'::jsonb,
        shifts JSONB NOT NULL DEFAULT '[]'::jsonb,
        equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_by TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(async () => {
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS club_operations_updated_idx ON club_operations_state (updated_at DESC)`)
    }).catch(error => { ready = null; throw error })
  }
  return ready
}

function array(value: unknown) { return Array.isArray(value) ? value : [] }

router.use(publicRateLimit)
router.use(authenticateClubUser)
router.use('/clubs/:clubId', requireActiveClubMembership)

router.get('/clubs/:clubId', async (req, res) => {
  try {
    await ensureTable()
    const rows = await prisma.$queryRawUnsafe<Array<{
      volunteers: unknown
      shifts: unknown
      equipment: unknown
      updatedAt: Date
      updatedBy: string | null
    }>>(`
      SELECT volunteers, shifts, equipment, updated_at AS "updatedAt", updated_by AS "updatedBy"
      FROM club_operations_state
      WHERE club_id = $1
      LIMIT 1
    `, req.params.clubId)
    const row = rows[0]
    res.json({ data: row ? {
      volunteers: array(row.volunteers),
      shifts: array(row.shifts),
      equipment: array(row.equipment),
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    } : { volunteers: [], shifts: [], equipment: [], updatedAt: null, updatedBy: null } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load club operations', detail: error instanceof Error ? error.message : String(error) })
  }
})

router.put('/clubs/:clubId/volunteers', async (req, res) => {
  try {
    await ensureTable()
    const volunteers = array(req.body?.volunteers)
    const shifts = array(req.body?.shifts)
    await prisma.$executeRawUnsafe(`
      INSERT INTO club_operations_state (club_id, volunteers, shifts, updated_by, updated_at)
      VALUES ($1, $2::jsonb, $3::jsonb, $4, NOW())
      ON CONFLICT (club_id) DO UPDATE SET
        volunteers = EXCLUDED.volunteers,
        shifts = EXCLUDED.shifts,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `, req.params.clubId, JSON.stringify(volunteers), JSON.stringify(shifts), req.clubUser!.id)
    res.json({ data: { volunteers, shifts }, message: 'Volunteer roster saved' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to save volunteer roster', detail: error instanceof Error ? error.message : String(error) })
  }
})

router.put('/clubs/:clubId/equipment', async (req, res) => {
  try {
    await ensureTable()
    const equipment = array(req.body?.equipment)
    await prisma.$executeRawUnsafe(`
      INSERT INTO club_operations_state (club_id, equipment, updated_by, updated_at)
      VALUES ($1, $2::jsonb, $3, NOW())
      ON CONFLICT (club_id) DO UPDATE SET
        equipment = EXCLUDED.equipment,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
    `, req.params.clubId, JSON.stringify(equipment), req.clubUser!.id)
    res.json({ data: { equipment }, message: 'Equipment register saved' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to save equipment register', detail: error instanceof Error ? error.message : String(error) })
  }
})

export { router as clubOperationsRouter }
