import { Router } from 'express'
import { prisma } from '../../db/client.js'
import {
  authenticateClubUser, auditMembership, ensureClubMembershipSchema, issueClubInvitation,
  membershipForClub, requireActiveClubMembership, type ClubMembership,
} from '../../auth/club-auth.js'
import {
  CLUB_PERMISSION_KEYS, CLUB_PERMISSION_PRESETS, effectiveClubPermissions,
  permissionsForPreset, sanitisePermissions, type ClubPermissionPreset,
} from '../../auth/club-permissions.js'

const router = Router()
router.use(authenticateClubUser)

function canManage(membership: ClubMembership | null | undefined) {
  if (!membership || membership.status !== 'ACTIVE') return false
  return effectiveClubPermissions(membership).includes('permissions.manage')
}

function requirePermissionManager(_req: any, res: any, next: any) {
  const membership = res.locals.clubMembership as ClubMembership | undefined
  if (!canManage(membership)) return res.status(403).json({ error: 'You do not have permission to manage club access' })
  next()
}

function parseAccess(body: any) {
  const preset = String(body?.preset ?? 'CUSTOM').toUpperCase() as ClubPermissionPreset
  if (!(preset in CLUB_PERMISSION_PRESETS)) throw new Error('Invalid permission preset')
  const permissions = preset === 'CUSTOM' ? sanitisePermissions(body?.permissions) : permissionsForPreset(preset)
  return { preset, permissions }
}

async function activeOwnerCount(clubId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{count:number}>>(`SELECT COUNT(*)::int AS count FROM club_portal_memberships WHERE club_id=$1 AND role='OWNER' AND status='ACTIVE'`, clubId)
  return rows[0]?.count ?? 0
}

router.get('/clubs/:clubId', requireActiveClubMembership, requirePermissionManager, async (req, res) => {
  try {
    await ensureClubMembershipSchema()
    const members = await prisma.$queryRawUnsafe<Array<Record<string,unknown>>>(`
      SELECT id,user_id AS "userId",email,role,status,preset,permissions,
        applicant_name AS "applicantName",club_position AS "clubPosition",phone,
        approved_at AS "approvedAt",created_at AS "createdAt",updated_at AS "updatedAt"
      FROM club_portal_memberships WHERE club_id=$1
      ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'INVITED' THEN 1 WHEN 'SUSPENDED' THEN 2 ELSE 3 END, email
    `, req.params.clubId)
    const invitations = await prisma.$queryRawUnsafe<Array<Record<string,unknown>>>(`
      SELECT id,email,role,preset,permissions,expires_at AS "expiresAt",accepted_at AS "acceptedAt",
        revoked_at AS "revokedAt",created_at AS "createdAt"
      FROM club_portal_invitations WHERE club_id=$1 ORDER BY created_at DESC LIMIT 100
    `, req.params.clubId)
    res.json({ data:{
      members:members.map(member => ({...member,effectivePermissions:effectiveClubPermissions(member as any)})),
      invitations,
      currentUserId:req.clubUser!.id,
      permissionKeys:CLUB_PERMISSION_KEYS,
      presets:CLUB_PERMISSION_PRESETS,
    } })
  } catch (error) {
    res.status(500).json({ error:'Unable to load permissions',detail:error instanceof Error?error.message:String(error) })
  }
})

router.post('/clubs/:clubId/invitations', requireActiveClubMembership, requirePermissionManager, async (req, res) => {
  try {
    await ensureClubMembershipSchema()
    const email=String(req.body?.email??'').trim().toLowerCase()
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'A valid email address is required'})
    const {preset,permissions}=parseAccess(req.body)
    const role=preset==='FULL_ADMIN'?'ADMIN':preset==='COACH'||preset==='ASSISTANT_COACH'?'TEAM_MANAGER':preset==='MEDIA_STUDIO'?'MEDIA_MANAGER':'VIEWER'
    const existing=await prisma.$queryRawUnsafe<Array<{id:string;status:string}>>(`SELECT id,status FROM club_portal_memberships WHERE club_id=$1 AND lower(email)=lower($2) ORDER BY created_at DESC LIMIT 1`,req.params.clubId,email)
    if(existing[0]?.status==='ACTIVE')return res.status(409).json({error:'This email already has active club access. Edit that user instead.'})
    await prisma.$executeRawUnsafe(`UPDATE club_portal_invitations SET revoked_at=NOW() WHERE club_id=$1 AND lower(email)=lower($2) AND accepted_at IS NULL AND revoked_at IS NULL`,req.params.clubId,email)
    const token=await issueClubInvitation(req.params.clubId,email,role as any,req.clubUser!.id,{preset,permissions})
    await auditMembership(existing[0]?.id??null,req.params.clubId,null,'PERMISSION_INVITATION_CREATED',req.clubUser!.id,{email,preset,permissions})
    res.status(201).json({data:{email,preset,permissions,invitePath:`/club-portal?invite=${token}`,expiresInDays:7},message:'User invitation created'})
  } catch(error){res.status(400).json({error:error instanceof Error?error.message:'Unable to create invitation'})}
})

router.patch('/clubs/:clubId/members/:membershipId', requireActiveClubMembership, requirePermissionManager, async (req,res)=>{
  try{
    await ensureClubMembershipSchema()
    const rows=await prisma.$queryRawUnsafe<Array<{id:string;userId:string;role:string;status:string;preset:string|null;permissions:unknown}>>(`SELECT id,user_id AS "userId",role,status,preset,permissions FROM club_portal_memberships WHERE id=$1 AND club_id=$2 LIMIT 1`,req.params.membershipId,req.params.clubId)
    const target=rows[0]
    if(!target)return res.status(404).json({error:'Club user not found'})
    const action=String(req.body?.action??'SAVE').toUpperCase()
    if(target.userId===req.clubUser!.id&&['SUSPEND','REVOKE'].includes(action))return res.status(400).json({error:'You cannot suspend or remove your own access'})
    if(target.role==='OWNER'&&target.status==='ACTIVE'&&['SUSPEND','REVOKE'].includes(action)&&await activeOwnerCount(req.params.clubId)<=1)return res.status(400).json({error:'The club must retain at least one active owner'})
    let status=target.status
    if(action==='SUSPEND')status='SUSPENDED'
    if(action==='REACTIVATE')status='ACTIVE'
    if(action==='REVOKE')status='REVOKED'
    let preset=target.preset??'CUSTOM',permissions=effectiveClubPermissions(target as any)
    if(action==='SAVE'||req.body?.preset||req.body?.permissions){const parsed=parseAccess(req.body);preset=parsed.preset;permissions=parsed.permissions}
    if(target.role==='OWNER'){preset='FULL_ADMIN';permissions=[...CLUB_PERMISSION_KEYS]}
    await prisma.$executeRawUnsafe(`UPDATE club_portal_memberships SET status=$1,preset=$2,permissions=$3::jsonb,revoked_at=CASE WHEN $1='REVOKED' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$4`,status,preset,JSON.stringify(permissions),target.id)
    await auditMembership(target.id,req.params.clubId,target.userId,`PERMISSIONS_${action}`,req.clubUser!.id,{preset,permissions,status})
    res.json({data:{id:target.id,preset,permissions,status},message:'User permissions updated'})
  }catch(error){res.status(400).json({error:error instanceof Error?error.message:'Unable to update permissions'})}
})

router.post('/clubs/:clubId/invitations/:invitationId/revoke', requireActiveClubMembership, requirePermissionManager, async(req,res)=>{
  await ensureClubMembershipSchema()
  const changed=await prisma.$executeRawUnsafe(`UPDATE club_portal_invitations SET revoked_at=NOW() WHERE id=$1 AND club_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL`,req.params.invitationId,req.params.clubId)
  if(!changed)return res.status(404).json({error:'Active invitation not found'})
  await auditMembership(null,req.params.clubId,null,'PERMISSION_INVITATION_REVOKED',req.clubUser!.id,{invitationId:req.params.invitationId})
  res.json({data:{revoked:true}})
})

export {router as clubPermissionsRouter}
