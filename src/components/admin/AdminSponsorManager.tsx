import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { getKey } from '../../lib/admin'
import { sponsorAdmin, type SponsorRecord, type SponsorshipRecord } from '../../lib/sponsorAdmin'

type EntityKind = 'club' | 'league'
type Target = { kind: EntityKind; id: string; name: string; host: HTMLElement }

const input: CSSProperties = { width: '100%', border: '1px solid #dce3eb', borderRadius: 12, padding: '12px 13px', font: 'inherit', background: '#fff', boxSizing: 'border-box' }
const primary: CSSProperties = { border: 0, borderRadius: 999, padding: '11px 17px', background: '#35b6ff', color: '#050505', fontWeight: 950, textTransform: 'uppercase', cursor: 'pointer' }
const dark: CSSProperties = { ...primary, background: '#050505', color: '#fff' }

const PACKAGES = [
  { value: 'MAJOR_PARTNER', label: 'Major partner', position: 'ALL_PROFILE_CONTENT', priority: 100 },
  { value: 'POWERED_BY', label: 'Powered by', position: 'POWERED_BY', priority: 80 },
  { value: 'FOOTBALL_PARTNER', label: 'Football partner', position: 'FIXTURES_RESULTS', priority: 60 },
  { value: 'PLAYER_PARTNER', label: 'Player partner', position: 'PLAYER_GOAL_CARDS', priority: 40 },
  { value: 'COMMUNITY_PARTNER', label: 'Community partner', position: 'SPONSOR_GRID', priority: 20 },
]

export default function AdminSponsorManager() {
  const { pathname } = useLocation()
  const [target, setTarget] = useState<Target | null>(null)
  const [sponsors, setSponsors] = useState<SponsorRecord[]>([])
  const [deals, setDeals] = useState<SponsorshipRecord[]>([])
  const [selectedSponsorId, setSelectedSponsorId] = useState('')
  const [newName, setNewName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [packageName, setPackageName] = useState('MAJOR_PARTNER')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (pathname !== '/admin' || !getKey()) { setTarget(null); return }
    let timer = 0
    const findEditor = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const link = document.querySelector<HTMLAnchorElement>('.editor .eh a[href^="/team/"], .editor .eh a[href^="/league/"]')
        const body = document.querySelector<HTMLElement>('.editor .eb')
        const title = document.querySelector<HTMLElement>('.editor .eh h2')
        if (!link || !body) { setTarget(current => current ? null : current); return }
        const match = link.getAttribute('href')?.match(/^\/(team|league)\/([^/?#]+)/)
        if (!match) return
        const kind: EntityKind = match[1] === 'team' ? 'club' : 'league'
        const id = decodeURIComponent(match[2])
        let host = body.querySelector<HTMLElement>(':scope > .admin-editor-sponsor-host')
        if (!host) { host = document.createElement('div'); host.className = 'admin-editor-sponsor-host'; body.append(host) }
        const name = title?.textContent?.trim() || (kind === 'club' ? 'Club' : 'League')
        setTarget(current => current?.kind === kind && current.id === id && current.host === host ? current : { kind, id, name, host })
      }, 100)
    }
    findEditor()
    const observer = new MutationObserver(findEditor)
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => { window.clearTimeout(timer); observer.disconnect() }
  }, [pathname])

  const load = async (activeTarget = target) => {
    if (!activeTarget) return
    const [sponsorRows, dealRows] = await Promise.all([
      sponsorAdmin.listSponsors(),
      sponsorAdmin.listEntitySponsorships(activeTarget.kind, activeTarget.id),
    ])
    setSponsors(sponsorRows)
    setDeals(dealRows)
  }

  useEffect(() => {
    if (!target) { setSponsors([]); setDeals([]); setMessage(''); return }
    let active = true
    void load(target).catch(error => { if (active) setMessage(error instanceof Error ? error.message : String(error)) })
    return () => { active = false }
  }, [target?.kind, target?.id])

  const selectedSponsor = useMemo(() => sponsors.find(item => item.id === selectedSponsorId) ?? null, [sponsors, selectedSponsorId])
  if (!target) return null

  const createOrSelectSponsor = async () => {
    if (selectedSponsorId) return sponsors.find(item => item.id === selectedSponsorId) ?? null
    if (!newName.trim()) throw new Error('Enter a sponsor name or select an existing sponsor.')
    const sponsor = await sponsorAdmin.createSponsor({ name: newName.trim(), businessName: newName.trim(), websiteUrl: websiteUrl.trim() || null, status: 'ACTIVE' })
    setSponsors(current => [sponsor, ...current])
    setSelectedSponsorId(sponsor.id)
    return sponsor
  }

  const uploadLogo = async (sponsor: SponsorRecord) => {
    if (!file) return sponsor
    if (!file.type.startsWith('image/')) throw new Error('Sponsor logo must be an image.')
    if (file.size > 5 * 1024 * 1024) throw new Error('Sponsor logo must be under 5 MB.')
    const dataUrl = await readDataUrl(file)
    return sponsorAdmin.uploadSponsorLogo(sponsor.id, { fileName: file.name, contentType: file.type, dataUrl })
  }

  const assign = async () => {
    setBusy(true); setMessage('Saving sponsor…')
    try {
      let sponsor = await createOrSelectSponsor()
      if (!sponsor) throw new Error('Sponsor could not be selected.')
      if (websiteUrl.trim() && sponsor.websiteUrl !== websiteUrl.trim()) sponsor = await sponsorAdmin.updateSponsor(sponsor.id, { websiteUrl: websiteUrl.trim() })
      sponsor = await uploadLogo(sponsor)
      const chosen = PACKAGES.find(item => item.value === packageName) ?? PACKAGES[0]
      const deal = await sponsorAdmin.createSponsorship({
        sponsorId: sponsor.id,
        scope: target.kind.toUpperCase(),
        ...(target.kind === 'club' ? { clubId: target.id } : { leagueId: target.id }),
        package: chosen.value,
        tier: chosen.label,
        bannerPosition: chosen.position,
        displayPriority: chosen.priority,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ctaLabel: 'Visit sponsor',
        ctaUrl: sponsor.websiteUrl || undefined,
        notes: `${chosen.label} assigned through the ${target.kind} editor.`,
      })
      await sponsorAdmin.setSponsorshipStatus(deal.id, 'ACTIVE', 'Activated through profile editor')
      await load()
      setNewName(''); setWebsiteUrl(''); setFile(null); setStartDate(''); setEndDate('')
      const fileInput = document.getElementById(`admin-sponsor-file-${target.kind}-${target.id}`) as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
      setMessage('Sponsor assigned and active on the public profile.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  const changeStatus = async (deal: SponsorshipRecord, status: 'ACTIVE' | 'CANCELLED') => {
    setBusy(true)
    try {
      if (status === 'CANCELLED') await sponsorAdmin.archiveSponsorship(deal.id)
      else await sponsorAdmin.setSponsorshipStatus(deal.id, status, 'Updated through profile editor')
      await load(); setMessage(status === 'ACTIVE' ? 'Sponsor activated.' : 'Sponsor removed from this profile.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }

  return createPortal(<section className="admin-sponsor-card">
    <div className="admin-sponsor-heading"><div><small>COMMERCIAL PARTNERS</small><h3>Sponsors</h3><p>Create or select a sponsor, upload its logo and assign it directly to this {target.kind}.</p></div><span>{deals.filter(deal => ['ACTIVE','APPROVED','PAYMENT_COMPLETE','RENEWAL_DUE'].includes(deal.status)).length} active</span></div>

    {deals.length > 0 && <div className="admin-sponsor-current">{deals.map(deal => <article key={deal.id}>
      <div className="admin-sponsor-logo">{deal.sponsor?.logoUrl ? <img src={deal.sponsor.logoUrl} alt="" /> : <strong>{deal.sponsor?.name?.slice(0,2).toUpperCase() || 'SP'}</strong>}</div>
      <div><strong>{deal.sponsor?.name || 'Unknown sponsor'}</strong><small>{deal.tier || deal.package || 'Partner'} · {deal.status}</small></div>
      {['ACTIVE','APPROVED','PAYMENT_COMPLETE','RENEWAL_DUE'].includes(deal.status) ? <button disabled={busy} onClick={() => void changeStatus(deal, 'CANCELLED')}>Remove</button> : <button disabled={busy} onClick={() => void changeStatus(deal, 'ACTIVE')}>Activate</button>}
    </article>)}</div>}

    <div className="admin-sponsor-form">
      <label><span>Existing sponsor</span><select style={input} value={selectedSponsorId} onChange={event => { setSelectedSponsorId(event.target.value); const sponsor = sponsors.find(item => item.id === event.target.value); setWebsiteUrl(sponsor?.websiteUrl ?? '') }}><option value="">Create a new sponsor</option>{sponsors.map(sponsor => <option key={sponsor.id} value={sponsor.id}>{sponsor.name}</option>)}</select></label>
      {!selectedSponsor && <label><span>Sponsor name</span><input style={input} value={newName} onChange={event => setNewName(event.target.value)} placeholder="Business or sponsor name" /></label>}
      <label><span>Website</span><input style={input} value={websiteUrl} onChange={event => setWebsiteUrl(event.target.value)} placeholder="https://" /></label>
      <label><span>Package</span><select style={input} value={packageName} onChange={event => setPackageName(event.target.value)}>{PACKAGES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label><span>Start date</span><input style={input} type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
      <label><span>End date</span><input style={input} type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
      <label className="wide"><span>Sponsor logo</span><input id={`admin-sponsor-file-${target.kind}-${target.id}`} style={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
    </div>
    <div className="admin-sponsor-note"><strong>Major partner coverage</strong><span>The major partner becomes the featured “Brought to you by” sponsor on this profile. Card-by-card sponsor propagation uses the package metadata added here and can be expanded without re-entering the sponsor.</span></div>
    {message && <div className="admin-sponsor-message">{message}</div>}
    <div className="admin-sponsor-actions"><button style={primary} disabled={busy} onClick={() => void assign()}>{busy ? 'Working…' : 'Assign sponsor'}</button><a style={{ ...dark, textDecoration: 'none' }} href={`/${target.kind === 'club' ? 'team' : 'league'}/${target.id}`} target="_blank" rel="noreferrer">Preview profile</a></div>
    <style>{`
      .admin-editor-sponsor-host{grid-column:1/-1}.admin-sponsor-card{display:grid;gap:16px;padding:20px;border:1px solid #dce3eb;border-radius:18px;background:#f7f9fb}.admin-sponsor-heading{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.admin-sponsor-heading small,.admin-sponsor-form label>span{display:block;color:#168fd4;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.admin-sponsor-heading h3{margin:5px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;line-height:1;text-transform:uppercase}.admin-sponsor-heading p{margin:0;color:#687385}.admin-sponsor-heading>span{border-radius:999px;background:#050505;color:#fff;padding:8px 12px;font-size:11px;font-weight:950;text-transform:uppercase}.admin-sponsor-current{display:grid;gap:8px}.admin-sponsor-current article{display:grid;grid-template-columns:48px 1fr auto;align-items:center;gap:12px;padding:11px;border:1px solid #e0e6ec;border-radius:13px;background:#fff}.admin-sponsor-logo{width:48px;height:48px;border-radius:10px;background:#f0f4f7;display:grid;place-items:center;overflow:hidden}.admin-sponsor-logo img{width:100%;height:100%;object-fit:contain}.admin-sponsor-current strong,.admin-sponsor-current small{display:block}.admin-sponsor-current small{color:#687385;margin-top:3px}.admin-sponsor-current button{border:1px solid #d71920;border-radius:999px;background:#fff;color:#d71920;padding:8px 12px;font-weight:900;text-transform:uppercase}.admin-sponsor-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.admin-sponsor-form label{display:grid;gap:6px}.admin-sponsor-form .wide{grid-column:1/-1}.admin-sponsor-note{display:grid;gap:4px;padding:13px;border-radius:12px;background:#eef8ff;color:#174a68}.admin-sponsor-note span{font-size:13px;line-height:1.45}.admin-sponsor-message{padding:11px 13px;border-radius:11px;background:#fff3cd;color:#664d03;font-weight:800}.admin-sponsor-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}@media(max-width:680px){.admin-sponsor-heading{display:grid}.admin-sponsor-form{grid-template-columns:1fr}.admin-sponsor-form .wide{grid-column:auto}.admin-sponsor-current article{grid-template-columns:44px 1fr}.admin-sponsor-current article button{grid-column:1/-1}}
    `}</style>
  </section>, target.host)
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the sponsor logo.'))
    reader.readAsDataURL(file)
  })
}
