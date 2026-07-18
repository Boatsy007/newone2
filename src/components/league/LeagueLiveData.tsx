import { useEffect, useMemo, useState } from 'react'
import { Bell, ExternalLink, Facebook } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LeagueDetail } from '../../lib/rankings'
import { TeamLogo } from '../rankings/bits'

const BLUE = '#42b8ff'
const INK = '#0c0e13'
const LINE = '#e2e7ed'
const MUTE = '#687385'

function supporterId() {
  const key = 'playfooty-supporter-id'
  let value = window.localStorage.getItem(key)
  if (!value) {
    value = `${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
    window.localStorage.setItem(key, value)
  }
  return value
}

export default function LeagueLiveData({ league }: { league: LeagueDetail }) {
  const fixtures = useMemo(() => (league.fixtures ?? []).filter(row => !row.matchDate || Date.parse(row.matchDate) >= Date.now() - 86400000).slice(0, 5), [league.fixtures])
  const results = (league.results ?? []).slice(0, 5)
  const goalKickers = (league.goalKickers ?? []).slice(0, 8)

  return <section className="league-live-wrap">
    <div className="league-live-grid">
      <article className="league-live-card league-about-card">
        <span className="league-live-kicker">About the competition</span>
        <h2>{league.name}</h2>
        <p>{league.description?.trim() || `Follow the ${league.name} ladder, rankings, fixtures, results and leading goal kickers on PlayFooty.`}</p>
        <div className="league-meta-row">
          <span>{league.stateName ?? league.state}</span>
          {league.regionName && <span>{league.regionName}</span>}
          {league.currentSeason && <span>{league.currentSeason} season</span>}
          {league.clubCount != null && <span>{league.clubCount} club records</span>}
        </div>
        <div className="league-actions">
          <LeagueFollow leagueId={league.id} leagueName={league.name} />
          {league.websiteUrl && <a href={league.websiteUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Official website</a>}
          {league.facebookUrl && <a href={league.facebookUrl} target="_blank" rel="noreferrer"><Facebook size={16} /> Facebook</a>}
        </div>
      </article>

      <article className="league-live-card">
        <div className="league-card-head"><div><span className="league-live-kicker">Latest match data</span><h2>Fixtures & results</h2></div><Link to={`/matches?league=${encodeURIComponent(league.id)}`}>Match centre</Link></div>
        <div className="league-match-columns">
          <div><h3>Upcoming</h3>{fixtures.length ? fixtures.map(row => <Link className="league-match-row" key={row.id} to={`/match/fixture/${row.id}?source=football`}><span><b>{row.homeName}</b><b>{row.awayName}</b></span><small>{row.round || row.grade}{row.matchDate ? ` · ${formatDate(row.matchDate)}` : ''}</small></Link>) : <Empty text="No upcoming fixtures published." />}</div>
          <div><h3>Recent results</h3>{results.length ? results.map(row => <Link className="league-match-row result" key={row.id} to={`/match/result/${row.id}?source=football`}><span><b>{row.homeName}</b><strong>{row.homePoints}</strong><b>{row.awayName}</b><strong>{row.awayPoints}</strong></span><small>{row.round || row.grade}{row.matchDate ? ` · ${formatDate(row.matchDate)}` : ''}</small></Link>) : <Empty text="No results published yet." />}</div>
        </div>
      </article>
    </div>

    <article className="league-live-card league-goals-card">
      <div className="league-card-head"><div><span className="league-live-kicker">Season leaders</span><h2>Goal kickers</h2></div><Link to={`/goal-kickers?league=${encodeURIComponent(league.id)}`}>View all</Link></div>
      {goalKickers.length ? <div className="league-goal-grid">{goalKickers.map(row => <Link key={row.id} to={`/player/${encodeURIComponent(row.id)}`} className="league-goal-row"><span className="league-goal-rank">{row.rank}</span><TeamLogo name={row.clubName} src={row.clubLogoUrl ?? undefined} size={46} /><span><strong>{row.playerName}</strong><small>{row.clubName}{row.matches ? ` · ${row.matches} matches` : ''}</small></span><b>{row.goals}</b></Link>)}</div> : <Empty text="Goal-kicker data will appear after an approved league import." />}
    </article>

    <style>{`
      .league-live-wrap{max-width:1180px;margin:22px auto;padding:0 20px;display:grid;gap:18px;font-family:Barlow,Inter,Arial,sans-serif}.league-live-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.4fr);gap:18px}.league-live-card{background:#fff;border:1px solid ${LINE};border-radius:14px;padding:22px;box-shadow:0 7px 22px rgba(12,14,19,.045)}.league-live-kicker{display:block;color:#0783c9;font-size:10px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}.league-live-card h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:34px;line-height:.95;margin:8px 0 11px}.league-about-card p{color:${MUTE};line-height:1.6;margin:0}.league-meta-row{display:flex;flex-wrap:wrap;gap:7px;margin:17px 0}.league-meta-row span{background:#f1f5f8;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800}.league-actions{display:flex;gap:8px;flex-wrap:wrap}.league-actions a,.league-actions button{border:0;border-radius:999px;padding:10px 13px;display:inline-flex;align-items:center;gap:7px;text-decoration:none;font-weight:900;font-size:12px;background:#eef3f7;color:${INK};cursor:pointer}.league-actions .following{background:${BLUE}}.league-card-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.league-card-head>a{color:#0783c9;text-decoration:none;text-transform:uppercase;font-size:11px;font-weight:900}.league-match-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px}.league-match-columns h3{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:${MUTE};margin:8px 0}.league-match-row{display:block;border-top:1px solid #edf1f4;padding:10px 0;text-decoration:none;color:${INK}}.league-match-row span{display:grid;grid-template-columns:1fr;gap:2px}.league-match-row.result span{grid-template-columns:minmax(0,1fr) auto}.league-match-row b{font-size:13px}.league-match-row strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:20px;color:#0783c9}.league-match-row small{display:block;color:${MUTE};margin-top:5px}.league-goal-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.league-goal-row{display:grid;grid-template-columns:34px 48px minmax(0,1fr) auto;align-items:center;gap:10px;border:1px solid ${LINE};border-radius:11px;padding:10px;text-decoration:none;color:${INK}}.league-goal-rank{display:grid;place-items:center;width:30px;height:30px;border-radius:7px;background:${BLUE};font-family:'Bebas Neue',Impact,sans-serif;font-size:20px}.league-goal-row strong,.league-goal-row small{display:block}.league-goal-row small{color:${MUTE};font-size:11px;margin-top:2px}.league-goal-row>b{font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;color:#0783c9}.league-empty{color:${MUTE};font-size:13px;padding:18px 0}.league-follow-error{color:#b42318;font-size:11px;margin-top:8px}@media(max-width:900px){.league-live-grid,.league-match-columns,.league-goal-grid{grid-template-columns:1fr}}@media(max-width:560px){.league-live-wrap{padding:0 13px}.league-live-card{padding:17px}.league-card-head{align-items:flex-start}.league-goal-row{grid-template-columns:30px 42px minmax(0,1fr) auto}}
    `}</style>
  </section>
}

function LeagueFollow({ leagueId, leagueName }: { leagueId: string; leagueName: string }) {
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const id = supporterId()
    fetch(`/api/follows?supporterId=${encodeURIComponent(id)}`).then(response => response.ok ? response.json() : Promise.reject()).then((payload: { data?: Array<{ entityType: string; entityId: string }> }) => setFollowing(Boolean(payload.data?.some(row => row.entityType === 'LEAGUE' && row.entityId === leagueId)))).catch(() => {})
  }, [leagueId])
  const toggle = async () => {
    setBusy(true); setError('')
    try {
      const id = supporterId()
      const response = following
        ? await fetch(`/api/follows/LEAGUE/${encodeURIComponent(leagueId)}?supporterId=${encodeURIComponent(id)}`, { method: 'DELETE' })
        : await fetch('/api/follows', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ supporterId: id, entityType: 'LEAGUE', entityId: leagueId }) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setFollowing(value => !value)
    } catch { setError(`Could not update your ${leagueName} follow.`) } finally { setBusy(false) }
  }
  return <span><button className={following ? 'following' : ''} onClick={toggle} disabled={busy}><Bell size={16} />{following ? 'Following league' : 'Follow league'}</button>{error && <small className="league-follow-error">{error}</small>}</span>
}

function Empty({ text }: { text: string }) { return <div className="league-empty">{text}</div> }
function formatDate(value: string) { return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) }
