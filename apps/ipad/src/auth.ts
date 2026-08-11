import * as SecureStore from 'expo-secure-store'
import type { AuthSession } from './types'

const API_BASE = 'https://playfooty.com.au/api'
const SESSION_KEY = 'playfooty.native.club.session.v1'

type AuthError = { error_description?: string; msg?: string; error?: string }

async function authRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}/portal-auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => ({}))) as AuthSession & AuthError
  if (!response.ok) {
    throw new Error(payload.error_description || payload.msg || payload.error || 'PlayFooty account request failed')
  }
  return payload
}

export function signIn(email: string, password: string) {
  return authRequest('signin-club', { email: email.trim(), password })
}

export function refreshSession(refreshToken: string) {
  return authRequest('refresh', { refresh_token: refreshToken })
}

export async function saveSession(session: AuthSession | null) {
  if (!session) return SecureStore.deleteItemAsync(SESSION_KEY)
  return SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  })
}

export async function restoreSession() {
  const raw = await SecureStore.getItemAsync(SESSION_KEY)
  if (!raw) return null
  try {
    const stored = JSON.parse(raw) as AuthSession
    const expiresSoon = stored.expires_at && stored.expires_at <= Math.floor(Date.now() / 1000) + 120
    if (!expiresSoon) return stored
    const refreshed = await refreshSession(stored.refresh_token)
    const session = { ...stored, ...refreshed }
    await saveSession(session)
    return session
  } catch {
    await saveSession(null)
    return null
  }
}
