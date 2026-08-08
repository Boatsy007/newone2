export type PortalClubAccount = {
  clubId: string
  clubName: string
  logoUrl?: string | null
  role: string
  permissions?: string[]
  defaultPage?: string
  legacyPortal?: boolean
}

export type PortalLeagueAccount = {
  leagueId: string
  leagueName: string
  logoUrl?: string | null
  role: string
}

export type PortalAuthSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  user?: { id?: string; email?: string | null }
  club_accounts?: PortalClubAccount[]
  league_accounts?: PortalLeagueAccount[]
}

type AuthErrorPayload = { error_description?: string; msg?: string; error?: string }

async function request(path: string, body: Record<string, unknown>, authorization?: string) {
  const response = await fetch(`/api/portal-auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as PortalAuthSession & AuthErrorPayload
  if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.error || 'PlayFooty account request failed')
  return payload
}

export function signInPortal(email: string, password: string) {
  const invite = new URLSearchParams(window.location.search).get('invite')
  return request('signin-club', { email: email.trim(), password, ...(invite ? { invite } : {}) })
}

export function signInLeaguePortal(email: string, password: string) {
  const invite = new URLSearchParams(window.location.search).get('invite')
  return request('signin-league', { email: email.trim(), password, ...(invite ? { invite } : {}) })
}

export function signUpPortal(email: string, password: string) {
  const portal = window.location.pathname.startsWith('/league-portal') ? '/league-portal' : '/club-portal'
  const invite = new URLSearchParams(window.location.search).get('invite')
  const redirectPath = invite ? `${portal}?invite=${encodeURIComponent(invite)}` : portal
  return request('signup', { email: email.trim(), password, redirect_path: redirectPath })
}

export function portalSessionFromLocation(): PortalAuthSession | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')
  if (!accessToken || !refreshToken) return null
  const expiresAt = Number(hash.get('expires_at') || 0) || undefined
  const expiresIn = Number(hash.get('expires_in') || 0) || undefined
  const session: PortalAuthSession = { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt, expires_in: expiresIn }
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  return session
}

export function refreshPortalSession(refreshToken: string) {
  return request('refresh', { refresh_token: refreshToken })
}

export function requestPortalPasswordReset(email: string, _redirectPath: string) {
  return request('recover', { email: email.trim() })
}

export function recoveryTokenFromLocation() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const type = hash.get('type') ?? query.get('type')
  const accessToken = hash.get('access_token') ?? query.get('access_token')
  return type === 'recovery' && accessToken ? accessToken : null
}

export async function updatePortalPassword(accessToken: string, password: string) {
  return request('update-password', { password }, `Bearer ${accessToken}`)
}

export function sessionNeedsRefresh(session: PortalAuthSession | null, bufferSeconds = 120) {
  if (!session?.access_token || !session.refresh_token || !session.expires_at) return false
  return session.expires_at <= Math.floor(Date.now() / 1000) + bufferSeconds
}

export async function ensureFreshPortalSession(session: PortalAuthSession | null) {
  if (!session) return null
  if (!sessionNeedsRefresh(session)) return session
  const refreshed = await refreshPortalSession(session.refresh_token)
  return { ...session, ...refreshed }
}
