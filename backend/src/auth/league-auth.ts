import type { NextFunction, Request, Response } from 'express'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { prisma } from '../db/client.js'
import { authenticateClubUser, type AuthenticatedClubUser } from './club-auth.js'

export const LEAGUE_ROLES = ['OWNER', 'ADMIN', 'DATA_MANAGER', 'MEDIA_MANAGER', 'SPONSOR_MANAGER', 'VIEWER'] as const
export const LEAGUE_MEMBERSHIP_STATUSES = ['INVITED', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'] as const
export type LeagueRole = typeof LEAGUE_ROLES[number]
export type LeagueMembershipStatus = typeof LEAGUE_MEMBERSHIP_STATUSES[number]
export type LeagueAction = 'manage_users' | 'competition_data' | 'media' | 'sponsors' | 'profile' | 'view'

export type LeagueMembership = {
  id: string
  userId: string
  email: string
  leagueId: string
  role: LeagueRole
  status: LeagueMembershipStatus
  applicantName: string | null
  leaguePosition: string | null
  phone: string | null
  reason: string | null
  reviewNotes: string | null
  invitedBy: string | null
  approvedBy: string | null
  approvedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export const authenticateLeagueUser = authenticateClubUser

let schemaReady: Promise<void> | null = null
export function ensureLeagueMembershipSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS league_portal_memberships (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, email TEXT NOT NULL, league_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'VIEWER', status TEXT NOT NULL DEFAULT 'PENDING', applicant_name TEXT,
      league_position TEXT, phone TEXT, reason TEXT, review_notes TEXT, invited_by TEXT, approved_by TEXT,
      approved_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    for (const sql of [
      `ALTER TABLE league_portal_memberships ADD COLUMN IF NOT EXISTS applicant_name TEXT`,
      `ALTER TABLE league_portal_memberships ADD COLUMN IF NOT EXISTS league_position TEXT`,
      `ALTER TABLE league_portal_memberships ADD COLUMN IF NOT EXISTS phone TEXT`,
      `ALTER TABLE league_portal_memberships ADD COLUMN IF NOT EXISTS reason TEXT`,
      `ALTER TABLE league_portal_memberships ADD COLUMN IF NOT EXISTS review_notes TEXT`,
      `ALTER TABLE league_portal_memberships ADD COLUMN IF NOT EXISTS invited_by TEXT`,
      `ALTER TABLE league_portal_memberships ADD COLUMN IF NOT EXISTS approved_by TEXT`,
      `ALTER TABLE league_portal_memberships ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`,
      `ALTER TABLE league_portal_memberships ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ`,
      `ALTER TABLE league_portal_memberships ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      `ALTER TABLE league_portal_memberships ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    ]) await prisma.$executeRawUnsafe(sql)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS league_portal_memberships_user_league_unique ON league_portal_memberships(user_id,league_id)`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS league_portal_memberships_league_status_idx ON league_portal_memberships(league_id,status)`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS league_portal_invitations (
      id TEXT PRIMARY KEY, league_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE, invited_by TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
      accepted_by TEXT, accepted_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS league_portal_invites_email_idx ON league_portal_invitations(email,expires_at)`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS league_portal_membership_audit (
      id TEXT PRIMARY KEY, membership_id TEXT, league_id TEXT NOT NULL, user_id TEXT,
      action TEXT NOT NULL, actor_id TEXT NOT NULL, detail JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
  })().catch(error => { schemaReady = null; throw error })
  return schemaReady
}

const membershipSelect = `id,user_id AS "userId",email,league_id AS "leagueId",role,status,
  applicant_name AS "applicantName",league_position AS "leaguePosition",phone,reason,
  review_notes AS "reviewNotes",invited_by AS "invitedBy",approved_by AS "approvedBy",
  approved_at AS "approvedAt",revoked_at AS "revokedAt",created_at AS "createdAt",updated_at AS "updatedAt"`
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function membershipsForLeagueUser(userId: string) {
  await ensureLeagueMembershipSchema()
  return prisma.$queryRawUnsafe<LeagueMembership[]>(`SELECT ${membershipSelect} FROM league_portal_memberships WHERE user_id=$1 ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PENDING' THEN 1 WHEN 'INVITED' THEN 2 WHEN 'SUSPENDED' THEN 3 ELSE 4 END,created_at`, userId)
}

export async function membershipForLeague(userId: string, leagueId: string) {
  await ensureLeagueMembershipSchema()
  const rows = await prisma.$queryRawUnsafe<LeagueMembership[]>(`SELECT ${membershipSelect} FROM league_portal_memberships WHERE user_id=$1 AND league_id=$2 LIMIT 1`, userId, leagueId)
  return rows[0] ?? null
}

export async function requireActiveLeagueMembership(req: Request, res: Response, next: NextFunction) {
  const user = req.clubUser
  const leagueId = String(req.params.leagueId ?? '').trim()
  if (!user) return res.status(401).json({ error: 'Sign in is required' })
  if (!leagueId) return res.status(400).json({ error: 'leagueId is required in the route' })
  const membership = await membershipForLeague(user.id, leagueId)
  if (!membership || membership.status !== 'ACTIVE') return res.status(403).json({ error: 'You do not have active access to this league' })
  res.locals.leagueMembership = membership
  next()
}

export function roleCanManageLeagueAction(role: LeagueRole, action: LeagueAction) {
  if (role === 'OWNER') return true
  if (role === 'ADMIN') return true
  if (role === 'DATA_MANAGER') return action === 'competition_data' || action === 'view'
  if (role === 'MEDIA_MANAGER') return action === 'media' || action === 'profile' || action === 'view'
  if (role === 'SPONSOR_MANAGER') return action === 'sponsors' || action === 'view'
  return action === 'view'
}

export async function createPendingLeagueMembership(user: AuthenticatedClubUser, leagueId: string, claim: { applicantName: string; leaguePosition: string; phone?: string; reason: string }) {
  await ensureLeagueMembershipSchema()
  await prisma.$executeRawUnsafe(`INSERT INTO league_portal_memberships(id,user_id,email,league_id,role,status,applicant_name,league_position,phone,reason)
    VALUES($1,$2,$3,$4,'VIEWER','PENDING',$5,$6,$7,$8)
    ON CONFLICT(user_id,league_id) DO UPDATE SET email=EXCLUDED.email,status=CASE WHEN league_portal_memberships.status IN('REVOKED','SUSPENDED') THEN 'PENDING' ELSE league_portal_memberships.status END,applicant_name=EXCLUDED.applicant_name,league_position=EXCLUDED.league_position,phone=EXCLUDED.phone,reason=EXCLUDED.reason,updated_at=NOW()`,
    randomUUID(), user.id, user.email ?? '', leagueId, claim.applicantName, claim.leaguePosition, claim.phone ?? null, claim.reason)
  const membership = await membershipForLeague(user.id, leagueId)
  if (membership) await auditLeagueMembership(membership.id, leagueId, user.id, 'CLAIM_SUBMITTED', user.id, claim)
  return membership
}

export async function issueLeagueInvitation(leagueId: string, email: string, role: LeagueRole, actorId: string) {
  await ensureLeagueMembershipSchema()
  const token = randomBytes(32).toString('hex')
  await prisma.$executeRawUnsafe(`INSERT INTO league_portal_invitations(id,league_id,email,role,token_hash,invited_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)`, randomUUID(), leagueId, email.trim().toLowerCase(), role, hashToken(token), actorId, new Date(Date.now() + 7 * 86400000))
  await auditLeagueMembership(null, leagueId, null, 'INVITATION_CREATED', actorId, { email: email.trim().toLowerCase(), role })
  return token
}

export async function acceptLeagueInvitation(user: AuthenticatedClubUser, token: string) {
  await ensureLeagueMembershipSchema()
  const rows = await prisma.$queryRawUnsafe<Array<{id:string;leagueId:string;email:string;role:LeagueRole;invitedBy:string}>>(`SELECT id,league_id AS "leagueId",email,role,invited_by AS "invitedBy" FROM league_portal_invitations WHERE token_hash=$1 AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at>NOW() LIMIT 1`, hashToken(token))
  const invite = rows[0]
  if (!invite) return null
  if (user.email && user.email !== invite.email) throw new Error('This invitation was sent to another email address')
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`INSERT INTO league_portal_memberships(id,user_id,email,league_id,role,status,invited_by,approved_by,approved_at) VALUES($1,$2,$3,$4,$5,'ACTIVE',$6,$6,NOW()) ON CONFLICT(user_id,league_id) DO UPDATE SET role=EXCLUDED.role,status='ACTIVE',invited_by=EXCLUDED.invited_by,approved_by=EXCLUDED.approved_by,approved_at=NOW(),revoked_at=NULL,updated_at=NOW()`, randomUUID(), user.id, invite.email, invite.leagueId, invite.role, invite.invitedBy)
    await tx.$executeRawUnsafe(`UPDATE league_portal_invitations SET accepted_by=$1,accepted_at=NOW() WHERE id=$2`, user.id, invite.id)
  })
  const membership = await membershipForLeague(user.id, invite.leagueId)
  if (membership) await auditLeagueMembership(membership.id, invite.leagueId, user.id, 'INVITATION_ACCEPTED', user.id, { role: invite.role })
  return membership
}

export async function auditLeagueMembership(membershipId: string | null, leagueId: string, userId: string | null, action: string, actorId: string, detail: unknown) {
  await ensureLeagueMembershipSchema()
  await prisma.$executeRawUnsafe(`INSERT INTO league_portal_membership_audit(id,membership_id,league_id,user_id,action,actor_id,detail) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`, randomUUID(), membershipId, leagueId, userId, action, actorId, JSON.stringify(detail ?? {}))
}
