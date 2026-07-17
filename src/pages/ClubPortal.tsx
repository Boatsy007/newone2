import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'

type ClubPortalSession = {
  club: { id: string; name: string; logoUrl?: string | null }
  profile: Record<string, unknown>
  access: { email: string; expiresAt: string }
}

type PortalField = {
  key: string
  label: string
  inputType: 'text' | 'email' | 'url' | 'textarea'
}

const PORTAL_FIELDS: PortalField[] = [
  { key: 'history', label: 'Club bio', inputType: 'textarea' },
  { key: 'president', label: 'President', inputType: 'text' },
  { key: 'secretary', label: 'Secretary', inputType: 'text' },
  { key: 'email', label: 'Club email', inputType: 'email' },
  { key: 'phone', label: 'Phone', inputType: 'text' },
  { key: 'ground', label: 'Home ground', inputType: 'text' },
  { key: 'address', label: 'Address', inputType: 'text' },
  { key: 'trainingNights', label: 'Training nights', inputType: 'text' },
  { key: 'clubColours', label: 'Club colours', inputType: 'text' },
  { key: 'websiteUrl', label: 'Website', inputType: 'url' },
  { key: 'facebookUrl', label: 'Facebook', inputType: 'url' },
  { key: 'instagramUrl', label: 'Instagram', inputType: 'url' },
  { key: 'membershipLink', label: 'Membership link', inputType: 'url' },
  { key: 'volunteerLink', label: 'Volunteer link', inputType: 'url' },
]

export default function ClubPortal() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [session, setSession] = useState<ClubPortalSession | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setMessage('This club access link is missing.')
      setLoading(false)
      return
    }
    fetch(`/api/club-portal/session?token=${encodeURIComponent(token)}`)
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error ?? 'Unable to open club portal')
        return json.data as ClubPortalSession
      })
      .then(data => {
        setSession(data)
        const next: Record<string, string> = {}
        for (const field of PORTAL_FIELDS) next[field.key] = String(data.profile[field.key] ?? '')
        setForm(next)
      })
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false))
  }, [token])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    const response = await fetch('/api/club-portal/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, profile: form }),
    })
    const json = await response.json().catch(() => ({})) as { error?: string }
    setMessage(response.ok ? 'Club profile saved. Changes are now available on the public club page.' : json.error ?? 'Unable to save profile')
  }

  return (
    <>
      <Nav />
      <main className="club-portal-page">
        <div className="club-portal-shell">
          {loading && <div className="portal-card">Loading club portal…</div>}
          {!loading && !session && (
            <div className="portal-card">
              <h1>Club access unavailable</h1>
              <p>{message}</p>
              <Link to="/">Return home</Link>
            </div>
          )}
          {!loading && session && (
            <>
              <header className="portal-hero">
                {session.club.logoUrl && <img src={session.club.logoUrl} alt="" />}
                <div>
                  <span>Verified club manager</span>
                  <h1>{session.club.name}</h1>
                  <p>Update public club information without changing rankings, fixtures, results, ladders or imported data.</p>
                </div>
              </header>
              {message && <div className="portal-message">{message}</div>}
              <form className="portal-card portal-form" onSubmit={save}>
                <div className="portal-heading">
                  <div><span>Public profile</span><h2>Club information</h2></div>
                  <small>Access expires {new Date(session.access.expiresAt).toLocaleDateString('en-AU')}</small>
                </div>
                <div className="portal-grid">
                  {PORTAL_FIELDS.map(field => (
                    <label key={field.key} className={field.inputType === 'textarea' ? 'wide' : ''}>
                      {field.label}
                      {field.inputType === 'textarea' ? (
                        <textarea rows={6} value={form[field.key] ?? ''} onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))} />
                      ) : (
                        <input type={field.inputType} value={form[field.key] ?? ''} onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))} />
                      )}
                    </label>
                  ))}
                </div>
                <button type="submit">Save club profile</button>
              </form>
            </>
          )}
        </div>
      </main>
      <Footer />
      <style>{`
        .club-portal-page{background:#f3f5f7;min-height:70vh;padding:42px 20px 70px;font-family:Barlow,Inter,Arial,sans-serif}
        .club-portal-shell{max-width:1050px;margin:auto}.portal-hero{display:flex;gap:22px;align-items:center;background:#050505;color:#fff;padding:30px;border-radius:12px;margin-bottom:18px}
        .portal-hero img{width:96px;height:96px;object-fit:contain}.portal-hero span,.portal-heading span{color:#42b8ff;font-weight:900;text-transform:uppercase;font-size:11px;letter-spacing:.15em}
        .portal-hero h1,.portal-heading h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;margin:5px 0;line-height:.9}.portal-hero h1{font-size:clamp(2.8rem,6vw,5.6rem)}
        .portal-hero p{color:#cbd3dc;margin:8px 0 0}.portal-card{background:#fff;border:1px solid #dfe5eb;border-radius:12px;padding:26px;box-shadow:0 8px 24px rgba(17,24,39,.06)}
        .portal-message{padding:13px 16px;margin-bottom:16px;background:#e8f7ff;border:1px solid #b8e5ff;border-radius:9px;font-weight:800}.portal-heading{display:flex;justify-content:space-between;align-items:end;gap:20px;margin-bottom:20px}
        .portal-heading h2{font-size:42px}.portal-heading small{color:#687385}.portal-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.portal-grid label{display:grid;gap:7px;font-weight:850}
        .portal-grid .wide{grid-column:1/-1}.portal-grid input,.portal-grid textarea{width:100%;box-sizing:border-box;border:1px solid #dce2e8;border-radius:8px;padding:12px;font:inherit}
        .portal-form>button{margin-top:20px;border:0;border-radius:7px;background:#42b8ff;color:#050505;padding:14px 20px;font-weight:950;text-transform:uppercase;cursor:pointer}
        @media(max-width:700px){.club-portal-page{padding:20px 12px 45px}.portal-hero{align-items:flex-start}.portal-hero img{width:70px;height:70px}.portal-grid{grid-template-columns:1fr}.portal-grid .wide{grid-column:auto}.portal-heading{display:block}}
      `}</style>
    </>
  )
}
