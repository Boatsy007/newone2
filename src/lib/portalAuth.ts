export type PortalAuthSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  user?: { id?: string; email?: string | null }
}

type AuthErrorPayload = { error_description?: string; msg?: string; error?: string }

function config() {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '')
  if (!url || !key) throw new Error('Portal authentication is not configured yet')
  return { url, key }
}

async function request(path: string, body: Record<string, unknown>) {
  const { url, key } = config()
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as PortalAuthSession & AuthErrorPayload
  if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.error || 'Authentication failed')
  return payload
}

export function signInPortal(email: string, password: string) {
  return request('token?grant_type=password', { email: email.trim(), password })
}

export function signUpPortal(email: string, password: string) {
  return request('signup', { email: email.trim(), password })
}

export function refreshPortalSession(refreshToken: string) {
  return request('token?grant_type=refresh_token', { refresh_token: refreshToken })
}

export function requestPortalPasswordReset(email: string, redirectPath: string) {
  const redirectTo = `${window.location.origin}${redirectPath}`
  return request('recover', { email: email.trim(), redirect_to: redirectTo })
}

export function sessionNeedsRefresh(session: PortalAuthSession | null, bufferSeconds = 120) {
  if (!session?.access_token || !session.refresh_token) return false
  if (!session.expires_at) return false
  return session.expires_at <= Math.floor(Date.now() / 1000) + bufferSeconds
}

export async function ensureFreshPortalSession(session: PortalAuthSession | null) {
  if (!session) return null
  if (!sessionNeedsRefresh(session)) return session
  const refreshed = await refreshPortalSession(session.refresh_token)
  return { ...session, ...refreshed }
}
