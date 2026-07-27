import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { acceptClubInvitation, authenticateClubUser, createPendingMembership, membershipForClub, membershipsForUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'
import { getClubSponsorships } from '../../commercial/sponsorships.service.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
router.use(publicRateLimit)

function jsonArrayLength(value: string | null | undefined) {
  if (!value) return 0
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.length : 0 } catch { return 0 }
}

router.get('/me', authenticateClubUser, async (req, res) => {
  const user = req.clubUser!
  const memberships = await membershipsForUser(user.id)
  const clubIds = [...new Set(memberships.map(item => item.clubId))]
  const clubs = clubIds.length ? await prisma.club.findMany({ where: { id: { in: clubIds }, archivedAt: null }, select: { id:true,name:true,logoUrl:true,primaryColour:true,state:{select:{code:true,name:true}},clubSeasons:{where:{isActive:true},orderBy:[{season:'desc'},{updatedAt:'desc'}],take:1,select:{leagueId:true,league:{select:{name:true}}}} } }) : []
  const clubById = new Map(clubs.map(club => [club.id, club]))
  res.json({ data: { user: { id:user.id,email:user.email }, memberships: memberships.map(membership => {
    const club = clubById.get(membership.clubId)
    return { ...membership, permissions: { manageUsers:roleCan(membership.role,'manage_users'),teamSelection:roleCan(membership.role,'team_selection'),media:roleCan(membership.role,'media'),sponsors:roleCan(membership.role,'sponsors'),profile:roleCan(membership.role,'profile'),view:roleCan(membership.role,'view') }, club: club ? { id:club.id,name:club.name,logoUrl:club.logoUrl,primaryColour:club.primaryColour,state:club.state.code,stateName:club.state.name,leagueId:club.clubSeasons[0]?.leagueId??null,leagueName:club.clubSeasons[0]?.league.name??null } : null }
  }) } })
})

router.get('/clubs/:clubId/access', authenticateClubUser, async (req,res) => {
  const membership = await membershipForClub(req.clubUser!.id, req.params.clubId)
  if (!membership) return res.status(404).json({error:'No membership exists for this club'})
  res.json({data:{...membership,active:membership.status==='ACTIVE',permissions:{manageUsers:roleCan(membership.role,'manage_users'),teamSelection:roleCan(membership.role,'team_selection'),media:roleCan(membership.role,'media'),sponsors:roleCan(membership.role,'sponsors'),profile:roleCan(membership.role,'profile'),view:roleCan(membership.role,'view')}}})
})

router.get('/clubs/:clubId/dashboard', authenticateClubUser, requireActiveClubMembership, async (req, res) => {
  try {
    const clubId = req.params.clubId
    const membership = res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>>
    if (!membership) return res.status(403).json({ error: 'Active club access is required' })

    const club = await prisma.club.findFirst({
      where: { id: clubId, archivedAt: null },
      select: {
        id: true, name: true, shortName: true, logoUrl: true, primaryColour: true, secondaryColour: true,
        description: true, websiteUrl: true, facebookUrl: true, instagramUrl: true, contactEmail: true,
        state: { select: { code: true, name: true } },
        clubSeasons: { where: { isActive: true }, orderBy: [{ season: 'desc' }, { updatedAt: 'desc' }], take: 1, select: { season: true, grade: true, leagueId: true, league: { select: { name: true } } } },
      },
    })
    if (!club) return res.status(404).json({ error: 'Club not found' })

    const [profileResult, sheetResult, articlesResult, sponsorsResult, pendingUsersResult, notificationsResult] = await Promise.allSettled([
      prisma.clubProfile.findUnique({
        where: { clubId },
        select: { ground:true,address:true,websiteUrl:true,facebookUrl:true,instagramUrl:true,email:true,phone:true,trainingNights:true,clubColours:true,history:true,foundedYear:true,gallery:true,uniformPhotos:true,partnerLogos:true,updatedAt:true },
      }),
      prisma.$queryRawUnsafe<Array<{ id:string; roundLabel:string; opponentName:string|null; matchDate:string|null; status:string; publishedAt:string|null; playerCount:number }>>(`
        SELECT s.id::text AS id, s.round_label AS "roundLabel", s.opponent_name AS "opponentName",
          s.match_date::text AS "matchDate", s.status, s.published_at AS "publishedAt",
          COUNT(p.id)::int AS "playerCount"
        FROM football_team_sheets s
        LEFT JOIN football_team_sheet_players p ON p.team_sheet_id=s.id
        WHERE s.club_id=$1
        GROUP BY s.id
        ORDER BY s.match_date DESC NULLS LAST, s.updated_at DESC
        LIMIT 1
      `, clubId),
      (async () => {
        const links = await prisma.articleLink.findMany({ where: { entityType: 'CLUB', entityId: clubId }, orderBy: { createdAt: 'desc' }, take: 8, select: { articleId: true } })
        const ids = [...new Set(links.map(link => link.articleId))]
        return ids.length ? prisma.generatedArticle.findMany({
          where: { id: { in: ids }, status: { not: 'ARCHIVED' } },
          orderBy: { updatedAt: 'desc' }, take: 5,
          select: { id:true,slug:true,title:true,summary:true,status:true,heroSeed:true,updatedAt:true,publishedAt:true },
        }) : []
      })(),
      getClubSponsorships(clubId, false),
      prisma.$queryRawUnsafe<Array<{ count:number }>>(`SELECT COUNT(*)::int AS count FROM club_portal_memberships WHERE club_id=$1 AND status IN ('PENDING','INVITED')`, clubId),
      prisma.notification.count({ where: { recipientScope: 'CLUB', recipientId: clubId, status: { in: ['PENDING','QUEUED','SENT','DELIVERED'] } } }),
    ])

    const profile = profileResult.status === 'fulfilled' && profileResult.value ? profileResult.value : {
      ground:null,address:null,websiteUrl:null,facebookUrl:null,instagramUrl:null,email:null,phone:null,trainingNights:null,clubColours:null,history:null,foundedYear:null,gallery:null,uniformPhotos:null,partnerLogos:null,updatedAt:new Date(0),
    }
    const latestSheet = sheetResult.status === 'fulfilled' ? sheetResult.value[0] ?? null : null
    const articles = articlesResult.status === 'fulfilled' ? articlesResult.value : []
    const sponsors = sponsorsResult.status === 'fulfilled' && Array.isArray(sponsorsResult.value) ? sponsorsResult.value : []
    const pendingUsers = pendingUsersResult.status === 'fulfilled' ? pendingUsersResult.value[0]?.count ?? 0 : 0
    const unreadNotifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value : 0

    const profileChecks = [
      Boolean(club.logoUrl), Boolean(club.description || profile.history), Boolean(profile.ground), Boolean(profile.address),
      Boolean(club.websiteUrl || profile.websiteUrl), Boolean(club.facebookUrl || profile.facebookUrl),
      Boolean(club.instagramUrl || profile.instagramUrl), Boolean(club.contactEmail || profile.email), Boolean(profile.phone),
      Boolean(profile.trainingNights), Boolean(profile.clubColours), Boolean(profile.foundedYear),
    ]
    const completedFields = profileChecks.filter(Boolean).length
    const season = club.clubSeasons[0]
    const draftCount = articles.filter(article => article.status === 'DRAFT').length
    const approvalCount = articles.filter(article => article.status === 'APPROVED').length

    res.json({ data: {
      club: { id:club.id,name:club.name,shortName:club.shortName,logoUrl:club.logoUrl,primaryColour:club.primaryColour,secondaryColour:club.secondaryColour,state:club.state.code,stateName:club.state.name,leagueId:season?.leagueId??null,leagueName:season?.league.name??null,season:season?.season??null,grade:season?.grade??null },
      membership: { id:membership.id,role:membership.role,status:membership.status,permissions:{manageUsers:roleCan(membership.role,'manage_users'),teamSelection:roleCan(membership.role,'team_selection'),media:roleCan(membership.role,'media'),sponsors:roleCan(membership.role,'sponsors'),profile:roleCan(membership.role,'profile'),view:true} },
      profile: { completion:Math.round((completedFields/profileChecks.length)*100),completedFields,totalFields:profileChecks.length,lastUpdatedAt:profile.updatedAt,photoCount:jsonArrayLength(profile.gallery)+jsonArrayLength(profile.uniformPhotos),partnerLogoCount:jsonArrayLength(profile.partnerLogos),missing:[!club.logoUrl?'Club logo':null,!(club.description||profile.history)?'Club story':null,!profile.ground?'Home ground':null,!profile.address?'Address':null,!(club.contactEmail||profile.email)?'Contact email':null,!profile.phone?'Phone':null].filter(Boolean) },
      teamSelection: latestSheet,
      news: { total:articles.length,drafts:draftCount,pending:approvalCount,published:articles.filter(article=>article.status==='PUBLISHED').length,recent:articles },
      sponsors: { active:sponsors.filter((item:{status?:string})=>['APPROVED','ACTIVE','PAYMENT_COMPLETE','RENEWAL_DUE'].includes(String(item.status))).length,items:sponsors.slice(0,4) },
      users: { pending:pendingUsers },
      notifications: { unread:unreadNotifications },
      generatedAt:new Date().toISOString(),
    } })
  } catch (error) {
    res.status(500).json({ error:'Unable to load club dashboard',detail:String(error) })
  }
})

router.post('/clubs/:clubId/request-access', authenticateClubUser, async (req,res) => {
  const club = await prisma.club.findFirst({where:{id:req.params.clubId,archivedAt:null},select:{id:true,name:true}})
  if (!club) return res.status(404).json({error:'Club not found'})
  const body=(req.body??{}) as Record<string,unknown>
  const applicantName=String(body.applicantName??'').trim(), clubPosition=String(body.clubPosition??'').trim(), reason=String(body.reason??'').trim(), phone=String(body.phone??'').trim()
  if (!applicantName || !clubPosition || reason.length<20) return res.status(400).json({error:'Your name, club role and a short verification reason are required'})
  const existing=await membershipForClub(req.clubUser!.id,club.id)
  if (existing?.status==='ACTIVE') return res.status(409).json({error:'You already have active access to this club'})
  if (existing?.status==='PENDING') return res.json({data:existing,message:'Your claim is already awaiting approval'})
  const membership=await createPendingMembership(req.clubUser!,club.id,{applicantName,clubPosition,phone,reason})
  res.status(201).json({data:membership,message:`Claim submitted for ${club.name}`})
})

router.post('/invitations/accept', authenticateClubUser, async (req,res) => {
  const token=String(req.body?.token??'').trim()
  if (!token) return res.status(400).json({error:'Invitation token is required'})
  try {
    const membership=await acceptClubInvitation(req.clubUser!,token)
    if (!membership) return res.status(404).json({error:'This invitation is invalid, expired or already used'})
    res.json({data:{membership},message:'Club invitation accepted'})
  } catch(error){res.status(403).json({error:error instanceof Error?error.message:'Unable to accept invitation'})}
})

export { router as clubMembershipsRouter }
