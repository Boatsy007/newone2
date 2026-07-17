/** PlayFooty Admin — simplified operations workflows. */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { admin, getKey, setKey, clearKey, type AdminClub, type FootballLeague, type LeagueProfileDetail, type ClubProfileDetail, type ArticleRow, type GoalKickerRow } from '../lib/admin'

const C = { bg: '#f7f8fb', panel: '#fff', line: '#e6eaf2', text: '#172033', mute: '#68758a', red: '#d71920', soft: '#fff4f4', green: '#128a4a', gold: '#f4c14d' }
const box: CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 22, padding: 22, boxShadow: '0 18px 42px rgba(23,32,51,.08)' }
const input: CSSProperties = { width: '100%', border: `1px solid ${C.line}`, borderRadius: 14, padding: '13px 14px', font: 'inherit', color: C.text, background: '#fff', boxSizing: 'border-box', outlineColor: C.red }
const button = (bg = C.red): CSSProperties => ({ border: bg === '#fff' ? `1px solid ${C.line}` : 'none', borderRadius: 999, background: bg, color: bg === '#fff' ? C.text : '#fff', padding: '11px 16px', fontWeight: 900, cursor: 'pointer', boxShadow: bg === C.red ? '0 10px 22px rgba(215,25,32,.18)' : 'none' })
const css = `.pf-admin *{box-sizing:border-box}.pf-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.pf-two{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px}.pf-form{display:grid;gap:12px}.pf-card-button{transition:.16s transform,.16s box-shadow}.pf-card-button:hover{transform:translateY(-2px);box-shadow:0 22px 48px rgba(23,32,51,.12)!important}@media(max-width:820px){.pf-grid,.pf-two{grid-template-columns:1fr}.pf-admin h1{font-size:42px!important}}`

type Area = 'home' | 'leagues' | 'clubs' | 'fixtures' | 'rankings' | 'articles' | 'goalKickers' | 'settings'

type Toast = (message: string, ok?: boolean) => void

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const show: Toast = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4200) }
  return { show, node: msg ? <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 20, background: msg.ok ? C.green : C.red, color: '#fff', borderRadius: 14, padding: '12px 16px', fontWeight: 900, maxWidth: 420 }}>{msg.text}</div> : null }
}

export default function Admin() {
  const [authed, setAuthed] = useState(!!getKey())
  const [area, setArea] = useState<Area>('home')
  const toast = useToast()
  if (!authed) return <Login onIn={() => setAuthed(true)} />
  return <div className="pf-admin" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}><style>{css}</style><main style={{ maxWidth: 1240, margin: '0 auto', padding: '26px clamp(14px,4vw,30px) 52px' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}><div><div style={{ color: C.red, fontSize: 12, letterSpacing: '.18em', fontWeight: 950 }}>PLAYFOOTY</div><h1 style={{ margin: 0, fontSize: 56, letterSpacing: '-.07em' }}>Operations</h1></div><div style={{ display: 'flex', gap: 8 }}>{area !== 'home' && <button style={button('#fff')} onClick={() => setArea('home')}>← Home</button>}<button style={button('#fff')} onClick={() => { clearKey(); setAuthed(false) }}>Sign out</button></div></header>
    {area === 'home' && <Home go={setArea} />}
    {area === 'leagues' && <Leagues toast={toast.show} />}
    {area === 'clubs' && <Clubs toast={toast.show} />}
    {area === 'fixtures' && <Fixtures toast={toast.show} />}
    {area === 'rankings' && <Rankings toast={toast.show} />}
    {area === 'articles' && <Articles toast={toast.show} />}
    {area === 'goalKickers' && <GoalKickers />}
    {area === 'settings' && <Settings />}
  </main>{toast.node}</div>
}

function Login({ onIn }: { onIn: () => void }) {
  const [key, setLocalKey] = useState('')
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: C.bg, padding: 20 }}><div style={{ ...box, width: 420 }}><h1 style={{ marginTop: 0 }}>PlayFooty Admin</h1><p style={{ color: C.mute }}>Enter the admin key to continue.</p><input style={input} type="password" value={key} onChange={e => setLocalKey(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && key.trim()) { setKey(key.trim()); onIn() } }} /><button style={{ ...button(), marginTop: 12, width: '100%' }} onClick={() => { if (key.trim()) { setKey(key.trim()); onIn() } }}>Open admin</button></div></div>
}

function Home({ go }: { go: (area: Area) => void }) {
  const cards: Array<{ area: Area; icon: string; title: string; text: string }> = [
    { area: 'leagues', icon: '🏆', title: 'Leagues', text: 'Import and edit league profiles.' },
    { area: 'clubs', icon: '👥', title: 'Clubs', text: 'Logos, colours, teams and links.' },
    { area: 'fixtures', icon: '📅', title: 'Fixtures', text: 'Import fixtures and results.' },
    { area: 'rankings', icon: '🥇', title: 'Rankings', text: 'Refresh national rankings.' },
    { area: 'articles', icon: '📰', title: 'Articles', text: 'Create and publish stories.' },
    { area: 'goalKickers', icon: '⚽', title: 'Goal Kickers', text: 'Import and view goal ladders.' },
    { area: 'settings', icon: '⚙️', title: 'Settings', text: 'Logo storage and account setup.' },
  ]
  return <div style={{ display: 'grid', gap: 24 }}><section style={{ ...box, textAlign: 'center', padding: 'clamp(32px,7vw,64px)', background: 'linear-gradient(180deg,#fff,#fff8f8)' }}><div style={{ color: C.red, fontWeight: 950, letterSpacing: '.16em', fontSize: 12 }}>WEBSITE BUILDER</div><h2 style={{ margin: '12px auto', fontSize: 'clamp(44px,9vw,92px)', letterSpacing: '-.08em', lineHeight: .85, maxWidth: 860 }}>What would you like to update?</h2><p style={{ color: C.mute, margin: '0 auto', maxWidth: 640, fontSize: 18 }}>Simple PlayFooty workflows only. Paste PlayHQ URLs when importing; edit logos, bios, colours and stories here.</p></section><div className="pf-grid">{cards.map(card => <button key={card.area} className="pf-card-button" style={{ ...box, aspectRatio: '1/1', minHeight: 210, display: 'grid', placeItems: 'center', textAlign: 'center', cursor: 'pointer', color: C.text }} onClick={() => go(card.area)}><span style={{ fontSize: 52 }}>{card.icon}</span><strong style={{ fontSize: 28, letterSpacing: '-.05em' }}>{card.title}</strong><span style={{ color: C.mute }}>{card.text}</span></button>)}</div></div>
}

function Page({ icon, title, children }: { icon: string; title: string; children: ReactNode }) { return <div style={{ display: 'grid', gap: 18 }}><section style={{ ...box, display: 'flex', alignItems: 'center', gap: 16 }}><span style={{ fontSize: 44 }}>{icon}</span><div><h2 style={{ margin: 0, fontSize: 46, letterSpacing: '-.065em' }}>{title}</h2><p style={{ margin: '4px 0 0', color: C.mute }}>Focused tools only.</p></div></section>{children}</div> }

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
  return <Page icon="🏆" title="Leagues"><section style={{ ...box, textAlign: 'center', padding: 34 }}><h3 style={{ marginTop: 0, fontSize: 34, letterSpacing: '-.055em' }}>Import League</h3><p style={{ color: C.mute }}>Paste the PlayHQ ladder URL. PlayFooty detects the league, clubs, teams, ladder, fixtures and results.</p><div style={{ maxWidth: 780, margin: '0 auto', display: 'grid', gap: 12 }}><input style={{ ...input, padding: 18 }} value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste PlayHQ ladder URL" /><button disabled={busy} style={{ ...button(), padding: 16 }} onClick={run}>{busy ? 'IMPORTING…' : 'IMPORT LEAGUE'}</button></div>{result && <div style={{ marginTop: 18, color: C.green, fontWeight: 900 }}>✓ Workflow started · ✓ League will appear after import · <a href={result} target="_blank" rel="noreferrer" style={{ color: C.red }}>Open run</a></div>}</section><section style={box}><h3>Leagues</h3><div style={{ display: 'grid', gap: 12 }}>{rows.map(l => <div key={l.id} style={{ border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><strong>{l.name}</strong><div style={{ color: C.mute, fontSize: 13 }}>{l.state?.code ?? '—'} · {l._count?.clubSeasons ?? 0} clubs · Ladder {l._count?.footballLadderEntries ?? 0 ? 'ready' : 'waiting'}</div></div><button style={button('#fff')} onClick={() => setEditing(l.id)}>Open League</button></div>)}{rows.length === 0 && <p style={{ color: C.mute }}>No leagues yet.</p>}</div></section></Page>
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
function Avatar({ name, logoUrl, size = 84 }: { name: string; logoUrl?: string | null; size?: number }) { return <div style={{ width: size, height: size, borderRadius: 24, background: C.soft, display: 'grid', placeItems: 'center', overflow: 'hidden', border: `1px solid ${C.line}`, color: C.red, fontSize: size * .32, fontWeight: 950 }}>{logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : initials(name)}</div> }
const initials = (name?: string | null) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
const plainError = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^HTTP \d+:?\s*/i, '') || 'Something went wrong.'
function logoPayload(file: File) { return new Promise<{ fileName: string; contentType: string; dataUrl: string }>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve({ fileName: file.name, contentType: file.type || 'image/png', dataUrl: String(r.result) }); r.onerror = () => reject(r.error); r.readAsDataURL(file) }) }
