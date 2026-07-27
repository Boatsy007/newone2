import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Building2, LogOut, Search, ShieldCheck, UserPlus } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { TeamLogo } from '../components/rankings/bits'
import { ensureFreshPortalSession, requestPortalPasswordReset, signInPortal, signUpPortal, type PortalAuthSession } from '../lib/portalAuth'

type AuthSession = PortalAuthSession
type ClubResult = { clubId: string; clubName: string; leagueName: string; state: string }
type Membership = {
  id: string; clubId: string; role: string; status: string; reviewNotes?: string | null
  club: { id: string; name: string; logoUrl: string | null; state: string; leagueName: string | null } | null
}
type MePayload = { data?: { user: { email: string | null }; memberships: Membership[] }; error?: string }

const SESSION_KEY = 'playfooty.clubPortal.session.v1'
function readSession(): AuthSession | null {
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) as AuthSession : null } catch { return null }
}
function saveSession(session: AuthSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}

export default function ClubPortal() {
  const [params, setParams] = useSearchParams()
  const [session, setSession] = useState<AuthSession | null>(() => readSession())
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(session?.user?.email ?? null)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(Boolean(session))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [clubs, setClubs] = useState<ClubResult[]>([])
  const [selectedClub, setSelectedClub] = useState<ClubResult | null>(null)
  const [claim, setClaim] = useState({ applicantName: '', clubPosition: '', phone: '', reason: '' })

  const active = useMemo(() => memberships.filter(item => item.status === 'ACTIVE'), [memberships])
  const pending = useMemo(() => memberships.filter(item => item.status !== 'ACTIVE' && item.status !== 'REVOKED'), [memberships])

  async function freshSession(current: AuthSession | null) {
    const fresh = await ensureFreshPortalSession(current)
    if (fresh && fresh.access_token !== current?.access_token) { saveSession(fresh); setSession(fresh) }
    return fresh
  }

  async function portalRequest(path: string, options: RequestInit = {}, current = session) {
    const fresh = await freshSession(current)
    if (!fresh) throw new Error('Sign in is required')
    const response = await fetch(path, {
      ...options,
      headers: { ...(options.headers ?? {}), authorization: `Bearer ${fresh.access_token}` },
    })
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; data?: unknown }
    if (response.status === 401) {
      saveSession(null); setSession(null); setMemberships([])
      throw new Error('Your session has expired. Please sign in again.')
    }
    if (!response.ok) throw new Error(payload.error || 'Request failed')
    return payload
  }

  async function loadMemberships(current: AuthSession) {
    const payload = await portalRequest('/api/club-portal/me', {}, current) as MePayload
    setUserEmail(payload.data?.user.email ?? current.user?.email ?? null)
    setMemberships(payload.data?.memberships ?? [])
  }

  async function acceptInvite(current: AuthSession) {
    const token = params.get('invite')
    if (!token) return
    const payload = await portalRequest('/api/club-portal/invitations/accept', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
    }, current)
    setMessage(payload.message || 'Invitation accepted')
    const next = new URLSearchParams(params)
    next.delete('invite')
    setParams(next, { replace: true })
    await loadMemberships(current)
  }

  useEffect(() => {
    if (!session) { setLoading(false); return }
    let live = true
    setLoading(true)
    void freshSession(session)
      .then(current => { if (!current) throw new Error('Sign in is required'); return loadMemberships(current).then(() => acceptInvite(current)) })
      .catch(reason => { if (live) setError(reason instanceof Error ? reason.message : 'Unable to load club access') })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) { setClubs([]); return }
    const timer = window.setTimeout(() => {
      void fetch(`/api/leagues/search/global?q=${encodeURIComponent(query.trim())}`)
        .then(response => response.json())
        .then((payload: { data?: { teams?: ClubResult[] } }) => setClubs(payload.data?.teams ?? []))
        .catch(() => setClubs([]))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError(''); setMessage('')
    try {
      const result = mode === 'signup' ? await signUpPortal(email, password) : await signInPortal(email, password)
      if (!result.access_token) {
        setMessage('Account created. Confirm your email, then sign in.')
        setMode('signin')
        return
      }
      setSession(result); saveSession(result); await loadMemberships(result); await acceptInvite(result); setPassword('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in') }
    finally { setLoading(false) }
  }

  async function forgotPassword() {
    setError(''); setMessage('')
    if (!email.trim()) { setError('Enter your email address first.'); return }
    setLoading(true)
    try {
      await requestPortalPasswordReset(email, '/club-portal')
      setMessage('Password reset email sent. Check your inbox and junk folder.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send password reset email') }
    finally { setLoading(false) }
  }

  async function submitClaim(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedClub || !session) return
    setLoading(true); setError(''); setMessage('')
    try {
      const payload = await portalRequest(`/api/club-portal/clubs/${encodeURIComponent(selectedClub.clubId)}/request-access`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(claim),
      })
      setMessage(payload.message || 'Club claim submitted')
      setSelectedClub(null); setQuery(''); setClaim({ applicantName: '', clubPosition: '', phone: '', reason: '' })
      await loadMemberships(session)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to submit claim') }
    finally { setLoading(false) }
  }

  function signOut() {
    saveSession(null); setSession(null); setMemberships([]); setUserEmail(null); setMessage('You have signed out.')
  }

  return (
    <>
      <Nav />
      <main className="club-portal-page">
        <section className="club-portal-intro">
          <span>PlayFooty Club Portal</span>
          <h1>Manage your club</h1>
          <p>Secure club accounts, verified claims and role-based access.</p>
          <div><b><ShieldCheck size={18} /> Every club claim is reviewed</b></div>
        </section>
        <section className="club-portal-panel">
          {!session ? (
            <>
              <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
              {params.get('invite') && <p className="notice">Sign in with the email address that received the invitation.</p>}
              <form onSubmit={submitAuth}>
                <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
                <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} required /></label>
                {error && <div className="error">{error}</div>}
                {message && <div className="notice">{message}</div>}
                <button disabled={loading}>{loading ? 'Please wait…' : mode === 'signin' ? 'Sign in securely' : 'Create account'} <ArrowRight size={16} /></button>
              </form>
              {mode === 'signin' && <button className="text-button" type="button" onClick={forgotPassword}>Forgot your password?</button>}
              <button className="text-button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
                <UserPlus size={16} /> {mode === 'signin' ? 'Create a club account' : 'Already have an account? Sign in'}
              </button>
            </>
          ) : (
            <>
              <div className="account-bar"><div><span>Signed in as</span><strong>{userEmail}</strong></div><button onClick={signOut}><LogOut size={16} /> Sign out</button></div>
              {error && <div className="error">{error}</div>}
              {message && <div className="notice">{message}</div>}
              {loading ? <div className="loading">Checking your club access…</div> : (
                <>
                  {active.length > 0 && <MembershipList title="Your clubs" items={active} />}
                  {pending.length > 0 && <MembershipList title="Awaiting approval" items={pending} />}
                  <div className="claim-section">
                    <Building2 size={30} />
                    <h2>Claim a club</h2>
                    <p>Search for your club and provide enough information for PlayFooty to verify your role.</p>
                    <label className="search-field"><Search size={17} /><input value={query} onChange={event => { setQuery(event.target.value); setSelectedClub(null) }} placeholder="Search club name" /></label>
                    {clubs.length > 0 && !selectedClub && <div className="club-results">{clubs.slice(0, 8).map(club => <button key={club.clubId} onClick={() => { setSelectedClub(club); setQuery(club.clubName) }}><strong>{club.clubName}</strong><small>{club.leagueName} · {club.state}</small></button>)}</div>}
                    {selectedClub && (
                      <form onSubmit={submitClaim} className="claim-form">
                        <div className="selected-club"><strong>{selectedClub.clubName}</strong><small>{selectedClub.leagueName}</small></div>
                        <label>Your full name<input value={claim.applicantName} onChange={event => setClaim({ ...claim, applicantName: event.target.value })} required /></label>
                        <label>Your role at the club<input value={claim.clubPosition} onChange={event => setClaim({ ...claim, clubPosition: event.target.value })} placeholder="President, secretary, media manager…" required /></label>
                        <label>Phone number<input value={claim.phone} onChange={event => setClaim({ ...claim, phone: event.target.value })} /></label>
                        <label>How can we verify you?<textarea value={claim.reason} onChange={event => setClaim({ ...claim, reason: event.target.value })} minLength={20} required /></label>
                        <button disabled={loading}>Submit club claim</button>
                      </form>
                    )}
                  </div>
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

function MembershipList({ title, items }: { title: string; items: Membership[] }) {
  return <section className="membership-list"><h2>{title}</h2>{items.map(item => {
    const club = item.club
    return <article key={item.id}><TeamLogo name={club?.name ?? 'Club'} src={club?.logoUrl ?? undefined} size={50} /><div><span>{item.status === 'ACTIVE' ? item.role.replaceAll('_', ' ') : item.status}</span><strong>{club?.name ?? 'Club unavailable'}</strong><small>{[club?.leagueName, club?.state].filter(Boolean).join(' · ')}</small>{item.reviewNotes && <small>{item.reviewNotes}</small>}</div>{item.status === 'ACTIVE' && club ? <Link to={`/club-portal/${club.id}`}>Open portal <ArrowRight size={15} /></Link> : <b>Pending</b>}</article>
  })}</section>
}

const styles = `
.club-portal-page{min-height:72vh;background:#eef3f7;padding:50px 20px;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,540px);gap:60px;align-items:start}.club-portal-intro>span{color:#0783c9;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.club-portal-intro h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4rem,9vw,8rem);line-height:.82;text-transform:uppercase;margin:12px 0}.club-portal-intro p{color:#526070;font-size:17px}.club-portal-intro b{display:inline-flex;align-items:center;gap:8px;margin-top:18px;padding:10px 14px;border-radius:999px;background:#fff;border:1px solid #d8e0e7}.club-portal-panel{background:#fff;border:1px solid #dce3e9;border-radius:18px;box-shadow:0 18px 50px rgba(17,24,39,.1);padding:28px}.club-portal-panel h2,.claim-section h2,.membership-list h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:40px;text-transform:uppercase;margin:8px 0}.club-portal-panel form{display:grid;gap:13px}.club-portal-panel label{display:grid;gap:6px;font-size:12px;font-weight:900;text-transform:uppercase}.club-portal-panel input,.club-portal-panel textarea{width:100%;box-sizing:border-box;border:1px solid #ccd5de;border-radius:10px;padding:13px;font:inherit}.club-portal-panel textarea{min-height:100px}.club-portal-panel form>button{min-height:48px;border:0;border-radius:10px;background:#111318;color:#fff;font-weight:900;text-transform:uppercase}.text-button{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:12px;border:0;background:none;font-weight:900;color:#087bbf}.account-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e1e6eb;padding-bottom:16px;margin-bottom:16px}.account-bar span,.account-bar strong{display:block}.account-bar span{font-size:10px;text-transform:uppercase;color:#75808d;font-weight:900}.account-bar button{display:flex;align-items:center;gap:6px;border:0;background:none;font-weight:900}.error,.notice{padding:12px;border-radius:10px;margin:10px 0}.error{background:#fff0f0;color:#a31414}.notice{background:#eaf7ff;color:#066aa1}.loading{padding:24px;text-align:center;color:#687385}.membership-list{display:grid;gap:10px;margin-bottom:24px}.membership-list article{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;padding:13px;border:1px solid #e0e6eb;border-radius:12px}.membership-list span,.membership-list strong,.membership-list small{display:block}.membership-list span{color:#0783c9;font-size:9px;font-weight:900;text-transform:uppercase}.membership-list small{color:#687385;margin-top:2px}.membership-list a{display:flex;align-items:center;gap:5px;text-decoration:none;color:#111318;font-weight:900;font-size:12px}.membership-list>b{font-size:10px;text-transform:uppercase;color:#916000}.claim-section{border-top:1px solid #e1e6eb;padding-top:22px}.claim-section>p{color:#687385}.search-field{position:relative}.search-field svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);z-index:2}.search-field input{padding-left:38px}.club-results{display:grid;border:1px solid #d7dfe6;border-radius:10px;overflow:hidden}.club-results button{text-align:left;padding:12px;border:0;border-bottom:1px solid #e5e9ed;background:#fff}.club-results button:last-child{border-bottom:0}.club-results strong,.club-results small{display:block}.club-results small{color:#687385;margin-top:3px}.claim-form{margin-top:14px}.selected-club{padding:12px;border-radius:10px;background:#edf7fd}.selected-club strong,.selected-club small{display:block}.selected-club small{color:#687385;margin-top:3px}@media(max-width:850px){.club-portal-page{grid-template-columns:1fr;gap:24px;padding:32px 14px}.club-portal-intro h1{font-size:4.6rem}.club-portal-panel{padding:20px}.membership-list article{grid-template-columns:auto minmax(0,1fr)}.membership-list article>a,.membership-list article>b{grid-column:2}}
`
