import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, Award, Clock3, ExternalLink, Play, ShieldCheck, Trophy, Upload, Vote } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { useSeo } from '../lib/seo'

type Category = 'goal' | 'mark' | 'play' | 'performance'
type Highlight = {
  id: string
  category: Category
  playerName: string
  clubId?: string | null
  clubName: string
  leagueId?: string | null
  leagueName?: string | null
  matchDate?: string | null
  roundLabel?: string | null
  videoUrl: string
  thumbnailUrl?: string | null
  description?: string | null
  weekKey: string
  votingOpensAt?: string | null
  votingClosesAt?: string | null
  votingOpen: boolean
  winner: boolean
  votes: number
}

type CategoryDefinition = {
  id: Category
  title: string
  eyebrow: string
  description: string
  icon: typeof Trophy
}

const categories: CategoryDefinition[] = [
  { id: 'goal', title: 'Goal of the week', eyebrow: 'The impossible finish', description: 'The best snaps, runs, set shots and match-winning goals.', icon: Trophy },
  { id: 'mark', title: 'Mark of the week', eyebrow: 'The biggest grabs', description: 'Contested marks, high flyers and courageous intercepts.', icon: Award },
  { id: 'play', title: 'Play of the week', eyebrow: 'The moment that changed it', description: 'Team football, pressure acts, chases and brilliant passages.', icon: Play },
  { id: 'performance', title: 'Performance of the week', eyebrow: 'The standout player', description: 'The complete individual performance deserving a national spotlight.', icon: ShieldCheck },
]

export default function Highlights() {
  const [rows, setRows] = useState<Highlight[]>([])
  const [archive, setArchive] = useState<Highlight[]>([])
  const [weekKey, setWeekKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [showSubmit, setShowSubmit] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/highlights').then(response => response.ok ? response.json() : Promise.reject(new Error('Unable to load highlights'))),
      fetch('/api/highlights/archive').then(response => response.ok ? response.json() : Promise.reject(new Error('Unable to load archive'))),
    ])
      .then(([current, past]) => {
        setRows(Array.isArray(current.data) ? current.data : [])
        setWeekKey(current.meta?.weekKey ?? '')
        setArchive(Array.isArray(past.data) ? past.data : [])
      })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Unable to load highlights'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useSeo({
    title: 'Weekly Awards & Community Football Highlights | PlayFooty',
    description: "Vote for Australia's best community football goals, marks, plays and performances each week.",
    path: '/highlights',
  })

  const groups = useMemo(() => {
    const grouped: Record<Category, Highlight[]> = { goal: [], mark: [], play: [], performance: [] }
    rows.forEach(row => grouped[row.category].push(row))
    return grouped
  }, [rows])

  const openCount = rows.filter(row => row.votingOpen).length

  const vote = async (row: Highlight) => {
    setMessage('')
    const response = await fetch(`/api/highlights/${row.id}/vote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const json = await response.json().catch(() => ({})) as { error?: string; data?: { votes?: number } }
    if (!response.ok) {
      setMessage(json.error ?? 'Vote could not be recorded')
      return
    }
    setRows(current => current.map(item => item.id === row.id ? { ...item, votes: json.data?.votes ?? item.votes } : item))
    setMessage(`Your vote for ${row.playerName} has been recorded.`)
  }

  return <div className="pf-awards-page">
    <Nav />
    <main id="main-content">
      <section className="pf-awards-hero">
        <div className="pf-awards-shell pf-awards-hero-inner">
          <div className="pf-awards-hero-copy">
            <span className="pf-awards-kicker"><Vote size={16} /> Fan voted. Club driven.</span>
            <h1>PlayFooty<br /><em>weekly awards</em></h1>
            <p>Australia's best community football moments, chosen by the people who live them.</p>
            <div className="pf-awards-actions">
              <a href="#awards" className="primary">Vote now <ArrowRight size={18} /></a>
              <button type="button" onClick={() => setShowSubmit(true)}><Upload size={17} /> Submit a highlight</button>
            </div>
          </div>
          <div className="pf-awards-hero-panel">
            <span><i /> {openCount ? 'Voting live now' : 'Weekly voting'}</span>
            <strong>{rows.length ? `${rows.length} nominees` : 'Nominees coming soon'}</strong>
            <p>{rows.length ? `Week ${weekKey}. Choose one nominee in each category while voting is open.` : 'Clubs and supporters can submit verified highlights for moderation.'}</p>
            <div><Clock3 size={18} /><span>{openCount ? 'Live vote totals update after every accepted vote.' : 'Voting windows are set by PlayFooty after moderation.'}</span></div>
          </div>
        </div>
      </section>

      {message && <div className="pf-awards-message">{message}</div>}

      <section id="awards" className="pf-awards-shell pf-awards-section">
        <header className="pf-awards-heading">
          <div><span>Choose the moment</span><h2>This week's awards</h2></div>
          <p>Every nominee below has been reviewed and approved before publication.</p>
        </header>
        {loading
          ? <div className="pf-awards-empty">Loading this week's nominees…</div>
          : <div className="pf-awards-category-stack">{categories.map(category => <CategoryBlock key={category.id} category={category} rows={groups[category.id]} vote={vote} />)}</div>}
      </section>

      <section className="pf-awards-process">
        <div className="pf-awards-shell">
          <header className="pf-awards-heading light"><div><span>How it works</span><h2>From local moment to national winner</h2></div></header>
          <div className="pf-awards-steps">
            <Step number="01" icon={Upload} title="Submit" text="Supporters and clubs send the video, player, club, league and match details." />
            <Step number="02" icon={ShieldCheck} title="Moderation" text="PlayFooty checks every submission before it becomes a public nominee." />
            <Step number="03" icon={Vote} title="Vote" text="One vote per category each week from each supporter or device." />
            <Step number="04" icon={Trophy} title="Winner" text="The winning moment is selected and preserved in the permanent archive." />
          </div>
        </div>
      </section>

      <section className="pf-awards-shell pf-awards-archive">
        <div><span>Hall of fame</span><h2>Every winner.<br />Every week.<br /><em>Forever.</em></h2><p>Weekly winners remain attached to their player, club, league and original video.</p></div>
        <div className="pf-awards-archive-list">
          {archive.map(row => <a key={row.id} href={row.videoUrl} target="_blank" rel="noreferrer"><Trophy size={20} /><span><strong>{row.playerName}</strong><small>{row.clubName} · {row.weekKey} · {row.votes} votes</small></span><ExternalLink size={16} /></a>)}
          {archive.length === 0 && <div className="pf-awards-empty">No winners have been published yet.</div>}
        </div>
      </section>

      <section className="pf-awards-cta"><div className="pf-awards-shell"><div><span>Captured something special?</span><strong>Put your club's moment in front of Australia.</strong></div><button type="button" onClick={() => setShowSubmit(true)}>Submit highlight <ArrowRight size={18} /></button></div></section>
      {showSubmit && <SubmissionModal close={() => setShowSubmit(false)} submitted={text => { setShowSubmit(false); setMessage(text) }} />}
    </main>
    <Footer />
    <Styles />
  </div>
}

function CategoryBlock({ category, rows, vote }: { category: CategoryDefinition; rows: Highlight[]; vote: (row: Highlight) => void }) {
  const Icon = category.icon
  return <section className="pf-category">
    <header><span><Icon size={21} /></span><div><small>{category.eyebrow}</small><h3>{category.title}</h3><p>{category.description}</p></div></header>
    {rows.length ? <div className="pf-nominee-grid">{rows.map(row => <Nominee key={row.id} row={row} vote={vote} />)}</div> : <div className="pf-awards-empty">No approved nominees in this category yet.</div>}
  </section>
}

function Nominee({ row, vote }: { row: Highlight; vote: (row: Highlight) => void }) {
  const mediaStyle = row.thumbnailUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.16),rgba(0,0,0,.38)),url(${row.thumbnailUrl})` } : undefined
  return <article className="pf-nominee">
    <a href={row.videoUrl} target="_blank" rel="noreferrer" className="pf-nominee-media" style={mediaStyle}><Play size={34} fill="currentColor" /><span>Watch highlight</span></a>
    <div className="pf-nominee-copy">
      {row.winner && <span className="winner"><Trophy size={13} /> Weekly winner</span>}
      <h4>{row.playerName}</h4><strong>{row.clubName}</strong>
      <small>{row.leagueName || 'Community football'}{row.roundLabel ? ` · ${row.roundLabel}` : ''}</small>
      {row.description && <p>{row.description}</p>}
      <div><b>{row.votes} votes</b><button type="button" disabled={!row.votingOpen} onClick={() => vote(row)}>{row.votingOpen ? 'Vote' : 'Voting closed'}</button></div>
    </div>
  </article>
}

function SubmissionModal({ close, submitted }: { close: () => void; submitted: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    const response = await fetch('/api/highlights/submissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const json = await response.json().catch(() => ({})) as { error?: string }
    setBusy(false)
    if (!response.ok) {
      setError(json.error ?? 'Submission failed')
      return
    }
    submitted('Highlight submitted. PlayFooty will review it before it appears publicly.')
  }

  return <div className="pf-submit-backdrop" onClick={close}>
    <form className="pf-submit-modal" onClick={event => event.stopPropagation()} onSubmit={submit}>
      <header><div><span>Weekly awards</span><h2>Submit a highlight</h2></div><button type="button" onClick={close}>×</button></header>
      <div className="pf-submit-grid">
        <label>Category<select name="category" required>{categories.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
        <label>Player name<input name="playerName" required /></label>
        <label>Club name<input name="clubName" required /></label>
        <label>League name<input name="leagueName" /></label>
        <label>Match date<input type="date" name="matchDate" /></label>
        <label>Round<input name="roundLabel" placeholder="Round 8" /></label>
        <label className="wide">Video URL<input type="url" name="videoUrl" required placeholder="YouTube, Vimeo, Facebook or direct video link" /></label>
        <label className="wide">Thumbnail URL<input type="url" name="thumbnailUrl" placeholder="Optional image URL" /></label>
        <label className="wide">Description<textarea name="description" rows={3} /></label>
        <label>Your name<input name="submitterName" required /></label>
        <label>Your email<input type="email" name="submitterEmail" required /></label>
      </div>
      {error && <p className="pf-submit-error">{error}</p>}
      <footer><small>Submission does not guarantee publication. Videos must be yours to share or supplied with permission.</small><button disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'}</button></footer>
    </form>
  </div>
}

function Step({ number, icon: Icon, title, text }: { number: string; icon: typeof Trophy; title: string; text: string }) {
  return <article><span>{number}</span><Icon size={24} /><h3>{title}</h3><p>{text}</p></article>
}

function Styles() {
  return <style>{`
    .pf-awards-page{min-height:100vh;background:#fff;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.pf-awards-shell{width:min(1280px,calc(100% - 48px));margin:0 auto}.pf-awards-hero{background:#050505;color:#fff;border-bottom:5px solid #42b8ff}.pf-awards-hero-inner{min-height:560px;display:grid;grid-template-columns:1.15fr .85fr;gap:70px;align-items:center;padding:64px 0}.pf-awards-kicker,.pf-awards-heading span,.pf-awards-archive>div>span,.pf-submit-modal header span{color:#42b8ff;font-size:11px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}.pf-awards-hero h1,.pf-awards-heading h2,.pf-category h3,.pf-nominee h4,.pf-awards-process h3,.pf-awards-archive h2,.pf-awards-hero-panel strong,.pf-awards-cta strong,.pf-submit-modal h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.pf-awards-hero h1{font-size:clamp(5rem,9vw,9rem);line-height:.78;margin:18px 0}.pf-awards-hero h1 em,.pf-awards-archive h2 em{font-style:normal;color:#42b8ff}.pf-awards-hero-copy>p{font-size:20px;color:#d8dee5}.pf-awards-actions{display:flex;gap:12px;margin-top:28px;flex-wrap:wrap}.pf-awards-actions a,.pf-awards-actions button,.pf-awards-cta button{display:inline-flex;align-items:center;gap:9px;min-height:48px;padding:0 20px;border-radius:7px;text-transform:uppercase;font-size:12px;font-weight:900;cursor:pointer}.pf-awards-actions .primary,.pf-awards-cta button{background:#42b8ff;color:#050505;border:0;text-decoration:none}.pf-awards-actions button{background:transparent;color:#fff;border:1px solid #555}.pf-awards-hero-panel{padding:30px;border:1px solid #333;border-radius:12px;background:#0d0f12}.pf-awards-hero-panel>span{display:flex;gap:9px;align-items:center;font-weight:900;text-transform:uppercase;font-size:11px}.pf-awards-hero-panel i{width:9px;height:9px;background:#42b8ff;border-radius:50%}.pf-awards-hero-panel strong{display:block;font-size:clamp(3rem,5vw,5rem);line-height:.85;margin-top:28px}.pf-awards-hero-panel p{color:#cbd3dc;line-height:1.5}.pf-awards-hero-panel>div{display:flex;gap:10px;color:#42b8ff;border-top:1px solid #333;padding-top:20px}.pf-awards-message{position:sticky;top:76px;z-index:30;background:#e8f7ff;border-bottom:1px solid #b7e4ff;padding:13px;text-align:center;font-weight:850}.pf-awards-section{padding:64px 0}.pf-awards-heading{display:flex;justify-content:space-between;align-items:end;gap:30px;margin-bottom:25px}.pf-awards-heading h2{font-size:clamp(3rem,5.5vw,5.5rem);line-height:.86;margin:6px 0}.pf-awards-heading p{max-width:430px;color:#687385}.pf-awards-category-stack{display:grid;gap:24px}.pf-category{border:1px solid #e0e5ea;border-radius:12px;padding:22px;background:#fff}.pf-category>header{display:flex;gap:15px;align-items:flex-start;margin-bottom:18px}.pf-category>header>span{display:grid;place-items:center;width:44px;height:44px;border-radius:8px;background:#42b8ff;flex:0 0 auto}.pf-category h3{font-size:38px;line-height:.9;margin:5px 0}.pf-category header small{color:#42b8ff;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.14em}.pf-category header p{margin:0;color:#687385}.pf-nominee-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.pf-nominee{overflow:hidden;border:1px solid #e1e6eb;border-radius:10px;background:#fff}.pf-nominee-media{aspect-ratio:16/9;background:#111 center/cover;display:grid;place-items:center;align-content:center;gap:8px;color:#42b8ff;text-decoration:none}.pf-nominee-media span{color:#fff;font-size:11px;font-weight:900;text-transform:uppercase}.pf-nominee-copy{padding:17px}.pf-nominee-copy .winner{display:inline-flex;align-items:center;gap:5px;background:#42b8ff;color:#050505;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:900;text-transform:uppercase}.pf-nominee h4{font-size:30px;margin:11px 0 3px}.pf-nominee-copy>strong,.pf-nominee-copy>small{display:block}.pf-nominee-copy>small{color:#687385;margin-top:4px}.pf-nominee-copy>p{color:#687385;line-height:1.45}.pf-nominee-copy>div{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:15px;padding-top:14px;border-top:1px solid #e5e9ed}.pf-nominee-copy button{border:0;border-radius:7px;background:#42b8ff;color:#050505;padding:10px 15px;font-weight:900;text-transform:uppercase;cursor:pointer}.pf-nominee-copy button:disabled{background:#edf0f3;color:#87919d;cursor:not-allowed}.pf-awards-empty{padding:28px;text-align:center;color:#687385;background:#f6f8fa;border:1px dashed #cfd6de;border-radius:9px}.pf-awards-process{background:#050505;color:#fff;padding:68px 0}.pf-awards-heading.light h2{color:#fff}.pf-awards-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.pf-awards-steps article{position:relative;padding:24px;border:1px solid #2b2d31;border-radius:10px;background:#0c0d0f}.pf-awards-steps article>span{position:absolute;right:18px;top:15px;color:#42b8ff;font-family:'Bebas Neue',Impact,sans-serif;font-size:28px}.pf-awards-steps svg{color:#42b8ff;margin-top:18px}.pf-awards-steps h3{font-size:29px;margin:20px 0 8px}.pf-awards-steps p{color:#b9c2cc;line-height:1.5}.pf-awards-archive{display:grid;grid-template-columns:1fr 1fr;gap:55px;align-items:center;padding:72px 0}.pf-awards-archive h2{font-size:clamp(4rem,7vw,7rem);line-height:.8;margin:8px 0}.pf-awards-archive>div>p{color:#687385;line-height:1.6}.pf-awards-archive-list{display:grid;gap:10px}.pf-awards-archive-list>a{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #e0e5ea;border-radius:9px;color:#111318;text-decoration:none}.pf-awards-archive-list>a>svg:first-child{color:#42b8ff}.pf-awards-archive-list>a>span{flex:1}.pf-awards-archive-list strong,.pf-awards-archive-list small{display:block}.pf-awards-archive-list small{color:#687385;margin-top:3px}.pf-awards-cta{background:#42b8ff}.pf-awards-cta>.pf-awards-shell{min-height:150px;display:flex;align-items:center;justify-content:space-between;gap:20px}.pf-awards-cta span{font-size:11px;font-weight:900;text-transform:uppercase}.pf-awards-cta strong{display:block;font-size:36px;margin-top:4px}.pf-awards-cta button{background:#050505;color:#fff;border:0}.pf-submit-backdrop{position:fixed;inset:0;z-index:150;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:20px}.pf-submit-modal{width:min(760px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:12px;padding:24px}.pf-submit-modal header{display:flex;justify-content:space-between;gap:20px}.pf-submit-modal h2{font-size:48px;margin:5px 0 20px}.pf-submit-modal header button{border:0;background:transparent;font-size:32px;cursor:pointer}.pf-submit-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.pf-submit-grid label{display:grid;gap:6px;font-size:12px;font-weight:850}.pf-submit-grid .wide{grid-column:1/-1}.pf-submit-grid input,.pf-submit-grid select,.pf-submit-grid textarea{width:100%;box-sizing:border-box;border:1px solid #dce2e8;border-radius:8px;padding:12px;font:inherit}.pf-submit-error{color:#c5161d;font-weight:850}.pf-submit-modal footer{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:18px}.pf-submit-modal footer small{color:#687385;max-width:430px}.pf-submit-modal footer button{border:0;border-radius:7px;background:#42b8ff;padding:13px 18px;font-weight:900;text-transform:uppercase;cursor:pointer}
    @media(max-width:900px){.pf-awards-hero-inner,.pf-awards-archive{grid-template-columns:1fr;gap:30px}.pf-nominee-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pf-awards-steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:620px){.pf-awards-shell{width:min(100% - 28px,1280px)}.pf-awards-hero-inner{padding:45px 0}.pf-awards-hero h1{font-size:4.8rem}.pf-awards-heading{display:block}.pf-nominee-grid,.pf-awards-steps,.pf-submit-grid{grid-template-columns:1fr}.pf-submit-grid .wide{grid-column:auto}.pf-awards-cta>.pf-awards-shell,.pf-submit-modal footer{align-items:flex-start;flex-direction:column;padding-top:24px;padding-bottom:24px}.pf-submit-backdrop{padding:0}.pf-submit-modal{height:100%;max-height:none;border-radius:0}.pf-awards-message{top:72px}}
  `}</style>
}
