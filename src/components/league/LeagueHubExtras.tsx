import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Play, Shield, Trophy } from 'lucide-react'
import type { LeagueDetail } from '../../lib/rankings'
import { getSupporterId } from '../../lib/supporter'

type RecordItem = { playerName?: string; clubName?: string; value?: number; goals?: number; label?: string; title?: string }
type Highlight = { id: string; playerName: string; clubName: string; leagueId: string | null; category: string; thumbnailUrl: string | null; videoUrl: string; votes: number; roundLabel: string | null }
type FeedItem = { id: string; title: string; body: string; href: string; createdAt: string; entityType: string; entityId: string; type: string }

export default function LeagueHubExtras({ league }: { league: LeagueDetail }) {
  const [records, setRecords] = useState<RecordItem[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [activity, setActivity] = useState<FeedItem[]>([])
  const [errors, setErrors] = useState({ records: false, highlights: false, activity: false })

  useEffect(() => {
    let active = true
    Promise.allSettled([
      fetch(`/api/records?period=season&league=${encodeURIComponent(league.id)}&limit=6`).then(r => r.ok ? r.json() : Promise.reject()).then((p: { data?: RecordItem[] }) => p.data ?? []),
      fetch('/api/highlights').then(r => r.ok ? r.json() : Promise.reject()).then((p: { data?: Highlight[] }) => (p.data ?? []).filter(item => item.leagueId === league.id).slice(0, 4)),
      fetch(`/api/follows/feed?supporterId=${encodeURIComponent(getSupporterId())}`).then(r => r.ok ? r.json() : Promise.reject()).then((p: { data?: FeedItem[] }) => (p.data ?? []).filter(item => item.entityType === 'LEAGUE' && item.entityId === league.id).slice(0, 6)),
    ]).then(results => {
      if (!active) return
      if (results[0].status === 'fulfilled') setRecords(results[0].value); else setErrors(value => ({ ...value, records: true }))
      if (results[1].status === 'fulfilled') setHighlights(results[1].value); else setErrors(value => ({ ...value, highlights: true }))
      if (results[2].status === 'fulfilled') setActivity(results[2].value); else setErrors(value => ({ ...value, activity: true }))
    })
    return () => { active = false }
  }, [league.id])

  const clubs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; logoUrl?: string | null; ladderPosition?: number | null; nationalRank?: number | null }>()
    league.ladder.forEach(row => map.set(row.clubId, { id: row.clubId, name: row.clubName, logoUrl: row.logoUrl, ladderPosition: row.position, nationalRank: null }))
    league.rankedTeams.forEach(row => map.set(row.clubId, { ...(map.get(row.clubId) ?? { id: row.clubId, name: row.clubName }), nationalRank: row.rank }))
    return [...map.values()].sort((a, b) => (a.ladderPosition ?? 999) - (b.ladderPosition ?? 999) || a.name.localeCompare(b.name))
  }, [league.ladder, league.rankedTeams])

  return <section className="lhx-wrap" aria-label={`${league.name} league hub`}>
    <div className="lhx-grid">
      <article className="lhx-card lhx-clubs">
        <Head icon={<Shield size={18}/>} eyebrow="Competition directory" title={`${clubs.length} clubs`} link={`/directory?league=${encodeURIComponent(league.id)}`} linkLabel="Directory" />
        {clubs.length ? <div className="lhx-club-grid">{clubs.map(club => <Link key={club.id} to={`/team/${club.id}`}>
          <span className="lhx-logo">{club.logoUrl ? <img src={club.logoUrl} alt=""/> : initials(club.name)}</span>
          <span><strong>{club.name}</strong><small>{club.ladderPosition ? `Ladder #${club.ladderPosition}` : 'League club'}{club.nationalRank ? ` · National #${club.nationalRank}` : ''}</small></span>
        </Link>)}</div> : <Empty text="No clubs are connected to this league yet." />}
      </article>

      <article className="lhx-card">
        <Head icon={<Trophy size={18}/>} eyebrow="Season performance" title="League records" link={`/records?league=${encodeURIComponent(league.id)}`} linkLabel="All records" />
        {errors.records ? <Empty text="Records are temporarily unavailable."/> : records.length ? <div className="lhx-records">{records.map((record, index) => <div key={`${record.playerName ?? record.clubName ?? index}-${index}`}><b>{index + 1}</b><span><strong>{record.playerName ?? record.clubName ?? record.title ?? 'League record'}</strong><small>{record.clubName && record.playerName ? record.clubName : record.label ?? 'Season record'}</small></span><em>{record.goals ?? record.value ?? '—'}</em></div>)}</div> : <Empty text="League records will appear as verified data is published."/>}
      </article>
    </div>

    <div className="lhx-grid">
      <article className="lhx-card">
        <Head icon={<Play size={18}/>} eyebrow="Community video" title="League highlights" link="/highlights" linkLabel="All highlights" />
        {errors.highlights ? <Empty text="Highlights are temporarily unavailable."/> : highlights.length ? <div className="lhx-highlights">{highlights.map(item => <a key={item.id} href={item.videoUrl} target="_blank" rel="noreferrer"><span className="lhx-thumb">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt=""/> : <Play size={24}/>}</span><strong>{item.playerName}</strong><small>{item.clubName}{item.roundLabel ? ` · ${item.roundLabel}` : ''} · {item.votes} votes</small></a>)}</div> : <Empty text="No approved highlights for this league this week."/>}
      </article>

      <article className="lhx-card">
        <Head icon={<Activity size={18}/>} eyebrow="Supporter feed" title="Latest activity" link="/feed" linkLabel="My feed" />
        {errors.activity ? <Empty text="League activity is temporarily unavailable."/> : activity.length ? <div className="lhx-activity">{activity.map(item => <Link key={item.id} to={item.href}><strong>{item.title}</strong><small>{item.body}</small><time>{relative(item.createdAt)}</time></Link>)}</div> : <Empty text="Follow this league to see its latest results, fixtures and achievements here."/>}
      </article>
    </div>
    <style>{styles}</style>
  </section>
}

function Head({ icon, eyebrow, title, link, linkLabel }: { icon: React.ReactNode; eyebrow: string; title: string; link: string; linkLabel: string }) { return <header className="lhx-head"><span className="lhx-icon">{icon}</span><div><small>{eyebrow}</small><h2>{title}</h2></div><Link to={link}>{linkLabel}</Link></header> }
function Empty({ text }: { text: string }) { return <p className="lhx-empty">{text}</p> }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() }
function relative(value: string) { const ms = Date.now() - Date.parse(value); const hours = Math.floor(ms / 3600000); return hours < 1 ? 'Just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago` }

const styles = `
.lhx-wrap{display:grid;gap:18px;font-family:Barlow,Inter,Arial,sans-serif}.lhx-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.lhx-card{border:1px solid #e2e7ed;border-radius:14px;background:#fff;padding:20px;box-shadow:0 7px 22px rgba(12,14,19,.045);min-width:0}.lhx-head{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;margin-bottom:14px}.lhx-icon{width:36px;height:36px;border-radius:9px;background:#eaf7ff;color:#0783c9;display:grid;place-items:center}.lhx-head small{display:block;color:#0783c9;font-size:9px;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.lhx-head h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:30px;line-height:1;margin:4px 0 0}.lhx-head>a{color:#0783c9;text-decoration:none;text-transform:uppercase;font-size:10px;font-weight:950}.lhx-club-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.lhx-club-grid>a{display:grid;grid-template-columns:42px minmax(0,1fr);align-items:center;gap:9px;border:1px solid #edf1f4;border-radius:10px;padding:9px;color:#111318;text-decoration:none}.lhx-logo{width:40px;height:40px;border:1px solid #e2e7ed;border-radius:9px;background:#f5f7f9;display:grid;place-items:center;overflow:hidden;font-weight:950;color:#0783c9}.lhx-logo img,.lhx-thumb img{width:100%;height:100%;object-fit:contain}.lhx-club-grid strong,.lhx-club-grid small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lhx-club-grid small,.lhx-records small,.lhx-highlights small,.lhx-activity small{color:#687385;font-size:11px;margin-top:3px}.lhx-records{display:grid}.lhx-records>div{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px 0;border-top:1px solid #edf1f4}.lhx-records b{width:26px;height:26px;border-radius:7px;background:#42b8ff;display:grid;place-items:center}.lhx-records strong,.lhx-records small{display:block}.lhx-records em{font-family:'Bebas Neue',Impact,sans-serif;font-style:normal;font-size:26px;color:#0783c9}.lhx-highlights{display:grid;grid-template-columns:1fr 1fr;gap:9px}.lhx-highlights>a{color:#111318;text-decoration:none;border:1px solid #edf1f4;border-radius:10px;padding:9px}.lhx-thumb{height:90px;border-radius:8px;background:#101318;color:#42b8ff;display:grid;place-items:center;overflow:hidden;margin-bottom:8px}.lhx-highlights strong,.lhx-highlights small{display:block}.lhx-activity{display:grid}.lhx-activity>a{position:relative;display:block;color:#111318;text-decoration:none;padding:10px 68px 10px 0;border-top:1px solid #edf1f4}.lhx-activity strong,.lhx-activity small{display:block}.lhx-activity time{position:absolute;right:0;top:12px;color:#87919f;font-size:10px;font-weight:800}.lhx-empty{margin:0;color:#687385;line-height:1.5;padding:18px 0}@media(max-width:760px){.lhx-grid{grid-template-columns:1fr}.lhx-club-grid,.lhx-highlights{grid-template-columns:1fr}.lhx-card{padding:16px}.lhx-head{grid-template-columns:36px minmax(0,1fr) auto}.lhx-head h2{font-size:27px}}
`