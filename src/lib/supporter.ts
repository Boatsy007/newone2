import { allArticles, loadPublished, newsPath } from '../news/content'

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

export function getSupporterId(): string { let id=localStorage.getItem(SUPPORTER_KEY);if(!id){id=typeof crypto!=='undefined'&&'randomUUID'in crypto?crypto.randomUUID():`pf-${Date.now()}-${Math.random().toString(36).slice(2)}`;localStorage.setItem(SUPPORTER_KEY,id)}return id }
export async function listFollows():Promise<Follow[]>{const response=await fetch(`/api/follows?supporterId=${encodeURIComponent(getSupporterId())}`);if(!response.ok)throw new Error('Unable to load follows');const payload=await response.json() as {data?:Follow[]};return Array.isArray(payload.data)?payload.data:[]}
export async function setFollow(entityType:FollowEntity,entityId:string,enabled:boolean):Promise<void>{const supporterId=getSupporterId();const response=enabled?await fetch('/api/follows',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({supporterId,entityType,entityId})}):await fetch(`/api/follows/${entityType.toLowerCase()}/${encodeURIComponent(entityId)}?supporterId=${encodeURIComponent(supporterId)}`,{method:'DELETE'});if(!response.ok)throw new Error(enabled?'Unable to follow':'Unable to unfollow');window.dispatchEvent(new CustomEvent('playfooty:follows-changed'))}

export async function loadGoalKickerAlertPreferences():Promise<GoalKickerAlertPreferences>{try{const response=await fetch(`/api/goal-kicker-controls/preferences?supporterId=${encodeURIComponent(getSupporterId())}`);if(!response.ok)throw new Error();const payload=await response.json() as {data?:Partial<GoalKickerAlertPreferences>};return{...DEFAULT_GOAL_ALERTS,...payload.data}}catch{return DEFAULT_GOAL_ALERTS}}
export async function saveGoalKickerAlertPreferences(preferences:GoalKickerAlertPreferences):Promise<void>{const response=await fetch('/api/goal-kicker-controls/preferences',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({supporterId:getSupporterId(),preferences})});if(!response.ok)throw new Error('Unable to save alert preferences')}

export async function loadNotificationPreferences():Promise<NotificationPreferences>{
  let local: Partial<NotificationPreferences> = {}
  try { local = JSON.parse(localStorage.getItem(NOTIFICATION_PREFS_KEY) ?? '{}') as Partial<NotificationPreferences> } catch { local = {} }
  const goalKickers = await loadGoalKickerAlertPreferences()
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...local, ...goalKickers }
}

export async function saveNotificationPreferences(preferences:NotificationPreferences):Promise<void>{
  localStorage.setItem(NOTIFICATION_PREFS_KEY,JSON.stringify(preferences))
  await saveGoalKickerAlertPreferences({MILESTONES:preferences.MILESTONES,LEADERSHIP:preferences.LEADERSHIP,WEEKLY:preferences.WEEKLY,UPDATES:preferences.UPDATES})
  window.dispatchEvent(new CustomEvent('playfooty:alert-preferences-changed'))
}

export async function loadFeed():Promise<FeedItem[]>{const[response,follows,preferences]=await Promise.all([fetch(`/api/follows/feed?supporterId=${encodeURIComponent(getSupporterId())}`),listFollows(),loadNotificationPreferences()]);if(!response.ok)throw new Error('Unable to load supporter feed');const payload=await response.json() as {data?:FeedItem[]};const eventItems=(Array.isArray(payload.data)?payload.data:[]).filter(item=>allowNotificationItem(item,preferences));const newsItems=preferences.NEWS?await loadFollowedNews(follows,eventItems):[];return[...eventItems,...newsItems].filter((item,index,items)=>items.findIndex(candidate=>candidate.id===item.id)===index).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,150)}
function allowNotificationItem(item:FeedItem,p:NotificationPreferences){const type=item.type.toUpperCase();if(type.includes('FIXTURE'))return p.FIXTURES;if(type.includes('RESULT'))return p.RESULTS;if(type.includes('RANKING')||type.includes('RANK_MOVEMENT'))return p.RANKINGS;if(type.includes('NEWS')||type.includes('ARTICLE'))return p.NEWS;if(type.includes('HIGHLIGHT'))return p.HIGHLIGHTS;if(type.includes('RECORD'))return p.RECORDS;if(type==='GOAL_KICKER_UPDATE'||type==='GOAL_KICKER_UPDATED'||type==='PLAYER')return p.UPDATES;if(type!=='GOAL_KICKER_ACHIEVEMENT')return true;const text=`${item.title} ${item.body}`.toLowerCase();if(/50|100|milestone|fastest/.test(text))return p.MILESTONES;if(/lead|top 10|leader/.test(text))return p.LEADERSHIP;if(/weekly|increase|added/.test(text))return p.WEEKLY;return p.UPDATES}

async function loadFollowedNews(follows:Follow[],eventItems:FeedItem[]):Promise<FeedItem[]>{try{await loadPublished();const names=followedNames(follows,eventItems);const followedClubIds=new Set(follows.filter(f=>f.entityType==='CLUB').map(f=>f.entityId));const followedLeagueIds=new Set(follows.filter(f=>f.entityType==='LEAGUE').map(f=>f.entityId));const clubNames=new Set(names.filter(i=>i.entityType==='CLUB').map(i=>normalise(i.name)));const leagueNames=new Set(names.filter(i=>i.entityType==='LEAGUE').map(i=>normalise(i.name)));return allArticles().flatMap(article=>{const clubMatch=(!!article.tags.clubId&&followedClubIds.has(article.tags.clubId))||(!!article.tags.club&&clubNames.has(normalise(article.tags.club)));const leagueMatch=(!!article.tags.leagueId&&followedLeagueIds.has(article.tags.leagueId))||(!!article.tags.league&&leagueNames.has(normalise(article.tags.league)));if(!clubMatch&&!leagueMatch)return[];const entityType:FollowEntity=clubMatch?'CLUB':'LEAGUE';const directId=clubMatch?article.tags.clubId:article.tags.leagueId;const articleName=clubMatch?article.tags.club:article.tags.league;const matched=names.find(i=>i.entityType===entityType&&normalise(i.name)===normalise(articleName??''));const fallback=follows.find(f=>f.entityType===entityType);const entityId=directId??matched?.entityId??fallback?.entityId;if(!entityId)return[];return[{id:`news-${article.slug}`,type:'NEWS',title:`New article: ${article.title}`,body:article.summary,entityType,entityId,href:newsPath(article.slug),createdAt:article.date} satisfies FeedItem]})}catch{return[]}}
function followedNames(follows:Follow[],items:FeedItem[]){return follows.flatMap(follow=>{if(follow.name)return[{entityType:follow.entityType,entityId:follow.entityId,name:follow.name}];const item=items.find(candidate=>candidate.entityType===follow.entityType&&candidate.entityId===follow.entityId);if(!item)return[];let name=item.title;if(follow.entityType==='CLUB')name=name.split(' are ranked')[0].split("'s next match")[0];if(follow.entityType==='LEAGUE')name=name.split(' results are in')[0].split(' fixtures are set')[0];if(follow.entityType==='PLAYER')name=name.split(' has moved to')[0];return[{entityType:follow.entityType,entityId:follow.entityId,name}]})}
function normalise(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\b(senior|seniors|football|netball|fnl|fntl)\b/g,'').replace(/\s+/g,' ').trim()}
export function readIds():Set<string>{try{return new Set(JSON.parse(localStorage.getItem(READ_KEY)??'[]') as string[])}catch{return new Set()}}
export function markRead(id:string):void{const ids=readIds();ids.add(id);localStorage.setItem(READ_KEY,JSON.stringify([...ids].slice(-500)));window.dispatchEvent(new CustomEvent('playfooty:notifications-read'))}
export function markAllRead(items:FeedItem[]):void{const ids=readIds();items.forEach(item=>ids.add(item.id));localStorage.setItem(READ_KEY,JSON.stringify([...ids].slice(-500)));window.dispatchEvent(new CustomEvent('playfooty:notifications-read'))}
