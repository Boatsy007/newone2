import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { attachActor, requireAdminActor } from '../middleware/permissions.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const ACTIVE = ['APPROVED', 'ACTIVE', 'PAYMENT_COMPLETE', 'RENEWAL_DUE']

export const playerSponsorsRouter = Router()
playerSponsorsRouter.use(attachActor)

playerSponsorsRouter.get('/:playerId/sponsors', publicRateLimit, async (req, res) => {
  try {
    const playerId = String(req.params.playerId)
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT s.*, json_build_object(
        'id', cs.id,
        'name', cs.name,
        'logoUrl', cs.logo_url,
        'websiteUrl', cs.website_url,
        'tier', cs.tier
      ) AS sponsor
      FROM sponsorships s
      JOIN commercial_sponsors cs ON cs.id = s.sponsor_id
      WHERE s.player_id = $1
        AND s.deleted_at IS NULL
        AND cs.deleted_at IS NULL
        AND s.status = ANY($2::text[])
        AND (s.start_date IS NULL OR s.start_date <= NOW())
        AND (s.end_date IS NULL OR s.end_date >= NOW())
      ORDER BY s.display_priority DESC, s.created_at DESC
    `, playerId, ACTIVE)
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300')
    res.json({ data: rows })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

playerSponsorsRouter.post('/:playerId/sponsors', requireAdminActor, async (req, res) => {
  try {
    const playerId = String(req.params.playerId)
    const body = (req.body ?? {}) as Record<string, unknown>
    const sponsorId = String(body.sponsorId ?? '')
    if (!sponsorId) return res.status(400).json({ error: 'sponsorId required' })

    const id = crypto.randomUUID()
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      INSERT INTO sponsorships (
        id, sponsor_id, scope, player_id, package, tier, status,
        start_date, end_date, display_priority, banner_position,
        cta_label, cta_url, created_by, notes, created_at, updated_at
      ) VALUES (
        $1::uuid, $2::uuid, 'PLAYER', $3::text, $4::text, $5::text, 'ACTIVE',
        NULLIF($6::text, '')::timestamptz, NULLIF($7::text, '')::timestamptz,
        $8::int, 'PLAYER_CARD', 'Visit sponsor', NULLIF($9::text, ''),
        'admin', $10::text, NOW(), NOW()
      )
      RETURNING *
    `,
      id,
      sponsorId,
      playerId,
      String(body.package ?? 'PLAYER_PARTNER'),
      String(body.tier ?? 'Player partner'),
      String(body.startDate ?? ''),
      String(body.endDate ?? ''),
      Number(body.displayPriority ?? 100),
      String(body.ctaUrl ?? ''),
      String(body.notes ?? 'Assigned through player admin.'),
    )
    res.status(201).json({ data: rows[0] })
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

playerSponsorsRouter.delete('/:playerId/sponsors/:sponsorshipId', requireAdminActor, async (req, res) => {
  try {
    const playerId = String(req.params.playerId)
    const sponsorshipId = String(req.params.sponsorshipId)
    await prisma.$executeRawUnsafe(`
      UPDATE sponsorships
      SET status = 'CANCELLED', deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1::uuid AND player_id = $2::text
    `, sponsorshipId, playerId)
    res.json({ data: { archived: true } })
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) })
  }
})
