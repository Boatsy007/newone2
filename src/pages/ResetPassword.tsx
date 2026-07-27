import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { recoveryTokenFromLocation, updatePortalPassword } from '../lib/portalAuth'

export default function ResetPassword() {
  const token = useMemo(() => recoveryTokenFromLocation(), [])
  const portal = useMemo(() => new URLSearchParams(window.location.search).get('portal') === 'league' ? 'league' : 'club', [])
  const loginPath = portal === 'league' ? '/league-portal' : '/club-portal'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (!token) return setError('This password-reset link is invalid or has expired. Request a new link from a portal login page.')
    if (password.length < 8) return setError('Your new password must be at least eight characters long.')
    if (password !== confirm) return setError('The passwords do not match.')
    setLoading(true)
    try {
      await updatePortalPassword(token, password)
      window.history.replaceState({}, document.title, `/reset-password?portal=${portal}`)
      setPassword(''); setConfirm('')
      setMessage(`Your password has been updated. Continue to the ${portal === 'league' ? 'League' : 'Club'} Portal to sign in.`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update your password') }
    finally { setLoading(false) }
  }

  return <><Nav/><main className="reset-page"><section className="reset-card"><div className="reset-icon"><KeyRound size={34}/></div><span>PlayFooty account security</span><h1>Reset password</h1><p>Choose a new password for your PlayFooty Club Portal and League Portal account.</p>{!token&&!message&&<div className="error" role="alert">This password-reset link is invalid or has expired. Request a new link from a portal login page.</div>}{error&&<div className="error" role="alert">{error}</div>}{message&&<div className="notice" role="status"><ShieldCheck size={18}/><span>{message}</span></div>}{!message&&<form onSubmit={submit}><label>New password<input type="password" value={password} onChange={event=>setPassword(event.target.value)} minLength={8} autoComplete="new-password" required/></label><label>Confirm new password<input type="password" value={confirm} onChange={event=>setConfirm(event.target.value)} minLength={8} autoComplete="new-password" required/></label><button disabled={loading||!token}>{loading?'Updating password…':'Update password'}</button></form>}<div className="portal-links"><Link className="primary" to={loginPath}>Continue to {portal === 'league' ? 'League' : 'Club'} Login</Link><Link to={portal === 'league' ? '/club-portal' : '/league-portal'}>Other portal</Link></div></section></main><Footer/><style>{styles}</style></>
}

const styles=`.reset-page{min-height:72vh;background:#eef3f7;padding:48px 16px;display:grid;place-items:start center;color:#111318}.reset-card{width:min(520px,100%);background:#fff;border:1px solid #dce3e9;border-radius:18px;box-shadow:0 18px 50px rgba(17,24,39,.1);padding:30px}.reset-icon{width:66px;height:66px;border-radius:16px;background:#e8f6ff;color:#087bbf;display:grid;place-items:center}.reset-card>span{display:block;color:#0783c9;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase;margin-top:20px}.reset-card h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:54px;line-height:.9;text-transform:uppercase;margin:8px 0}.reset-card>p{color:#5d6976;line-height:1.55}.reset-card form{display:grid;gap:14px;margin-top:22px}.reset-card label{display:grid;gap:7px;font-size:12px;font-weight:900;text-transform:uppercase}.reset-card input{width:100%;box-sizing:border-box;border:1px solid #cbd5df;border-radius:10px;padding:14px;font:inherit}.reset-card button{min-height:48px;border:0;border-radius:10px;background:#111318;color:#fff;font-weight:950;text-transform:uppercase}.reset-card button:disabled{opacity:.55}.error,.notice{padding:13px;border-radius:10px;margin:16px 0}.error{background:#feecec;color:#a31414}.notice{background:#eaf8f0;color:#17623b;display:flex;gap:9px;align-items:flex-start}.portal-links{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.portal-links a{text-align:center;padding:12px;border:1px solid #cfd8e1;border-radius:10px;color:#111318;text-decoration:none;font-weight:900}.portal-links a.primary{background:#2daaf5;border-color:#2daaf5}@media(max-width:520px){.reset-card{padding:22px}.reset-card h1{font-size:46px}.portal-links{grid-template-columns:1fr}}`
