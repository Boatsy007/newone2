import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
let ready: Promise<void> | null = null

function ensureTables() {
  if (!ready) ready = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS live_sponsor_events (
        id bigserial PRIMARY KEY,
        club_id text NOT NULL,
        sponsorship_id text NOT NULL,
        sponsor_id text NOT NULL,
        placement text NOT NULL,
        event_type text NOT NULL,
        viewer_id text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS live_sponsor_events_club_idx ON live_sponsor_events(club_id,created_at DESC)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS live_sponsor_events_sponsor_idx ON live_sponsor_events(sponsorship_id,event_type,created_at DESC)`)
  })().catch(error => { ready = null; throw error })
  return ready
}

const clean = (value: unknown, max = 120) => String(value ?? '').trim().slice(0, max)

router.use(publicRateLimit)
router.post('/clubs/:clubId/event', async (req, res) => {
  try {
    await ensureTables()
    const sponsorshipId = clean(req.body?.sponsorshipId, 100)
    const sponsorId = clean(req.body?.sponsorId, 100)
    const placement = clean(req.body?.placement, 40).toUpperCase()
    const eventType = clean(req.body?.eventType, 20).toUpperCase()
    const viewerId = clean(req.body?.viewerId, 100) || null
    if (!sponsorshipId || !sponsorId || !['IMPRESSION','CLICK'].includes(eventType)) return res.status(400).json({ error: 'Valid sponsor event required' })
    if (!['BROADCAST','REPLAY','QUARTER','BREAK','PRESENTING'].includes(placement)) return res.status(400).json({ error: 'Invalid sponsor placement' })
    const rows = await prisma.$queryRawUnsafe<Array<{id:string}>>(`
      SELECT s.id::text FROM sponsorships s
      JOIN commercial_sponsors cs ON cs.id=s."sponsorId" AND cs."deletedAt" IS NULL
      WHERE s.id::text=$1 AND s."sponsorId"::text=$2 AND s."clubId"::text=$3
        AND s."deletedAt" IS NULL AND s.status IN ('APPROVED','ACTIVE','PAYMENT_COMPLETE','RENEWAL_DUE')
      LIMIT 1
    `, sponsorshipId, sponsorId, req.params.clubId)
    if (!rows[0]) return res.status(404).json({ error: 'Active club sponsorship not found' })
    await prisma.$executeRawUnsafe(`INSERT INTO live_sponsor_events(club_id,sponsorship_id,sponsor_id,placement,event_type,viewer_id) VALUES($1,$2,$3,$4,$5,$6)`, req.params.clubId, sponsorshipId, sponsorId, placement, eventType, viewerId)
    res.status(201).json({ data: { recorded: true } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to record sponsor event', detail: String(error) })
  }
})

export { router as liveSponsorsRouter }
