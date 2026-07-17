/**
 * Claims API — public claim submission and admin review.
 */
import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { attachActor, requireAdminActor, type AuthedRequest } from '../middleware/permissions.js'
import { submitClubClaim, submitLeagueClaim, reviewClubClaim, reviewLeagueClaim } from '../../services/claims.service.js'
import { issueClubPortalAccess } from './club-portal-access.js'
import { logger } from '../../utils/logger.js'

const router = Router()

router.post('/club', publicRateLimit, async (req, res) => {
  try {
    const r = await submitClubClaim(req.body ?? {})
    res.status(r.status).json(r.ok ? { data: { id: r.claimId, status: 'PENDING' } } : { error: r.error })
  } catch (err) { logger.error('POST /claims/club', { detail: String(err) }); res.status(500).json({ error: 'claim failed' }) }
})

router.post('/league', publicRateLimit, async (req, res) => {
  try {
    const r = await submitLeagueClaim(req.body ?? {})
    res.status(r.status).json(r.ok ? { data: { id: r.claimId, status: 'PENDING' } } : { error: r.error })
  } catch (err) { logger.error('POST /claims/league', { detail: String(err) }); res.status(500).json({ error: 'claim failed' }) }
})

router.get('/', attachActor, requireAdminActor, async (req, res) => {
  const status = (req.query.status as string) ?? 'PENDING'
  const type = (req.query.type as string) ?? 'all'
  const where = { ...(status === 'ALL' ? {} : { status }), deletedAt: null }
  const [clubClaims, leagueClaims] = await Promise.all([
    type === 'league' ? [] : prisma.clubClaim.findMany({ where, orderBy: { submittedAt: 'desc' }, take: 200 }),
    type === 'club' ? [] : prisma.leagueClaim.findMany({ where, orderBy: { submittedAt: 'desc' }, take: 200 }),
  ])
  res.json({ data: { clubClaims, leagueClaims }, meta: { status, type } })
})

router.patch('/:id', attachActor, requireAdminActor, async (req: AuthedRequest, res) => {
  const { type, action, notes } = (req.body ?? {}) as { type?: 'club' | 'league'; action?: 'VERIFIED' | 'REJECTED'; notes?: string }
  if (!type || !['club', 'league'].includes(type)) return res.status(400).json({ error: 'type must be club|league' })
  if (!action || !['VERIFIED', 'REJECTED'].includes(action)) return res.status(400).json({ error: 'action must be VERIFIED|REJECTED' })
  const reviewer = req.actor?.userId ?? 'admin'
  try {
    if (type === 'club') {
      const claim = await prisma.clubClaim.findUnique({ where: { id: String(req.params.id) } })
      const r = await reviewClubClaim(String(req.params.id), action, reviewer, notes)
      if (!r.ok) return res.status(r.status).json({ error: r.error })
      let accessUrl: string | null = null
      if (action === 'VERIFIED' && claim) {
        const user = await prisma.platformUser.findUnique({ where: { email: claim.email } })
        const token = await issueClubPortalAccess(claim.clubId, claim.email, user?.id)
        accessUrl = `/club-portal?token=${token}`
      }
      return res.json({ data: { id: r.claimId, status: action, accessUrl } })
    }
    const r = await reviewLeagueClaim(String(req.params.id), action, reviewer, notes)
    return res.status(r.status).json(r.ok ? { data: { id: r.claimId, status: action } } : { error: r.error })
  } catch (err) { logger.error('PATCH /claims/:id', { detail: String(err) }); res.status(500).json({ error: 'review failed' }) }
})

export { router as claimsRouter }
