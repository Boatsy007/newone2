import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, LogOut, ShieldCheck, UserPlus } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { TeamLogo } from '../components/rankings/bits'
import {
  ensureFreshPortalSession,
  requestPortalPasswordReset,
  signInPortal,
  signUpPortal,
  type PortalAuthSession,
} from '../lib/portalAuth'

type Membership = {
  id: string
  clubId: string
  role: string
  status: string
  club?: {
    id: string
    name: string
    logoUrl: string | null
    state: string
    leagueName: string | null
  } | null
}

type MePayload = {
  data?: {
    user: { email: string | null }
    memberships: Membership[]
  }
  error?: string
}

type InvitePayload = {
  message?: string
  data?: { membership?: Membership }
  error?: string
}

const SESSION_KEY = 'playfooty.clubPortal.session.v1'

function readSession(): PortalAuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as PortalAuthSession : null
  } catch {
    return null
  }
}

function saveSession(session: PortalAuthSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}

function sessionFromHash(): PortalAuthSession | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')
  if (!accessToken || !refreshToken) return null
  const expiresIn = Number(hash.get('expires_in') || 3600)
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
  }
}

export default function ClubPortal() {
  const returnedSession = useMemo(() => sessionFromHash(), [])
  const initialSession = returnedSession ?? readSession()
  const [session, setSession] = useState<PortalAuthSession | null>(initialSession)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(Boolean(initialSession))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const active = useMemo(
    () => memberships.filter(item => item.status === 'ACTIVE' && item.clubId),
    [memberships],
  )

  async function portalRequest(path: string, options: RequestInit = {}, current = session) {
    const fresh = await ensureFreshPortalSession(current)
    if (!fresh?.access_token) throw new Error('Sign in is required')
    saveSession(fresh)
    setSession(fresh)

    let response: Response
    try {
      response = await fetchWithTimeout(path, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          authorization: `Bearer ${fresh.access_token}`,
        },
      })
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        throw new Error('The club access check timed out. Tap retry below.')
      }
      throw reason
    }

    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; data?: unknown }
    if (response.status === 401) {
      saveSession(null)
      setSession(null)
      setMemberships([])
      throw new Error('Your session expired. Please sign in again.')
    }
    if (!response.ok) throw new Error(payload.error || 'Unable to check club access')
    return payload
  }

  async function loadAccess(current = session) {
    if (!current) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams(window.location.search)
      const invite = params.get('invite')
      if (invite) {
        const accepted = await portalRequest('/api/club-portal/invitations/accept', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: invite }),
        }, current) as InvitePayload
        if (accepted.data?.membership?.clubId) {
          setMessage(accepted.message || 'Club invitation accepted')
          window.history.replaceState({}, '', '/club-portal')
        }
      }

      const payload = await portalRequest('/api/club-portal/me', {}, current) as MePayload
      setUserEmail(payload.data?.user.email ?? null)
      setMemberships(payload.data?.memberships ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load club access')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (returnedSession) {
      saveSession(returnedSession)
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`)
    }
    if (initialSession) void loadAccess(initialSession)
    else setLoading(false)
    // Run once for the session present on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const result = mode === 'signup'
        ? await signUpPortal(email, password)
        : await signInPortal(email, password)

      if (!result.access_token) {
        setMessage('Account created. Confirm your email, then return to this PlayFooty invitation.')
        setMode('signin')
        return
      }

      saveSession(result)
      setSession(result)
      setPassword('')
      await loadAccess(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  async function forgotPassword() {
    if (!email.trim()) {
      setError('Enter your email address first.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await requestPortalPasswordReset(email, '/club-portal')
      setMessage('Password reset email sent. Check your inbox and junk folder.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to send the reset email')
    } finally {
      setLoading(false)
    }
  }

  function signOut() {
    saveSession(null)
    setSession(null)
    setMemberships([])
    setUserEmail(null)
    setMessage('You have signed out.')
  }

  return (
    <>
      <Nav />
      <main className="club-portal-page">
        <section className="club-portal-intro">
          <span>PlayFooty Club Portal</span>
          <h1>Manage your club</h1>
          <p>Secure PlayFooty access for invited club representatives.</p>
          <div><b><ShieldCheck size={18} /> Club access is controlled by PlayFooty invitations</b></div>
        </section>

        <section className="club-portal-panel">
          {!session ? (
            <>
              <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
              {new URLSearchParams(window.location.search).get('invite') && (
                <p className="notice">Use the email address that received this club invitation.</p>
              )}
              <form onSubmit={submitAuth}>
                <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
                <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} required /></label>
                {error && <div className="error">{error}</div>}
                {message && <div className="notice">{message}</div>}
                <button disabled={loading}>{loading ? 'Please wait…' : mode === 'signin' ? 'Sign in and open club' : 'Create account'} <ArrowRight size={16} /></button>
              </form>
              {mode === 'signin' && <button className="text-button" type="button" onClick={forgotPassword}>Forgot your password?</button>}
              <button className="text-button" type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
                <UserPlus size={16} /> {mode === 'signin' ? 'Create a PlayFooty account' : 'Already have an account? Sign in'}
              </button>
            </>
          ) : (
            <>
              <div className="account-bar"><div><span>Signed in as</span><strong>{userEmail || session.user?.email || 'PlayFooty account'}</strong></div><button onClick={signOut}><LogOut size={16} /> Sign out</button></div>
              {message && <div className="notice">{message}</div>}
              {error && <div className="error">{error}</div>}
              {loading ? (
                <div className="loading">Checking your club access…</div>
              ) : active.length ? (
                <section className="membership-list">
                  <h2>Your club</h2>
                  {active.map(item => {
                    const club = item.club
                    return (
                      <article key={item.id}>
                        <TeamLogo name={club?.name ?? 'Club'} src={club?.logoUrl ?? undefined} size={52} />
                        <div><span>{item.role.replaceAll('_', ' ')}</span><strong>{club?.name ?? 'Your club'}</strong><small>{[club?.leagueName, club?.state].filter(Boolean).join(' · ')}</small></div>
                        <a href={`/club-portal/${encodeURIComponent(item.clubId)}`}>Open portal <ArrowRight size={16} /></a>
                      </article>
                    )
                  })}
                </section>
              ) : (
                <div className="empty-access">
                  <h2>No active club access</h2>
                  <p>This account is signed in, but no active club membership was returned.</p>
                  <button type="button" onClick={() => void loadAccess()}>Retry access check</button>
                </div>
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

const styles = `
.club-portal-page{min-height:72vh;background:#eef3f7;padding:50px 20px;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,540px);gap:60px;align-items:start}.club-portal-intro>span{color:#0783c9;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.club-portal-intro h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4rem,9vw,8rem);line-height:.82;text-transform:uppercase;margin:12px 0}.club-portal-intro p{color:#526070;font-size:17px}.club-portal-intro b{display:inline-flex;align-items:center;gap:8px;margin-top:18px;padding:12px 16px;border-radius:999px;background:#fff;border:1px solid #d8e0e7}.club-portal-panel{background:#fff;border:1px solid #dce3e9;border-radius:18px;box-shadow:0 18px 50px rgba(17,24,39,.1);padding:28px}.club-portal-panel h2,.membership-list h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:40px;text-transform:uppercase;margin:8px 0}.club-portal-panel form{display:grid;gap:13px}.club-portal-panel label{display:grid;gap:6px;font-size:12px;font-weight:900;text-transform:uppercase}.club-portal-panel input{width:100%;box-sizing:border-box;border:1px solid #ccd5de;border-radius:10px;padding:13px;font:inherit}.club-portal-panel form>button,.empty-access button{min-height:48px;border:0;border-radius:10px;background:#111318;color:#fff;font-weight:900;text-transform:uppercase}.text-button{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:12px;border:0;background:none;font-weight:900;color:#087bbf}.account-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e1e6eb;padding-bottom:16px;margin-bottom:16px}.account-bar span,.account-bar strong{display:block}.account-bar span{font-size:10px;text-transform:uppercase;color:#75808d;font-weight:900}.account-bar button{display:flex;align-items:center;gap:6px;border:0;background:none;font-weight:900}.error,.notice{padding:12px;border-radius:10px;margin:10px 0}.error{background:#fff0f0;color:#a31414}.notice{background:#eaf7ff;color:#066aa1}.loading,.empty-access{padding:28px 8px;text-align:center;color:#687385}.empty-access button{padding:0 18px;margin-top:10px}.membership-list{display:grid;gap:12px}.membership-list article{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px;border:1px solid #e0e6eb;border-radius:12px}.membership-list span,.membership-list strong,.membership-list small{display:block}.membership-list span{color:#0783c9;font-size:9px;font-weight:900;text-transform:uppercase}.membership-list small{color:#687385;margin-top:2px}.membership-list a{display:flex;align-items:center;gap:5px;padding:11px 13px;border-radius:999px;background:#2daaf5;color:#07111f;text-decoration:none;font-weight:950;font-size:12px}@media(max-width:850px){.club-portal-page{grid-template-columns:1fr;gap:24px;padding:32px 14px}.club-portal-intro h1{font-size:4.6rem}.club-portal-panel{padding:20px}.membership-list article{grid-template-columns:auto minmax(0,1fr)}.membership-list article>a{grid-column:2;justify-self:start}}
`