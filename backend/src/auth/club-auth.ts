import type { NextFunction, Request, Response } from 'express'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { prisma } from '../db/client.js'
import { effectiveClubPermissions, type ClubPermissionKey, type ClubPermissionPreset } from './club-permissions.js'

export const CLUB_ROLES = ['OWNER', 'ADMIN', 'TEAM_MANAGER', 'MEDIA_MANAGER', 'SPONSOR_MANAGER', 'VIEWER'] as const
export const MEMBERSHIP_STATUSES = ['INVITED', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'] as const
export type ClubRole = typeof CLUB_ROLES[number]
export type MembershipStatus = typeof MEMBERSHIP_STATUSES[number]

export type AuthenticatedClubUser = { id: string; email: string | null; accessToken: string }
export type ClubMembership = {
  id: string; userId: string; email: string; clubId: string; role: ClubRole; status: MembershipStatus
  applicantName: string | null; clubPosition: string | null; phone: string | null; reason: string | null
  reviewNotes: string | null; invitedBy: string | null; approvedBy: string | null; approvedAt: Date | null
  revokedAt: Date | null; createdAt: Date; updatedAt: Date
  preset: ClubPermissionPreset | null; permissions: ClubPermissionKey[]
}

declare global { namespace Express { interface Request { clubUser?: AuthenticatedClubUser } } }

let schemaReady: Promise<void> | null = null
export function ensureClubMembershipSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "club_portal_memberships" (
      "id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL, "email" TEXT NOT NULL, "club_id" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'VIEWER', "status" TEXT NOT NULL DEFAULT 'PENDING',
      "applicant_name" TEXT, "club_position" TEXT, "phone" TEXT, "reason" TEXT, "review_notes" TEXT,
      "invited_by" TEXT, "approved_by" TEXT, "approved_at" TIMESTAMPTZ, "revoked_at" TIMESTAMPTZ,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "club_portal_memberships_role_check" CHECK ("role" IN ('OWNER','ADMIN','TEAM_MANAGER','MEDIA_MANAGER','SPONSOR_MANAGER','VIEWER')),
      CONSTRAINT "club_portal_memberships_status_check" CHECK ("status" IN ('INVITED','PENDING','ACTIVE','SUSPENDED','REVOKED'))
    )`)
    for (const sql of [
      `ALTER TABLE club_portal_memberships ADD COLUMN IF NOT EXISTS applicant_name TEXT`,
      `ALTER TABLE club_portal_memberships ADD COLUMN IF NOT EXISTS club_position TEXT`,
      `ALTER TABLE club_portal_memberships ADD COLUMN IF NOT EXISTS phone TEXT`,
      `ALTER TABLE club_portal_memberships ADD COLUMN IF NOT EXISTS reason TEXT`,
      `ALTER TABLE club_portal_memberships ADD COLUMN IF NOT EXISTS review_notes TEXT`,
      `ALTER TABLE club_portal_memberships ADD COLUMN IF NOT EXISTS preset TEXT DEFAULT 'CUSTOM'`,
      `ALTER TABLE club_portal_memberships ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb`,
    ]) await prisma.$executeRawUnsafe(sql)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "club_portal_memberships_user_club_unique" ON club_portal_memberships (user_id, club_id)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "club_portal_memberships_club_status_idx" ON club_portal_memberships (club_id, status)`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "club_portal_invitations" (
      "id" TEXT PRIMARY KEY, "club_id" TEXT NOT NULL, "email" TEXT NOT NULL, "role" TEXT NOT NULL,
      "token_hash" TEXT NOT NULL UNIQUE, "invited_by" TEXT NOT NULL, "expires_at" TIMESTAMPTZ NOT NULL,
      "accepted_by" TEXT, "accepted_at" TIMESTAMPTZ, "revoked_at" TIMESTAMPTZ, "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await prisma.$executeRawUnsafe(`ALTER TABLE club_portal_invitations ADD COLUMN IF NOT EXISTS preset TEXT DEFAULT 'CUSTOM'`)
    await prisma.$executeRawUnsafe(`ALTER TABLE club_portal_invitations ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "club_portal_invites_email_idx" ON club_portal_invitations (email, expires_at)`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "club_portal_membership_audit" (
      "id" TEXT PRIMARY KEY, "membership_id" TEXT, "club_id" TEXT NOT NULL, "user_id" TEXT,
      "action" TEXT NOT NULL, "actor_id" TEXT NOT NULL, "detail" JSONB, "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
  })().catch(error => { schemaReady = null; throw error })
  return schemaReady
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
function bearerToken(req: Request) { return req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '' }
export async function authenticateClubUser(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req)
  if (!token) return res.status(401).json({ error: 'Sign in is required' })
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const apiKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !apiKey) return res.status(503).json({ error: 'Club authentication is not configured' })
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { authorization: `Bearer ${token}`, apikey: apiKey }, signal: AbortSignal.timeout(6000) })
    if (!response.ok) return res.status(401).json({ error: 'Your session is invalid or has expired' })
    const identity = await response.json() as { id?: string; email?: string | null }
    if (!identity.id) return res.status(401).json({ error: 'Unable to verify this account' })
    req.clubUser = { id: identity.id, email: identity.email?.trim().toLowerCase() ?? null, accessToken: token }
    next()
  } catch { return res.status(503).json({ error: 'Authentication service is temporarily unavailable' }) }
}

const membershipSelect = `id, user_id AS "userId", email, club_id AS "clubId", role, status,
 applicant_name AS "applicantName", club_position AS "clubPosition", phone, reason, review_notes AS "reviewNotes",
 invited_by AS "invitedBy", approved_by AS "approvedBy", approved_at AS "approvedAt", revoked_at AS "revokedAt",
 created_at AS "createdAt", updated_at AS "updatedAt", preset, permissions`
export async function membershipsForUser(userId: string): Promise<ClubMembership[]> {
  return prisma.$queryRawUnsafe<ClubMembership[]>(`SELECT ${membershipSelect} FROM club_portal_memberships WHERE user_id=$1 AND status<>'REVOKED' ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PENDING' THEN 1 WHEN 'INVITED' THEN 2 ELSE 3 END, created_at`, userId)
}
export async function membershipForClub(userId: string, clubId: string) {
  const rows = await prisma.$queryRawUnsafe<ClubMembership[]>(`SELECT ${membershipSelect} FROM club_portal_memberships WHERE user_id=$1 AND club_id=$2 LIMIT 1`, userId, clubId)
  return rows[0] ?? null
}
export async function requireActiveClubMembership(req: Request, res: Response, next: NextFunction) {
  const user = req.clubUser
  if (!user) return res.status(401).json({ error: 'Sign in is required' })
  const clubId = String(req.params.clubId ?? req.body?.clubId ?? '').trim()
  if (!clubId) return res.status(400).json({ error: 'clubId is required' })
  const membership = await membershipForClub(user.id, clubId)
  if (!membership || membership.status !== 'ACTIVE') return res.status(403).json({ error: 'You do not have active access to this club' })
  res.locals.clubMembership = membership; next()
}
export function roleCan(role: ClubRole, action: 'manage_users'|'team_selection'|'media'|'sponsors'|'profile'|'view') {
  if (role === 'OWNER') return true
  if (role === 'ADMIN') return action !== 'manage_users'
  if (role === 'TEAM_MANAGER') return action === 'team_selection' || action === 'view'
  if (role === 'MEDIA_MANAGER') return action === 'media' || action === 'view'
  if (role === 'SPONSOR_MANAGER') return action === 'sponsors' || action === 'view'
  return action === 'view'
}
export async function createPendingMembership(user: AuthenticatedClubUser, clubId: string, claim: { applicantName?: string; clubPosition?: string; phone?: string; reason?: string } = {}) {
  await ensureClubMembershipSchema()
  await prisma.$executeRawUnsafe(`INSERT INTO club_portal_memberships (id,user_id,email,club_id,role,status,applicant_name,club_position,phone,reason)
    VALUES ($1,$2,$3,$4,'VIEWER','PENDING',$5,$6,$7,$8)
    ON CONFLICT (user_id,club_id) DO UPDATE SET email=EXCLUDED.email,status=CASE WHEN club_portal_memberships.status IN ('REVOKED','SUSPENDED') THEN 'PENDING' ELSE club_portal_memberships.status END,applicant_name=EXCLUDED.applicant_name,club_position=EXCLUDED.club_position,phone=EXCLUDED.phone,reason=EXCLUDED.reason,updated_at=NOW()`,
    randomUUID(), user.id, user.email ?? '', clubId, claim.applicantName ?? null, claim.clubPosition ?? null, claim.phone ?? null, claim.reason ?? null)
  const membership = await membershipForClub(user.id, clubId)
  if (membership) await auditMembership(membership.id, clubId, user.id, 'CLAIM_SUBMITTED', user.id, claim)
  return membership
}
export async function issueClubInvitation(clubId: string, email: string, role: ClubRole, actorId: string, access?: { preset?: ClubPermissionPreset; permissions?: ClubPermissionKey[] }) {
  await ensureClubMembershipSchema(); const token = randomBytes(32).toString('hex')
  const preset=access?.preset??'CUSTOM',permissions=access?.permissions??[]
  await prisma.$executeRawUnsafe(`INSERT INTO club_portal_invitations (id,club_id,email,role,token_hash,invited_by,expires_at,preset,permissions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`, randomUUID(), clubId, email.trim().toLowerCase(), role, hashToken(token), actorId, new Date(Date.now()+7*86400000),preset,JSON.stringify(permissions))
  return token
}
export async function acceptClubInvitation(user: AuthenticatedClubUser, token: string) {
  await ensureClubMembershipSchema()
  const rows = await prisma.$queryRawUnsafe<Array<{id:string;clubId:string;email:string;role:ClubRole;invitedBy:string;preset:ClubPermissionPreset|null;permissions:ClubPermissionKey[]}>>(`SELECT id,club_id AS "clubId",email,role,invited_by AS "invitedBy",preset,permissions FROM club_portal_invitations WHERE token_hash=$1 AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at>NOW() LIMIT 1`, hashToken(token))
  const invite = rows[0]; if (!invite) return null
  if (user.email && invite.email !== user.email) throw new Error('This invitation was sent to a different email address')
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`INSERT INTO club_portal_memberships (id,user_id,email,club_id,role,status,invited_by,approved_by,approved_at,preset,permissions) VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$6,NOW(),$7,$8::jsonb) ON CONFLICT (user_id,club_id) DO UPDATE SET role=EXCLUDED.role,status='ACTIVE',invited_by=EXCLUDED.invited_by,approved_by=EXCLUDED.approved_by,approved_at=NOW(),preset=EXCLUDED.preset,permissions=EXCLUDED.permissions,revoked_at=NULL,updated_at=NOW()`, randomUUID(), user.id, invite.email, invite.clubId, invite.role, invite.invitedBy,invite.preset??'CUSTOM',JSON.stringify(invite.permissions??[]))
    await tx.$executeRawUnsafe(`UPDATE club_portal_invitations SET accepted_by=$1,accepted_at=NOW() WHERE id=$2`, user.id, invite.id)
  })
  const membership = await membershipForClub(user.id, invite.clubId)
  if (membership) await auditMembership(membership.id, invite.clubId, user.id, 'INVITATION_ACCEPTED', user.id, { role: invite.role })
  return membership
}
export async function auditMembership(membershipId:string|null, clubId:string, userId:string|null, action:string, actorId:string, detail:unknown) {
  await ensureClubMembershipSchema()
  await prisma.$executeRawUnsafe(`INSERT INTO club_portal_membership_audit (id,membership_id,club_id,user_id,action,actor_id,detail) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`, randomUUID(), membershipId, clubId, userId, action, actorId, JSON.stringify(detail ?? {}))
}
export function clubUserCan(membership: ClubMembership, permission: ClubPermissionKey) { return effectiveClubPermissions(membership).includes(permission) }
