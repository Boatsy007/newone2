import { useEffect, useState } from 'react'
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react'

 type PublicLeagueInfo = {
  id: string
  name: string
  description?: string | null
  websiteUrl?: string | null
  facebookUrl?: string | null
  instagramUrl?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  state?: string | null
 }

export default function LeaguePublicInformation({ leagueId }: { leagueId: string }) {
  const [info, setInfo] = useState<PublicLeagueInfo | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/league-portal/leagues/${encodeURIComponent(leagueId)}/public-profile`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then((payload: { data?: PublicLeagueInfo }) => { if (active) setInfo(payload.data ?? null) })
      .catch(() => { if (active) setInfo(null) })
    return () => { active = false }
  }, [leagueId])

  if (!info) return null
  const links = [
    info.websiteUrl && { label: 'Website', href: info.websiteUrl },
    info.facebookUrl && { label: 'Facebook', href: info.facebookUrl },
    info.instagramUrl && { label: 'Instagram', href: info.instagramUrl },
  ].filter(Boolean) as { label: string; href: string }[]
  const hasContact = Boolean(info.contactEmail || info.contactPhone)
  if (!info.description && !hasContact && !links.length) return null

  return <section className="league-public-info">
    <header><span>League information</span><h2>About & contact</h2></header>
    {info.description && <p className="league-public-description">{info.description}</p>}
    <div className="league-public-info-grid">
      {info.state && <Info icon={<MapPin size={17}/>} label="State" value={info.state}/>} 
      {info.contactEmail && <Info icon={<Mail size={17}/>} label="Email" value={info.contactEmail} href={`mailto:${info.contactEmail}`}/>} 
      {info.contactPhone && <Info icon={<Phone size={17}/>} label="Phone" value={info.contactPhone} href={`tel:${info.contactPhone.replace(/\s/g, '')}`}/>} 
      {links.map(link => <Info key={link.label} icon={<ExternalLink size={17}/>} label={link.label} value={`Open ${link.label}`} href={link.href}/>) }
    </div>
    <style>{`
      .league-public-info{overflow:hidden;border:1px solid #e0e5ea;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(17,24,39,.055);padding:24px}
      .league-public-info>header span{display:block;color:#209fe9;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase}
      .league-public-info>header h2{margin:5px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;line-height:.9;text-transform:uppercase}
      .league-public-description{margin:18px 0 0;color:#46515f;font-size:15px;line-height:1.7;white-space:pre-line}
      .league-public-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}
      .league-public-info-item{display:flex;align-items:center;gap:11px;min-width:0;padding:14px;border:1px solid #e5eaee;border-radius:10px;background:#f8fafb;color:#111318;text-decoration:none}
      .league-public-info-item>svg{flex:0 0 auto;color:#209fe9}.league-public-info-item span{display:block;color:#687385;font-size:9px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.league-public-info-item strong{display:block;margin-top:3px;overflow-wrap:anywhere;font-size:13px}
      @media(max-width:640px){.league-public-info{padding:20px 18px}.league-public-info-grid{grid-template-columns:1fr}}
    `}</style>
  </section>
}

function Info({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const body = <>{icon}<div><span>{label}</span><strong>{value}</strong></div></>
  return href ? <a className="league-public-info-item" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined}>{body}</a> : <div className="league-public-info-item">{body}</div>
}
