import { createHash } from 'node:crypto'
import { Router } from 'express'
import { publicRateLimit } from '../middleware/rate-limit.js'
import { acceptClubInvitation, membershipsForUser, type AuthenticatedClubUser } from '../../auth/club-auth.js'
import { acceptLeagueInvitation, membershipsForLeagueUser } from '../../auth/league-auth.js'
import { prisma } from '../../db/client.js'
import { defaultPermissionPage, effectiveClubPermissions } from '../../auth/club-permissions.js'

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

async function supabaseRequest(path: string, body: Record<string, unknown>, authorization?: string, method: 'POST' | 'PUT' = 'POST') {
  const { url, key } = supabaseConfig()
  if (!url || !key) throw new Error('PlayFooty account services are temporarily unavailable')
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method,
    headers: { apikey: key, 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    const message = String(payload.error_description ?? payload.msg ?? payload.error ?? 'Account request failed')
    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return { status: response.status, payload }
}

async function supabaseAdminCreateUser(email:string,password:string) {
  const url=String(process.env.SUPABASE_URL??process.env.VITE_SUPABASE_URL??'').replace(/\/$/,'')
  const serviceKey=String(process.env.SUPABASE_SERVICE_ROLE_KEY??'')
  if(!url||!serviceKey)throw Object.assign(new Error('PlayFooty account creation is temporarily unavailable'),{status:503})
  const response=await fetch(`${url}/auth/v1/admin/users`,{method:'POST',headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},body:JSON.stringify({email,password,email_confirm:true,user_metadata:{source:'playfooty_club_invitation'}}),signal:AbortSignal.timeout(8000)})
  const payload=await response.json().catch(()=>({})) as Record<string,unknown>
  if(!response.ok){const message=String(payload.msg??payload.message??payload.error??'Unable to create account');throw Object.assign(new Error(message),{status:response.status})}
  return payload
}

const inviteHash=(token:string)=>createHash('sha256').update(token).digest('hex')
async function invitationDetails(token:string){
  const rows=await prisma.$queryRawUnsafe<Array<{id:string;clubId:string;email:string;preset:string|null;permissions:string[];expiresAt:Date;clubName:string;clubLogoUrl:string|null}>>(`SELECT i.id,i.club_id AS "clubId",i.email,i.preset,i.permissions,i.expires_at AS "expiresAt",c.name AS "clubName",c.logo_url AS "clubLogoUrl" FROM club_portal_invitations i JOIN "Club" c ON c.id=i.club_id WHERE i.token_hash=$1 AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at>NOW() LIMIT 1`,inviteHash(token))
  return rows[0]??null
}
async function clubAccountsFor(user:AuthenticatedClubUser){
  const memberships=(await membershipsForUser(user.id)).filter(item=>item.status==='ACTIVE')
  const clubIds=[...new Set(memberships.map(item=>item.clubId))]
  const clubs=clubIds.length?await prisma.club.findMany({where:{id:{in:clubIds},archivedAt:null},select:{id:true,name:true,logoUrl:true}}):[]
  const byId=new Map(clubs.map(club=>[club.id,club]))
  return memberships.map(membership=>{const permissions=effectiveClubPermissions(membership);return {clubId:membership.clubId,clubName:byId.get(membership.clubId)?.name??'Club',logoUrl:byId.get(membership.clubId)?.logoUrl??null,role:membership.role,permissions,defaultPage:defaultPermissionPage(permissions),legacyPortal:permissions.includes('legacy.portal')}})
}

async function relayAuth(res: import('express').Response, path: string, body: Record<string, unknown>, authorization?: string, method: 'POST' | 'PUT' = 'POST') {
  try {
    const result = await supabaseRequest(path, body, authorization, method)
    return res.status(result.status).json(result.payload)
  } catch (reason) {
    const error = reason as Error & { status?: number }
    return res.status(error.status ?? 503).json({ error: error.message || 'PlayFooty account services are temporarily unavailable' })
  }
}

type AuthPayload = {
  access_token?: string
  refresh_token?: string
  expires_at?: number
  expires_in?: number
  user?: { id?: string; email?: string | null }
}

function authenticatedUser(auth: AuthPayload, fallbackEmail: string): AuthenticatedClubUser {
  if (!auth.access_token || !auth.user?.id) throw Object.assign(new Error('Unable to sign in to this PlayFooty account'), { status: 401 })
  return {
    id: auth.user.id,
    email: auth.user.email?.trim().toLowerCase() ?? fallbackEmail,
    accessToken: auth.access_token,
  }
}

router.get('/club-invite/:token',async(req,res)=>{
  try{const token=String(req.params.token??'').trim();if(!token)return res.status(400).json({error:'Invitation token is required'});const invite=await invitationDetails(token);if(!invite)return res.status(404).json({error:'This invitation is invalid, expired or has already been used'});return res.json({data:{email:invite.email,clubName:invite.clubName,clubLogoUrl:invite.clubLogoUrl,preset:invite.preset,permissions:invite.permissions,expiresAt:invite.expiresAt}})}catch(reason){return res.status(500).json({error:reason instanceof Error?reason.message:'Unable to open invitation'})}
})

router.post('/club-invite/:token/accept',async(req,res)=>{
  const token=String(req.params.token??'').trim(),email=String(req.body?.email??'').trim().toLowerCase(),password=String(req.body?.password??''),mode=String(req.body?.mode??'signin')
  if(!token||!email||password.length<8)return res.status(400).json({error:'Email and a password of at least 8 characters are required'})
  try{
    const invite=await invitationDetails(token);if(!invite)return res.status(404).json({error:'This invitation is invalid, expired or has already been used'})
    if(invite.email!==email)return res.status(403).json({error:'Use the email address that received this invitation'})
    if(mode==='signup')await supabaseAdminCreateUser(email,password)
    const result=await supabaseRequest('token?grant_type=password',{email,password})
    const auth=result.payload as AuthPayload,user=authenticatedUser(auth,email)
    const membership=await acceptClubInvitation(user,token);if(!membership)return res.status(404).json({error:'This invitation could not be accepted'})
    const accounts=await clubAccountsFor(user)
    const accepted=accounts.find(account=>account.clubId===invite.clubId)
    return res.json({...auth,club_accounts:accounts,accepted_club:accepted,redirect:'/coach-app'})
  }catch(reason){const error=reason as Error&{status?:number};const message=error.message.includes('already been registered')?'A PlayFooty account already exists for this email. Choose “I already have an account” and sign in.':error.message;return res.status(error.status??503).json({error:message||'Unable to join this club'})}
})

router.post('/signin', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase(), password = String(req.body?.password ?? '')
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  return relayAuth(res, 'token?grant_type=password', { email, password })
})

router.post('/signin-club', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  const invite = String(req.body?.invite ?? '').trim()
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  try {
    const result = await supabaseRequest('token?grant_type=password', { email, password })
    const auth = result.payload as AuthPayload
    const user = authenticatedUser(auth, email)
    if (invite) await acceptClubInvitation(user, invite)

    const clubAccounts=await clubAccountsFor(user)
    return res.json({ ...auth, club_accounts: clubAccounts })
  } catch (reason) {
    const error = reason as Error & { status?: number }
    return res.status(error.status ?? 503).json({ error: error.message || 'Unable to sign in to this club' })
  }
})

router.post('/signin-league', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  const invite = String(req.body?.invite ?? '').trim()
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
  try {
    const result = await supabaseRequest('token?grant_type=password', { email, password })
    const auth = result.payload as AuthPayload
    const user = authenticatedUser(auth, email)
    if (invite) await acceptLeagueInvitation(user, invite)

    const memberships = (await membershipsForLeagueUser(user.id)).filter(item => item.status === 'ACTIVE')
    const leagueIds = [...new Set(memberships.map(item => item.leagueId))]
    const leagues = leagueIds.length
      ? await prisma.league.findMany({ where: { id: { in: leagueIds }, archivedAt: null }, select: { id: true, name: true, logoUrl: true } })
      : []
    const leagueById = new Map(leagues.map(league => [league.id, league]))
    const leagueAccounts = memberships.map(membership => ({
      leagueId: membership.leagueId,
      leagueName: leagueById.get(membership.leagueId)?.name ?? 'League',
      logoUrl: leagueById.get(membership.leagueId)?.logoUrl ?? null,
      role: membership.role,
    }))

    return res.json({ ...auth, league_accounts: leagueAccounts })
  } catch (reason) {
    const error = reason as Error & { status?: number }
    return res.status(error.status ?? 503).json({ error: error.message || 'Unable to sign in to this league' })
  }
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
