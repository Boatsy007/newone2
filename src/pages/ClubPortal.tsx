import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, CheckCircle2, LockKeyhole, LogOut, ShieldCheck, UserPlus } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { TeamLogo } from '../components/rankings/bits'

type AuthSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  token_type?: string
  user?: { id: string; email?: string | null }
}

type Membership = {
  id: string
  clubId: string
  role: string
  status: string
  approvedAt: string | null
  createdAt: string
  permissions: {
    manageUsers: boolean
    teamSelection: boolean
    media: boolean
    sponsors: boolean
    profile: boolean
    view: boolean
  }
  club: {
    id: string
    name: string
    logoUrl: string | null
    primaryColour: string | null
    state: string
    stateName: string
    leagueId: string | null
    leagueName: string | null
  } | null
}

type MePayload = {
  data?: {
    user: { id: string; email: string | null }
    memberships: Membership[]
  }
  error?: string
}

const SESSION_KEY = 'playfooty.clubPortal.session.v1'

function config() {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '')
  return { url, key, ready: Boolean(url && key) }
}

function readSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as AuthSession : null
  } catch {
    return null
  }
}

function saveSession(session: AuthSession | null) {
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else window.localStorage.removeItem(SESSION_KEY)
}

async function authRequest(path: string, body: Record<string, unknown>) {
  const auth = config()
  if (!auth.ready) throw new Error('Club login is not configured yet')
  const response = await fetch(`${auth.url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: auth.key, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json() as AuthSession & { error_description?: string; msg?: string }
  if (!response.ok) throw new Error(payload.error_description || payload.msg || 'Authentication failed')
  return payload
}

async function refreshSession(session: AuthSession) {
  if (!session.refresh_token) return session
  const refreshed = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
  saveSession(refreshed)
  return refreshed
}

export default function ClubPortal() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession())
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(session?.user?.email ?? null)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(Boolean(session))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const active = useMemo(() => memberships.filter(item => item.status === 'ACTIVE'), [memberships])
  const awaiting = useMemo(() => memberships.filter(item => item.status !== 'ACTIVE' && item.status !== 'REVOKED'), [memberships])

  const loadMemberships = async (current: AuthSession) => {
    let usable = current
    if (current.expires_at && current.expires_at * 1000 < Date.now() + 30_000) usable = await refreshSession(current)
    const response = await fetch('/api/club-portal/me', { headers: { authorization: `Bearer ${usable.access_token}` } })
    const payload = await response.json() as MePayload
    if (response.status === 401 && usable.refresh_token) {
      usable = await refreshSession(usable)
      setSession(usable)
      return loadMemberships(usable)
    }
    if (!response.ok) throw new Error(payload.error || 'Unable to load club access')
    setSession(usable)
    saveSession(usable)
    setUserEmail(payload.data?.user.email ?? usable.user?.email ?? null)
    setMemberships(payload.data?.memberships ?? [])
  }

  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    void loadMemberships(session)
      .catch(reason => {
        if (!live) return
        setError(String(reason instanceof Error ? reason.message : reason))
        saveSession(null)
        setSession(null)
        setMemberships([])
      })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'signup') {
        const result = await authRequest('signup', { email: email.trim(), password })
        if (!result.access_token) {
          setMessage('Account created. Check your email to confirm your address, then sign in.')
          setMode('signin')
          return
        }
        setSession(result)
        saveSession(result)
        await loadMemberships(result)
      } else {
        const result = await authRequest('token?grant_type=password', { email: email.trim(), password })
        setSession(result)
        saveSession(result)
        await loadMemberships(result)
      }
      setPassword('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    const auth = config()
    if (session?.access_token && auth.ready) {
      void fetch(`${auth.url}/auth/v1/logout`, { method: 'POST', headers: { apikey: auth.key, authorization: `Bearer ${session.access_token}` } }).catch(() => {})
    }
    saveSession(null)
    setSession(null)
    setMemberships([])
    setUserEmail(null)
    setError('')
    setMessage('You have signed out.')
  }

  return (
    <>
      <Nav />
      <main className="club-portal-auth">
        <section className="club-portal-intro">
          <span className="club-portal-kicker">PlayFooty Club Portal</span>
          <h1>Manage your club in one place</h1>
          <p>Secure access for approved club representatives. Your login identifies you; PlayFooty memberships control exactly which club and tools you can use.</p>
          <div className="club-portal-trust">
            <span><ShieldCheck size={18} /> Club-specific permissions</span>
            <span><LockKeyhole size={18} /> Protected backend actions</span>
            <span><CheckCircle2 size={18} /> Approval before access</span>
          </div>
        </section>

        <section className="club-portal-panel">
          {!session ? (
            <>
              <div className="club-portal-panel-head">
                <span>{mode === 'signin' ? 'Club representative login' : 'Create your account'}</span>
                <h2>{mode === 'signin' ? 'Sign in' : 'Join PlayFooty'}</h2>
                <p>{mode === 'signin' ? 'Use the account connected to your approved club membership.' : 'Creating an account does not automatically grant control of a club.'}</p>
              </div>
              <form onSubmit={submit}>
                <label>Email address<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" /></label>
                <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
                {error && <div className="club-portal-error">{error}</div>}
                {message && <div className="club-portal-message">{message}</div>}
                <button type="submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'signin' ? 'Sign in securely' : 'Create account'} <ArrowRight size={17} /></button>
              </form>
              <button className="club-portal-mode" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}>
                {mode === 'signin' ? <><UserPlus size={16} /> Create a club account</> : 'Already have an account? Sign in'}
              </button>
            </>
          ) : (
            <>
              <div className="club-portal-account-bar">
                <div><span>Signed in as</span><strong>{userEmail ?? 'Club account'}</strong></div>
                <button type="button" onClick={signOut}><LogOut size={16} /> Sign out</button>
              </div>
              {loading ? <div className="club-portal-state">Checking your club access…</div> : (
                <>
                  {error && <div className="club-portal-error">{error}</div>}
                  {active.length === 0 && awaiting.length === 0 && (
                    <div className="club-portal-empty">
                      <Building2 size={34} />
                      <h2>No club access yet</h2>
                      <p>Your account is secure and active, but it has not been approved for a club. Club claiming and invitations are the next stage.</p>
                      <Link to="/directory">Find your club <ArrowRight size={16} /></Link>
                    </div>
                  )}
                  {active.length > 0 && <div className="club-portal-memberships"><h2>Your clubs</h2>{active.map(item => <MembershipCard key={item.id} item={item} />)}</div>}
                  {awaiting.length > 0 && <div className="club-portal-memberships pending"><h2>Awaiting approval</h2>{awaiting.map(item => <MembershipCard key={item.id} item={item} />)}</div>}
                </>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />
      <style>{styles}</style>
    </>
  )
}

function MembershipCard({ item }: { item: Membership }) {
  const club = item.club
  return <article className="club-membership-card">
    <TeamLogo name={club?.name ?? 'Club'} src={club?.logoUrl ?? undefined} size={54} />
    <div><span>{item.status === 'ACTIVE' ? item.role.replaceAll('_', ' ') : item.status}</span><strong>{club?.name ?? 'Club record unavailable'}</strong><small>{[club?.leagueName, club?.state].filter(Boolean).join(' · ')}</small></div>
    {item.status === 'ACTIVE' && club ? <Link to={`/team/${club.id}`}>View club <ArrowRight size={15} /></Link> : <b>Pending</b>}
  </article>
}

const styles = `
.club-portal-auth{min-height:72vh;background:#eef3f7;padding:clamp(34px,6vw,76px) 20px;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,520px);gap:clamp(28px,6vw,80px);align-items:start}
.club-portal-intro{max-width:720px;padding-top:26px}.club-portal-kicker,.club-portal-panel-head>span{display:block;color:#0783c9;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.club-portal-intro h1{margin:12px 0 18px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4rem,9vw,8rem);line-height:.82;text-transform:uppercase;color:#101318}.club-portal-intro>p{max-width:620px;margin:0;color:#526070;font-size:17px;line-height:1.65}.club-portal-trust{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.club-portal-trust span{display:inline-flex;align-items:center;gap:8px;padding:10px 13px;border:1px solid #d8e0e7;border-radius:999px;background:#fff;color:#34404d;font-size:12px;font-weight:800}
.club-portal-panel{overflow:hidden;border:1px solid #dce3e9;border-radius:18px;background:#fff;box-shadow:0 18px 50px rgba(17,24,39,.1);padding:28px}.club-portal-panel-head h2,.club-portal-empty h2,.club-portal-memberships h2{margin:8px 0 8px;font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;line-height:.9;text-transform:uppercase}.club-portal-panel-head p{margin:0 0 22px;color:#687385;line-height:1.55}.club-portal-panel form{display:grid;gap:15px}.club-portal-panel label{display:grid;gap:7px;color:#26313d;font-size:12px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.club-portal-panel input{width:100%;box-sizing:border-box;border:1px solid #ccd5de;border-radius:10px;padding:14px 13px;font:inherit;font-size:16px;outline:none}.club-portal-panel input:focus{border-color:#2daaf5;box-shadow:0 0 0 3px rgba(45,170,245,.14)}.club-portal-panel form>button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;border:0;border-radius:10px;background:#111318;color:#fff;font-weight:900;text-transform:uppercase;letter-spacing:.08em;cursor:pointer}.club-portal-panel form>button:disabled{opacity:.6;cursor:wait}.club-portal-mode{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:12px;padding:10px;border:0;background:transparent;color:#0783c9;font-weight:900;cursor:pointer}.club-portal-error,.club-portal-message{padding:11px 13px;border-radius:9px;font-size:13px;line-height:1.45}.club-portal-error{background:#fff0f1;color:#b91c1c}.club-portal-message{background:#eef9ff;color:#075985}
.club-portal-account-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:20px;border-bottom:1px solid #e3e8ed}.club-portal-account-bar span,.club-membership-card div>span{display:block;color:#86909c;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.club-portal-account-bar strong{display:block;margin-top:4px;color:#111318}.club-portal-account-bar button{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:#687385;font-weight:800;cursor:pointer}.club-portal-state,.club-portal-empty{padding:38px 8px;text-align:center;color:#687385}.club-portal-empty svg{color:#2daaf5}.club-portal-empty h2{color:#111318}.club-portal-empty p{line-height:1.55}.club-portal-empty a{display:inline-flex;align-items:center;gap:6px;color:#0783c9;font-weight:900;text-decoration:none}.club-portal-memberships{margin-top:22px}.club-portal-memberships.pending{padding-top:18px;border-top:1px solid #e3e8ed}.club-membership-card{display:grid;grid-template-columns:58px minmax(0,1fr) auto;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #edf0f3}.club-membership-card:last-child{border-bottom:0}.club-membership-card div{min-width:0}.club-membership-card strong,.club-membership-card small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.club-membership-card strong{margin-top:3px;color:#111318;font-size:16px}.club-membership-card small{margin-top:3px;color:#687385;font-size:11px}.club-membership-card>a{display:inline-flex;align-items:center;gap:5px;color:#0783c9;font-size:11px;font-weight:900;text-decoration:none;text-transform:uppercase}.club-membership-card>b{color:#9a6700;font-size:10px;text-transform:uppercase}
@media(max-width:900px){.club-portal-auth{grid-template-columns:1fr;padding:30px 14px}.club-portal-intro{padding-top:0}.club-portal-intro h1{font-size:clamp(4rem,18vw,6.5rem)}.club-portal-panel{padding:22px 18px}.club-portal-trust{display:grid}.club-membership-card{grid-template-columns:48px minmax(0,1fr)}.club-membership-card>a,.club-membership-card>b{grid-column:2;justify-self:start}}
`
