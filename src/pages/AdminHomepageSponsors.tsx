import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, ImageUp, RefreshCw } from 'lucide-react'
import { getKey } from '../lib/admin'
import { sponsorAdmin, type SponsorRecord, type SponsorshipRecord } from '../lib/sponsorAdmin'

type InventoryRow = {
  id: string
  placement: string
  label: string
  available: boolean
  activeSponsorshipId?: string | null
  sponsorship: (SponsorshipRecord & { sponsor: SponsorRecord | null }) | null
}

type PlacementOption = { value: string; label: string; description: string }

const PLACEMENTS: PlacementOption[] = [
  { value: 'HOMEPAGE_HERO', label: 'Hero card', description: 'The #1 club card inside the homepage hero.' },
  { value: 'HOMEPAGE_TOP_20', label: 'National Top 20 cards', description: 'The five featured national ranking cards.' },
  { value: 'HOMEPAGE_MVP', label: 'National MVP cards', description: 'Every player card in the National MVP section.' },
  { value: 'HOMEPAGE_GOAL_KICKERS', label: 'Goal kicker cards', description: 'The homepage goal-kicker leader cards.' },
  { value: 'HOMEPAGE_WEEKLY_RECORDS', label: 'This Week in Footy cards', description: 'All weekly record cards.' },
  { value: 'HOMEPAGE_YEARLY_RECORDS', label: 'Yearly Records cards', description: 'All yearly record cards.' },
  { value: 'HOMEPAGE_FEATURES', label: 'Homepage feature cards', description: 'The main news and fixtures feature cards.' },
  { value: 'HOMEPAGE_LATEST_NEWS', label: 'Latest News cards', description: 'The smaller latest-news links on the homepage.' },
]

const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d8e0e7', borderRadius: 10, background: '#fff', padding: '11px 12px', font: 'inherit' }
const button: CSSProperties = { border: 0, borderRadius: 999, background: '#42b8ff', color: '#050505', padding: '12px 18px', fontWeight: 950, textTransform: 'uppercase', cursor: 'pointer' }

export default function AdminHomepageSponsors() {
  const [sponsors, setSponsors] = useState<SponsorRecord[]>([])
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [placement, setPlacement] = useState(PLACEMENTS[0].value)
  const [sponsorId, setSponsorId] = useState('')
  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const selectedSponsor = useMemo(() => sponsors.find(row => row.id === sponsorId) ?? null, [sponsors, sponsorId])

  const request = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetch(path, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${getKey()}` },
      body: body == null ? undefined : JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error((payload as { error?: string }).error || `HTTP ${response.status}`)
    return payload as T
  }

  const load = async () => {
    await request('POST', '/api/commercial/sweep', { seed: true })
    const [sponsorRows, inventoryPayload] = await Promise.all([
      sponsorAdmin.listSponsors(),
      request<{ data?: InventoryRow[] }>('GET', '/api/commercial/inventory'),
    ])
    setSponsors(sponsorRows)
    setInventory(Array.isArray(inventoryPayload.data) ? inventoryPayload.data : [])
  }

  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : String(error))) }, [])

  useEffect(() => {
    if (!selectedSponsor) return
    setWebsiteUrl(selectedSponsor.websiteUrl ?? '')
  }, [selectedSponsor?.id])

  const createOrUpdateSponsor = async () => {
    let sponsor = selectedSponsor
    if (!sponsor) {
      if (!name.trim()) throw new Error('Enter a sponsor name or choose an existing sponsor.')
      sponsor = await sponsorAdmin.createSponsor({ name: name.trim(), businessName: name.trim(), websiteUrl: websiteUrl.trim() || null, status: 'ACTIVE' })
      setSponsors(current => [sponsor!, ...current])
      setSponsorId(sponsor.id)
    } else if (websiteUrl.trim() !== (sponsor.websiteUrl ?? '')) {
      sponsor = await sponsorAdmin.updateSponsor(sponsor.id, { websiteUrl: websiteUrl.trim() || null })
      setSponsors(current => current.map(row => row.id === sponsor!.id ? sponsor! : row))
    }

    if (file) {
      if (!file.type.startsWith('image/')) throw new Error('Sponsor logo must be an image.')
      if (file.size > 5 * 1024 * 1024) throw new Error('Sponsor logo must be 5 MB or smaller.')
      sponsor = await sponsorAdmin.uploadSponsorLogo(sponsor.id, { fileName: file.name, contentType: file.type, dataUrl: await readDataUrl(file) })
      setSponsors(current => current.map(row => row.id === sponsor!.id ? sponsor! : row))
    }
    return sponsor
  }

  const save = async () => {
    setBusy(true)
    setMessage('Saving homepage sponsor…')
    try {
      const sponsor = await createOrUpdateSponsor()
      const deal = await sponsorAdmin.createSponsorship({
        sponsorId: sponsor.id,
        scope: 'HOMEPAGE',
        package: placement,
        tier: 'Homepage card sponsor',
        bannerPosition: placement,
        displayPriority: 100,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ctaLabel: 'Visit sponsor',
        ctaUrl: websiteUrl.trim() || sponsor.websiteUrl || undefined,
        notes: `Homepage card sponsorship for ${placement}`,
      })
      await sponsorAdmin.setSponsorshipStatus(deal.id, 'ACTIVE', 'Activated through Homepage Sponsors admin')
      await load()
      const slot = (await request<{ data?: InventoryRow[] }>('GET', `/api/commercial/inventory?placement=${encodeURIComponent(placement)}`)).data?.[0]
      if (!slot) throw new Error('Homepage inventory slot could not be created.')
      if (slot.activeSponsorshipId) await request('POST', `/api/commercial/inventory/${slot.id}/release`)
      await request('POST', `/api/commercial/inventory/${slot.id}/book`, { sponsorshipId: deal.id, start: startDate || undefined, end: endDate || undefined })
      await load()
      setMessage(`${sponsor.name} is now shown on ${PLACEMENTS.find(row => row.value === placement)?.label}.`)
      setName('')
      setFile(null)
      const fileInput = document.getElementById('homepage-sponsor-logo') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const release = async (row: InventoryRow) => {
    setBusy(true)
    try {
      await request('POST', `/api/commercial/inventory/${row.id}/release`)
      await load()
      setMessage('Homepage sponsor removed. The Sponsored by placeholder remains visible.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  if (!getKey()) return <main className="hsa"><section className="hsa-card"><h1>Admin key required</h1><Link to="/admin">Return to Control Centre</Link></section><style>{styles}</style></main>

  return <main className="hsa">
    <header className="hsa-top"><Link to="/admin"><ArrowLeft size={17} /> Control Centre</Link><a href="/" target="_blank" rel="noreferrer">Preview homepage <ExternalLink size={16} /></a></header>
    <section className="hsa-hero"><small>COMMERCIAL</small><h1>Homepage sponsors</h1><p>Upload a sponsor logo, connect its website and assign it to every card in a homepage section. Unassigned cards keep a visible Sponsored by placeholder.</p></section>

    <section className="hsa-grid">
      <div className="hsa-card hsa-form">
        <h2>Assign sponsor</h2>
        <label><span>Homepage cards</span><select style={input} value={placement} onChange={event => setPlacement(event.target.value)}>{PLACEMENTS.map(row => <option key={row.value} value={row.value}>{row.label}</option>)}</select><small>{PLACEMENTS.find(row => row.value === placement)?.description}</small></label>
        <label><span>Existing sponsor</span><select style={input} value={sponsorId} onChange={event => { setSponsorId(event.target.value); if (!event.target.value) setWebsiteUrl('') }}><option value="">Create a new sponsor</option>{sponsors.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        {!selectedSponsor && <label><span>Sponsor name</span><input style={input} value={name} onChange={event => setName(event.target.value)} placeholder="Business name" /></label>}
        <label><span>Sponsor website</span><input style={input} value={websiteUrl} onChange={event => setWebsiteUrl(event.target.value)} placeholder="https://" /></label>
        <label><span>Sponsor logo</span><input id="homepage-sponsor-logo" style={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
        <div className="hsa-dates"><label><span>Start date</span><input style={input} type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label><span>End date</span><input style={input} type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label></div>
        <button style={button} disabled={busy} onClick={() => void save()}><ImageUp size={17} /> {busy ? 'Saving…' : 'Upload and activate'}</button>
        {message && <p className="hsa-message">{message}</p>}
      </div>

      <div className="hsa-card">
        <div className="hsa-card-head"><div><small>LIVE INVENTORY</small><h2>Homepage placements</h2></div><button disabled={busy} onClick={() => void load()}><RefreshCw size={16} /></button></div>
        <div className="hsa-list">{PLACEMENTS.map(option => {
          const row = inventory.find(item => item.placement === option.value)
          const sponsor = row?.sponsorship?.sponsor
          return <article key={option.value}><div className="hsa-logo">{sponsor?.logoUrl ? <img src={sponsor.logoUrl} alt="" /> : <span>Logo</span>}</div><div><strong>{option.label}</strong><small>{sponsor?.name || 'Available — placeholder showing'}</small></div>{row?.activeSponsorshipId ? <button disabled={busy} onClick={() => void release(row)}>Remove</button> : <em>Available</em>}</article>
        })}</div>
      </div>
    </section>
    <style>{styles}</style>
  </main>
}

function readDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? '')); reader.onerror = () => reject(reader.error ?? new Error('Logo could not be read')); reader.readAsDataURL(file) }) }

const styles = `.hsa{min-height:100vh;background:#eef3f7;color:#111318;padding:20px 24px 60px;font-family:Barlow,Inter,Arial,sans-serif}.hsa-top,.hsa>section{width:min(1180px,100%);margin-left:auto;margin-right:auto}.hsa-top{display:flex;justify-content:space-between;gap:15px;margin-bottom:18px}.hsa-top a{display:inline-flex;align-items:center;gap:7px;color:#111318;text-decoration:none;font-weight:900;text-transform:uppercase;font-size:11px}.hsa-hero{box-sizing:border-box;background:#050505;color:#fff;border-radius:18px;padding:34px}.hsa-hero small,.hsa-card label>span,.hsa-card-head>div>small{color:#42b8ff;font-weight:950;letter-spacing:.15em;text-transform:uppercase;font-size:10px}.hsa-hero h1,.hsa-card h1,.hsa-card h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.hsa-hero h1{font-size:clamp(3.8rem,8vw,6.8rem);line-height:.84;margin:10px 0}.hsa-hero p{max-width:760px;color:#cad2db;font-size:16px}.hsa-grid{display:grid;grid-template-columns:1fr 1.15fr;gap:18px;margin-top:18px}.hsa-card{background:#fff;border:1px solid #dce3eb;border-radius:16px;padding:21px;box-shadow:0 8px 24px rgba(17,24,39,.06)}.hsa-card h2{font-size:34px;margin:0 0 16px}.hsa-form{display:grid;gap:13px}.hsa-form label{display:grid;gap:6px}.hsa-form label small{color:#687385}.hsa-dates{display:grid;grid-template-columns:1fr 1fr;gap:10px}.hsa-form>button{display:inline-flex;justify-content:center;align-items:center;gap:8px}.hsa-message{margin:0;padding:11px;border-radius:10px;background:#edf8ff;color:#14516f;font-weight:800}.hsa-card-head{display:flex;align-items:start;justify-content:space-between;gap:12px}.hsa-card-head h2{margin:5px 0 0}.hsa-card-head>button{border:1px solid #dce3eb;background:#fff;border-radius:999px;width:38px;height:38px;display:grid;place-items:center}.hsa-list{display:grid;margin-top:14px}.hsa-list article{display:grid;grid-template-columns:58px minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #edf1f4}.hsa-logo{width:56px;height:42px;display:grid;place-items:center;border:1px dashed #c4ccd5;border-radius:8px;background:#f8fafb;color:#8a94a2;font-size:9px;font-weight:900;text-transform:uppercase;overflow:hidden}.hsa-logo img{width:100%;height:100%;object-fit:contain}.hsa-list strong,.hsa-list small{display:block}.hsa-list small{color:#687385;margin-top:3px}.hsa-list article>button{border:1px solid #d71920;border-radius:999px;background:#fff;color:#d71920;padding:8px 11px;font-weight:900;text-transform:uppercase}.hsa-list article>em{font-style:normal;color:#128a4a;font-size:10px;font-weight:950;text-transform:uppercase}@media(max-width:850px){.hsa{padding:15px 12px 45px}.hsa-grid{grid-template-columns:1fr}.hsa-hero{padding:27px 20px}.hsa-top{padding:0 4px}}@media(max-width:520px){.hsa-dates{grid-template-columns:1fr}.hsa-list article{grid-template-columns:50px 1fr}.hsa-list article>button,.hsa-list article>em{grid-column:1/-1;justify-self:start}}`
