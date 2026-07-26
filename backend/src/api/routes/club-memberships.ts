import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { acceptClubInvitation, authenticateClubUser, createPendingMembership, membershipForClub, membershipsForUser, roleCan } from '../../auth/club-auth.js'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
router.use(publicRateLimit)

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
    res.json({data:membership,message:'Club invitation accepted'})
  } catch(error){res.status(403).json({error:error instanceof Error?error.message:'Unable to accept invitation'})}
})

export { router as clubMembershipsRouter }
