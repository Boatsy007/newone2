import { Bell, CheckCheck, Trophy, CalendarDays, UserRound, Shield } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { loadFeed, markAllRead, markRead, readIds, type FeedItem } from '../lib/supporter'
import { useSeo } from '../lib/seo'

export default function Notifications() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [read, setRead] = useState<Set<string>>(() => readIds())

  useSeo({ title: 'My PlayFooty — Notifications', description: 'Updates from the clubs, leagues and players you follow on PlayFooty.', path: '/notifications' })

  const refresh = () => {
    setLoading(true); setError('')
    loadFeed().then(setItems).catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load notifications')).finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])
  const unread = useMemo(() => items.filter(item => !read.has(item.id)).length, [items, read])

  const openItem = (id: string) => { markRead(id); setRead(readIds()) }
  const clearUnread = () => { markAllRead(items); setRead(readIds()) }

  return <div className="nt-page"><Nav/><main>
    <section className="nt-hero"><div className="nt-shell"><span>My PlayFooty</span><h1>Notifications</h1><p>Updates from the clubs, leagues and players you follow.</p></div></section>
    <section className="nt-shell nt-content">
      <div className="nt-toolbar"><div><strong>{unread}</strong><span>unread</span></div>{items.length > 0 && <button type="button" onClick={clearUnread}><CheckCheck size={17}/> Mark all read</button>}</div>
      {loading && <div className="nt-state">Loading your updates…</div>}
      {!loading && error && <div className="nt-state error"><p>{error}</p><button type="button" onClick={refresh}>Try again</button></div>}
      {!loading && !error && items.length === 0 && <div className="nt-empty"><Bell size={34}/><h2>No updates yet</h2><p>Follow a club, league or player from their profile and their latest updates will appear here.</p><Link to="/directory">Find clubs</Link></div>}
      {!loading && !error && items.length > 0 && <div className="nt-list">{items.map(item => <NotificationCard key={item.id} item={item} unread={!read.has(item.id)} onOpen={() => openItem(item.id)} />)}</div>}
    </section>
  </main><Footer/><style>{styles}</style></div>
}

function NotificationCard({ item, unread, onOpen }: { item: FeedItem; unread: boolean; onOpen: () => void }) {
  const Icon = item.type === 'RESULT' || item.type === 'RANKING' ? Trophy : item.type === 'FIXTURE' ? CalendarDays : item.type === 'PLAYER' ? UserRound : Shield
  return <Link to={item.href} onClick={onOpen} className={`nt-card ${unread ? 'unread' : ''}`}>
    <span className="nt-icon"><Icon size={21}/></span>
    <span className="nt-copy"><small>{label(item.type)} · {relativeTime(item.createdAt)}</small><strong>{item.title}</strong><p>{item.body}</p></span>
    {unread && <i aria-label="Unread"/>}
  </Link>
}

function label(type: string) { return type.toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) }
function relativeTime(value: string) {
  const difference = Date.now() - Date.parse(value)
  if (!Number.isFinite(difference)) return 'Recently'
  const hours = Math.floor(difference / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

const styles = `.nt-page{min-height:100vh;background:#f3f5f7;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.nt-shell{width:min(960px,calc(100% - 36px));margin:0 auto}.nt-hero{background:#050505;color:#fff;border-bottom:5px solid #2daaf5;padding:48px 0}.nt-hero span{color:#2daaf5;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.16em}.nt-hero h1{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(4rem,9vw,7rem);line-height:.82;margin:10px 0}.nt-hero p{color:#c8d0da;font-size:18px;margin:0}.nt-content{padding:26px 0 58px}.nt-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}.nt-toolbar>div{display:flex;align-items:baseline;gap:7px}.nt-toolbar strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:34px;color:#2daaf5}.nt-toolbar span{text-transform:uppercase;font-size:11px;font-weight:900}.nt-toolbar button,.nt-state button{display:inline-flex;align-items:center;gap:7px;border:1px solid #d8e0e7;background:#fff;border-radius:999px;padding:10px 14px;font-weight:900;text-transform:uppercase;cursor:pointer}.nt-list{display:grid;gap:10px}.nt-card{position:relative;display:grid;grid-template-columns:46px minmax(0,1fr) 10px;align-items:start;gap:14px;background:#fff;border:1px solid #dfe5eb;border-radius:12px;padding:18px;color:#111318;text-decoration:none;box-shadow:0 5px 17px rgba(17,24,39,.045)}.nt-card.unread{border-left:5px solid #2daaf5;background:#fbfdff}.nt-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:10px;background:#edf8ff;color:#0783c9}.nt-copy{min-width:0}.nt-copy small{display:block;color:#2daaf5;text-transform:uppercase;font-size:9px;font-weight:950;letter-spacing:.11em}.nt-copy strong{display:block;margin-top:5px;font-size:17px}.nt-copy p{margin:5px 0 0;color:#687385;line-height:1.4}.nt-card i{width:8px;height:8px;border-radius:50%;background:#2daaf5;margin-top:5px}.nt-state,.nt-empty{min-height:300px;display:grid;place-items:center;text-align:center;background:#fff;border:1px solid #dfe5eb;border-radius:12px;padding:30px}.nt-state.error{color:#d71920}.nt-state.error p{margin:0}.nt-empty h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:42px;margin:8px 0 0}.nt-empty p{max-width:500px;color:#687385;margin:8px auto 18px}.nt-empty a{background:#2daaf5;color:#050505;text-decoration:none;text-transform:uppercase;font-weight:950;border-radius:999px;padding:12px 18px}@media(max-width:600px){.nt-shell{width:min(100% - 24px,960px)}.nt-card{grid-template-columns:40px minmax(0,1fr) 8px;padding:15px;gap:11px}.nt-icon{width:38px;height:38px}.nt-toolbar{align-items:flex-start}.nt-toolbar button{font-size:10px}.nt-hero{padding:36px 0}}`
