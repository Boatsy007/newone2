import { allArticles, loadPublished, newsPath } from '../news/content'

export type FollowEntity = 'CLUB' | 'LEAGUE' | 'PLAYER'
export type Follow = {
  entityType: FollowEntity
  entityId: string
  name?: string
  subtitle?: string | null
  href?: string
  logoUrl?: string | null
}
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
  const [response, follows] = await Promise.all([
    fetch(`/api/follows/feed?supporterId=${encodeURIComponent(getSupporterId())}`),
    listFollows(),
  ])
  if (!response.ok) throw new Error('Unable to load supporter feed')
  const payload = await response.json() as { data?: FeedItem[] }
  const eventItems = Array.isArray(payload.data) ? payload.data : []
  const newsItems = await loadFollowedNews(follows, eventItems)
  return [...eventItems, ...newsItems]
    .filter((item, index, items) => items.findIndex(candidate => candidate.id === item.id) === index)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 150)
}

async function loadFollowedNews(follows: Follow[], eventItems: FeedItem[]): Promise<FeedItem[]> {
  try {
    await loadPublished()
    const names = followedNames(follows, eventItems)
    const followedClubIds = new Set(follows.filter(follow => follow.entityType === 'CLUB').map(follow => follow.entityId))
    const followedLeagueIds = new Set(follows.filter(follow => follow.entityType === 'LEAGUE').map(follow => follow.entityId))
    const clubNames = new Set(names.filter(item => item.entityType === 'CLUB').map(item => normalise(item.name)))
    const leagueNames = new Set(names.filter(item => item.entityType === 'LEAGUE').map(item => normalise(item.name)))

    return allArticles().flatMap(article => {
      const clubMatch = (!!article.tags.clubId && followedClubIds.has(article.tags.clubId))
        || (!!article.tags.club && clubNames.has(normalise(article.tags.club)))
      const leagueMatch = (!!article.tags.leagueId && followedLeagueIds.has(article.tags.leagueId))
        || (!!article.tags.league && leagueNames.has(normalise(article.tags.league)))
      if (!clubMatch && !leagueMatch) return []

      const entityType: FollowEntity = clubMatch ? 'CLUB' : 'LEAGUE'
      const directId = clubMatch ? article.tags.clubId : article.tags.leagueId
      const articleName = clubMatch ? article.tags.club : article.tags.league
      const matched = names.find(item => item.entityType === entityType && normalise(item.name) === normalise(articleName ?? ''))
      const fallback = follows.find(follow => follow.entityType === entityType)
      const entityId = directId ?? matched?.entityId ?? fallback?.entityId
      if (!entityId) return []

      return [{
        id: `news-${article.slug}`,
        type: 'NEWS',
        title: `New article: ${article.title}`,
        body: article.summary,
        entityType,
        entityId,
        href: newsPath(article.slug),
        createdAt: article.date,
      } satisfies FeedItem]
    })
  } catch {
    return []
  }
}

function followedNames(follows: Follow[], items: FeedItem[]) {
  return follows.flatMap(follow => {
    if (follow.name) return [{ entityType: follow.entityType, entityId: follow.entityId, name: follow.name }]
    const item = items.find(candidate => candidate.entityType === follow.entityType && candidate.entityId === follow.entityId)
    if (!item) return []
    let name = item.title
    if (follow.entityType === 'CLUB') name = name.split(' are ranked')[0].split("'s next match")[0]
    if (follow.entityType === 'LEAGUE') name = name.split(' results are in')[0].split(' fixtures are set')[0]
    if (follow.entityType === 'PLAYER') name = name.split(' has moved to')[0]
    return [{ entityType: follow.entityType, entityId: follow.entityId, name }]
  })
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(senior|seniors|football|netball|fnl|fntl)\b/g, '').replace(/\s+/g, ' ').trim()
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
