export type FollowEntity = 'CLUB' | 'LEAGUE' | 'PLAYER'
export type Follow = { entityType: FollowEntity; entityId: string; name?: string; subtitle?: string | null; href?: string; logoUrl?: string | null }
export type FeedItem = { id: string; type: string; title: string; body: string; entityType: string; entityId: string; href: string; createdAt: string }
export type GoalKickerAlertPreferences = { MILESTONES: boolean; LEADERSHIP: boolean; WEEKLY: boolean; UPDATES: boolean }
export type NotificationPreferences = GoalKickerAlertPreferences & {
  FIXTURES: boolean
  RESULTS: boolean
  RANKINGS: boolean
  NEWS: boolean
  HIGHLIGHTS: boolean
  RECORDS: boolean
}

const SUPPORTER_KEY = 'playfooty-supporter-id'
const READ_KEY = 'playfooty-read-notifications'
const NOTIFICATION_PREFS_KEY = 'playfooty-notification-preferences-v2'
const DEFAULT_GOAL_ALERTS: GoalKickerAlertPreferences = { MILESTONES: true, LEADERSHIP: true, WEEKLY: true, UPDATES: true }
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  FIXTURES: true,
  RESULTS: true,
  RANKINGS: true,
  NEWS: true,
  HIGHLIGHTS: true,
  RECORDS: true,
  ...DEFAULT_GOAL_ALERTS,
}

export function getSupporterId(): string {
  let id = localStorage.getItem(SUPPORTER_KEY)
  if (!id) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `pf-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(SUPPORTER_KEY, id)
  }
  return id
}

export async function listFollows(): Promise<Follow[]> {
  const response = await fetch(`/api/follows?supporterId=${encodeURIComponent(getSupporterId())}`)
  if (!response.ok) throw new Error('Unable to load follows')
  const payload = await response.json() as { data?: Follow[] }
  return Array.isArray(payload.data) ? payload.data : []
}

export async function setFollow(entityType: FollowEntity, entityId: string, enabled: boolean): Promise<void> {
  const supporterId = getSupporterId()
  const response = enabled
    ? await fetch('/api/follows', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ supporterId, entityType, entityId }) })
    : await fetch(`/api/follows/${entityType.toLowerCase()}/${encodeURIComponent(entityId)}?supporterId=${encodeURIComponent(supporterId)}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(enabled ? 'Unable to follow' : 'Unable to unfollow')
  window.dispatchEvent(new CustomEvent('playfooty:follows-changed'))
}

export async function loadGoalKickerAlertPreferences(): Promise<GoalKickerAlertPreferences> {
  try {
    const response = await fetch(`/api/goal-kicker-controls/preferences?supporterId=${encodeURIComponent(getSupporterId())}`)
    if (!response.ok) throw new Error()
    const payload = await response.json() as { data?: Partial<GoalKickerAlertPreferences> }
    return { ...DEFAULT_GOAL_ALERTS, ...payload.data }
  } catch {
    return DEFAULT_GOAL_ALERTS
  }
}

export async function saveGoalKickerAlertPreferences(preferences: GoalKickerAlertPreferences): Promise<void> {
  const response = await fetch('/api/goal-kicker-controls/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ supporterId: getSupporterId(), preferences }) })
  if (!response.ok) throw new Error('Unable to save alert preferences')
}

export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  let local: Partial<NotificationPreferences> = {}
  try { local = JSON.parse(localStorage.getItem(NOTIFICATION_PREFS_KEY) ?? '{}') as Partial<NotificationPreferences> } catch { local = {} }
  const goalKickers = await loadGoalKickerAlertPreferences()
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...local, ...goalKickers }
}

export async function saveNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(preferences))
  await saveGoalKickerAlertPreferences({ MILESTONES: preferences.MILESTONES, LEADERSHIP: preferences.LEADERSHIP, WEEKLY: preferences.WEEKLY, UPDATES: preferences.UPDATES })
  window.dispatchEvent(new CustomEvent('playfooty:alert-preferences-changed'))
}

export async function loadFeed(): Promise<FeedItem[]> {
  const [response, preferences] = await Promise.all([
    fetch(`/api/follows/feed?supporterId=${encodeURIComponent(getSupporterId())}`),
    loadNotificationPreferences(),
  ])
  if (!response.ok) throw new Error('Unable to load supporter feed')
  const payload = await response.json() as { data?: FeedItem[] }
  return (Array.isArray(payload.data) ? payload.data : [])
    .filter(item => allowNotificationItem(item, preferences))
    .filter((item, index, items) => items.findIndex(candidate => candidate.id === item.id) === index)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 150)
}

function allowNotificationItem(item: FeedItem, preferences: NotificationPreferences) {
  const type = item.type.toUpperCase()
  if (type.includes('FIXTURE')) return preferences.FIXTURES
  if (type.includes('RESULT')) return preferences.RESULTS
  if (type.includes('RANKING') || type.includes('RANK_MOVEMENT')) return preferences.RANKINGS
  if (type.includes('NEWS') || type.includes('ARTICLE')) return preferences.NEWS
  if (type.includes('HIGHLIGHT')) return preferences.HIGHLIGHTS
  if (type.includes('RECORD')) return preferences.RECORDS
  if (type === 'GOAL_KICKER_UPDATE' || type === 'GOAL_KICKER_UPDATED' || type === 'PLAYER') return preferences.UPDATES
  if (type !== 'GOAL_KICKER_ACHIEVEMENT') return true
  const text = `${item.title} ${item.body}`.toLowerCase()
  if (/50|100|milestone|fastest/.test(text)) return preferences.MILESTONES
  if (/lead|top 10|leader/.test(text)) return preferences.LEADERSHIP
  if (/weekly|increase|added/.test(text)) return preferences.WEEKLY
  return preferences.UPDATES
}

export function readIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

export function markRead(id: string): void {
  const ids = readIds()
  ids.add(id)
  localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-500)))
  window.dispatchEvent(new CustomEvent('playfooty:notifications-read'))
}

export function markAllRead(items: FeedItem[]): void {
  const ids = readIds()
  items.forEach(item => ids.add(item.id))
  localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-500)))
  window.dispatchEvent(new CustomEvent('playfooty:notifications-read'))
}
