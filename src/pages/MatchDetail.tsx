import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { useSeo } from '../lib/seo'

type MatchData = {
  id: string
  leagueId?: string | null
  leagueName?: string | null
  season?: string | null
  grade?: string | null
  round?: number | string | null
  matchDate?: string | null
  matchTime?: string | null
  venue?: string | null
  homeClubId?: string | null
  homeClubName?: string | null
  homeName?: string | null
  awayClubId?: string | null
  awayClubName?: string | null
  awayName?: string | null
  homeScore?: number | null
  awayScore?: number | null
  homePoints?: number | null
  awayPoints?: number | null
  homeGoals?: number | null
  homeBehinds?: number | null
  awayGoals?: number | null
  awayBehinds?: number | null
  status?: string | null
  sourceUrl?: string | null
  verified?: boolean | null
}

type Payload = { data?: MatchData; error?: string }

export default function MatchDetail() {
  const { kind = 'fixture', matchId = '' } = useParams()
  const safeKind = kind === 'result' ? 'result' : 'fixture'
  const [data, setData] = useState<MatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetch(`/api/${safeKind === 'result' ? 'results' : 'fixtures'}/${encodeURIComponent(matchId)}`)
      .then(async response => {
        const payload = await response.json() as Payload
        if (!response.ok || !payload.data) throw new Error(payload.error ?? 'Match not found')
        return payload.data
      })
      .then(next => { if (active) setData(next) })
      .catch((reason: Error) => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [matchId, safeKind])

  const home = data?.homeClubName ?? data?.homeName ?? 'Home team'
  const away = data?.awayClubName ?? data?.awayName ?? 'Away team'
  const title = data ? `${home} v ${away} | PlayFooty Match Centre` : 'Match Centre | PlayFooty'
  useSeo({ title, description: data ? `${home} versus ${away}. View match details, score, venue, round and competition information.` : 'Community football match details.', path: `/match/${safeKind}/${matchId}` })

  return <div className="md-page"><Nav /><main>
    {loading && <div className="md-state">Loading match centre…</div>}
    {!loading && error && <div className="md-state error">{error}</div>}
    {!loading && data && <>
      <section className="md-hero"><div className="md-shell">
        <div className="md-breadcrumb"><Link to="/matches">Match Centre</Link><span>›</span>{data.leagueId ? <Link to={`/league/${data.leagueId}`}>{data.leagueName ?? 'League'}</Link> : <span>{data.leagueName ?? 'Community football'}</span>}</div>
        <div className="md-meta"><span>{safeKind === 'result' ? 'Final result' : data.status ?? 'Upcoming fixture'}</span><small>{formatDate(data.matchDate)}{data.round != null ? ` · Round ${data.round}` : ''}{data.grade ? ` · ${data.grade}` : ''}</small></div>
        <div className="md-scoreboard">
          <TeamBlock id={data.homeClubId} name={home} />
          <ScoreBlock data={data} result={safeKind === 'result'} />
          <TeamBlock id={data.awayClubId} name={away} />
        </div>
      </div></section>
      <section className="md-shell md-grid">
        <article className="md-card"><header><span>Match information</span><h2>Game details</h2></header><dl>
          <Info label="Competition" value={data.leagueName ?? 'Not provided'} link={data.leagueId ? `/league/${data.leagueId}` : undefined} />
          <Info label="Season" value={data.season ?? 'Not provided'} />
          <Info label="Grade" value={data.grade ?? 'Not provided'} />
          <Info label="Round" value={data.round == null ? 'Not provided' : String(data.round)} />
          <Info label="Date" value={formatDate(data.matchDate)} />
          <Info label="Time" value={data.matchTime ?? 'Not provided'} />
          <Info label="Venue" value={data.venue ?? 'Not provided'} />
          <Info label="Data status" value={data.verified ? 'Verified' : 'Imported'} />
        </dl></article>
        <aside className="md-card"><header><span>Quick links</span><h2>Explore</h2></header><div className="md-links">
          {data.homeClubId && <Link to={`/team/${data.homeClubId}`}>View {home}</Link>}
          {data.awayClubId && <Link to={`/team/${data.awayClubId}`}>View {away}</Link>}
          {data.leagueId && <Link to={`/league/${data.leagueId}`}>View league</Link>}
          <Link to="/matches">All fixtures and results</Link>
          {data.sourceUrl && <a href={data.sourceUrl} target="_blank" rel="noreferrer">Open source record</a>}
        </div></aside>
      </section>
    </>}
  </main><Footer /><style>{styles}</style></div>
}

function TeamBlock({ id, name }: { id?: string | null; name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join('').toUpperCase() || 'FC'
  const content = <><span>{initials}</span><strong>{name}</strong></>
  return id ? <Link to={`/team/${id}`} className="md-team">{content}</Link> : <div className="md-team">{content}</div>
}

function ScoreBlock({ data, result }: { data: MatchData; result: boolean }) {
  const home = data.homeScore ?? data.homePoints
  const away = data.awayScore ?? data.awayPoints
  if (!result) return <div className="md-score"><b>VS</b><small>{data.matchTime ?? data.status ?? 'Scheduled'}</small></div>
  return <div className="md-score"><div><b>{home ?? '—'}</b>{data.homeGoals != null && <small>{data.homeGoals}.{data.homeBehinds ?? 0}</small>}</div><i>Final</i><div><b>{away ?? '—'}</b>{data.awayGoals != null && <small>{data.awayGoals}.{data.awayBehinds ?? 0}</small>}</div></div>
}

function Info({ label, value, link }: { label: string; value: string; link?: string }) { return <div><dt>{label}</dt><dd>{link ? <Link to={link}>{value}</Link> : value}</dd></div> }
function formatDate(value?: string | null) { if (!value) return 'Date to be confirmed'; return new Date(value).toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) }

const styles = `.md-page{min-height:100vh;background:#f3f5f7;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.md-shell{width:min(1120px,calc(100% - 36px));margin:0 auto}.md-state{min-height:65vh;display:grid;place-items:center;font-weight:950;text-transform:uppercase;letter-spacing:.12em}.md-state.error{color:#d71920}.md-hero{background:#050505;color:#fff;border-bottom:5px solid #2daaf5;padding:28px 0 48px}.md-breadcrumb{display:flex;align-items:center;gap:9px;color:#9da8b5;font-size:12px;font-weight:850}.md-breadcrumb a{color:#fff;text-decoration:none}.md-meta{text-align:center;margin-top:25px}.md-meta span{display:block;color:#2daaf5;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.16em}.md-meta small{display:block;margin-top:8px;color:#c8d0da;font-weight:800}.md-scoreboard{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:30px;margin-top:32px}.md-team{display:flex;flex-direction:column;align-items:center;text-align:center;color:#fff;text-decoration:none}.md-team>span{width:96px;height:96px;border-radius:20px;background:#2daaf5;color:#050505;display:grid;place-items:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px}.md-team strong{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(2rem,5vw,4.8rem);line-height:.88;margin-top:15px}.md-score{display:flex;align-items:center;gap:16px;text-align:center}.md-score>div{display:grid}.md-score b{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4.5rem,10vw,8rem);line-height:.8;color:#2daaf5}.md-score i,.md-score small{font-style:normal;text-transform:uppercase;font-size:10px;font-weight:950;letter-spacing:.12em;color:#9da8b5}.md-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start;padding:28px 0 56px}.md-card{background:#fff;border:1px solid #dfe5eb;border-radius:12px;padding:24px;box-shadow:0 7px 22px rgba(17,24,39,.06)}.md-card header span{color:#2daaf5;text-transform:uppercase;font-size:10px;font-weight:950;letter-spacing:.15em}.md-card h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:42px;line-height:.9;margin:6px 0 20px}.md-card dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0}.md-card dl>div{background:#f7f9fb;border:1px solid #e7ebef;border-radius:10px;padding:14px}.md-card dt{color:#687385;text-transform:uppercase;font-size:9px;font-weight:950;letter-spacing:.12em}.md-card dd{margin:6px 0 0;font-weight:850}.md-card dd a{color:#111318}.md-links{display:grid;gap:9px}.md-links a{display:block;border:1px solid #dfe5eb;border-radius:9px;padding:12px 14px;color:#111318;text-decoration:none;font-weight:850}.md-links a:hover{border-color:#2daaf5;color:#087bbf}@media(max-width:760px){.md-shell{width:min(100% - 24px,1120px)}.md-scoreboard{gap:8px}.md-team>span{width:58px;height:58px;border-radius:13px;font-size:25px}.md-team strong{font-size:2rem}.md-score{gap:8px}.md-score b{font-size:4rem}.md-grid{grid-template-columns:1fr}.md-card dl{grid-template-columns:1fr}.md-hero{padding-bottom:34px}}`