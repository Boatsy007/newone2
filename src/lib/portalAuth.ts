export type PortalClubAccount = {
  clubId: string
  clubName: string
  logoUrl?: string | null
  role: string
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
  if (!response.ok) throw new Error(friendlyAuthError(payload.error_description || payload.msg || payload.error || 'PlayFooty account request failed'))
  return payload
}

function friendlyAuthError(message: string) {
  const value = message.toLowerCase()
  if (value.includes('invalid login credentials')) return 'The email or password is incorrect.'
  if (value.includes('email not confirmed')) return 'Confirm your email before signing in.'
  if (value.includes('user already registered')) return 'A PlayFooty login already exists for this email. Sign in or reset your password.'
  if (value.includes('rate limit') || value.includes('too many')) return 'Too many attempts. Wait a moment and try again.'
  if (value.includes('expired') && value.includes('token')) return 'This sign-in link has expired. Request a new one.'
  return message
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

export function requestPortalPasswordReset(email: string, redirectPath: string) {
  return request('recover', { email: email.trim(), redirect_path: redirectPath })
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

export function safePortalReturnTo(kind: 'club' | 'league') {
  const value = new URLSearchParams(window.location.search).get('returnTo')?.trim() ?? ''
  const prefix = kind === 'club' ? '/club-portal/' : '/league-portal/'
  if (!value.startsWith(prefix) || value.startsWith('//') || value.includes('://')) return null
  return value
}

export function portalReasonMessage() {
  const reason = new URLSearchParams(window.location.search).get('reason')
  if (reason === 'session-expired') return 'Your session expired. Sign in again and you will return to the page you were using.'
  if (reason === 'signin-required') return 'Sign in to continue to that portal page.'
  return ''
}
