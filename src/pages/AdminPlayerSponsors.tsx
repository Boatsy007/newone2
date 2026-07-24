import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, ImageUp, Save } from 'lucide-react'
import { getKey } from '../lib/admin'
import { sponsorAdmin, type SponsorRecord, type SponsorshipRecord } from '../lib/sponsorAdmin'

type PlayerDetails = {
  bio: string | null
  primaryPosition: string | null
  secondaryPosition: string | null
  gamesPlayed: number | null
  jumperNumber: number | null
  photoUrl: string | null
}

type PlayerProfile = {
  id: string
  playerId: string
  playerName: string
  clubId: string | null
  clubName: string
  clubLogoUrl?: string | null
  leagueId: string | null
  leagueName: string
  state?: string | null
  season: string
  grade: string | null
  matches: number | null
  goals: number
  details: PlayerDetails | null
}

const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d8e0e7', borderRadius: 10, background: '#fff', padding: '11px 12px', font: 'inherit' }
const button: CSSProperties = { border: 0, borderRadius: 999, background: '#42b8ff', color: '#050505', padding: '12px 18px', fontWeight: 950, textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }

export default function AdminPlayerSponsors() {
  const { playerId = '' } = useParams()
  const [params] = useSearchParams()
  const fallbackName = params.get('name') || 'Player'
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [form, setForm] = useState({ bio: '', primaryPosition: '', secondaryPosition: '', gamesPlayed: '', jumperNumber: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [sponsors, setSponsors] = useState<SponsorRecord[]>([])
  const [deals, setDeals] = useState<SponsorshipRecord[]>([])
  const [sponsorId, setSponsorId] = useState('')
  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [sponsorFile, setSponsorFile] = useState<File | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const selectedSponsor = useMemo(() => sponsors.find(row => row.id === sponsorId) ?? null, [sponsors, sponsorId])

  const request = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetch(path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${getKey()}` }, body: body == null ? undefined : JSON.stringify(body) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error((payload as { error?: string }).error || `HTTP ${response.status}`)
    return payload as T
  }

  const load = async () => {
    const [profilePayload, sponsorRows, dealPayload] = await Promise.all([
      request<{ data: PlayerProfile }>('GET', `/admin/players/${encodeURIComponent(playerId)}`),
      sponsorAdmin.listSponsors(),
      request<{ data?: SponsorshipRecord[] }>('GET', `/api/players/${encodeURIComponent(playerId)}/sponsors?all=true`),
    ])
    const next = profilePayload.data
    setProfile(next)
    setForm({
      bio: next.details?.bio ?? '',
      primaryPosition: next.details?.primaryPosition ?? '',
      secondaryPosition: next.details?.secondaryPosition ?? '',
      gamesPlayed: next.details?.gamesPlayed == null ? '' : String(next.details.gamesPlayed),
      jumperNumber: next.details?.jumperNumber == null ? '' : String(next.details.jumperNumber),
    })
    setSponsors(sponsorRows)
    setDeals(Array.isArray(dealPayload.data) ? dealPayload.data : [])
  }

  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : String(error))) }, [playerId])
  useEffect(() => { if (selectedSponsor) setWebsiteUrl(selectedSponsor.websiteUrl ?? '') }, [selectedSponsor?.id])

  const saveProfile = async () => {
    setBusy(true); setMessage('Saving player profile…')
    try {
      const details = await request<{ data: PlayerDetails }>('PATCH', `/admin/players/${encodeURIComponent(playerId)}`, form)
      setProfile(current => current ? { ...current, details: details.data } : current)
      setMessage('Player profile saved.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  const uploadPhoto = async () => {
    if (!photo) { setMessage('Choose a player photo first.'); return }
    setBusy(true); setMessage('Uploading player photo…')
    try {
      if (!photo.type.startsWith('image/')) throw new Error('Player photo must be an image.')
      if (photo.size > 6 * 1024 * 1024) throw new Error('Player photo must be 6 MB or smaller.')
      const result = await request<{ data: PlayerDetails }>('POST', `/admin/players/${encodeURIComponent(playerId)}/photo`, { fileName: photo.name, contentType: photo.type, dataUrl: await readDataUrl(photo) })
      setProfile(current => current ? { ...current, details: result.data } : current)
      setPhoto(null)
      const control = document.getElementById('player-profile-photo') as HTMLInputElement | null
      if (control) control.value = ''
      setMessage('Player photo uploaded.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  const saveSponsor = async () => {
    setBusy(true); setMessage('Saving player sponsor…')
    try {
      let sponsor = selectedSponsor
      if (!sponsor) {
        if (!name.trim()) throw new Error('Enter a sponsor name or choose an existing sponsor.')
        sponsor = await sponsorAdmin.createSponsor({ name: name.trim(), businessName: name.trim(), websiteUrl: websiteUrl.trim() || null, status: 'ACTIVE' })
      } else if (websiteUrl.trim() !== (sponsor.websiteUrl ?? '')) {
        sponsor = await sponsorAdmin.updateSponsor(sponsor.id, { websiteUrl: websiteUrl.trim() || null })
      }
      if (sponsorFile) {
        if (!sponsorFile.type.startsWith('image/')) throw new Error('Sponsor logo must be an image.')
        if (sponsorFile.size > 5 * 1024 * 1024) throw new Error('Sponsor logo must be 5 MB or smaller.')
        sponsor = await sponsorAdmin.uploadSponsorLogo(sponsor.id, { fileName: sponsorFile.name, contentType: sponsorFile.type, dataUrl: await readDataUrl(sponsorFile) })
      }
      const deal = await sponsorAdmin.createSponsorship({ sponsorId: sponsor.id, scope: 'PLAYER', playerId, package: 'PLAYER_PARTNER', tier: 'Player partner', bannerPosition: 'PLAYER_CARDS', displayPriority: 100, startDate: startDate || undefined, endDate: endDate || undefined, ctaLabel: 'Visit sponsor', ctaUrl: websiteUrl.trim() || sponsor.websiteUrl || undefined, notes: `Player sponsor for ${profile?.playerName ?? fallbackName}` })
      await sponsorAdmin.setSponsorshipStatus(deal.id, 'ACTIVE', 'Activated through player admin')
      await load()
      setMessage(`${sponsor.name} now follows this player on player cards.`)
      setName(''); setSponsorFile(null)
      const control = document.getElementById('player-sponsor-logo') as HTMLInputElement | null
      if (control) control.value = ''
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  const removeSponsor = async (deal: SponsorshipRecord) => {
    setBusy(true)
    try { await sponsorAdmin.archiveSponsorship(deal.id); await load(); setMessage('Player sponsor removed.') }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  if (!getKey()) return <main className="psa"><section className="psa-card"><h1>Admin key required</h1><Link to="/admin">Return to Control Centre</Link></section><style>{styles}</style></main>
  const playerName = profile?.playerName ?? fallbackName

  return <main className="psa">
    <header className="psa-top"><Link to="/admin"><ArrowLeft size={17}/> Player admin</Link><a href={`/player/${encodeURIComponent(playerId)}`} target="_blank" rel="noreferrer">Public profile <ExternalLink size={16}/></a></header>
    <section className="psa-hero">
      <div className="psa-photo">{profile?.details?.photoUrl ? <img src={profile.details.photoUrl} alt={`${playerName} profile`} /> : <span>{playerName.slice(0, 1).toUpperCase()}</span>}</div>
      <div><small>PLAYER PROFILE EDITOR</small><h1>{playerName}</h1><p>{profile ? `${profile.clubName} · ${profile.leagueName} · ${profile.state ?? ''}` : 'Loading player profile…'}</p></div>
    </section>

    <section className="psa-grid">
      <div className="psa-card psa-form"><h2>Profile details</h2>
        <div className="psa-readonly"><span>Imported season</span><strong>{profile?.season ?? '—'} · {profile?.grade ?? 'Grade not provided'}</strong><span>Imported record</span><strong>{profile?.matches ?? '—'} matches · {profile?.goals ?? '—'} goals</strong></div>
        <label><span>Player bio</span><textarea style={{ ...input, minHeight: 130 }} value={form.bio} onChange={event => setForm(current => ({ ...current, bio: event.target.value }))} placeholder="Player background, strengths, achievements and football story" /></label>
        <div className="psa-dates"><label><span>Primary position</span><input style={input} value={form.primaryPosition} onChange={event => setForm(current => ({ ...current, primaryPosition: event.target.value }))} placeholder="e.g. Centre half forward" /></label><label><span>Secondary position</span><input style={input} value={form.secondaryPosition} onChange={event => setForm(current => ({ ...current, secondaryPosition: event.target.value }))} placeholder="e.g. Midfield" /></label></div>
        <div className="psa-dates"><label><span>Games played</span><input style={input} type="number" min="0" value={form.gamesPlayed} onChange={event => setForm(current => ({ ...current, gamesPlayed: event.target.value }))} /></label><label><span>Jumper number</span><input style={input} type="number" min="0" max="999" value={form.jumperNumber} onChange={event => setForm(current => ({ ...current, jumperNumber: event.target.value }))} /></label></div>
        <button style={button} disabled={busy} onClick={() => void saveProfile()}><Save size={17}/>{busy ? 'Saving…' : 'Save profile'}</button>
      </div>

      <div className="psa-card psa-form"><h2>Player photo</h2>
        <div className="psa-photo-preview">{profile?.details?.photoUrl ? <img src={profile.details.photoUrl} alt="" /> : <span>No player photo</span>}</div>
        <label><span>Upload photo</span><input id="player-profile-photo" style={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setPhoto(event.target.files?.[0] ?? null)} /></label>
        <button style={button} disabled={busy || !photo} onClick={() => void uploadPhoto()}><ImageUp size={17}/>{busy ? 'Uploading…' : 'Upload player photo'}</button>
      </div>

      <div className="psa-card psa-form"><h2>Assign player sponsor</h2>
        <label><span>Existing sponsor</span><select style={input} value={sponsorId} onChange={event => setSponsorId(event.target.value)}><option value="">Create a new sponsor</option>{sponsors.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        {!selectedSponsor && <label><span>Sponsor name</span><input style={input} value={name} onChange={event => setName(event.target.value)} /></label>}
        <label><span>Sponsor website</span><input style={input} value={websiteUrl} onChange={event => setWebsiteUrl(event.target.value)} placeholder="https://" /></label>
        <label><span>Sponsor logo</span><input id="player-sponsor-logo" style={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => setSponsorFile(event.target.files?.[0] ?? null)} /></label>
        <div className="psa-dates"><label><span>Start date</span><input style={input} type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label><span>End date</span><input style={input} type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label></div>
        <button style={button} disabled={busy} onClick={() => void saveSponsor()}><ImageUp size={17}/>{busy ? 'Saving…' : 'Upload and activate sponsor'}</button>
      </div>

      <div className="psa-card"><h2>Current player sponsors</h2><div className="psa-list">{deals.map(deal => <article key={deal.id}><div className="psa-logo">{deal.sponsor?.logoUrl ? <img src={deal.sponsor.logoUrl} alt=""/> : <span>Logo</span>}</div><div><strong>{deal.sponsor?.name || 'Sponsor'}</strong><small>{deal.status}</small></div>{['ACTIVE','APPROVED','PAYMENT_COMPLETE','RENEWAL_DUE'].includes(deal.status) && <button disabled={busy} onClick={() => void removeSponsor(deal)}>Remove</button>}</article>)}</div>{deals.length === 0 && <p>No sponsor assigned. Player cards retain their empty Sponsored by space.</p>}</div>
    </section>
    {message && <div className="psa-global-message">{message}</div>}
    <style>{styles}</style>
  </main>
}

function readDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? '')); reader.onerror = () => reject(reader.error ?? new Error('File could not be read')); reader.readAsDataURL(file) }) }
const styles = `.psa{min-height:100vh;background:#eef3f7;color:#111318;padding:20px 24px 80px;font-family:Barlow,Inter,Arial,sans-serif}.psa-top,.psa>section{width:min(1120px,100%);margin-left:auto;margin-right:auto}.psa-top{display:flex;justify-content:space-between;margin-bottom:18px}.psa-top a{display:inline-flex;align-items:center;gap:7px;color:#111318;text-decoration:none;font-weight:900;text-transform:uppercase;font-size:11px}.psa-hero{box-sizing:border-box;background:#050505;color:#fff;border-radius:18px;padding:34px;display:flex;align-items:center;gap:24px}.psa-photo{width:118px;height:118px;border-radius:18px;overflow:hidden;display:grid;place-items:center;background:#42b8ff;color:#050505;flex:0 0 auto}.psa-photo img,.psa-photo-preview img{width:100%;height:100%;object-fit:cover}.psa-photo span{font-family:'Bebas Neue',Impact,sans-serif;font-size:64px}.psa-hero small,.psa-form label>span{color:#42b8ff;font-weight:950;letter-spacing:.15em;text-transform:uppercase;font-size:10px}.psa-hero h1,.psa-card h1,.psa-card h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.psa-hero h1{font-size:clamp(3.8rem,8vw,6.8rem);line-height:.84;margin:10px 0}.psa-hero p{color:#cad2db;margin:0}.psa-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.psa-card{background:#fff;border:1px solid #dce3eb;border-radius:16px;padding:21px}.psa-card h2{font-size:34px;margin:0 0 16px}.psa-form{display:grid;gap:13px}.psa-form label{display:grid;gap:6px}.psa-dates{display:grid;grid-template-columns:1fr 1fr;gap:10px}.psa-readonly{display:grid;grid-template-columns:auto 1fr;gap:5px 13px;padding:13px;border-radius:11px;background:#f4f7f9}.psa-readonly span{font-size:10px;font-weight:900;text-transform:uppercase;color:#687385}.psa-photo-preview{height:260px;border:1px dashed #b9c4ce;border-radius:13px;display:grid;place-items:center;overflow:hidden;background:#f7f9fb;color:#687385;font-weight:900;text-transform:uppercase}.psa-list article{display:grid;grid-template-columns:58px 1fr auto;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #edf1f4}.psa-logo{width:56px;height:42px;display:grid;place-items:center;border:1px dashed #c4ccd5;border-radius:8px;overflow:hidden}.psa-logo img{max-width:100%;max-height:100%;object-fit:contain}.psa-list strong,.psa-list small{display:block}.psa-list small{color:#687385}.psa-list button{border:1px solid #d71920;border-radius:999px;background:#fff;color:#d71920;padding:8px 12px;font-weight:900}.psa-global-message{position:fixed;right:18px;bottom:18px;z-index:50;padding:13px 17px;border-radius:12px;background:#050505;color:#fff;font-weight:850;box-shadow:0 8px 30px #0004}@media(max-width:760px){.psa{padding:14px 12px 60px}.psa-grid{grid-template-columns:1fr}.psa-dates{grid-template-columns:1fr}.psa-hero{align-items:flex-start;padding:24px}.psa-photo{width:82px;height:82px}.psa-photo span{font-size:42px}}`
