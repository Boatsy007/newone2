import { Router } from 'express'
import { publicRateLimit } from '../middleware/rate-limit.js'

const router = Router()
router.use(publicRateLimit)

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const key = String(
    process.env.SUPABASE_ANON_KEY
      ?? process.env.VITE_SUPABASE_ANON_KEY
      ?? process.env.SUPABASE_SERVICE_ROLE_KEY
      ?? '',
  )
  return { url, key }
}

async function relayAuth(
  res: import('express').Response,
  path: string,
  body: Record<string, unknown>,
  authorization?: string,
  method: 'POST' | 'PUT' = 'POST',
) {
  const { url, key } = supabaseConfig()
  if (!url || !key) return res.status(503).json({ error: 'Portal authentication is not configured on the server' })

  try {
    const response = await fetch(`${url}/auth/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        'content-type': 'application/json',
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) {
      const error = String(payload.error_description ?? payload.msg ?? payload.error ?? 'Authentication failed')
      return res.status(response.status).json({ error })
    }
    return res.status(response.status).json(payload)
  } catch {
    return res.status(503).json({ error: 'Authentication service is temporarily unavailable' })
  }
}

router.post('/signin', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  return relayAuth(res, 'token?grant_type=password', { email, password })
})

router.post('/signup', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  if (!email || password.length < 8) return res.status(400).json({ error: 'A valid email and password of at least 8 characters are required' })
  return relayAuth(res, 'signup', { email, password })
})

router.post('/refresh', async (req, res) => {
  const refreshToken = String(req.body?.refresh_token ?? '')
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required' })
  return relayAuth(res, 'token?grant_type=refresh_token', { refresh_token: refreshToken })
})

router.post('/recover', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const redirectTo = String(req.body?.redirect_to ?? '').trim()
  if (!email) return res.status(400).json({ error: 'Email is required' })
  const body: Record<string, unknown> = { email }
  if (redirectTo) body.redirect_to = redirectTo
  return relayAuth(res, 'recover', body)
})

router.post('/update-password', async (req, res) => {
  const password = String(req.body?.password ?? '')
  const authorization = req.get('authorization') ?? ''
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
  if (!/^Bearer\s+.+/i.test(authorization)) return res.status(401).json({ error: 'A valid recovery session is required' })
  return relayAuth(res, 'user', { password }, authorization, 'PUT')
})

export { router as portalAuthRouter }
