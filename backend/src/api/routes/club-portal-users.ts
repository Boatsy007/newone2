import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, auditMembership, CLUB_ROLES, ensureClubMembershipSchema, issueClubInvitation, membershipForClub, requireActiveClubMembership, roleCan, type ClubRole } from '../../auth/club-auth.js'

const router = Router()
router.use(authenticateClubUser)

async function requireOwner(req: any, res: any, next: any) {
  const membership = res.locals.clubMembership as Awaited<ReturnType<typeof membershipForClub>> | undefined
  if (!membership || !roleCan(membership.role, 'manage_users')) return res.status(403).json({ error: 'Only a club owner can manage club users' })
  next()
}

async function activeOwnerCount(clubId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ count:number }>>(`SELECT COUNT(*)::int AS count FROM club_portal_memberships WHERE club_id=$1 AND role='OWNER' AND status='ACTIVE'`, clubId)
  return rows[0]?.count ?? 0
}

router.get('/clubs/:clubId/users', requireActiveClubMembership, requireOwner, async (req, res) => {
  try {
    const members = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT id,user_id AS "userId",email,role,status,applicant_name AS "applicantName",
        club_position AS "clubPosition",phone,review_notes AS "reviewNotes",approved_at AS "approvedAt",
        revoked_at AS "revokedAt",created_at AS "createdAt",updated_at AS "updatedAt"
      FROM club_portal_memberships WHERE club_id=$1
      ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PENDING' THEN 1 WHEN 'INVITED' THEN 2 WHEN 'SUSPENDED' THEN 3 ELSE 4 END, created_at
    `, req.params.clubId)
    const invitations = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT id,email,role,invited_by AS "invitedBy",expires_at AS "expiresAt",accepted_by AS "acceptedBy",
        accepted_at AS "acceptedAt",revoked_at AS "revokedAt",created_at AS "createdAt"
      FROM club_portal_invitations WHERE club_id=$1 ORDER BY created_at DESC LIMIT 100
    `, req.params.clubId)
    const audit = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT id,membership_id AS "membershipId",user_id AS "userId",action,actor_id AS "actorId",detail,created_at AS "createdAt"
      FROM club_portal_membership_audit WHERE club_id=$1 ORDER BY created_at DESC LIMIT 100
    `, req.params.clubId)
    res.json({ data: { members, invitations, audit, currentUserId:req.clubUser!.id } })
  } catch (error) { res.status(500).json({ error:'Unable to load club users',detail:String(error) }) }
})

router.post('/clubs/:clubId/users/invitations', requireActiveClubMembership, requireOwner, async (req, res) => {
  try {
    await ensureClubMembershipSchema()
    const email=String(req.body?.email??'').trim().toLowerCase()
    const role=String(req.body?.role??'VIEWER').toUpperCase() as ClubRole
    if(!email.includes('@'))return res.status(400).json({error:'A valid email address is required'})
    if(!CLUB_ROLES.includes(role))return res.status(400).json({error:'Invalid club role'})
    const existing=await prisma.$queryRawUnsafe<Array<{id:string;status:string}>>(`SELECT id,status FROM club_portal_memberships WHERE club_id=$1 AND lower(email)=lower($2) ORDER BY created_at DESC LIMIT 1`,req.params.clubId,email)
    if(existing[0]?.status==='ACTIVE')return res.status(409).json({error:'This email already has active club access'})
    await prisma.$executeRawUnsafe(`UPDATE club_portal_invitations SET revoked_at=NOW() WHERE club_id=$1 AND lower(email)=lower($2) AND accepted_at IS NULL AND revoked_at IS NULL`,req.params.clubId,email)
    const token=await issueClubInvitation(req.params.clubId,email,role,req.clubUser!.id)
    await auditMembership(existing[0]?.id??null,req.params.clubId,null,'INVITATION_CREATED',req.clubUser!.id,{email,role})
    res.status(201).json({data:{email,role,invitePath:`/club-portal?invite=${token}`,expiresInDays:7},message:'Invitation created'})
  } catch(error){res.status(500).json({error:'Unable to create invitation',detail:String(error)})}
})

router.post('/clubs/:clubId/users/invitations/:invitationId/resend', requireActiveClubMembership, requireOwner, async (req,res)=>{
  try {
    await ensureClubMembershipSchema()
    const rows=await prisma.$queryRawUnsafe<Array<{id:string;email:string;role:ClubRole;acceptedAt:Date|null}>>(`SELECT id,email,role,accepted_at AS "acceptedAt" FROM club_portal_invitations WHERE id=$1 AND club_id=$2 LIMIT 1`,req.params.invitationId,req.params.clubId)
    const invitation=rows[0]
    if(!invitation)return res.status(404).json({error:'Invitation not found'})
    if(invitation.acceptedAt)return res.status(409).json({error:'This invitation has already been accepted'})
    await prisma.$executeRawUnsafe(`UPDATE club_portal_invitations SET revoked_at=NOW() WHERE club_id=$1 AND lower(email)=lower($2) AND accepted_at IS NULL AND revoked_at IS NULL`,req.params.clubId,invitation.email)
    const token=await issueClubInvitation(req.params.clubId,invitation.email,invitation.role,req.clubUser!.id)
    await auditMembership(null,req.params.clubId,null,'INVITATION_RESENT',req.clubUser!.id,{email:invitation.email,role:invitation.role,previousInvitationId:invitation.id})
    res.json({data:{email:invitation.email,role:invitation.role,invitePath:`/club-portal?invite=${token}`,expiresInDays:7},message:'A new invitation link was created'})
  }catch(error){res.status(500).json({error:'Unable to resend invitation',detail:String(error)})}
})

router.patch('/clubs/:clubId/users/:membershipId', requireActiveClubMembership, requireOwner, async (req, res) => {
  try {
    await ensureClubMembershipSchema()
    const action=String(req.body?.action??'').toUpperCase()
    const role=String(req.body?.role??'').toUpperCase() as ClubRole
    const notes=String(req.body?.notes??'').trim()
    if(!['CHANGE_ROLE','SUSPEND','REACTIVATE','REVOKE','APPROVE','REJECT'].includes(action))return res.status(400).json({error:'Invalid membership action'})
    if(action==='CHANGE_ROLE'||action==='APPROVE'){if(!CLUB_ROLES.includes(role))return res.status(400).json({error:'Invalid club role'})}
    const rows=await prisma.$queryRawUnsafe<Array<{id:string;clubId:string;userId:string;role:ClubRole;status:string}>>(`SELECT id,club_id AS "clubId",user_id AS "userId",role,status FROM club_portal_memberships WHERE id=$1 AND club_id=$2 LIMIT 1`,req.params.membershipId,req.params.clubId)
    const target=rows[0]
    if(!target)return res.status(404).json({error:'Club membership not found'})
    if(target.userId===req.clubUser!.id&&['SUSPEND','REVOKE','REJECT'].includes(action))return res.status(400).json({error:'You cannot remove or suspend your own club access'})
    const removesOwner=(target.role==='OWNER'&&target.status==='ACTIVE'&&(['SUSPEND','REVOKE','REJECT'].includes(action)||(action==='CHANGE_ROLE'&&role!=='OWNER')))
    if(removesOwner&&await activeOwnerCount(req.params.clubId)<=1)return res.status(409).json({error:'The club must retain at least one active Owner'})
    let nextStatus=target.status,nextRole=target.role
    if(action==='CHANGE_ROLE')nextRole=role
    if(action==='APPROVE'){nextStatus='ACTIVE';nextRole=role}
    if(action==='REACTIVATE')nextStatus='ACTIVE'
    if(action==='SUSPEND')nextStatus='SUSPENDED'
    if(action==='REVOKE'||action==='REJECT')nextStatus='REVOKED'
    await prisma.$executeRawUnsafe(`UPDATE club_portal_memberships SET role=$1,status=$2,review_notes=$3,approved_by=CASE WHEN $2='ACTIVE' THEN $4 ELSE approved_by END,approved_at=CASE WHEN $2='ACTIVE' THEN COALESCE(approved_at,NOW()) ELSE approved_at END,revoked_at=CASE WHEN $2='REVOKED' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$5`,nextRole,nextStatus,notes||null,req.clubUser!.id,target.id)
    await auditMembership(target.id,req.params.clubId,target.userId,action,req.clubUser!.id,{fromRole:target.role,toRole:nextRole,fromStatus:target.status,toStatus:nextStatus,notes})
    res.json({data:{id:target.id,role:nextRole,status:nextStatus},message:'Club access updated'})
  } catch(error){res.status(500).json({error:'Unable to update club access',detail:String(error)})}
})

router.post('/clubs/:clubId/users/invitations/:invitationId/revoke', requireActiveClubMembership, requireOwner, async (req,res)=>{
  await ensureClubMembershipSchema()
  const changed=await prisma.$executeRawUnsafe(`UPDATE club_portal_invitations SET revoked_at=NOW() WHERE id=$1 AND club_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL`,req.params.invitationId,req.params.clubId)
  if(!changed)return res.status(404).json({error:'Active invitation not found'})
  await auditMembership(null,req.params.clubId,null,'INVITATION_REVOKED',req.clubUser!.id,{invitationId:req.params.invitationId})
  res.json({data:{revoked:true}})
})

export { router as clubPortalUsersRouter }
