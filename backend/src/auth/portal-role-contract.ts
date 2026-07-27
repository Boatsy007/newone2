export const CLUB_PORTAL_ACTIONS = ['manage_users', 'team_selection', 'media', 'sponsors', 'profile', 'view'] as const
export const LEAGUE_PORTAL_ACTIONS = ['manage_users', 'competition_data', 'media', 'sponsors', 'profile', 'view'] as const

export type ClubPortalAction = typeof CLUB_PORTAL_ACTIONS[number]
export type LeaguePortalAction = typeof LEAGUE_PORTAL_ACTIONS[number]

export const CLUB_PORTAL_ROLES = ['OWNER', 'ADMIN', 'TEAM_MANAGER', 'MEDIA_MANAGER', 'SPONSOR_MANAGER', 'VIEWER'] as const
export const LEAGUE_PORTAL_ROLES = ['OWNER', 'ADMIN', 'DATA_MANAGER', 'MEDIA_MANAGER', 'SPONSOR_MANAGER', 'VIEWER'] as const

export type ClubPortalRole = typeof CLUB_PORTAL_ROLES[number]
export type LeaguePortalRole = typeof LEAGUE_PORTAL_ROLES[number]

const CLUB_PERMISSIONS: Record<ClubPortalRole, ReadonlySet<ClubPortalAction>> = {
  OWNER: new Set(CLUB_PORTAL_ACTIONS),
  ADMIN: new Set(['team_selection', 'media', 'sponsors', 'profile', 'view']),
  TEAM_MANAGER: new Set(['team_selection', 'view']),
  MEDIA_MANAGER: new Set(['media', 'view']),
  SPONSOR_MANAGER: new Set(['sponsors', 'view']),
  VIEWER: new Set(['view']),
}

const LEAGUE_PERMISSIONS: Record<LeaguePortalRole, ReadonlySet<LeaguePortalAction>> = {
  OWNER: new Set(LEAGUE_PORTAL_ACTIONS),
  ADMIN: new Set(['competition_data', 'media', 'sponsors', 'profile', 'view']),
  DATA_MANAGER: new Set(['competition_data', 'view']),
  MEDIA_MANAGER: new Set(['media', 'profile', 'view']),
  SPONSOR_MANAGER: new Set(['sponsors', 'view']),
  VIEWER: new Set(['view']),
}

export function clubRoleCan(role: ClubPortalRole, action: ClubPortalAction) {
  return CLUB_PERMISSIONS[role]?.has(action) ?? false
}

export function leagueRoleCan(role: LeaguePortalRole, action: LeaguePortalAction) {
  return LEAGUE_PERMISSIONS[role]?.has(action) ?? false
}

export function clubPermissionSnapshot(role: ClubPortalRole) {
  return Object.fromEntries(CLUB_PORTAL_ACTIONS.map(action => [action, clubRoleCan(role, action)])) as Record<ClubPortalAction, boolean>
}

export function leaguePermissionSnapshot(role: LeaguePortalRole) {
  return Object.fromEntries(LEAGUE_PORTAL_ACTIONS.map(action => [action, leagueRoleCan(role, action)])) as Record<LeaguePortalAction, boolean>
}
