import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'
import { randomBytes, randomUUID } from 'node:crypto'

const required = [
  'PORTAL_E2E_BASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ADMIN_API_KEY',
  'DATABASE_URL','PORTAL_E2E_CLUB_ID','PORTAL_E2E_LEAGUE_ID','PORTAL_E2E_CONFIRM',
]
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required`)
if (process.env.PORTAL_E2E_CONFIRM !== 'RUN_DISPOSABLE_PORTAL_TESTS') throw new Error('Explicit production-test confirmation is required')

const baseUrl = process.env.PORTAL_E2E_BASE_URL.replace(/\/$/, '')
const supabaseUrl = process.env.SUPABASE_URL.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminKey = process.env.ADMIN_API_KEY
const clubId = process.env.PORTAL_E2E_CLUB_ID
const leagueId = process.env.PORTAL_E2E_LEAGUE_ID
const prisma = new PrismaClient()
const runId = `${Date.now()}-${randomBytes(4).toString('hex')}`
const password = `Pf-${randomBytes(14).toString('base64url')}!9`
const users = []

async function json(url, options = {}) {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${response.status} ${url}: ${payload.error || payload.msg || JSON.stringify(payload)}`)
  return payload
}

async function createAuthUser(kind) {
  const email = `portal-e2e+${kind}-${runId}@example.com`
  const payload = await json(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { playfooty_e2e: true, runId } }),
  })
  users.push({ id: payload.id, email, kind })
  return { id: payload.id, email }
}

async function createInvite(kind, entityId, email) {
  const path = kind === 'club' ? '/api/club-portal/admin/invitations' : '/api/league-portal/admin/invitations'
  const body = kind === 'club' ? { clubId: entityId, email, role: 'OWNER' } : { leagueId: entityId, email, role: 'OWNER' }
  const payload = await json(`${baseUrl}${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${adminKey}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  return payload.data.invitePath
}

async function runJourney(browser, kind, entityId) {
  const user = await createAuthUser(kind)
  const invitePath = await createInvite(kind, entityId, user.email)
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const portal = kind === 'club' ? 'club-portal' : 'league-portal'
  await page.goto(`${baseUrl}${invitePath}`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(new RegExp(`/${portal}/${entityId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), { timeout: 20000 })

  await page.reload({ waitUntil: 'networkidle' })
  if (!page.url().includes(`/${portal}/${entityId}`)) throw new Error(`${kind} session was not restored after reload`)

  const sessionKey = kind === 'club' ? 'playfooty.clubPortal.session.v1' : 'playfooty.leaguePortal.session.v1'
  const session = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), sessionKey)
  if (!session?.access_token || !session?.refresh_token) throw new Error(`${kind} session tokens were not persisted`)

  const wrongId = randomUUID()
  const protectedPath = kind === 'club' ? `/api/club-portal/clubs/${wrongId}` : `/api/league-portal/leagues/${wrongId}`
  const isolation = await page.evaluate(async ({ path, token }) => {
    const response = await fetch(path, { headers: { authorization: `Bearer ${token}` } })
    return response.status
  }, { path: protectedPath, token: session.access_token })
  if (isolation !== 403) throw new Error(`${kind} cross-organisation isolation expected 403, received ${isolation}`)

  await page.evaluate(key => localStorage.removeItem(key), sessionKey)
  await page.goto(`${baseUrl}/${portal}/${entityId}`, { waitUntil: 'networkidle' })
  await page.waitForURL(new RegExp(`/${portal}(\\?|$)`), { timeout: 15000 })
  if (!page.url().includes('returnTo=')) throw new Error(`${kind} protected route did not preserve its return destination`)
  await context.close()
  console.log(`PASS ${kind}: invitation, sign-in, restoration, isolation and expired-session redirect`)
}

async function cleanup() {
  for (const user of users) {
    try {
      if (user.kind === 'club') {
        await prisma.$executeRawUnsafe('DELETE FROM club_portal_membership_audit WHERE user_id=$1 OR actor_id=$1', user.id)
        await prisma.$executeRawUnsafe('DELETE FROM club_portal_memberships WHERE user_id=$1', user.id)
        await prisma.$executeRawUnsafe('DELETE FROM club_portal_invitations WHERE lower(email)=lower($1)', user.email)
      } else {
        await prisma.$executeRawUnsafe('DELETE FROM league_portal_membership_audit WHERE user_id=$1 OR actor_id=$1', user.id)
        await prisma.$executeRawUnsafe('DELETE FROM league_portal_memberships WHERE user_id=$1', user.id)
        await prisma.$executeRawUnsafe('DELETE FROM league_portal_invitations WHERE lower(email)=lower($1)', user.email)
      }
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } })
    } catch (error) { console.error(`Cleanup failed for ${user.email}:`, error) }
  }
}

const browser = await chromium.launch({ headless: true })
try {
  await runJourney(browser, 'club', clubId)
  await runJourney(browser, 'league', leagueId)
  console.log('All real portal journeys passed')
} finally {
  await browser.close()
  await cleanup()
  await prisma.$disconnect()
}
