import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, ImageUp } from 'lucide-react'
import { getKey } from '../lib/admin'
import { sponsorAdmin, type SponsorRecord, type SponsorshipRecord } from '../lib/sponsorAdmin'

const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d8e0e7', borderRadius: 10, background: '#fff', padding: '11px 12px', font: 'inherit' }
const button: CSSProperties = { border: 0, borderRadius: 999, background: '#42b8ff', color: '#050505', padding: '12px 18px', fontWeight: 950, textTransform: 'uppercase', cursor: 'pointer' }

export default function AdminPlayerSponsors() {
  const { playerId = '' } = useParams()
  const [params] = useSearchParams()
  const playerName = params.get('name') || 'Player'
  const [sponsors, setSponsors] = useState<SponsorRecord[]>([])
  const [deals, setDeals] = useState<SponsorshipRecord[]>([])
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
    const response = await fetch(path, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${getKey()}` }, body: body == null ? undefined : JSON.stringify(body) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error((payload as { error?: string }).error || `HTTP ${response.status}`)
    return payload as T
  }

  const load = async () => {
    const [sponsorRows, dealPayload] = await Promise.all([
      sponsorAdmin.listSponsors(),
      request<{ data?: SponsorshipRecord[] }>('GET', `/api/players/${encodeURIComponent(playerId)}/sponsors?all=true`),
    ])
    setSponsors(sponsorRows)
    setDeals(Array.isArray(dealPayload.data) ? dealPayload.data : [])
  }

  useEffect(() => { void load().catch(error => setMessage(error instanceof Error ? error.message : String(error))) }, [playerId])
  useEffect(() => { if (selectedSponsor) setWebsiteUrl(selectedSponsor.websiteUrl ?? '') }, [selectedSponsor?.id])

  const save = async () => {
    setBusy(true); setMessage('Saving player sponsor…')
    try {
      let sponsor = selectedSponsor
      if (!sponsor) {
        if (!name.trim()) throw new Error('Enter a sponsor name or choose an existing sponsor.')
        sponsor = await sponsorAdmin.createSponsor({ name: name.trim(), businessName: name.trim(), websiteUrl: websiteUrl.trim() || null, status: 'ACTIVE' })
      } else if (websiteUrl.trim() !== (sponsor.websiteUrl ?? '')) {
        sponsor = await sponsorAdmin.updateSponsor(sponsor.id, { websiteUrl: websiteUrl.trim() || null })
      }
      if (file) {
        if (!file.type.startsWith('image/')) throw new Error('Sponsor logo must be an image.')
        if (file.size > 5 * 1024 * 1024) throw new Error('Sponsor logo must be 5 MB or smaller.')
        sponsor = await sponsorAdmin.uploadSponsorLogo(sponsor.id, { fileName: file.name, contentType: file.type, dataUrl: await readDataUrl(file) })
      }
      const deal = await sponsorAdmin.createSponsorship({ sponsorId: sponsor.id, scope: 'PLAYER', playerId, package: 'PLAYER_PARTNER', tier: 'Player partner', bannerPosition: 'PLAYER_CARDS', displayPriority: 100, startDate: startDate || undefined, endDate: endDate || undefined, ctaLabel: 'Visit sponsor', ctaUrl: websiteUrl.trim() || sponsor.websiteUrl || undefined, notes: `Player sponsor for ${playerName}` })
      await sponsorAdmin.setSponsorshipStatus(deal.id, 'ACTIVE', 'Activated through player admin')
      await load()
      setMessage(`${sponsor.name} now follows ${playerName} on player cards.`)
      setName(''); setFile(null)
      const fileInput = document.getElementById('player-sponsor-logo') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  const remove = async (deal: SponsorshipRecord) => {
    setBusy(true)
    try { await sponsorAdmin.archiveSponsorship(deal.id); await load(); setMessage('Player sponsor removed.') }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  if (!getKey()) return <main className="psa"><section className="psa-card"><h1>Admin key required</h1><Link to="/admin">Return to Control Centre</Link></section><style>{styles}</style></main>

  return <main className="psa">
    <header className="psa-top"><Link to="/admin"><ArrowLeft size={17}/> Player admin</Link><a href={`/player/${encodeURIComponent(playerId)}`} target="_blank" rel="noreferrer">Public profile <ExternalLink size={16}/></a></header>
    <section className="psa-hero"><small>PLAYER COMMERCIAL PARTNER</small><h1>{playerName}</h1><p>The active sponsor follows this player automatically onto MVP, goal-kicker and other player cards wherever the player appears.</p></section>
    <section className="psa-grid">
      <div className="psa-card psa-form"><h2>Add player sponsor</h2>
        <label><span>Existing sponsor</span><select style={input} value={sponsorId} onChange={event => setSponsorId(event.target.value)}><option value="">Create a new sponsor</option>{sponsors.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        {!selectedSponsor && <label><span>Sponsor name</span><input style={input} value={name} onChange={event => setName(event.target.value)} /></label>}
        <label><span>Sponsor website</span><input style={input} value={websiteUrl} onChange={event => setWebsiteUrl(event.target.value)} placeholder="https://" /></label>
        <label><span>Sponsor logo</span><input id="player-sponsor-logo" style={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
        <div className="psa-dates"><label><span>Start date</span><input style={input} type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label><span>End date</span><input style={input} type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label></div>
        <button style={button} disabled={busy} onClick={() => void save()}><ImageUp size={17}/>{busy ? 'Saving…' : 'Upload and activate'}</button>{message && <p className="psa-message">{message}</p>}
      </div>
      <div className="psa-card"><h2>Current player sponsors</h2><div className="psa-list">{deals.map(deal => <article key={deal.id}><div className="psa-logo">{deal.sponsor?.logoUrl ? <img src={deal.sponsor.logoUrl} alt=""/> : <span>Logo</span>}</div><div><strong>{deal.sponsor?.name || 'Sponsor'}</strong><small>{deal.status}</small></div>{['ACTIVE','APPROVED','PAYMENT_COMPLETE','RENEWAL_DUE'].includes(deal.status) && <button disabled={busy} onClick={() => void remove(deal)}>Remove</button>}</article>)}</div>{deals.length === 0 && <p>No sponsor assigned. Player cards will keep the empty Sponsored by logo space.</p>}</div>
    </section><style>{styles}</style>
  </main>
}

function readDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? '')); reader.onerror = () => reject(reader.error ?? new Error('Logo could not be read')); reader.readAsDataURL(file) }) }
const styles = `.psa{min-height:100vh;background:#eef3f7;color:#111318;padding:20px 24px 60px;font-family:Barlow,Inter,Arial,sans-serif}.psa-top,.psa>section{width:min(1100px,100%);margin-left:auto;margin-right:auto}.psa-top{display:flex;justify-content:space-between;margin-bottom:18px}.psa-top a{display:inline-flex;align-items:center;gap:7px;color:#111318;text-decoration:none;font-weight:900;text-transform:uppercase;font-size:11px}.psa-hero{box-sizing:border-box;background:#050505;color:#fff;border-radius:18px;padding:34px}.psa-hero small,.psa-form label>span{color:#42b8ff;font-weight:950;letter-spacing:.15em;text-transform:uppercase;font-size:10px}.psa-hero h1,.psa-card h1,.psa-card h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.psa-hero h1{font-size:clamp(3.8rem,8vw,6.8rem);line-height:.84;margin:10px 0}.psa-hero p{color:#cad2db}.psa-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.psa-card{background:#fff;border:1px solid #dce3eb;border-radius:16px;padding:21px}.psa-card h2{font-size:34px;margin:0 0 16px}.psa-form{display:grid;gap:13px}.psa-form label{display:grid;gap:6px}.psa-dates{display:grid;grid-template-columns:1fr 1fr;gap:10px}.psa-form>button{display:inline-flex;justify-content:center;align-items:center;gap:8px}.psa-message{padding:11px;border-radius:10px;background:#edf8ff;font-weight:800}.psa-list article{display:grid;grid-template-columns:58px 1fr auto;align-items:center;gap:12px;padding:12px 0;border-top:1px solid #edf1f4}.psa-logo{width:56px;height:42px;display:grid;place-items:center;border:1px dashed #c4ccd5;border-radius:8px;overflow:hidden}.psa-logo img{max-width:100%;max-height:100%;object-fit:contain}.psa-list strong,.psa-list small{display:block}.psa-list small{color:#687385}.psa-list button{border:1px solid #d71920;border-radius:999px;background:#fff;color:#d71920;padding:8px 12px;font-weight:900}@media(max-width:760px){.psa{padding:14px 12px 45px}.psa-grid{grid-template-columns:1fr}.psa-dates{grid-template-columns:1fr}}`
