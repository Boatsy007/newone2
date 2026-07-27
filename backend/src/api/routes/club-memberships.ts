import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { acceptClubInvitation, authenticateClubUser, createPendingMembership, membershipForClub, membershipsForUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
router.use(publicRateLimit)

router.get('/me', authenticateClubUser, async (req, res) => {
  const user = req.clubUser!
  const memberships = await membershipsForUser(user.id)
  const clubIds = [...new Set(memberships.map(item => item.clubId))]
  const clubs = clubIds.length
    ? await prisma.club.findMany({
        where: { id: { in: clubIds }, archivedAt: null },
        select: { id: true, name: true, logoUrl: true, primaryColour: true },
      })
    : []
  const clubById = new Map(clubs.map(club => [club.id, club]))
  res.json({
    data: {
      user: { id: user.id, email: user.email },
      memberships: memberships.map(membership => {
        const club = clubById.get(membership.clubId)
        return {
          ...membership,
          permissions: {
            manageUsers: roleCan(membership.role, 'manage_users'),
            teamSelection: roleCan(membership.role, 'team_selection'),
            media: roleCan(membership.role, 'media'),
            sponsors: roleCan(membership.role, 'sponsors'),
            profile: roleCan(membership.role, 'profile'),
            view: roleCan(membership.role, 'view'),
          },
          club: club
            ? {
                id: club.id,
                name: club.name,
                logoUrl: club.logoUrl,
                primaryColour: club.primaryColour,
                state: '',
                stateName: '',
                leagueId: null,
                leagueName: null,
              }
            : null,
        }
      }),
    },
  })
})

router.get('/clubs/:clubId/access', authenticateClubUser, async (req, res) => {
  const membership = await membershipForClub(req.clubUser!.id, req.params.clubId)
  if (!membership) return res.status(404).json({ error: 'No membership exists for this club' })
  res.json({
    data: {
      ...membership,
      active: membership.status === 'ACTIVE',
      permissions: {
        manageUsers: roleCan(membership.role, 'manage_users'),
        teamSelection: roleCan(membership.role, 'team_selection'),
        media: roleCan(membership.role, 'media'),
        sponsors: roleCan(membership.role, 'sponsors'),
        profile: roleCan(membership.role, 'profile'),
        view: roleCan(membership.role, 'view'),
      },
    },
  })
})

router.get('/clubs/:clubId/dashboard', authenticateClubUser, requireActiveClubMembership, async (req, res) => {
  try {
    const clubId = req.params.clubId
    const membership = res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
    if (!membership) return res.status(403).json({ error: 'Active club access is required' })

    const club = await prisma.club.findFirst({
      where: { id: clubId, archivedAt: null },
      select: {
        id: true,
        name: true,
        shortName: true,
        logoUrl: true,
        primaryColour: true,
        secondaryColour: true,
      },
    })
    if (!club) return res.status(404).json({ error: 'Club not found' })

    const permissions = {
      manageUsers: roleCan(membership.role, 'manage_users'),
      teamSelection: roleCan(membership.role, 'team_selection'),
      media: roleCan(membership.role, 'media'),
      sponsors: roleCan(membership.role, 'sponsors'),
      profile: roleCan(membership.role, 'profile'),
      view: true,
    }

    res.json({
      data: {
        club: {
          id: club.id,
          name: club.name,
          shortName: club.shortName,
          logoUrl: club.logoUrl,
          primaryColour: club.primaryColour,
          secondaryColour: club.secondaryColour,
          state: '',
          stateName: 'Community football club',
          leagueId: null,
          leagueName: null,
          season: null,
          grade: null,
        },
        membership: {
          id: membership.id,
          role: membership.role,
          status: membership.status,
          permissions,
        },
        profile: {
          completion: 0,
          completedFields: 0,
          totalFields: 12,
          lastUpdatedAt: new Date(0).toISOString(),
          photoCount: 0,
          partnerLogoCount: 0,
          missing: [],
        },
        teamSelection: null,
        news: { total: 0, drafts: 0, pending: 0, published: 0, recent: [] },
        sponsors: { active: 0, items: [] },
        users: { pending: 0 },
        notifications: { unread: 0 },
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load club dashboard', detail: error instanceof Error ? error.message : String(error) })
  }
})

router.post('/clubs/:clubId/request-access', authenticateClubUser, async (req, res) => {
  const club = await prisma.club.findFirst({ where: { id: req.params.clubId, archivedAt: null }, select: { id: true, name: true } })
  if (!club) return res.status(404).json({ error: 'Club not found' })
  const body = (req.body ?? {}) as Record<string, unknown>
  const applicantName = String(body.applicantName ?? '').trim()
  const clubPosition = String(body.clubPosition ?? '').trim()
  const reason = String(body.reason ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  if (!applicantName || !clubPosition || reason.length < 20) return res.status(400).json({ error: 'Your name, club role and a short verification reason are required' })
  const existing = await membershipForClub(req.clubUser!.id, club.id)
  if (existing?.status === 'ACTIVE') return res.status(409).json({ error: 'You already have active access to this club' })
  if (existing?.status === 'PENDING') return res.json({ data: existing, message: 'Your claim is already awaiting approval' })
  const membership = await createPendingMembership(req.clubUser!, club.id, { applicantName, clubPosition, phone, reason })
  res.status(201).json({ data: membership, message: `Claim submitted for ${club.name}` })
})

router.post('/invitations/accept', authenticateClubUser, async (req, res) => {
  const token = String(req.body?.token ?? '').trim()
  if (!token) return res.status(400).json({ error: 'Invitation token is required' })
  try {
    const membership = await acceptClubInvitation(req.clubUser!, token)
    if (!membership) return res.status(404).json({ error: 'This invitation is invalid, expired or already used' })
    res.json({ data: { membership }, message: 'Club invitation accepted' })
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : 'Unable to accept invitation' })
  }
})

export { router as clubMembershipsRouter }
