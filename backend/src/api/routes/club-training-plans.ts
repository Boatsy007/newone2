import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { authenticateClubUser, requireActiveClubMembership, roleCan } from '../../auth/club-auth.js'

const router = Router()
type Membership = { role: Parameters<typeof roleCan>[0] }
let ready: Promise<void> | null = null

function ensureTables() {
  if (!ready) ready = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_training_plans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      club_id text NOT NULL,
      plan_date date NOT NULL,
      title text NOT NULL DEFAULT 'Training session',
      start_time text NULL,
      location text NULL,
      focus text NULL,
      notes text NULL,
      created_by text NULL,
      updated_by text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(club_id, plan_date)
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_training_plans_club_date ON football_training_plans(club_id, plan_date DESC)`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_training_plan_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id uuid NOT NULL REFERENCES football_training_plans(id) ON DELETE CASCADE,
      drill_id uuid NULL,
      title text NOT NULL,
      category text NULL,
      duration_minutes integer NOT NULL DEFAULT 10,
      notes text NULL,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_training_plan_items_plan_order ON football_training_plan_items(plan_id, sort_order)`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS football_training_drills (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      club_id text NULL,
      title text NOT NULL,
      category text NULL,
      description text NULL,
      default_minutes integer NOT NULL DEFAULT 10,
      equipment text NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS football_training_drills_library ON football_training_drills(active, club_id, category, title)`)
  })().catch(error => { ready = null; throw error })
  return ready
}

function allowCoach(_req: any, res: any, next: any) {
  const membership = res.locals.clubMembership as Membership | undefined
  if (!membership || !roleCan(membership.role, 'team_selection')) return res.status(403).json({ error: 'Your club role cannot manage training plans' })
  next()
}

router.use(authenticateClubUser)
router.use('/clubs/:clubId', requireActiveClubMembership, allowCoach)

router.get('/clubs/:clubId', async (req, res) => {
  try {
    await ensureTables()
    const [plans, items, drills] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{id:string;planDate:string;title:string;startTime:string|null;location:string|null;focus:string|null;notes:string|null;updatedAt:string}>>(`SELECT id::text AS id,plan_date::text AS "planDate",title,start_time AS "startTime",location,focus,notes,updated_at AS "updatedAt" FROM football_training_plans WHERE club_id=$1 ORDER BY plan_date DESC LIMIT 60`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{id:string;planId:string;drillId:string|null;title:string;category:string|null;durationMinutes:number;notes:string|null;sortOrder:number}>>(`SELECT i.id::text AS id,i.plan_id::text AS "planId",i.drill_id::text AS "drillId",i.title,i.category,i.duration_minutes AS "durationMinutes",i.notes,i.sort_order AS "sortOrder" FROM football_training_plan_items i JOIN football_training_plans p ON p.id=i.plan_id WHERE p.club_id=$1 ORDER BY i.sort_order,i.created_at`, req.params.clubId),
      prisma.$queryRawUnsafe<Array<{id:string;title:string;category:string|null;description:string|null;defaultMinutes:number;equipment:string|null}>>(`SELECT id::text AS id,title,category,description,default_minutes AS "defaultMinutes",equipment FROM football_training_drills WHERE active=true AND (club_id IS NULL OR club_id=$1) ORDER BY category NULLS LAST,title`, req.params.clubId),
    ])
    res.json({ data: { plans, items, drills } })
  } catch (error) {
    res.status(500).json({ error: 'Unable to load training planner', detail: String(error) })
  }
})

router.put('/clubs/:clubId/plans/:planDate', async (req, res) => {
  try {
    await ensureTables()
    const planDate = String(req.params.planDate ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(planDate)) return res.status(400).json({ error: 'A valid training date is required' })

    const title = String(req.body?.title ?? 'Training session').trim().slice(0, 120) || 'Training session'
    const startTime = String(req.body?.startTime ?? '').trim().slice(0, 20) || null
    const location = String(req.body?.location ?? '').trim().slice(0, 180) || null
    const focus = String(req.body?.focus ?? '').trim().slice(0, 300) || null
    const notes = String(req.body?.notes ?? '').trim().slice(0, 2000) || null
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : []
    const items = rawItems.slice(0, 80).map((item: any, index: number) => ({
      drillId: String(item?.drillId ?? '').trim() || null,
      title: String(item?.title ?? '').trim().slice(0, 160),
      category: String(item?.category ?? '').trim().slice(0, 80) || null,
      durationMinutes: Math.min(180, Math.max(1, Number(item?.durationMinutes) || 10)),
      notes: String(item?.notes ?? '').trim().slice(0, 1000) || null,
      sortOrder: index,
    })).filter((item: any) => item.title)
    const userId = req.clubUser?.id ?? null

    const saved = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRawUnsafe<Array<{id:string;planDate:string;title:string;startTime:string|null;location:string|null;focus:string|null;notes:string|null}>>(`INSERT INTO football_training_plans(club_id,plan_date,title,start_time,location,focus,notes,created_by,updated_by) VALUES($1,$2::date,$3,$4,$5,$6,$7,$8,$8) ON CONFLICT(club_id,plan_date) DO UPDATE SET title=EXCLUDED.title,start_time=EXCLUDED.start_time,location=EXCLUDED.location,focus=EXCLUDED.focus,notes=EXCLUDED.notes,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING id::text AS id,plan_date::text AS "planDate",title,start_time AS "startTime",location,focus,notes`, req.params.clubId, planDate, title, startTime, location, focus, notes, userId)
      const plan = rows[0]
      await tx.$executeRawUnsafe(`DELETE FROM football_training_plan_items WHERE plan_id=$1::uuid`, plan.id)
      for (const item of items) {
        await tx.$executeRawUnsafe(`INSERT INTO football_training_plan_items(plan_id,drill_id,title,category,duration_minutes,notes,sort_order) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7)`, plan.id, item.drillId, item.title, item.category, item.durationMinutes, item.notes, item.sortOrder)
      }
      return { ...plan, items }
    })

    res.json({ data: saved, message: 'Training plan saved' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to save training plan', detail: String(error) })
  }
})

router.delete('/clubs/:clubId/plans/:planDate', async (req, res) => {
  try {
    await ensureTables()
    const count = await prisma.$executeRawUnsafe(`DELETE FROM football_training_plans WHERE club_id=$1 AND plan_date=$2::date`, req.params.clubId, req.params.planDate)
    if (!count) return res.status(404).json({ error: 'Training plan not found' })
    res.json({ message: 'Training plan deleted' })
  } catch (error) {
    res.status(500).json({ error: 'Unable to delete training plan', detail: String(error) })
  }
})

export { router as clubTrainingPlansRouter }
