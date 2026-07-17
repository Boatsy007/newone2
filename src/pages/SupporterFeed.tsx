import { CalendarDays, Filter, RefreshCw, Shield, Trophy, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { listFollows, loadFeed, markRead, type FeedItem, type Follow, type FollowEntity } from '../lib/supporter'
import { useSeo } from '../lib/seo'

type FeedFilter = 'ALL' | FollowEntity

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'ALL', label: 'All updates' },
  { id: 'CLUB', label: 'Clubs' },
  { id: 'LEAGUE', label: 'Leagues' },
  { id: 'PLAYER', label: 'Players' },
]

export default function SupporterFeed() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [follows, setFollows] = useState<Follow[]>([])
  const [filter, setFilter] = useState<FeedFilter>('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useSeo({ title: 'My Feed | PlayFooty', description: 'A personalised community football feed from the clubs, leagues and players you follow.', path: '/feed' })

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const [nextItems, nextFollows] = await Promise.all([loadFeed(), listFollows()])
      setItems(dedupe(nextItems))
      setFollows(nextFollows)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load your feed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    const onChanged = () => { void refresh() }
    window.addEventListener('playfooty:follows-changed', onChanged)
    return () => window.removeEventListener('playfooty:follows-changed', onChanged)
  }, [])

  const visible = useMemo(() => filter === 'ALL' ? items : items.filter(item => item.entityType === filter), [filter, items])
  const groups = useMemo(() => groupByDate(visible), [visible])
  const counts = useMemo(() => ({
    CLUB: follows.filter(follow => follow.entityType === 'CLUB').length,
    LEAGUE: follows.filter(follow => follow.entityType === 'LEAGUE').length,
    PLAYER: follows.filter(follow => follow.entityType === 'PLAYER').length,
  }), [follows])

  return <div className="sf-page">
    <Nav />
    <main>
      <section className="sf-hero"><div className="sf-shell">
        <span>My PlayFooty</span><h1>Your feed</h1>
        <p>One personalised timeline for the clubs, leagues and players you follow.</p>
        <div className="sf-summary">
          <Summary label="Clubs" value={counts.CLUB}/><Summary label="Leagues" value={counts.LEAGUE}/><Summary label="Players" value={counts.PLAYER}/>
        </div>
      </div></section>

      <section className="sf-shell sf-content">
        <div className="sf-toolbar">
          <div className="sf-filters" role="tablist" aria-label="Filter supporter feed">
            {FILTERS.map(option => <button key={option.id} type="button" role="tab" aria-selected={filter === option.id} className={filter === option.id ? 'active' : ''} onClick={() => setFilter(option.id)}>{option.label}</button>)}
          </div>
          <button type="button" className="sf-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={17}/> Refresh</button>
        </div>

        {loading && <div className="sf-state">Building your personalised feed…</div>}
        {!loading && error && <div className="sf-state error"><p>{error}</p><button type="button" onClick={() => void refresh()}>Try again</button></div>}
        {!loading && !error && follows.length === 0 && <div className="sf-empty"><Filter size={38}/><h2>Make PlayFooty yours</h2><p>Follow clubs, leagues and players from their profiles. Their fixtures, results, rankings and goal-kicking updates will appear here.</p><div><Link to="/directory">Find clubs</Link><Link to="/leagues">Find leagues</Link><Link to="/goal-kickers">Find players</Link></div></div>}
        {!loading && !error && follows.length > 0 && visible.length === 0 && <div className="sf-empty"><Filter size={38}/><h2>No {filter === 'ALL' ? '' : filter.toLowerCase()} updates yet</h2><p>There are no current updates in this part of your feed. New imported results, fixtures and rankings will appear automatically.</p></div>}

        {!loading && !error && visible.length > 0 && <div className="sf-groups">
          {groups.map(group => <section key={group.label} className="sf-group"><h2>{group.label}</h2><div className="sf-list">{group.items.map(item => <FeedCard key={item.id} item={item}/>)}</div></section>)}
        </div>}
      </section>
    </main>
    <Footer />
    <style>{styles}</style>
  </div>
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label} followed</span></div>
}

function FeedCard({ item }: { item: FeedItem }) {
  const Icon = item.type === 'RESULT' || item.type === 'RANKING' ? Trophy : item.type === 'FIXTURE' ? CalendarDays : item.entityType === 'PLAYER' ? UserRound : Shield
  return <Link to={item.href} className="sf-card" onClick={() => markRead(item.id)}>
    <span className={`sf-icon ${item.type.toLowerCase()}`}><Icon size={22}/></span>
    <span className="sf-copy"><small>{entityLabel(item.entityType)} · {itemLabel(item.type)} · {relativeTime(item.createdAt)}</small><strong>{item.title}</strong><p>{item.body}</p><em>View update →</em></span>
  </Link>
}

function dedupe(items: FeedItem[]) {
  const unique = new Map<string, FeedItem>()
  for (const item of items) if (!unique.has(item.id)) unique.set(item.id, item)
  return [...unique.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

function groupByDate(items: FeedItem[]) {
  const now = Date.now()
  const groups = new Map<string, FeedItem[]>()
  for (const item of items) {
    const age = now - Date.parse(item.createdAt)
    const label = age < 86_400_000 ? 'Today' : age < 604_800_000 ? 'This week' : 'Earlier'
    groups.set(label, [...(groups.get(label) ?? []), item])
  }
  return ['Today', 'This week', 'Earlier'].filter(label => groups.has(label)).map(label => ({ label, items: groups.get(label)! }))
}

function entityLabel(value: string) { return value.toLowerCase().replace(/^./, char => char.toUpperCase()) }
function itemLabel(value: string) { return value.toLowerCase().replace(/_/g, ' ').replace(/^./, char => char.toUpperCase()) }
function relativeTime(value: string) {
  const difference = Date.now() - Date.parse(value)
  if (!Number.isFinite(difference) || difference < 0) return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  const hours = Math.floor(difference / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

const styles = `.sf-page{min-height:100vh;background:#f3f5f7;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.sf-shell{width:min(1040px,calc(100% - 36px));margin:0 auto}.sf-hero{background:#050505;color:#fff;border-bottom:5px solid #2daaf5;padding:48px 0}.sf-hero>div>span{color:#2daaf5;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.16em}.sf-hero h1{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(4.5rem,10vw,8rem);line-height:.8;margin:11px 0}.sf-hero p{margin:0;color:#c8d0da;font-size:18px}.sf-summary{display:flex;gap:12px;margin-top:25px;flex-wrap:wrap}.sf-summary>div{min-width:130px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);border-radius:12px;padding:12px 15px}.sf-summary strong,.sf-summary span{display:block}.sf-summary strong{font-family:'Bebas Neue',Impact,sans-serif;color:#2daaf5;font-size:32px;line-height:1}.sf-summary span{text-transform:uppercase;font-size:9px;font-weight:900;letter-spacing:.11em;margin-top:5px}.sf-content{padding:25px 0 60px}.sf-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:22px}.sf-filters{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}.sf-filters::-webkit-scrollbar{display:none}.sf-filters button,.sf-refresh,.sf-state button{flex:0 0 auto;border:1px solid #d9e1e8;background:#fff;color:#111318;border-radius:999px;padding:11px 15px;font-weight:900;text-transform:uppercase;font-size:11px;cursor:pointer}.sf-filters button.active{background:#2daaf5;border-color:#2daaf5;color:#050505}.sf-refresh{display:inline-flex;align-items:center;gap:7px}.sf-refresh:disabled{opacity:.55}.sf-groups{display:grid;gap:28px}.sf-group>h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:35px;margin:0 0 11px}.sf-list{display:grid;gap:11px}.sf-card{display:grid;grid-template-columns:52px minmax(0,1fr);gap:15px;align-items:start;background:#fff;border:1px solid #dfe5eb;border-radius:13px;padding:18px;color:#111318;text-decoration:none;box-shadow:0 5px 18px rgba(17,24,39,.045);transition:transform .17s ease,box-shadow .17s ease}.sf-card:hover{transform:translateY(-1px);box-shadow:0 11px 25px rgba(17,24,39,.09)}.sf-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:12px;background:#edf8ff;color:#0783c9}.sf-icon.result,.sf-icon.ranking{background:#fff6df;color:#b87900}.sf-copy{min-width:0}.sf-copy small{display:block;color:#2daaf5;text-transform:uppercase;font-size:9px;font-weight:950;letter-spacing:.11em}.sf-copy strong{display:block;margin-top:6px;font-size:19px;line-height:1.2}.sf-copy p{margin:6px 0 0;color:#687385;line-height:1.45}.sf-copy em{display:block;margin-top:11px;color:#0783c9;font-style:normal;text-transform:uppercase;font-size:10px;font-weight:950;letter-spacing:.08em}.sf-state,.sf-empty{min-height:330px;display:grid;place-items:center;text-align:center;background:#fff;border:1px solid #dfe5eb;border-radius:13px;padding:32px}.sf-state.error{color:#d71920}.sf-state.error p{margin:0}.sf-empty h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:46px;line-height:.95;margin:10px 0 0}.sf-empty p{max-width:580px;color:#687385;line-height:1.5;margin:10px auto 20px}.sf-empty>div{display:flex;justify-content:center;gap:9px;flex-wrap:wrap}.sf-empty a{background:#2daaf5;color:#050505;text-decoration:none;text-transform:uppercase;font-size:11px;font-weight:950;border-radius:999px;padding:12px 17px}@media(max-width:620px){.sf-shell{width:min(100% - 24px,1040px)}.sf-hero{padding:36px 0}.sf-toolbar{align-items:flex-start;flex-direction:column}.sf-filters{width:100%}.sf-refresh{align-self:flex-end}.sf-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.sf-summary>div{min-width:0;padding:10px}.sf-summary strong{font-size:27px}.sf-summary span{font-size:8px}.sf-card{grid-template-columns:42px minmax(0,1fr);padding:15px;gap:11px}.sf-icon{width:40px;height:40px}.sf-copy strong{font-size:17px}.sf-copy p{font-size:14px}}`
