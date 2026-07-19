/** Notification reporting and read models. */
import { prisma } from '../db/client.js'

export async function listNotifications(opts: { recipientScope?: string; recipientId?: string; type?: string; category?: string; status?: string; unreadOnly?: boolean; limit?: number } = {}) {
  return prisma.notification.findMany({
    where: {
      ...(opts.recipientScope ? { recipientScope: opts.recipientScope } : {}),
      ...(opts.recipientId ? { recipientId: opts.recipientId } : {}),
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.unreadOnly ? { status: { notIn: ['READ', 'SUPPRESSED'] } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.limit ?? 200, 1000),
  })
}

export async function notificationSummary() {
  const [total, unread, byCategory, bySeverity, byStatus, lastScan, recent] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.count({ where: { status: { notIn: ['READ', 'SUPPRESSED'] } } }),
    prisma.notification.groupBy({ by: ['category'], _count: { category: true } }),
    prisma.notification.groupBy({ by: ['severity'], _count: { severity: true } }),
    prisma.notification.groupBy({ by: ['status'], _count: { status: true } }),
    prisma.automationRun.findFirst({ orderBy: { ranAt: 'desc' } }),
    prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, type: true, category: true, severity: true, status: true, title: true, recipientScope: true, recipientId: true, entityType: true, entityId: true, channel: true, dedupeKey: true, createdAt: true, sentAt: true, readAt: true } }),
  ])
  return {
    total, unread,
    byCategory: Object.fromEntries(byCategory.map(c => [c.category ?? 'Unknown', c._count.category])),
    bySeverity: Object.fromEntries(bySeverity.map(s => [s.severity, s._count.severity])),
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count.status])),
    lastScan,
    recent,
  }
}
