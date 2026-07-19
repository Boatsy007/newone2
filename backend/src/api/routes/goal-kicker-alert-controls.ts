import { Router } from 'express'
import { prisma } from '../../db/client.js'

const router = Router()
const ALERTS = ['MILESTONES', 'LEADERSHIP', 'WEEKLY', 'UPDATES'] as const
const ACHIEVEMENTS = [
  'SEASON_50_GOALS', 'SEASON_100_GOALS', 'FASTEST_TO_50', 'FASTEST_TO_100',
  'NATIONAL_GOAL_LEADER', 'NATIONAL_TOP_10', 'LEAGUE_GOAL_LEADER', 'CLUB_GOAL_LEADER',
  'CAREER_BEST_SEASON', 'BIGGEST_WEEKLY_GOAL_INCREASE', 'GOALS_PER_GAME_LEADER',
] as const

const validSupporter = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(value) ? value : null
const prefType = (key: string) => `GOAL_KICKER_ALERT:${key}`
const settingKey = (type: string) => `goalKickerAchievement:${type}:enabled`

router.get('/preferences', async (req, res) => {
  const supporterId = validSupporter(req.query.supporterId)
  if (!supporterId) return res.status(400).json({ error: 'valid supporterId required' })
  const rows = await prisma.notificationPreference.findMany({
    where: { recipientScope: 'USER', recipientId: supporterId, type: { startsWith: 'GOAL_KICKER_ALERT:' }, channel: 'IN_APP' },
    select: { type: true, enabled: true },
  })
  const saved = new Map(rows.map(row => [row.type, row.enabled]))
  res.json({ data: Object.fromEntries(ALERTS.map(key => [key, saved.get(prefType(key)) ?? true])) })
})

router.put('/preferences', async (req, res) => {
  const body = (req.body ?? {}) as { supporterId?: string; preferences?: Record<string, boolean> }
  const supporterId = validSupporter(body.supporterId)
  if (!supporterId) return res.status(400).json({ error: 'valid supporterId required' })
  await prisma.$transaction(ALERTS.map(key => prisma.notificationPreference.upsert({
    where: { recipientScope_recipientId_type_channel: { recipientScope: 'USER', recipientId: supporterId, type: prefType(key), channel: 'IN_APP' } },
    create: { recipientScope: 'USER', recipientId: supporterId, type: prefType(key), channel: 'IN_APP', enabled: body.preferences?.[key] !== false, frequency: 'INSTANT' },
    update: { enabled: body.preferences?.[key] !== false },
  })))
  res.json({ data: { saved: true } })
})

router.get('/admin', async (_req, res) => {
  const [settings, events] = await Promise.all([
    prisma.setting.findMany({ where: { key: { startsWith: 'goalKickerAchievement:' } } }),
    prisma.notification.findMany({
      where: { type: 'GOAL_KICKER_ACHIEVEMENT', category: 'PLAYER' },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, title: true, body: true, status: true, data: true, createdAt: true },
    }),
  ])
  const enabled = new Map(settings.map(row => [row.key, row.value !== 'false']))
  res.json({ data: {
    types: ACHIEVEMENTS.map(type => ({ type, enabled: enabled.get(settingKey(type)) ?? true })),
    events: events.map(row => {
      let data: Record<string, unknown> = {}
      try { data = row.data ? JSON.parse(row.data) as Record<string, unknown> : {} } catch { data = {} }
      return { id: row.id, title: row.title, body: row.body, status: row.status, achievementType: data.achievementType ?? null, playerName: data.playerName ?? null, createdAt: row.createdAt.toISOString() }
    }),
  } })
})

router.patch('/admin/types/:type', async (req, res) => {
  const type = String(req.params.type).toUpperCase()
  if (!ACHIEVEMENTS.includes(type as typeof ACHIEVEMENTS[number])) return res.status(400).json({ error: 'unknown achievement type' })
  const enabled = (req.body as { enabled?: boolean })?.enabled !== false
  await prisma.setting.upsert({ where: { key: settingKey(type) }, create: { key: settingKey(type), value: String(enabled) }, update: { value: String(enabled) } })
  res.json({ data: { type, enabled } })
})

router.patch('/admin/events/:id', async (req, res) => {
  const status = (req.body as { status?: string })?.status === 'SUPPRESSED' ? 'SUPPRESSED' : 'DELIVERED'
  const source = await prisma.notification.findFirst({ where: { id: req.params.id, type: 'GOAL_KICKER_ACHIEVEMENT', category: 'PLAYER' }, select: { dedupeKey: true } })
  if (!source) return res.status(404).json({ error: 'achievement not found' })
  const prefix = source.dedupeKey?.replace(/:(player-feed|club-feed|league-feed)$/, '')
  await prisma.notification.updateMany({ where: prefix ? { dedupeKey: { startsWith: prefix } } : { id: req.params.id }, data: { status } })
  res.json({ data: { id: req.params.id, status } })
})

export { router as goalKickerAlertControlsRouter }
