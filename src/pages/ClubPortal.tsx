import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'

type ClubPortalProfile = {
  history?: string | null
  president?: string | null
  secretary?: string | null
  email?: string | null
  phone?: string | null
  ground?: string | null
  address?: string | null
  trainingNights?: string | null
  clubColours?: string | null
  websiteUrl?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  membershipLink?: string | null
  volunteerLink?: string | null
}

type ClubPortalSession = {
  club: { id: string; name: string; logoUrl?: string | null }
  profile: ClubPortalProfile
  access: { email: string; expiresAt: string }
}

const EMPTY_PROFILE: Required<Record<keyof ClubPortalProfile, string>> = {
  history: '',
  president: '',
  secretary: '',
  email: '',
  phone: '',
  ground: '',
  address: '',
  trainingNights: '',
  clubColours: '',
  websiteUrl: '',
  facebookUrl: '',
  instagramUrl: '',
  membershipLink: '',
  volunteerLink: '',
}

export default function ClubPortal() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [session, setSession] = useState<ClubPortalSession | null>(null)
  const [form, setForm] = useState({ ...EMPTY_PROFILE })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setMessage('This club access link is missing.')
      setLoading(false)
      return
    }

    void fetch(`/api/club-portal/session?token=${encodeURIComponent(token)}`)
      .then(async response => {
        const json = await response.json() as { data?: ClubPortalSession; error?: string }
        if (!response.ok || !json.data) throw new Error(json.error ?? 'Unable to open club portal')
        return json.data
      })
      .then(data => {
        setSession(data)
        setForm({
          history: data.profile.history ?? '',
          president: data.profile.president ?? '',
          secretary: data.profile.secretary ?? '',
          email: data.profile.email ?? '',
          phone: data.profile.phone ?? '',
          ground: data.profile.ground ?? '',
          address: data.profile.address ?? '',
          trainingNights: data.profile.trainingNights ?? '',
          clubColours: data.profile.clubColours ?? '',
          websiteUrl: data.profile.websiteUrl ?? '',
          facebookUrl: data.profile.facebookUrl ?? '',
          instagramUrl: data.profile.instagramUrl ?? '',
          membershipLink: data.profile.membershipLink ?? '',
          volunteerLink: data.profile.volunteerLink ?? '',
        })
      })
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false))
  }, [token])

  const setField = (field: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [field]: value }))
  }

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
                  <label className="wide">Club bio<textarea rows={6} value={form.history} onChange={event => setField('history', event.target.value)} /></label>
                  <label>President<input value={form.president} onChange={event => setField('president', event.target.value)} /></label>
                  <label>Secretary<input value={form.secretary} onChange={event => setField('secretary', event.target.value)} /></label>
                  <label>Club email<input type="email" value={form.email} onChange={event => setField('email', event.target.value)} /></label>
                  <label>Phone<input value={form.phone} onChange={event => setField('phone', event.target.value)} /></label>
                  <label>Home ground<input value={form.ground} onChange={event => setField('ground', event.target.value)} /></label>
                  <label>Address<input value={form.address} onChange={event => setField('address', event.target.value)} /></label>
                  <label>Training nights<input value={form.trainingNights} onChange={event => setField('trainingNights', event.target.value)} /></label>
                  <label>Club colours<input value={form.clubColours} onChange={event => setField('clubColours', event.target.value)} /></label>
                  <label>Website<input type="url" value={form.websiteUrl} onChange={event => setField('websiteUrl', event.target.value)} /></label>
                  <label>Facebook<input type="url" value={form.facebookUrl} onChange={event => setField('facebookUrl', event.target.value)} /></label>
                  <label>Instagram<input type="url" value={form.instagramUrl} onChange={event => setField('instagramUrl', event.target.value)} /></label>
                  <label>Membership link<input type="url" value={form.membershipLink} onChange={event => setField('membershipLink', event.target.value)} /></label>
                  <label>Volunteer link<input type="url" value={form.volunteerLink} onChange={event => setField('volunteerLink', event.target.value)} /></label>
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
