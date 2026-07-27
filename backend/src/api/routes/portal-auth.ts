import { Router } from 'express'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
router.use(publicRateLimit)

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const key = String(process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')
  return { url, key }
}

function playFootyRedirect(req: import('express').Request, requestedPath: unknown) {
  const requested = String(requestedPath ?? '').trim()
  const [pathname, query = ''] = requested.split('?', 2)
  const allowedPaths = ['/club-portal', '/league-portal', '/reset-password']
  const safePath = allowedPaths.includes(pathname) ? pathname : '/club-portal'
  const params = new URLSearchParams(query)
  const invite = params.get('invite')?.trim() ?? ''
  const safeQuery = invite && /^[A-Za-z0-9_-]{20,200}$/.test(invite) && safePath !== '/reset-password'
    ? `?invite=${encodeURIComponent(invite)}`
    : ''
  const configuredOrigin = String(process.env.PUBLIC_SITE_URL ?? process.env.SITE_URL ?? '').replace(/\/$/, '')
  const requestOrigin = String(req.get('origin') ?? '').replace(/\/$/, '')
  const origin = configuredOrigin || requestOrigin || 'https://playfooty.com.au'
  return `${origin}${safePath}${safeQuery}`
}

async function relayAuth(res: import('express').Response, path: string, body: Record<string, unknown>, authorization?: string, method: 'POST' | 'PUT' = 'POST') {
  const { url, key } = supabaseConfig()
  if (!url || !key) return res.status(503).json({ error: 'PlayFooty account services are temporarily unavailable' })
  try {
    const response = await fetch(`${url}/auth/v1/${path}`, {
      method,
      headers: { apikey: key, 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) return res.status(response.status).json({ error: String(payload.error_description ?? payload.msg ?? payload.error ?? 'Account request failed') })
    return res.status(response.status).json(payload)
  } catch {
    return res.status(503).json({ error: 'PlayFooty account services are temporarily unavailable' })
  }
}

router.post('/signin', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase(), password = String(req.body?.password ?? '')
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  return relayAuth(res, 'token?grant_type=password', { email, password })
})

router.post('/signup', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase(), password = String(req.body?.password ?? '')
  if (!email || password.length < 8) return res.status(400).json({ error: 'A valid email and password of at least 8 characters are required' })
  const redirectTo = playFootyRedirect(req, req.body?.redirect_path)
  return relayAuth(res, `signup?redirect_to=${encodeURIComponent(redirectTo)}`, { email, password })
})

router.post('/refresh', async (req, res) => {
  const refreshToken = String(req.body?.refresh_token ?? '')
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required' })
  return relayAuth(res, 'token?grant_type=refresh_token', { refresh_token: refreshToken })
})

router.post('/recover', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  if (!email) return res.status(400).json({ error: 'Email is required' })
  const redirectTo = playFootyRedirect(req, '/reset-password')
  return relayAuth(res, `recover?redirect_to=${encodeURIComponent(redirectTo)}`, { email })
})

router.post('/update-password', async (req, res) => {
  const password = String(req.body?.password ?? ''), authorization = req.get('authorization') ?? ''
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
  if (!/^Bearer\s+.+/i.test(authorization)) return res.status(401).json({ error: 'A valid recovery session is required' })
  return relayAuth(res, 'user', { password }, authorization, 'PUT')
})

export { router as portalAuthRouter }
