import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { requireAdminKey } from '../middleware/auth.js'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { leaguePortalNewsRouter } from './league-portal-news.js'
import { leaguePortalSponsorsRouter } from './league-portal-sponsors.js'
import { leaguePortalUsersRouter } from './league-portal-users.js'
import { leaguePortalActivityRouter } from './league-portal-activity.js'
import { leaguePortalMediaRouter } from './league-portal-media.js'
import {
  LEAGUE_ROLES,
  acceptLeagueInvitation,
  auditLeagueMembership,
  authenticateLeagueUser,
  createPendingLeagueMembership,
  ensureLeagueMembershipSchema,
  issueLeagueInvitation,
  membershipsForLeagueUser,
  requireActiveLeagueMembership,
  roleCanManageLeagueAction,
  type LeagueRole,
} from '../../auth/league-auth.js'

const router = Router()
router.use(publicRateLimit)
router.use('/', leaguePortalNewsRouter)
router.use('/', leaguePortalSponsorsRouter)
router.use('/', leaguePortalUsersRouter)
router.use('/', leaguePortalActivityRouter)
router.use('/', leaguePortalMediaRouter)

let profileSchemaReady: Promise<void> | null = null
function ensureLeagueProfileFields() {
  if (!profileSchemaReady) profileSchemaReady = (async () => {
    for (const sql of [
      `ALTER TABLE leagues ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT`,
      `ALTER TABLE leagues ADD COLUMN IF NOT EXISTS "contactEmail" TEXT`,
      `ALTER TABLE leagues ADD COLUMN IF NOT EXISTS "contactPhone" TEXT`,
    ]) await prisma.$executeRawUnsafe(sql)
  })().catch(error => { profileSchemaReady = null; throw error })
  return profileSchemaReady
}

router.get('/me', authenticateLeagueUser, async (req, res) => {
  const memberships = await membershipsForLeagueUser(req.clubUser!.id)
  const leagueIds = memberships.map(item => item.leagueId)
  const leagues = leagueIds.length ? await prisma.league.findMany({
    where: { id: { in: leagueIds } },
    select: { id: true, name: true, logoUrl: true, state: { select: { code: true } } },
  }) : []
  const byId = new Map(leagues.map(league => [league.id, league]))
  res.json({ data: {
    user: { id: req.clubUser!.id, email: req.clubUser!.email },
    memberships: memberships.map(item => ({
      ...item,
      leagueName: byId.get(item.leagueId)?.name ?? 'League',
      logoUrl: byId.get(item.leagueId)?.logoUrl ?? null,
      state: byId.get(item.leagueId)?.state.code ?? '',
    })),
  } })
})

router.post('/leagues/:leagueId/request-access', authenticateLeagueUser, async (req, res) => {
  const league = await prisma.league.findFirst({ where: { id: req.params.leagueId, archivedAt: null }, select: { id: true, name: true } })
  if (!league) return res.status(404).json({ error: 'League not found' })
  const applicantName = String(req.body?.applicantName ?? '').trim()
  const leaguePosition = String(req.body?.leaguePosition ?? '').trim()
  const phone = String(req.body?.phone ?? '').trim()
  const reason = String(req.body?.reason ?? '').trim()
  if (!applicantName || !leaguePosition || reason.length < 20) return res.status(400).json({ error: 'Your name, league role and verification details are required' })
  await createPendingLeagueMembership(req.clubUser!, league.id, { applicantName, leaguePosition, phone: phone || undefined, reason })
  res.status(201).json({ message: `League claim submitted for ${league.name}` })
})

router.post('/invitations/accept', authenticateLeagueUser, async (req, res) => {
  try {
    const membership = await acceptLeagueInvitation(req.clubUser!, String(req.body?.token ?? ''))
    if (!membership) return res.status(404).json({ error: 'Invitation is invalid or expired' })
    res.json({ message: 'League invitation accepted', data: { membership } })
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : 'Unable to accept invitation' })
  }
})

router.get('/leagues/:leagueId', authenticateLeagueUser, requireActiveLeagueMembership, async (req, res) => {
  const league = await prisma.league.findFirst({
    where: { id: req.params.leagueId, archivedAt: null },
    select: { id: true, name: true, logoUrl: true, state: { select: { code: true, name: true } } },
  })
  if (!league) return res.status(404).json({ error: 'League not found' })
  res.json({ data: { league: { id: league.id, name: league.name, logoUrl: league.logoUrl, state: league.state.code || league.state.name }, membership: res.locals.leagueMembership } })
})

router.get('/leagues/:leagueId/profile', authenticateLeagueUser, requireActiveLeagueMembership, async (req, res) => {
  await ensureLeagueProfileFields()
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT l.id,l.name,l."shortName",l."logoUrl",l.description,l."websiteUrl",l."facebookUrl",l."instagramUrl",l."contactEmail",l."contactPhone",s.code AS state FROM leagues l JOIN states s ON s.id=l."stateId" WHERE l.id=$1 AND l."archivedAt" IS NULL LIMIT 1`, req.params.leagueId)
  const league = rows[0]
  if (!league) return res.status(404).json({ error: 'League not found' })
  res.json({ data: { league, membership: res.locals.leagueMembership } })
})

router.patch('/leagues/:leagueId/profile', authenticateLeagueUser, requireActiveLeagueMembership, async (req, res) => {
  await ensureLeagueProfileFields()
  const membership = res.locals.leagueMembership as { id: string; role: LeagueRole }
  if (!roleCanManageLeagueAction(membership.role, 'profile')) return res.status(403).json({ error: 'Your league role cannot manage the league profile' })
  const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max) || null
  const description = clean(req.body?.description, 5000)
  const websiteUrl = clean(req.body?.websiteUrl, 500)
  const facebookUrl = clean(req.body?.facebookUrl, 500)
  const instagramUrl = clean(req.body?.instagramUrl, 500)
  const contactEmail = clean(req.body?.contactEmail, 320)
  const contactPhone = clean(req.body?.contactPhone, 80)
  const logoUrl = clean(req.body?.logoUrl, 1000)
  if (contactEmail && !contactEmail.includes('@')) return res.status(400).json({ error: 'Enter a valid contact email address' })
  const before = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT description,"websiteUrl","facebookUrl","instagramUrl","contactEmail","contactPhone","logoUrl" FROM leagues WHERE id=$1 LIMIT 1`, req.params.leagueId)
  if (!before[0]) return res.status(404).json({ error: 'League not found' })
  await prisma.$executeRawUnsafe(`UPDATE leagues SET description=$1,"websiteUrl"=$2,"facebookUrl"=$3,"instagramUrl"=$4,"contactEmail"=$5,"contactPhone"=$6,"logoUrl"=$7,"updatedAt"=NOW() WHERE id=$8`, description, websiteUrl, facebookUrl, instagramUrl, contactEmail, contactPhone, logoUrl, req.params.leagueId)
  await auditLeagueMembership(membership.id, req.params.leagueId, req.clubUser!.id, 'PROFILE_UPDATED', req.clubUser!.id, { before: before[0], after: { description, websiteUrl, facebookUrl, instagramUrl, contactEmail, contactPhone, logoUrl } })
  res.json({ message: 'League profile saved', data: { description, websiteUrl, facebookUrl, instagramUrl, contactEmail, contactPhone, logoUrl } })
})

const admin = Router()
admin.use(requireAdminKey)

admin.get('/', async (req, res) => {
  await ensureLeagueMembershipSchema()
  const status = String(req.query.status ?? 'ALL').toUpperCase()
  const where = status === 'ALL' ? '' : 'WHERE m.status=$1'
  const args = status === 'ALL' ? [] : [status]
  const rows = await prisma.$queryRawUnsafe(`SELECT m.id,m.user_id AS "userId",m.email,m.league_id AS "leagueId",l.name AS "leagueName",m.role,m.status,m.applicant_name AS "applicantName",m.league_position AS "leaguePosition",m.phone,m.reason,m.review_notes AS "reviewNotes",m.created_at AS "createdAt" FROM league_portal_memberships m JOIN leagues l ON l.id=m.league_id ${where} ORDER BY m.created_at DESC LIMIT 300`, ...args)
  res.json({ data: rows })
})

admin.get('/audit', async (_req, res) => {
  await ensureLeagueMembershipSchema()
  const rows = await prisma.$queryRawUnsafe(`SELECT a.id,a.membership_id AS "membershipId",a.league_id AS "leagueId",l.name AS "leagueName",a.user_id AS "userId",a.action,a.actor_id AS "actorId",a.detail,a.created_at AS "createdAt" FROM league_portal_membership_audit a LEFT JOIN leagues l ON l.id=a.league_id ORDER BY a.created_at DESC LIMIT 100`)
  res.json({ data: rows })
})

admin.patch('/:id', async (req, res) => {
  await ensureLeagueMembershipSchema()
  const action = String(req.body?.action ?? '').toUpperCase()
  const role = String(req.body?.role ?? 'VIEWER').toUpperCase() as LeagueRole
  const notes = String(req.body?.notes ?? '').trim()
  if (!['APPROVE', 'REJECT', 'SUSPEND', 'REACTIVATE', 'REVOKE'].includes(action)) return res.status(400).json({ error: 'Invalid action' })
  if (!LEAGUE_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid league role' })
  const rows = await prisma.$queryRawUnsafe<Array<{id:string;leagueId:string;userId:string;role:LeagueRole;status:string}>>(`SELECT id,league_id AS "leagueId",user_id AS "userId",role,status FROM league_portal_memberships WHERE id=$1 LIMIT 1`, req.params.id)
  const item = rows[0]
  if (!item) return res.status(404).json({ error: 'Membership not found' })
  if (item.role === 'OWNER' && item.status === 'ACTIVE' && (role !== 'OWNER' || action === 'SUSPEND' || action === 'REVOKE' || action === 'REJECT')) {
    const owners = await prisma.$queryRawUnsafe<Array<{count: bigint}>>(`SELECT COUNT(*)::bigint AS count FROM league_portal_memberships WHERE league_id=$1 AND role='OWNER' AND status='ACTIVE'`, item.leagueId)
    if (Number(owners[0]?.count ?? 0) <= 1) return res.status(409).json({ error: 'Assign another active Owner before removing or changing the final Owner' })
  }
  const status = action === 'APPROVE' || action === 'REACTIVATE' ? 'ACTIVE' : action === 'REJECT' || action === 'REVOKE' ? 'REVOKED' : 'SUSPENDED'
  await prisma.$executeRawUnsafe(`UPDATE league_portal_memberships SET role=$1,status=$2,review_notes=$3,approved_by=CASE WHEN $2='ACTIVE' THEN 'admin' ELSE approved_by END,approved_at=CASE WHEN $2='ACTIVE' THEN NOW() ELSE approved_at END,revoked_at=CASE WHEN $2='REVOKED' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$4`, role, status, notes || null, item.id)
  await auditLeagueMembership(item.id, item.leagueId, item.userId, action, 'admin', { role, notes })
  res.json({ message: 'Membership updated', data: { id: item.id, role, status } })
})

admin.post('/invitations', async (req, res) => {
  const leagueId = String(req.body?.leagueId ?? '').trim()
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const role = String(req.body?.role ?? 'VIEWER').toUpperCase() as LeagueRole
  if (!leagueId || !email.includes('@') || !LEAGUE_ROLES.includes(role)) return res.status(400).json({ error: 'League, email and valid role are required' })
  const league = await prisma.league.findFirst({ where: { id: leagueId, archivedAt: null }, select: { id: true } })
  if (!league) return res.status(404).json({ error: 'League not found' })
  const token = await issueLeagueInvitation(league.id, email, role, 'admin')
  res.status(201).json({ data: { invitePath: `/league-portal?invite=${token}`, email, role, expiresInDays: 7 } })
})

router.use('/admin', admin)
export { router as leaguePortalRouter }
