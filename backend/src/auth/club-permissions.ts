export const CLUB_PERMISSION_KEYS = [
  'coaching.dashboard',
  'coaching.training-plan',
  'coaching.training-report',
  'coaching.availability',
  'coaching.select-team',
  'coaching.game-plan',
  'coaching.match-day',
  'coaching.fixtures-results',
  'coaching.league-ladder',
  'coaching.stats',
  'studio.access',
  'website.access',
  'operations.access',
  'analytics.access',
  'permissions.manage',
  'legacy.portal',
] as const

export type ClubPermissionKey = typeof CLUB_PERMISSION_KEYS[number]
export type ClubPermissionPreset = 'FULL_ADMIN' | 'COACH' | 'ASSISTANT_COACH' | 'STATS_RECORDER' | 'OPERATIONS_VOLUNTEER' | 'MEDIA_STUDIO' | 'CUSTOM'

const COACHING: ClubPermissionKey[] = CLUB_PERMISSION_KEYS.filter(key => key.startsWith('coaching.')) as ClubPermissionKey[]

export const CLUB_PERMISSION_PRESETS: Record<ClubPermissionPreset, ClubPermissionKey[]> = {
  FULL_ADMIN: [...CLUB_PERMISSION_KEYS],
  COACH: [...COACHING],
  ASSISTANT_COACH: [
    'coaching.dashboard','coaching.training-plan','coaching.training-report','coaching.availability',
    'coaching.select-team','coaching.game-plan','coaching.fixtures-results','coaching.league-ladder',
  ],
  STATS_RECORDER: ['coaching.stats'],
  OPERATIONS_VOLUNTEER: ['operations.access'],
  MEDIA_STUDIO: ['studio.access'],
  CUSTOM: [],
}

export function sanitisePermissions(value: unknown): ClubPermissionKey[] {
  const input = Array.isArray(value) ? value : []
  const allowed = new Set<string>(CLUB_PERMISSION_KEYS)
  return [...new Set(input.map(String).filter(item => allowed.has(item)))] as ClubPermissionKey[]
}

export function permissionsForPreset(preset: string | null | undefined) {
  return [...(CLUB_PERMISSION_PRESETS[(preset || 'CUSTOM').toUpperCase() as ClubPermissionPreset] ?? [])]
}

export function legacyRolePermissions(role: string): ClubPermissionKey[] {
  if (role === 'OWNER') return [...CLUB_PERMISSION_KEYS]
  if (role === 'ADMIN') return CLUB_PERMISSION_KEYS.filter(key => key !== 'permissions.manage') as ClubPermissionKey[]
  if (role === 'TEAM_MANAGER') return [...COACHING]
  if (role === 'MEDIA_MANAGER') return ['studio.access']
  if (role === 'SPONSOR_MANAGER') return ['operations.access']
  return []
}

export function effectiveClubPermissions(input: { role: string; preset?: string | null; permissions?: unknown }) {
  if (input.role === 'OWNER') return [...CLUB_PERMISSION_KEYS]
  const explicit = sanitisePermissions(input.permissions)
  if (explicit.length || input.preset === 'CUSTOM') return explicit
  const preset = permissionsForPreset(input.preset)
  return preset.length ? preset : legacyRolePermissions(input.role)
}

export function allowedClubAreas(permissions: readonly ClubPermissionKey[]) {
  const set = new Set(permissions)
  const areas: Array<'coaching'|'studio'|'website'|'operations'|'analytics'|'permissions'> = []
  if ([...set].some(key => key.startsWith('coaching.'))) areas.push('coaching')
  if (set.has('studio.access')) areas.push('studio')
  if (set.has('website.access')) areas.push('website')
  if (set.has('operations.access')) areas.push('operations')
  if (set.has('analytics.access')) areas.push('analytics')
  if (set.has('permissions.manage')) areas.push('permissions')
  return areas
}

export function defaultPermissionPage(permissions: readonly ClubPermissionKey[]) {
  if (permissions.length === 1 && permissions[0] === 'coaching.stats') return 'STATS'
  if (permissions.length === 1 && permissions[0] === 'operations.access') return 'OPERATIONS'
  if (permissions.length === 1 && permissions[0] === 'studio.access') return 'STUDIO'
  return 'CLUB_DASHBOARD'
}
