import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../db/client.js'

export const CLUB_ROLES = ['OWNER', 'ADMIN', 'TEAM_MANAGER', 'MEDIA_MANAGER', 'SPONSOR_MANAGER', 'VIEWER'] as const
export const MEMBERSHIP_STATUSES = ['INVITED', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'] as const
export type ClubRole = typeof CLUB_ROLES[number]
export type MembershipStatus = typeof MEMBERSHIP_STATUSES[number]

export type AuthenticatedClubUser = {
  id: string
  email: string | null
  accessToken: string
}

export type ClubMembership = {
  id: string
  userId: string
  email: string
  clubId: string
  role: ClubRole
  status: MembershipStatus
  invitedBy: string | null
  approvedBy: string | null
  approvedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

declare global {
  namespace Express {
    interface Request {
      clubUser?: AuthenticatedClubUser
    }
  }
}

let schemaReady: Promise<void> | null = null

export function ensureClubMembershipSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "club_portal_memberships" (
        "id" TEXT PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "club_id" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'VIEWER',
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "invited_by" TEXT,
        "approved_by" TEXT,
        "approved_at" TIMESTAMPTZ,
        "revoked_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "club_portal_memberships_role_check" CHECK ("role" IN ('OWNER','ADMIN','TEAM_MANAGER','MEDIA_MANAGER','SPONSOR_MANAGER','VIEWER')),
        CONSTRAINT "club_portal_memberships_status_check" CHECK ("status" IN ('INVITED','PENDING','ACTIVE','SUSPENDED','REVOKED'))
      )`)
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "club_portal_memberships_user_club_unique" ON "club_portal_memberships" ("user_id", "club_id")`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "club_portal_memberships_club_status_idx" ON "club_portal_memberships" ("club_id", "status")`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "club_portal_memberships_user_status_idx" ON "club_portal_memberships" ("user_id", "status")`)
    })().catch(error => {
      schemaReady = null
      throw error
    })
  }
  return schemaReady
}

function bearerToken(req: Request) {
  const header = req.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? ''
}

export async function authenticateClubUser(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req)
  if (!token) return res.status(401).json({ error: 'Sign in is required' })

  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const apiKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!supabaseUrl || !apiKey) return res.status(503).json({ error: 'Club authentication is not configured' })

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { authorization: `Bearer ${token}`, apikey: apiKey },
    })
    if (!response.ok) return res.status(401).json({ error: 'Your session is invalid or has expired' })
    const identity = await response.json() as { id?: string; email?: string | null }
    if (!identity.id) return res.status(401).json({ error: 'Unable to verify this account' })
    req.clubUser = { id: identity.id, email: identity.email?.trim().toLowerCase() ?? null, accessToken: token }
    next()
  } catch {
    return res.status(503).json({ error: 'Authentication service is temporarily unavailable' })
  }
}

export async function membershipsForUser(userId: string): Promise<ClubMembership[]> {
  await ensureClubMembershipSchema()
  return prisma.$queryRawUnsafe<ClubMembership[]>(`SELECT
    id,
    user_id AS "userId",
    email,
    club_id AS "clubId",
    role,
    status,
    invited_by AS "invitedBy",
    approved_by AS "approvedBy",
    approved_at AS "approvedAt",
    revoked_at AS "revokedAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM club_portal_memberships
  WHERE user_id = $1 AND status <> 'REVOKED'
  ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PENDING' THEN 1 WHEN 'INVITED' THEN 2 ELSE 3 END, created_at ASC`, userId)
}

export async function membershipForClub(userId: string, clubId: string) {
  await ensureClubMembershipSchema()
  const rows = await prisma.$queryRawUnsafe<ClubMembership[]>(`SELECT
    id,
    user_id AS "userId",
    email,
    club_id AS "clubId",
    role,
    status,
    invited_by AS "invitedBy",
    approved_by AS "approvedBy",
    approved_at AS "approvedAt",
    revoked_at AS "revokedAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM club_portal_memberships
  WHERE user_id = $1 AND club_id = $2
  LIMIT 1`, userId, clubId)
  return rows[0] ?? null
}

export async function requireActiveClubMembership(req: Request, res: Response, next: NextFunction) {
  const user = req.clubUser
  if (!user) return res.status(401).json({ error: 'Sign in is required' })
  const clubId = String(req.params.clubId ?? req.body?.clubId ?? '').trim()
  if (!clubId) return res.status(400).json({ error: 'clubId is required' })
  const membership = await membershipForClub(user.id, clubId)
  if (!membership || membership.status !== 'ACTIVE') return res.status(403).json({ error: 'You do not have active access to this club' })
  res.locals.clubMembership = membership
  next()
}

export function roleCan(role: ClubRole, action: 'manage_users' | 'team_selection' | 'media' | 'sponsors' | 'profile' | 'view') {
  if (role === 'OWNER') return true
  if (role === 'ADMIN') return action !== 'manage_users'
  if (role === 'TEAM_MANAGER') return action === 'team_selection' || action === 'view'
  if (role === 'MEDIA_MANAGER') return action === 'media' || action === 'view'
  if (role === 'SPONSOR_MANAGER') return action === 'sponsors' || action === 'view'
  return action === 'view'
}

export async function createPendingMembership(user: AuthenticatedClubUser, clubId: string) {
  await ensureClubMembershipSchema()
  const email = user.email ?? ''
  await prisma.$executeRawUnsafe(`INSERT INTO club_portal_memberships
    (id, user_id, email, club_id, role, status)
    VALUES ($1,$2,$3,$4,'VIEWER','PENDING')
    ON CONFLICT (user_id, club_id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
  `, randomUUID(), user.id, email, clubId)
  return membershipForClub(user.id, clubId)
}
