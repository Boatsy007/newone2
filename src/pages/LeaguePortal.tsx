import { useMemo, useState } from 'react'
import { ArrowRight, Building2, LogOut, ShieldCheck, UserPlus } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { requestPortalPasswordReset, signInLeaguePortal, signUpPortal, type PortalAuthSession, type PortalLeagueAccount } from '../lib/portalAuth'

const SESSION_KEY = 'playfooty.leaguePortal.session.v1'

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

function openLeague(leagueId: string) {
  window.location.assign(`/league-portal/${encodeURIComponent(leagueId)}`)
}

export default function LeaguePortal() {
  const initial = useMemo(() => readSession(), [])
  const [session, setSession] = useState<PortalAuthSession | null>(initial)
  const [accounts, setAccounts] = useState<PortalLeagueAccount[]>(initial?.league_accounts ?? [])
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const hasInvite = Boolean(new URLSearchParams(window.location.search).get('invite'))

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const result = mode === 'signup'
        ? await signUpPortal(email, password)
        : await signInLeaguePortal(email, password)

      if (!result.access_token) {
        setMessage('Account created. Confirm your email, then sign in to open your league.')
        setMode('signin')
        return
      }

      saveSession(result)
      setSession(result)
      setAccounts(result.league_accounts ?? [])
      setPassword('')

      if ((result.league_accounts ?? []).length === 1) {
        openLeague(result.league_accounts![0].leagueId)
      } else if (!(result.league_accounts ?? []).length) {
        setError('This PlayFooty login is not linked to an active league. Contact PlayFooty for an invitation.')
      }
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
      await requestPortalPasswordReset(email, '/league-portal')
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
    setAccounts([])
    setMessage('You have signed out.')
  }

  return <><Nav/><main className="league-login">
    <section className="league-intro">
      <span>PlayFooty League Portal</span>
      <h1>Manage your league</h1>
      <p>Sign in with the PlayFooty login supplied to your league. Your linked league opens automatically.</p>
      <b><ShieldCheck size={18}/> League accounts are supplied by PlayFooty invitation</b>
    </section>

    <section className="league-panel">
      {!session ? <>
        <h2>{mode === 'signin' ? 'League sign in' : 'Create PlayFooty login'}</h2>
        {hasInvite && <p className="notice">Use the email address that received this league invitation.</p>}
        <form onSubmit={submitAuth}>
          <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required/></label>
          <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} required/></label>
          {error && <div className="error">{error}</div>}
          {message && <div className="notice">{message}</div>}
          <button disabled={loading}>{loading ? 'Please wait…' : mode === 'signin' ? 'Sign in and open league' : 'Create account'} <ArrowRight size={16}/></button>
        </form>
        {mode === 'signin' && <button className="switch" type="button" onClick={forgotPassword}>Forgot your password?</button>}
        <button className="switch" type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}><UserPlus size={16}/>{mode === 'signin' ? 'Create a PlayFooty login' : 'Already have an account? Sign in'}</button>
      </> : <>
        <div className="account"><div><span>Signed in as</span><strong>{session.user?.email || 'PlayFooty account'}</strong></div><button onClick={signOut}><LogOut size={16}/> Sign out</button></div>
        {error && <div className="error">{error}</div>}
        {message && <div className="notice">{message}</div>}
        {accounts.length > 0 ? <section className="memberships"><h2>{accounts.length === 1 ? 'Your league' : 'Choose a league'}</h2>{accounts.map(account => <button key={account.leagueId} type="button" onClick={() => openLeague(account.leagueId)}><span className="league-mark">{account.logoUrl ? <img src={account.logoUrl} alt=""/> : <Building2 size={25}/>}</span><span><small>{account.role.replaceAll('_', ' ')}</small><strong>{account.leagueName}</strong></span><ArrowRight size={18}/></button>)}</section> : <div className="empty"><Building2 size={30}/><h2>No linked league</h2><p>Contact PlayFooty to have this login connected to your league.</p></div>}
      </>}
    </section>
  </main><Footer/><style>{styles}</style></>
}

const styles = `.league-login{min-height:72vh;background:#eef3f7;padding:50px 20px;display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,540px);gap:60px;align-items:start}.league-intro>span{color:#0783c9;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.league-intro h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4rem,9vw,8rem);line-height:.82;text-transform:uppercase;margin:12px 0}.league-intro p{color:#526070;font-size:17px;max-width:720px;line-height:1.6}.league-intro b{display:inline-flex;align-items:center;gap:8px;margin-top:18px;padding:12px 16px;border-radius:999px;background:#fff;border:1px solid #d8e0e7}.league-panel{background:#fff;border:1px solid #dce3e9;border-radius:18px;box-shadow:0 18px 50px rgba(17,24,39,.1);padding:28px}.league-panel h2,.memberships h2,.empty h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:40px;text-transform:uppercase;margin:8px 0}.league-panel form{display:grid;gap:13px}.league-panel label{display:grid;gap:6px;font-size:12px;font-weight:900;text-transform:uppercase}.league-panel input{width:100%;box-sizing:border-box;border:1px solid #ccd5de;border-radius:10px;padding:13px;font:inherit}.league-panel form>button{min-height:48px;border:0;border-radius:10px;background:#111318;color:#fff;font-weight:900;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:8px}.switch{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;margin-top:12px;border:0;background:none;font-weight:900;padding:10px;color:#087bbf}.error,.notice{padding:12px;border-radius:10px;margin:10px 0}.error{background:#fff0f0;color:#a31414}.notice{background:#eaf7ff;color:#066aa1}.account{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #e1e7ec;padding-bottom:16px}.account span,.account strong{display:block}.account span{font-size:10px;text-transform:uppercase;color:#687385;font-weight:900}.account button{display:flex;align-items:center;gap:6px;border:0;background:#eef3f7;border-radius:999px;padding:9px 12px;font-weight:900}.memberships{display:grid;gap:10px;margin-top:20px}.memberships>button{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;text-align:left;border:1px solid #e0e6eb;border-radius:12px;padding:13px;background:#fff;color:#111}.league-mark{width:52px;height:52px;border-radius:12px;background:#eef3f7;display:grid;place-items:center;overflow:hidden}.league-mark img{width:100%;height:100%;object-fit:contain}.memberships small,.memberships strong{display:block}.memberships small{font-size:9px;color:#0783c9;font-weight:900;text-transform:uppercase}.memberships strong{font-size:16px;margin-top:3px}.empty{text-align:center;padding:35px 10px;color:#687385}.empty h2{color:#111}@media(max-width:850px){.league-login{grid-template-columns:1fr;gap:24px;padding:28px 14px}.league-intro h1{font-size:4.4rem}}@media(max-width:520px){.league-panel{padding:20px}.account{align-items:flex-start;flex-direction:column}}`
