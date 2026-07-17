export type FollowEntity = 'CLUB' | 'LEAGUE' | 'PLAYER'
export type Follow = { entityType: FollowEntity; entityId: string }
export type FeedItem = { id: string; type: string; title: string; body: string; entityType: string; entityId: string; href: string; createdAt: string }

const SUPPORTER_KEY = 'playfooty-supporter-id'
const READ_KEY = 'playfooty-read-notifications'

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

export async function loadFeed(): Promise<FeedItem[]> {
  const response = await fetch(`/api/follows/feed?supporterId=${encodeURIComponent(getSupporterId())}`)
  if (!response.ok) throw new Error('Unable to load notifications')
  const payload = await response.json() as { data?: FeedItem[] }
  return Array.isArray(payload.data) ? payload.data : []
}

export function readIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

export function markRead(id: string): void {
  const ids = readIds(); ids.add(id); localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-500)))
  window.dispatchEvent(new CustomEvent('playfooty:notifications-read'))
}

export function markAllRead(items: FeedItem[]): void {
  const ids = readIds(); items.forEach(item => ids.add(item.id)); localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-500)))
  window.dispatchEvent(new CustomEvent('playfooty:notifications-read'))
}
