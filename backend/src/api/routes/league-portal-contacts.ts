import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../db/client.js'
import { authenticateLeagueUser, requireActiveLeagueMembership, type LeagueMembership } from '../../auth/league-auth.js'

const router = Router()
let schemaReady: Promise<void> | null = null

async function ensureContactsSchema() {
  if (!schemaReady) schemaReady = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS league_contacts (
      id TEXT PRIMARY KEY,
      league_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      position TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      contact_type TEXT NOT NULL DEFAULT 'GENERAL',
      is_public BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      archived_at TIMESTAMPTZ,
      created_by TEXT,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS league_contacts_league_idx ON league_contacts(league_id,archived_at,display_order)`)
  })().catch(error => { schemaReady = null; throw error })
  return schemaReady
}

const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
const canManage = (membership: LeagueMembership) => membership.role === 'OWNER' || membership.role === 'ADMIN'

router.get('/leagues/:leagueId/contacts', authenticateLeagueUser, requireActiveLeagueMembership, async (req, res) => {
  await ensureContactsSchema()
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT id,full_name AS "fullName",position,email,phone,contact_type AS "contactType",is_public AS "isPublic",display_order AS "displayOrder",archived_at AS "archivedAt",created_at AS "createdAt",updated_at AS "updatedAt" FROM league_contacts WHERE league_id=$1 ORDER BY archived_at NULLS FIRST,display_order,full_name`, req.params.leagueId)
  const membership = res.locals.leagueMembership as LeagueMembership
  res.json({ data: { contacts: rows, membership: { role: membership.role }, canManage: canManage(membership) } })
})

router.post('/leagues/:leagueId/contacts', authenticateLeagueUser, requireActiveLeagueMembership, async (req, res) => {
  await ensureContactsSchema()
  const membership = res.locals.leagueMembership as LeagueMembership
  if (!canManage(membership)) return res.status(403).json({ error: 'Only League Owners and Admins can manage contacts' })
  const fullName = clean(req.body?.fullName, 160), position = clean(req.body?.position, 160)
  const email = clean(req.body?.email, 320) || null, phone = clean(req.body?.phone, 80) || null
  const contactType = clean(req.body?.contactType, 60).toUpperCase() || 'GENERAL'
  const isPublic = req.body?.isPublic !== false
  const displayOrder = Number.isFinite(Number(req.body?.displayOrder)) ? Math.max(0, Math.min(999, Number(req.body.displayOrder))) : 0
  if (!fullName || !position) return res.status(400).json({ error: 'Full name and league position are required' })
  if (email && !email.includes('@')) return res.status(400).json({ error: 'Enter a valid email address' })
  const id = randomUUID()
  await prisma.$executeRawUnsafe(`INSERT INTO league_contacts(id,league_id,full_name,position,email,phone,contact_type,is_public,display_order,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`, id, req.params.leagueId, fullName, position, email, phone, contactType, isPublic, displayOrder, req.clubUser!.id)
  res.status(201).json({ message: 'League contact added', data: { id } })
})

router.patch('/leagues/:leagueId/contacts/:contactId', authenticateLeagueUser, requireActiveLeagueMembership, async (req, res) => {
  await ensureContactsSchema()
  const membership = res.locals.leagueMembership as LeagueMembership
  if (!canManage(membership)) return res.status(403).json({ error: 'Only League Owners and Admins can manage contacts' })
  const owned = await prisma.$queryRawUnsafe<Array<{id:string}>>(`SELECT id FROM league_contacts WHERE id=$1 AND league_id=$2 LIMIT 1`, req.params.contactId, req.params.leagueId)
  if (!owned[0]) return res.status(404).json({ error: 'League contact not found' })
  const fullName = clean(req.body?.fullName, 160), position = clean(req.body?.position, 160)
  const email = clean(req.body?.email, 320) || null, phone = clean(req.body?.phone, 80) || null
  const contactType = clean(req.body?.contactType, 60).toUpperCase() || 'GENERAL'
  const isPublic = req.body?.isPublic !== false
  const displayOrder = Number.isFinite(Number(req.body?.displayOrder)) ? Math.max(0, Math.min(999, Number(req.body.displayOrder))) : 0
  if (!fullName || !position) return res.status(400).json({ error: 'Full name and league position are required' })
  if (email && !email.includes('@')) return res.status(400).json({ error: 'Enter a valid email address' })
  await prisma.$executeRawUnsafe(`UPDATE league_contacts SET full_name=$1,position=$2,email=$3,phone=$4,contact_type=$5,is_public=$6,display_order=$7,updated_by=$8,updated_at=NOW() WHERE id=$9 AND league_id=$10`, fullName, position, email, phone, contactType, isPublic, displayOrder, req.clubUser!.id, req.params.contactId, req.params.leagueId)
  res.json({ message: 'League contact updated' })
})

router.post('/leagues/:leagueId/contacts/:contactId/archive', authenticateLeagueUser, requireActiveLeagueMembership, async (req, res) => {
  await ensureContactsSchema()
  const membership = res.locals.leagueMembership as LeagueMembership
  if (!canManage(membership)) return res.status(403).json({ error: 'Only League Owners and Admins can manage contacts' })
  const result = await prisma.$executeRawUnsafe(`UPDATE league_contacts SET archived_at=CASE WHEN archived_at IS NULL THEN NOW() ELSE NULL END,updated_by=$1,updated_at=NOW() WHERE id=$2 AND league_id=$3`, req.clubUser!.id, req.params.contactId, req.params.leagueId)
  if (!result) return res.status(404).json({ error: 'League contact not found' })
  res.json({ message: 'League contact status updated' })
})

export { router as leaguePortalContactsRouter }
