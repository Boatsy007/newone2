/** PlayFooty Admin — simplified operations workflows. */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Database,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  RefreshCw,
  Settings as SettingsIcon,
  Target,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { admin, getKey, setKey, clearKey, type AdminClub, type FootballLeague, type LeagueProfileDetail, type ClubProfileDetail, type ArticleRow, type GoalKickerRow, type DashboardData } from '../lib/admin'

const C = { bg: '#eef2f6', panel: '#fff', line: '#dce3eb', text: '#111318', mute: '#687385', blue: '#2daaf5', blueDark: '#0783c9', black: '#050505', red: '#d71920', soft: '#edf8ff', green: '#128a4a', gold: '#f4c14d' }
const box: CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 22, boxShadow: '0 12px 32px rgba(17,24,39,.07)' }
const input: CSSProperties = { width: '100%', border: `1px solid ${C.line}`, borderRadius: 12, padding: '13px 14px', font: 'inherit', color: C.text, background: '#fff', boxSizing: 'border-box', outlineColor: C.blue }
const button = (bg = C.blue): CSSProperties => ({ border: bg === '#fff' ? `1px solid ${C.line}` : 'none', borderRadius: 999, background: bg, color: bg === '#fff' ? C.text : '#050505', padding: '11px 16px', fontWeight: 950, cursor: 'pointer', boxShadow: bg === C.blue ? '0 9px 22px rgba(45,170,245,.22)' : 'none', textTransform: 'uppercase', letterSpacing: '.035em' })
const css = `
.pf-admin *{box-sizing:border-box}.pf-admin button,.pf-admin input,.pf-admin textarea,.pf-admin select{font-family:inherit}.pf-admin-shell{min-height:100vh;display:grid;grid-template-columns:250px minmax(0,1fr);background:${C.bg}}.pf-admin-sidebar{position:sticky;top:0;height:100vh;background:${C.black};color:#fff;padding:24px 18px;display:flex;flex-direction:column;z-index:30}.pf-admin-brand{display:flex;align-items:center;padding:4px 8px 24px;border-bottom:1px solid rgba(255,255,255,.12)}.pf-admin-brand img{width:174px;height:auto;display:block}.pf-admin-nav{display:grid;gap:5px;padding-top:20px}.pf-admin-nav button{width:100%;display:flex;align-items:center;gap:12px;border:0;border-radius:11px;background:transparent;color:#c9d0da;padding:12px 13px;text-align:left;font-weight:850;cursor:pointer}.pf-admin-nav button svg{color:#7a8797}.pf-admin-nav button:hover,.pf-admin-nav button.active{background:${C.blue};color:#050505}.pf-admin-nav button:hover svg,.pf-admin-nav button.active svg{color:#050505}.pf-admin-side-footer{margin-top:auto;display:grid;gap:9px;padding-top:18px;border-top:1px solid rgba(255,255,255,.12)}.pf-admin-side-footer a,.pf-admin-side-footer button{display:flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;padding:12px;text-decoration:none;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.06em}.pf-admin-side-footer a{background:#fff;color:#050505}.pf-admin-side-footer button{border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;cursor:pointer}.pf-admin-main{min-width:0}.pf-admin-topbar{height:78px;background:#fff;border-bottom:1px solid ${C.line};display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:20}.pf-admin-topbar-copy small{display:block;color:${C.blueDark};font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.15em}.pf-admin-topbar-copy strong{display:block;font-family:'Barlow Condensed',Inter,sans-serif;font-size:24px;text-transform:uppercase;line-height:1.05}.pf-admin-menu{display:none;border:0;background:#050505;color:#fff;border-radius:10px;width:42px;height:42px;place-items:center}.pf-admin-content{max-width:1320px;margin:0 auto;padding:26px clamp(16px,3vw,34px) 54px}.pf-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.pf-two{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px}.pf-form{display:grid;gap:12px}.pf-card-button{transition:.16s transform,.16s box-shadow}.pf-card-button:hover{transform:translateY(-2px);box-shadow:0 18px 40px rgba(17,24,39,.12)!important}.pf-dashboard{display:grid;gap:20px}.pf-dashboard-hero{background:${C.black};color:#fff;border-radius:20px;padding:clamp(24px,5vw,48px);position:relative;overflow:hidden}.pf-dashboard-hero:after{content:'';position:absolute;width:300px;height:300px;border-radius:50%;background:${C.blue};right:-135px;top:-145px;opacity:.9}.pf-dashboard-hero>*{position:relative;z-index:1}.pf-dashboard-hero small{color:${C.blue};text-transform:uppercase;font-weight:950;letter-spacing:.16em}.pf-dashboard-hero h1{font-family:'Bebas Neue','Barlow Condensed',Impact,sans-serif;font-size:clamp(3.8rem,8vw,7rem);line-height:.83;margin:12px 0 10px;text-transform:uppercase;letter-spacing:-.035em}.pf-dashboard-hero p{max-width:660px;color:#c8d0da;font-size:17px;margin:0}.pf-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.pf-stat{background:#fff;border:1px solid ${C.line};border-radius:16px;padding:18px}.pf-stat-head{display:flex;align-items:center;justify-content:space-between}.pf-stat-icon{width:38px;height:38px;border-radius:10px;background:${C.soft};color:${C.blueDark};display:grid;place-items:center}.pf-stat b{display:block;font-family:'Bebas Neue','Barlow Condensed',Impact,sans-serif;font-size:42px;line-height:1;margin-top:17px}.pf-stat span{display:block;color:${C.mute};font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.06em}.pf-dashboard-columns{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(280px,.75fr);gap:18px}.pf-section-card{background:#fff;border:1px solid ${C.line};border-radius:18px;overflow:hidden}.pf-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid ${C.line}}.pf-section-head h2{font-family:'Barlow Condensed',Inter,sans-serif;text-transform:uppercase;font-size:25px;margin:0}.pf-section-head button{border:0;background:transparent;color:${C.blueDark};font-weight:950;text-transform:uppercase;cursor:pointer}.pf-quick-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px}.pf-quick-action{display:grid;grid-template-columns:42px minmax(0,1fr) 20px;align-items:center;gap:12px;border:1px solid ${C.line};border-radius:14px;background:#fff;padding:14px;text-align:left;color:${C.text};cursor:pointer}.pf-quick-action:hover{border-color:${C.blue};background:#f7fcff}.pf-quick-action>span:first-child{width:42px;height:42px;border-radius:11px;background:${C.black};color:${C.blue};display:grid;place-items:center}.pf-quick-action strong{display:block}.pf-quick-action small{display:block;color:${C.mute};margin-top:3px}.pf-status-list{display:grid}.pf-status-row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;gap:11px;padding:14px 18px;border-bottom:1px solid #edf1f5}.pf-status-row:last-child{border-bottom:0}.pf-status-dot{width:9px;height:9px;border-radius:50%;background:${C.green}}.pf-status-dot.warn{background:${C.gold}}.pf-status-row strong{display:block;font-size:14px}.pf-status-row small{display:block;color:${C.mute};margin-top:2px}.pf-status-row em{font-style:normal;color:${C.blueDark};font-size:11px;font-weight:950;text-transform:uppercase}.pf-alert{display:flex;gap:12px;align-items:flex-start;margin:16px;border:1px solid #f4d38a;background:#fffaf0;border-radius:13px;padding:14px;color:#694d0a}.pf-alert strong{display:block}.pf-alert small{display:block;margin-top:3px}.pf-admin-toast{position:fixed;right:18px;bottom:18px;z-index:100;color:#fff;border-radius:13px;padding:12px 16px;font-weight:900;max-width:420px;box-shadow:0 12px 30px rgba(0,0,0,.2)}
@media(max-width:1050px){.pf-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pf-dashboard-columns{grid-template-columns:1fr}.pf-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:820px){.pf-admin-shell{display:block}.pf-admin-sidebar{position:fixed;inset:0 44px 0 0;height:auto;transform:translateX(-110%);transition:transform .2s;box-shadow:20px 0 50px rgba(0,0,0,.3)}.pf-admin-sidebar.open{transform:translateX(0)}.pf-admin-topbar{height:70px;padding:0 14px}.pf-admin-menu{display:grid}.pf-admin-content{padding:18px 12px 42px}.pf-grid,.pf-two{grid-template-columns:1fr}.pf-admin h1{font-size:42px!important}.pf-quick-grid{grid-template-columns:1fr}.pf-dashboard-hero h1{font-size:4rem}}
@media(max-width:520px){.pf-stat-grid{grid-template-columns:1fr 1fr;gap:10px}.pf-stat{padding:14px}.pf-stat b{font-size:34px}.pf-stat span{font-size:10px}.pf-admin-topbar-copy strong{font-size:20px}}
`

type Area = 'home' | 'leagues' | 'clubs' | 'fixtures' | 'rankings' | 'articles' | 'goalKickers' | 'settings'
type Toast = (message: string, ok?: boolean) => void
type NavItem = { area: Area; label: string; icon: LucideIcon }

const navigation: NavItem[] = [
  { area: 'home', label: 'Dashboard', icon: LayoutDashboard },
  { area: 'leagues', label: 'Leagues', icon: Trophy },
  { area: 'clubs', label: 'Clubs', icon: Users },
  { area: 'fixtures', label: 'Matches', icon: CalendarDays },
  { area: 'rankings', label: 'Rankings', icon: ChartNoAxesColumnIncreasing },
  { area: 'goalKickers', label: 'Goal Kickers', icon: Target },
  { area: 'articles', label: 'News', icon: Newspaper },
  { area: 'settings', label: 'Settings', icon: SettingsIcon },
]

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const show: Toast = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4200) }
  return { show, node: msg ? <div className="pf-admin-toast" style={{ background: msg.ok ? C.green : C.red }}>{msg.text}</div> : null }
}

export default function Admin() {
  const [authed, setAuthed] = useState(!!getKey())
  const [area, setArea] = useState<Area>('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const toast = useToast()
  if (!authed) return <Login onIn={() => setAuthed(true)} />
  const active = navigation.find(item => item.area === area) ?? navigation[0]
  const go = (next: Area) => { setArea(next); setMenuOpen(false); window.scrollTo(0, 0) }
  const signOut = () => { clearKey(); setAuthed(false) }
  return <div className="pf-admin" style={{ minHeight: '100vh', color: C.text, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}><style>{css}</style>
    <div className="pf-admin-shell">
      <aside className={`pf-admin-sidebar${menuOpen ? ' open' : ''}`}>
        <div className="pf-admin-brand"><img src="/playfooty-logo-modern.svg" alt="PlayFooty" /></div>
        <nav className="pf-admin-nav" aria-label="Control Centre navigation">
          {navigation.map(item => { const Icon = item.icon; return <button key={item.area} className={area === item.area ? 'active' : ''} onClick={() => go(item.area)}><Icon size={19}/><span>{item.label}</span></button> })}
        </nav>
        <div className="pf-admin-side-footer">
          <a href="/" target="_blank" rel="noreferrer"><ExternalLink size={16}/> View website</a>
          <button onClick={signOut}><LogOut size={16}/> Sign out</button>
        </div>
      </aside>
      <section className="pf-admin-main">
        <header className="pf-admin-topbar">
          <div className="pf-admin-topbar-copy"><small>PlayFooty Control Centre</small><strong>{active.label}</strong></div>
          <button className="pf-admin-menu" type="button" aria-label={menuOpen ? 'Close admin menu' : 'Open admin menu'} onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={24}/> : <Menu size={24}/>}</button>
        </header>
        <main className="pf-admin-content">
          {area === 'home' && <Home go={go} toast={toast.show} />}
          {area === 'leagues' && <Leagues toast={toast.show} />}
          {area === 'clubs' && <Clubs toast={toast.show} />}
          {area === 'fixtures' && <Fixtures toast={toast.show} />}
          {area === 'rankings' && <Rankings toast={toast.show} />}
          {area === 'articles' && <Articles toast={toast.show} />}
          {area === 'goalKickers' && <GoalKickers />}
          {area === 'settings' && <Settings />}
        </main>
      </section>
    </div>{toast.node}
  </div>
}

function Login({ onIn }: { onIn: () => void }) {
  const [key, setLocalKey] = useState('')
  const enter = () => { if (key.trim()) { setKey(key.trim()); onIn() } }
  return <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(360px,520px)', background: C.black }}>
    <section style={{ color: '#fff', padding: 'clamp(34px,7vw,90px)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100vh' }}><img src="/playfooty-logo-modern.svg" alt="PlayFooty" style={{ width: 190 }} /><div><small style={{ color: C.blue, textTransform: 'uppercase', fontWeight: 950, letterSpacing: '.17em' }}>Control Centre</small><h1 style={{ fontFamily: "'Bebas Neue',Impact,sans-serif", textTransform: 'uppercase', fontSize: 'clamp(4.5rem,10vw,9rem)', lineHeight: .82, margin: '12px 0' }}>Run every part of PlayFooty.</h1><p style={{ color: '#bbc4cf', maxWidth: 620, fontSize: 18 }}>Imports, profiles, rankings, matches, goal kickers and publishing—connected to the systems already powering the public site.</p></div><span style={{ color: '#697586', fontSize: 12 }}>Authorised access only</span></section>
    <section style={{ background: '#fff', display: 'grid', placeItems: 'center', padding: 24 }}><div style={{ width: 'min(100%,390px)' }}><small style={{ color: C.blueDark, textTransform: 'uppercase', fontWeight: 950, letterSpacing: '.15em' }}>Welcome back</small><h2 style={{ fontFamily: "'Barlow Condensed',Inter,sans-serif", textTransform: 'uppercase', fontSize: 44, margin: '8px 0' }}>Admin login</h2><p style={{ color: C.mute, marginBottom: 22 }}>Enter the existing admin key to continue.</p><input style={input} type="password" value={key} onChange={e => setLocalKey(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') enter() }} placeholder="Admin key" /><button style={{ ...button(), marginTop: 12, width: '100%', padding: 14 }} onClick={enter}>Open Control Centre</button></div></section>
  </div>
}

function Home({ go, toast }: { go: (area: Area) => void; toast: Toast }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = () => { setLoading(true); admin.dashboard().then(setData).catch(e => toast(plainError(e), false)).finally(() => setLoading(false)) }
  useEffect(() => { refresh() }, [])
  const stats = [
    { label: 'Active leagues', value: data?.counts.leaguesActive ?? '—', icon: Trophy },
    { label: 'Clubs', value: data?.counts.clubs ?? '—', icon: Users },
    { label: 'Teams', value: data?.counts.teams ?? '—', icon: Database },
    { label: 'Pending reviews', value: data?.counts.pendingReviews ?? '—', icon: AlertTriangle },
  ]
  const actions: Array<{ area: Area; title: string; text: string; icon: LucideIcon }> = [
    { area: 'leagues', title: 'Import a league', text: 'Paste a PlayHQ ladder URL.', icon: Trophy },
    { area: 'fixtures', title: 'Import matches', text: 'Bring in fixtures and results.', icon: CalendarDays },
    { area: 'rankings', title: 'Refresh rankings', text: 'Run the existing ranking engine.', icon: ChartNoAxesColumnIncreasing },
    { area: 'articles', title: 'Create a story', text: 'Open publishing tools.', icon: Newspaper },
    { area: 'goalKickers', title: 'Import goal kickers', text: 'Update the national goal ladder.', icon: Target },
    { area: 'clubs', title: 'Edit club profiles', text: 'Logos, bios, colours and links.', icon: Users },
  ]
  return <div className="pf-dashboard">
    <section className="pf-dashboard-hero"><small>PlayFooty operations</small><h1>Control Centre</h1><p>Manage the live data and content powering Australia’s community football platform. Existing connections remain exactly where they are—this dashboard simply makes them easier to use.</p></section>
    <section className="pf-stat-grid">{stats.map(stat => { const Icon = stat.icon; return <article className="pf-stat" key={stat.label}><div className="pf-stat-head"><span>{stat.label}</span><i className="pf-stat-icon"><Icon size={19}/></i></div><b>{loading ? '…' : stat.value}</b></article> })}</section>
    <div className="pf-dashboard-columns">
      <section className="pf-section-card"><header className="pf-section-head"><h2>Quick actions</h2></header><div className="pf-quick-grid">{actions.map(action => { const Icon = action.icon; return <button className="pf-quick-action" key={action.area} onClick={() => go(action.area)}><span><Icon size={20}/></span><span><strong>{action.title}</strong><small>{action.text}</small></span><ChevronRight size={18}/></button> })}</div></section>
      <section className="pf-section-card"><header className="pf-section-head"><h2>System status</h2><button type="button" onClick={refresh}><RefreshCw size={14}/> Refresh</button></header>{(data?.warnings ?? 0) > 0 && <div className="pf-alert"><AlertTriangle size={20}/><span><strong>{data?.warnings} warning{data?.warnings === 1 ? '' : 's'} need attention</strong><small>Open the relevant manager to review the existing issue.</small></span></div>}<div className="pf-status-list"><StatusRow title="Ranking engine" detail={data?.lastRun ? `${data.lastRun.clubCount} clubs · ${data.lastRun.weekLabel}` : 'No completed ranking run found'} value={data?.lastRun ? 'Ready' : 'Waiting'} warn={!data?.lastRun}/><StatusRow title="Latest source sync" detail={data?.lastScrape ? `${data.lastScrape.sourceType} · ${formatAdminDate(data.lastScrape.lastScrapedAt)}` : 'No recent scrape found'} value={data?.lastScrape ? 'Connected' : 'Waiting'} warn={!data?.lastScrape}/><StatusRow title="Review queue" detail={`${data?.counts.pendingReviews ?? 0} pending items`} value={(data?.counts.pendingReviews ?? 0) > 0 ? 'Review' : 'Clear'} warn={(data?.counts.pendingReviews ?? 0) > 0}/></div></section>
    </div>
    <div className="pf-dashboard-columns">
      <section className="pf-section-card"><header className="pf-section-head"><h2>Recently updated leagues</h2><button onClick={() => go('leagues')}>Open leagues</button></header><div className="pf-status-list">{data?.recentLeagues?.length ? data.recentLeagues.slice(0, 6).map(row => <div className="pf-status-row" key={row.id}><i className="pf-status-dot"/><span><strong>{row.name}</strong><small>{formatAdminDate(row.lastManualUpdateAt)}</small></span><em>{row.status}</em></div>) : <EmptyDashboard text={loading ? 'Loading leagues…' : 'No recent league updates.'}/>}</div></section>
      <section className="pf-section-card"><header className="pf-section-head"><h2>Recently updated clubs</h2><button onClick={() => go('clubs')}>Open clubs</button></header><div className="pf-status-list">{data?.recentClubs?.length ? data.recentClubs.slice(0, 6).map(row => <div className="pf-status-row" key={row.id}><i className="pf-status-dot"/><span><strong>{row.name}</strong><small>{formatAdminDate(row.updatedAt)}</small></span><em>Updated</em></div>) : <EmptyDashboard text={loading ? 'Loading clubs…' : 'No recent club updates.'}/>}</div></section>
    </div>
  </div>
}

function StatusRow({ title, detail, value, warn = false }: { title: string; detail: string; value: string; warn?: boolean }) { return <div className="pf-status-row"><i className={`pf-status-dot${warn ? ' warn' : ''}`}/><span><strong>{title}</strong><small>{detail}</small></span><em>{value}</em></div> }
function EmptyDashboard({ text }: { text: string }) { return <div style={{ padding: 22, color: C.mute, textAlign: 'center' }}>{text}</div> }
function formatAdminDate(value?: string | null) { if (!value) return 'Not available'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }

function Page({ icon, title, children }: { icon: string; title: string; children: ReactNode }) { return <div style={{ display: 'grid', gap: 18 }}><section style={{ ...box, display: 'flex', alignItems: 'center', gap: 16 }}><span style={{ fontSize: 44 }}>{icon}</span><div><h2 style={{ margin: 0, fontFamily: "'Barlow Condensed',Inter,sans-serif", textTransform: 'uppercase', fontSize: 46, letterSpacing: '-.035em' }}>{title}</h2><p style={{ margin: '4px 0 0', color: C.mute }}>Existing PlayFooty tools and connections.</p></div></section>{children}</div> }

function Leagues({ toast }: { toast: Toast }) {
  const [rows, setRows] = useState<FootballLeague[]>([])
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const load = () => admin.listFootballLeagues().then(setRows).catch(e => toast(e.message, false))
  useEffect(() => { load() }, [])
  const run = async () => { if (!url.trim()) return toast('Paste the PlayHQ ladder URL first.', false); setBusy(true); setResult(null); try { const r = await admin.importUrl(url.trim()); setResult(r.workflowRunUrl ?? r.htmlUrl ?? 'Import started'); setUrl(''); toast('League import started'); await load() } catch (e) { toast(plainError(e), false) } finally { setBusy(false) } }
  if (editing) return <LeagueProfile id={editing} toast={toast} back={() => { setEditing(null); load() }} />
  return <Page icon="🏆" title="Leagues"><section style={{ ...box, textAlign: 'center', padding: 34 }}><h3 style={{ marginTop: 0, fontSize: 34, letterSpacing: '-.055em' }}>Import League</h3><p style={{ color: C.mute }}>Paste the PlayHQ ladder URL. PlayFooty detects the league, clubs, teams, ladder, fixtures and results.</p><div style={{ maxWidth: 780, margin: '0 auto', display: 'grid', gap: 12 }}><input style={{ ...input, padding: 18 }} value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste PlayHQ ladder URL" /><button disabled={busy} style={{ ...button(), padding: 16 }} onClick={run}>{busy ? 'IMPORTING…' : 'IMPORT LEAGUE'}</button></div>{result && <div style={{ marginTop: 18, color: C.green, fontWeight: 900 }}>✓ Workflow started · ✓ League will appear after import · <a href={result} target="_blank" rel="noreferrer" style={{ color: C.blueDark }}>Open run</a></div>}</section><section style={box}><h3>Leagues</h3><div style={{ display: 'grid', gap: 12 }}>{rows.map(l => <div key={l.id} style={{ border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><strong>{l.name}</strong><div style={{ color: C.mute, fontSize: 13 }}>{l.state?.code ?? '—'} · {l._count?.clubSeasons ?? 0} clubs · Ladder {l._count?.footballLadderEntries ?? 0 ? 'ready' : 'waiting'}</div></div><button style={button('#fff')} onClick={() => setEditing(l.id)}>Open League</button></div>)}{rows.length === 0 && <p style={{ color: C.mute }}>No leagues yet.</p>}</div></section></Page>
}

function LeagueProfile({ id, toast, back }: { id: string; toast: Toast; back: () => void }) {
  const [league, setLeague] = useState<LeagueProfileDetail | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  const load = () => admin.getLeagueProfile(id).then(l => { setLeague(l); setForm({ name: l.name ?? '', description: l.description ?? '', websiteUrl: l.websiteUrl ?? '', facebookUrl: l.facebookUrl ?? '', logoUrl: l.logoUrl ?? '' }) }).catch(e => toast(e.message, false))
  useEffect(() => { load() }, [id])
  if (!league) return <div style={box}>Loading league…</div>
  const save = async () => { setBusy(true); try { const l = await admin.updateLeagueProfile(id, form); setLeague(p => ({ ...(p ?? league), ...l })); toast('League saved') } catch (e) { toast(plainError(e), false) } finally { setBusy(false) } }
  const upload = async (file: File) => { setBusy(true); try { const l = await admin.uploadLeagueLogo(id, await logoPayload(file)); setLeague(p => ({ ...(p ?? league), ...l })); toast('Logo uploaded') } catch (e) { toast(plainError(e), false) } finally { setBusy(false) } }
  const remove = async () => { setBusy(true); try { const l = await admin.removeLeagueLogo(id); setLeague(p => ({ ...(p ?? league), ...l })); toast('Logo removed') } catch (e) { toast(plainError(e), false) } finally { setBusy(false) } }
  return <Page icon="🏆" title={league.name}><button style={button('#fff')} onClick={back}>← Back to Leagues</button><div className="pf-two"><ProfileForm title="League profile" name={league.name} logoUrl={league.logoUrl} form={form} setForm={setForm} onUpload={upload} onRemove={remove} busy={busy} save={save} league /><RelatedCards /></div></Page>
}

function Clubs({ toast }: { toast: Toast }) {
  const [clubs, setClubs] = useState<AdminClub[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const load = () => admin.listClubs().then(setClubs).catch(e => toast(e.message, false))
  useEffect(() => { load() }, [])
  if (editing) return <ClubProfile id={editing} toast={toast} back={() => { setEditing(null); load() }} />
  return <Page icon="👥" title="Clubs"><section style={box}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>{clubs.map(c => <div key={c.id} style={{ border: `1px solid ${C.line}`, borderRadius: 18, padding: 16 }}><Avatar name={c.name} logoUrl={c.logoUrl} /><h3 style={{ marginBottom: 4 }}>{c.name}</h3><div style={{ color: C.mute, fontSize: 13 }}>{c.region ?? 'Imported club'} · {c.state?.code ?? '—'}</div><button style={{ ...button('#fff'), marginTop: 12 }} onClick={() => setEditing(c.id)}>Open Club</button></div>)}</div>{clubs.length === 0 && <p style={{ color: C.mute }}>No clubs imported yet.</p>}</section></Page>
}

function ClubProfile({ id, toast, back }: { id: string; toast: Toast; back: () => void }) {
  const [club, setClub] = useState<ClubProfileDetail | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  const load = () => admin.getClubProfile(id).then(c => { setClub(c); setForm({ name: c.name ?? '', description: c.description ?? '', primaryColour: c.primaryColour ?? '', secondaryColour: c.secondaryColour ?? '', websiteUrl: c.websiteUrl ?? '', facebookUrl: c.facebookUrl ?? '', instagramUrl: c.instagramUrl ?? '', logoUrl: c.logoUrl ?? '' }) }).catch(e => toast(e.message, false))
  useEffect(() => { load() }, [id])
  if (!club) return <div style={box}>Loading club…</div>
  const save = async () => { setBusy(true); try { const c = await admin.updateClubProfile(id, form); setClub(p => ({ ...(p ?? club), ...c })); toast('Club saved') } catch (e) { toast(plainError(e), false) } finally { setBusy(false) } }
  const upload = async (file: File) => { setBusy(true); try { const c = await admin.uploadClubLogo(id, await logoPayload(file)); setClub(p => ({ ...(p ?? club), ...c })); toast('Logo uploaded') } catch (e) { toast(plainError(e), false) } finally { setBusy(false) } }
  const remove = async () => { setBusy(true); try { const c = await admin.removeClubLogo(id); setClub(p => ({ ...(p ?? club), ...c })); toast('Logo removed') } catch (e) { toast(plainError(e), false) } finally { setBusy(false) } }
  const grades = useMemo(() => Array.from(new Set(((club.leagueSeasons ?? []) as any[]).map(s => String(s.grade ?? '')).filter(Boolean))), [club])
  return <Page icon="👥" title={club.name}><button style={button('#fff')} onClick={back}>← Back to Clubs</button><div className="pf-two"><ProfileForm title="Club profile" name={club.name} logoUrl={club.logoUrl} form={form} setForm={setForm} onUpload={upload} onRemove={remove} busy={busy} save={save} /><section style={box}><h3>Teams</h3>{grades.length ? grades.map(g => <label key={g} style={{ display: 'block', margin: '10px 0', fontWeight: 800 }}><input type="checkbox" checked readOnly /> {g}</label>) : <p style={{ color: C.mute }}>Teams will appear automatically from imported PlayHQ grades.</p>}</section></div></Page>
}

function ProfileForm({ title, name, logoUrl, form, setForm, onUpload, onRemove, busy, save, league }: { title: string; name: string; logoUrl?: string | null; form: Record<string, any>; setForm: (f: Record<string, any>) => void; onUpload: (file: File) => void; onRemove: () => void; busy: boolean; save: () => void; league?: boolean }) {
  const set = (key: string, value: unknown) => setForm({ ...form, [key]: value })
  return <section style={box}><h3 style={{ marginTop: 0 }}>{title}</h3><div className="pf-form"><Avatar name={name} logoUrl={logoUrl} size={110} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) onUpload(file) }} /><button style={button('#fff')} disabled={!logoUrl || busy} onClick={onRemove}>Remove logo</button><Field label={league ? 'League bio for SEO' : 'Club bio for SEO'}><textarea style={{ ...input, minHeight: 150 }} value={form.description ?? ''} onChange={e => set('description', e.target.value)} /></Field>{!league && <><Field label="Primary colour"><input style={input} value={form.primaryColour ?? ''} onChange={e => set('primaryColour', e.target.value)} placeholder="#d71920" /></Field><Field label="Secondary colour"><input style={input} value={form.secondaryColour ?? ''} onChange={e => set('secondaryColour', e.target.value)} placeholder="#062a5f" /></Field></>}<Field label="Website"><input style={input} value={form.websiteUrl ?? ''} onChange={e => set('websiteUrl', e.target.value)} /></Field><Field label="Facebook"><input style={input} value={form.facebookUrl ?? ''} onChange={e => set('facebookUrl', e.target.value)} /></Field>{!league && <Field label="Instagram"><input style={input} value={form.instagramUrl ?? ''} onChange={e => set('instagramUrl', e.target.value)} /></Field>}<button style={button()} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></div></section>
}

function RelatedCards() { return <section style={box}><h3>League tools</h3><div style={{ display: 'grid', gap: 10 }}>{['👥 Clubs', '📅 Fixtures', '🏆 Ladder', '🥇 Rankings', '⚽ Goal Kickers', '📰 Articles'].map(x => <div key={x} style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, fontWeight: 900 }}>{x}</div>)}</div></section> }

function Fixtures({ toast }: { toast: Toast }) {
  const [leagues, setLeagues] = useState<FootballLeague[]>([]); const [leagueId, setLeagueId] = useState(''); const [url, setUrl] = useState('')
  useEffect(() => { admin.listFootballLeagues().then(r => { setLeagues(r); setLeagueId(r[0]?.id ?? '') }).catch(e => toast(e.message, false)) }, [])
  const run = async () => { if (!leagueId || !url.trim()) return toast('Choose a league and paste the Round 1 PlayHQ URL.', false); try { await admin.importFootballSeason(leagueId, { rounds: [{ round: 'Round 1', fixtureUrl: url.trim(), resultsUrl: url.trim() }], generateLadder: true }); toast('Fixtures import started. Rounds found, fixtures/results imported where available.') } catch (e) { toast(plainError(e), false) } }
  return <Page icon="📅" title="Fixtures"><section style={box}><h3>Import Fixtures</h3><p style={{ color: C.mute }}>Paste the Round 1 PlayHQ URL. PlayFooty will import available fixtures and results.</p><div className="pf-form"><select style={input} value={leagueId} onChange={e => setLeagueId(e.target.value)}>{leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select><input style={input} value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste Round 1 PlayHQ URL" /><button style={button()} onClick={run}>IMPORT FIXTURES</button></div></section></Page>
}

function Rankings({ toast }: { toast: Toast }) { const [busy, setBusy] = useState(false); const [summary, setSummary] = useState<string>('Rankings update automatically after imports.'); const refresh = async () => { setBusy(true); try { const r = await admin.recalculate(); setSummary(`Latest rankings generated. Clubs ranked: ${r.clubsRanked}.`); toast('Rankings refreshed') } catch (e) { toast(plainError(e), false) } finally { setBusy(false) } }; return <Page icon="🥇" title="Rankings"><section style={box}><h3>Latest rankings</h3><p style={{ color: C.mute }}>{summary}</p><button style={button()} disabled={busy} onClick={refresh}>{busy ? 'Refreshing…' : 'Refresh Rankings'}</button></section></Page> }

function Articles({ toast }: { toast: Toast }) { const [rows, setRows] = useState<ArticleRow[]>([]); useEffect(() => { admin.listArticles('ALL').then(r => setRows(r.data)).catch(e => toast(e.message, false)) }, []); return <Page icon="📰" title="Articles"><section style={box}><h3>Create Article</h3><button style={button()} onClick={() => toast('Manual article editor uses the existing article tools.')}>New Manual Article</button></section><section style={box}><h3>Suggested Stories</h3><div style={{ display: 'grid', gap: 12 }}>{['Clubs rising in rankings', 'Big ladder changes', 'Undefeated teams', 'Top goal kickers', 'Close matches'].map(s => <div key={s} style={{ border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}><strong>{s}</strong><p style={{ color: C.mute, margin: '4px 0 10px' }}>Suggested from imported PlayFooty data.</p><button style={button('#fff')}>Create Draft</button></div>)}</div></section><section style={box}><h3>Existing articles</h3>{rows.slice(0, 20).map(a => <div key={a.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>{a.title} <span style={{ color: C.mute }}>({a.status})</span></div>)}</section></Page> }

function GoalKickers() {
  const [rows, setRows] = useState<GoalKickerRow[]>([])
  const [url, setUrl] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => admin.listGoalKickers().then(setRows).catch(() => setRows([]))
  useEffect(() => { load() }, [])
  const run = async () => {
    const pastedUrl = url.trim()
    setMessage('')
    setError('')
    if (!pastedUrl) { setError('Paste a PlayHQ goal kickers/statistics URL.'); return }
    setBusy(true)
    try {
      const result = await admin.importUrl(pastedUrl)
      setMessage(result.workflowRunUrl ? `PlayHQ import dispatched. Workflow: ${result.workflowRunUrl}` : 'PlayHQ import dispatched. Goal Kickers will appear after the workflow completes.')
      await load()
    } catch (e) {
      const response = (e as Error & { response?: unknown }).response
      setError(response ? JSON.stringify(response, null, 2) : plainError(e))
    } finally {
      setBusy(false)
    }
  }
  return <Page icon="⚽" title="Goal Kickers"><section style={box}><h3>Import Goal Kickers</h3><p style={{ color: C.mute }}>Paste a PlayHQ goal kickers/statistics URL. Parsed goal rows are stored in the country-wide goal kicking ladder.</p><div className="pf-form"><input style={input} value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste PlayHQ goal kickers/statistics URL" /><button style={button()} disabled={busy} onClick={run}>{busy ? 'IMPORTING…' : 'IMPORT'}</button></div>{message && <p style={{ color: C.green, fontWeight: 900 }}>{message}</p>}{error && <pre style={{ whiteSpace: 'pre-wrap', color: C.red, background: '#fff5f5', border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>{error}</pre>}</section><section style={box}><h3>Country goal kicking ladder</h3>{rows.length === 0 ? <p style={{ color: C.mute }}>No goal kickers imported yet.</p> : rows.map(r => <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.line}`, padding: '10px 0', gap: 12 }}><span><strong>{r.playerName}</strong><br/><small style={{ color: C.mute }}>{r.clubName} · {r.leagueName}</small></span><strong>{r.goals}</strong></div>)}</section></Page>
}
function Settings() { return <Page icon="⚙️" title="Settings"><section style={box}><h3>Logo storage</h3><p style={{ color: C.mute }}>Logo upload uses Supabase Storage bucket <strong>playfooty-logos</strong>. Accepted: png, jpg/jpeg and webp. Max size: 5MB.</p></section></Page> }

function Field({ label, children }: { label: string; children: ReactNode }) { return <label style={{ display: 'grid', gap: 6, fontWeight: 850, color: C.text }}>{label}{children}</label> }
function Avatar({ name, logoUrl, size = 84 }: { name: string; logoUrl?: string | null; size?: number }) { return <div style={{ width: size, height: size, borderRadius: 24, background: C.soft, display: 'grid', placeItems: 'center', overflow: 'hidden', border: `1px solid ${C.line}`, color: C.blueDark, fontSize: size * .32, fontWeight: 950 }}>{logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : initials(name)}</div> }
const initials = (name?: string | null) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
const plainError = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^HTTP \d+:?\s*/i, '') || 'Something went wrong.'
function logoPayload(file: File) { return new Promise<{ fileName: string; contentType: string; dataUrl: string }>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve({ fileName: file.name, contentType: file.type || 'image/png', dataUrl: String(r.result) }); r.onerror = () => reject(r.error); r.readAsDataURL(file) }) }
