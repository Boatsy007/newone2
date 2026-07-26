import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Building2, LogOut, Search, ShieldCheck, UserPlus } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { TeamLogo } from '../components/rankings/bits'

type AuthSession = { access_token: string; refresh_token: string; expires_at?: number; user?: { id: string; email?: string | null } }
type ClubResult = { clubId: string; clubName: string; leagueName: string; state: string }
type Membership = {
  id: string; clubId: string; role: string; status: string; reviewNotes?: string | null
  club: { id: string; name: string; logoUrl: string | null; state: string; leagueName: string | null } | null
}
type MePayload = { data?: { user: { email: string | null }; memberships: Membership[] }; error?: string }

const SESSION_KEY = 'playfooty.clubPortal.session.v1'
function authConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '')
  return { url, key, ready: Boolean(url && key) }
}
function readSession(): AuthSession | null {
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) as AuthSession : null } catch { return null }
}
function saveSession(session: AuthSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
}
async function authRequest(path: string, body: Record<string, unknown>) {
  const auth = authConfig()
  if (!auth.ready) throw new Error('Club login is not configured yet')
  const response = await fetch(`${auth.url}/auth/v1/${path}`, {
    method: 'POST', headers: { apikey: auth.key, 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const payload = await response.json() as AuthSession & { error_description?: string; msg?: string }
  if (!response.ok) throw new Error(payload.error_description || payload.msg || 'Authentication failed')
  return payload
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

  async function portalRequest(path: string, options: RequestInit = {}, current = session) {
    if (!current) throw new Error('Sign in is required')
    const response = await fetch(path, {
      ...options,
      headers: { ...(options.headers ?? {}), authorization: `Bearer ${current.access_token}` },
    })
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; data?: unknown }
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
    void loadMemberships(session)
      .then(() => acceptInvite(session))
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
      const result = mode === 'signup'
        ? await authRequest('signup', { email: email.trim(), password })
        : await authRequest('token?grant_type=password', { email: email.trim(), password })
      if (!result.access_token) {
        setMessage('Account created. Confirm your email, then sign in.')
        setMode('signin')
        return
      }
      setSession(result); saveSession(result); await loadMemberships(result); await acceptInvite(result); setPassword('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in') }
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
    return <article key={item.id}><TeamLogo name={club?.name ?? 'Club'} src={club?.logoUrl ?? undefined} size={50} /><div><span>{item.status === 'ACTIVE' ? item.role.replaceAll('_', ' ') : item.status}</span><strong>{club?.name ?? 'Club unavailable'}</strong><small>{[club?.leagueName, club?.state].filter(Boolean).join(' · ')}</small>{item.reviewNotes && <small>{item.reviewNotes}</small>}</div>{item.status === 'ACTIVE' && club ? <Link to={`/team/${club.id}`}>Open <ArrowRight size={15} /></Link> : <b>Pending</b>}</article>
  })}</section>
}

const styles = `
.club-portal-page{min-height:72vh;background:#eef3f7;padding:50px 20px;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,540px);gap:60px;align-items:start}.club-portal-intro>span{color:#0783c9;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.club-portal-intro h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4rem,9vw,8rem);line-height:.82;text-transform:uppercase;margin:12px 0}.club-portal-intro p{color:#526070;font-size:17px}.club-portal-intro b{display:inline-flex;align-items:center;gap:8px;margin-top:18px;padding:10px 14px;border-radius:999px;background:#fff;border:1px solid #d8e0e7}.club-portal-panel{background:#fff;border:1px solid #dce3e9;border-radius:18px;box-shadow:0 18px 50px rgba(17,24,39,.1);padding:28px}.club-portal-panel h2,.claim-section h2,.membership-list h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:40px;text-transform:uppercase;margin:8px 0}.club-portal-panel form{display:grid;gap:13px}.club-portal-panel label{display:grid;gap:6px;font-size:12px;font-weight:900;text-transform:uppercase}.club-portal-panel input,.club-portal-panel textarea{width:100%;box-sizing:border-box;border:1px solid #ccd5de;border-radius:10px;padding:13px;font:inherit}.club-portal-panel textarea{min-height:100px}.club-portal-panel form>button{min-height:48px;border:0;border-radius:10px;background:#111318;color:#fff;font-weight:900;text-transform:uppercase}.text-button{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:12px;border:0;background:none;font-weight:800}.notice,.error{padding:12px;border-radius:9px;margin:12px 0}.notice{background:#e8f7ff}.error{background:#fff0f0;color:#b42318}.account-bar{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e9ed;padding-bottom:18px}.account-bar span{display:block;color:#7a8592;font-size:10px;text-transform:uppercase}.account-bar button{display:flex;gap:6px;border:1px solid #dce2e8;border-radius:999px;background:#fff;padding:9px 12px}.membership-list{margin-top:20px}.membership-list article{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;border:1px solid #e1e6eb;border-radius:12px;padding:13px;margin-top:10px}.membership-list article span,.membership-list article strong,.membership-list article small{display:block}.membership-list article span{color:#0783c9;font-size:9px;font-weight:900;text-transform:uppercase}.membership-list article a{display:flex;gap:5px;color:#111;text-decoration:none;font-weight:900}.claim-section{margin-top:26px;border-top:1px solid #e2e7eb;padding-top:24px}.claim-section>p{color:#687385}.search-field{position:relative}.search-field svg{position:absolute;left:13px;top:14px}.search-field input{padding-left:40px}.club-results{border:1px solid #dde3e8;border-radius:10px;overflow:hidden}.club-results button{display:block;width:100%;padding:12px;border:0;border-bottom:1px solid #e5e9ed;background:#fff;text-align:left}.club-results button:last-child{border-bottom:0}.club-results strong,.club-results small,.selected-club strong,.selected-club small{display:block}.club-results small,.selected-club small{color:#687385}.selected-club{padding:13px;border-radius:10px;background:#eef8ff}.claim-form{margin-top:14px}.loading{text-align:center;padding:30px;color:#687385}@media(max-width:900px){.club-portal-page{grid-template-columns:1fr;gap:30px}}@media(max-width:520px){.club-portal-page{padding:24px 12px}.club-portal-panel{padding:20px}.membership-list article{grid-template-columns:auto 1fr}.membership-list article>a,.membership-list article>b{grid-column:1/-1}.account-bar{align-items:flex-start;flex-direction:column;gap:10px}}
`
