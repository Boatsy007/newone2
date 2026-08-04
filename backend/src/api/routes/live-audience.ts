import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
const ALLOWED = new Set(['🔥','👏','❤️','😮'])
let ready: Promise<void> | null = null

function ensureTables() {
  if (!ready) ready = prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS live_audience_presence (
      club_id text NOT NULL,
      session_id text NOT NULL,
      first_seen_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (club_id, session_id)
    );
    CREATE INDEX IF NOT EXISTS live_audience_presence_active_idx ON live_audience_presence(club_id,last_seen_at DESC);
    CREATE TABLE IF NOT EXISTS live_audience_reactions (
      id text PRIMARY KEY,
      club_id text NOT NULL,
      session_id text NOT NULL,
      reaction text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS live_audience_reactions_club_idx ON live_audience_reactions(club_id,created_at DESC);
  `).then(() => undefined).catch(error => { ready = null; throw error })
  return ready
}

const clean = (value: unknown, max = 120) => String(value ?? '').trim().slice(0, max)
const noCache = (res: any) => res.set('Cache-Control','no-store, no-cache, must-revalidate')

router.use(publicRateLimit)

router.post('/clubs/:clubId/heartbeat', async (req, res) => {
  try {
    await ensureTables()
    const sessionId = clean(req.body?.sessionId)
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
    await prisma.$executeRawUnsafe(`
      INSERT INTO live_audience_presence(club_id,session_id,first_seen_at,last_seen_at)
      VALUES($1,$2,now(),now())
      ON CONFLICT(club_id,session_id) DO UPDATE SET last_seen_at=now()
    `, req.params.clubId, sessionId)
    await prisma.$executeRawUnsafe(`DELETE FROM live_audience_presence WHERE last_seen_at < now() - interval '2 hours'`)
    noCache(res)
    res.json({ data: { active: true } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to register viewer', detail: String(error) })
  }
})

router.get('/clubs/:clubId', async (req, res) => {
  try {
    await ensureTables()
    const rows = await prisma.$queryRawUnsafe<Array<{viewers:number;peak:number;total:number}>>(`
      SELECT
        (SELECT COUNT(*)::int FROM live_audience_presence WHERE club_id=$1 AND last_seen_at > now() - interval '25 seconds') AS viewers,
        (SELECT COUNT(*)::int FROM live_audience_presence WHERE club_id=$1) AS total,
        (SELECT COUNT(*)::int FROM live_audience_presence WHERE club_id=$1 AND last_seen_at > now() - interval '5 minutes') AS peak
    `, req.params.clubId)
    const reactions = await prisma.$queryRawUnsafe<Array<{reaction:string;count:number}>>(`
      SELECT reaction,COUNT(*)::int AS count FROM live_audience_reactions
      WHERE club_id=$1 AND created_at > now() - interval '8 hours'
      GROUP BY reaction
    `, req.params.clubId)
    const recent = await prisma.$queryRawUnsafe<Array<{id:string;reaction:string;createdAt:string}>>(`
      SELECT id,reaction,created_at AS "createdAt" FROM live_audience_reactions
      WHERE club_id=$1 AND created_at > now() - interval '20 seconds'
      ORDER BY created_at DESC LIMIT 40
    `, req.params.clubId)
    noCache(res)
    res.json({ data: { viewers: rows[0]?.viewers ?? 0, totalViewers: rows[0]?.total ?? 0, peakViewers: rows[0]?.peak ?? 0, reactions, recent } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load live audience', detail: String(error) })
  }
})

router.post('/clubs/:clubId/reactions', async (req, res) => {
  try {
    await ensureTables()
    const sessionId = clean(req.body?.sessionId)
    const reaction = clean(req.body?.reaction, 8)
    if (!sessionId || !ALLOWED.has(reaction)) return res.status(400).json({ error: 'Valid session and reaction required' })
    const recent = await prisma.$queryRawUnsafe<Array<{count:number}>>(`SELECT COUNT(*)::int AS count FROM live_audience_reactions WHERE club_id=$1 AND session_id=$2 AND created_at > now() - interval '2 seconds'`, req.params.clubId, sessionId)
    if ((recent[0]?.count ?? 0) > 0) return res.status(429).json({ error: 'Please wait before reacting again' })
    const id = randomUUID()
    await prisma.$executeRawUnsafe(`INSERT INTO live_audience_reactions(id,club_id,session_id,reaction) VALUES($1,$2,$3,$4)`, id, req.params.clubId, sessionId, reaction)
    noCache(res)
    res.status(201).json({ data: { id, reaction } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to add reaction', detail: String(error) })
  }
})

export { router as liveAudienceRouter }
