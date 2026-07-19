import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { useSeo } from '../lib/seo'

type PlayerSeason = {
  id: string
  season: string
  grade: string | null
  goals: number
  matches: number | null
  goalsPerGame: number | null
  adjustedGoals: number
  clubId: string | null
  clubName: string
  clubLogoUrl: string | null
  leagueId: string | null
  leagueName: string
}

type GoalHistoryEntry = {
  playerId: string
  playerRowId?: string
  playerName: string
  clubName: string
  leagueName: string
  season: string
  grade: string
  previousGoals: number
  goals: number
  weeklyGoals: number
  previousMatches?: number | null
  matches?: number | null
  matchesAdded: number | null
  updatedAt: string
}

type PlayerRecord = {
  key: string
  label: string
  value: string
}

type PlayerProfileData = {
  id: string
  playerId: string
  playerName: string
  clubId: string | null
  clubName: string
  clubLogoUrl: string | null
  leagueId: string | null
  leagueName: string
  season: string
  grade: string | null
  goals: number
  matches: number | null
  goalsPerGame: number | null
  latestGoals: number
  latestPreviousGoals: number | null
  latestUpdatedAt: string | null
  rank: number | null
  goalsPerGameRank: number | null
  biggestBagRank: number | null
  leagueStrength: number
  adjustedGoals: number
  town: string | null
  state: string | null
  stateName: string | null
  records: PlayerRecord[]
  goalHistory: GoalHistoryEntry[]
  history: PlayerSeason[]
}

export default function PlayerProfile() {
  const { playerId = '' } = useParams()
  const [data, setData] = useState<PlayerProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    fetch(`/api/goal-kickers/player/${encodeURIComponent(playerId)}`)
      .then(async response => {
        const json = await response.json() as { data?: PlayerProfileData; error?: string }
        if (!response.ok || !json.data) throw new Error(json.error ?? 'Player not found')
        return json.data
      })
      .then(next => { if (active) setData(next) })
      .catch((reason: Error) => { if (active) setError(reason.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [playerId])

  useSeo({
    title: data ? `${data.playerName} — Goals, Club & Player Profile | PlayFooty` : 'Player Profile | PlayFooty',
    description: data ? `${data.playerName} plays for ${data.clubName} in ${data.leagueName}. View goals, latest-game performance, ranking, records and goal history.` : 'Community football player profile and goal-kicking statistics.',
    path: `/player/${playerId}`,
  })

  return <div className="player-page">
    <Nav />
    <main>
      {loading && <div className="player-state">Loading player profile…</div>}
      {!loading && error && <div className="player-state error">{error}</div>}
      {!loading && data && <>
        <section className="player-hero">
          <div className="player-shell player-hero-inner">
            <div className="player-identity">
              <ClubLogo src={data.clubLogoUrl} name={data.clubName} />
              <div>
                <span className="player-kicker">Community football player</span>
                <h1>{data.playerName}</h1>
                <p>{data.clubName} · {data.leagueName}{data.state ? ` · ${data.state}` : ''}</p>
                <div className="player-links">
                  {data.clubId && <Link to={`/team/${data.clubId}`}>View club</Link>}
                  {data.leagueId && <Link to={`/league/${data.leagueId}`}>View league</Link>}
                  <Link to="/goal-kickers">Goal-kicking ladder</Link>
                </div>
              </div>
            </div>
            <div className="player-rank">
              <span>National goal-kicking rank</span>
              <strong>{data.rank ? `#${data.rank}` : '—'}</strong>
              <small>{data.season} {data.grade ? `· ${data.grade}` : ''}</small>
            </div>
          </div>
        </section>

        <section className="player-shell player-content">
          <div className="player-main">
            <section className="player-card stats-card">
              <header><span>Current season</span><h2>Goal-kicking stats</h2></header>
              <div className="stat-grid">
                <Stat label="Season goals" value={String(data.goals)} />
                <Stat label="Latest game" value={data.latestGoals > 0 ? `+${data.latestGoals}` : '—'} />
                <Stat label="Matches" value={data.matches == null ? '—' : String(data.matches)} />
                <Stat label="Goals per game" value={data.goalsPerGame == null ? '—' : data.goalsPerGame.toFixed(2)} />
                <Stat label="National rank" value={data.rank ? `#${data.rank}` : '—'} />
                <Stat label="GPG rank" value={data.goalsPerGameRank ? `#${data.goalsPerGameRank}` : '—'} />
              </div>
              {data.latestGoals > 0 && <p className="latest-summary">
                Latest recorded update: <strong>{data.latestPreviousGoals ?? data.goals - data.latestGoals} → {data.goals} goals</strong>
                {data.latestUpdatedAt ? ` · ${formatDate(data.latestUpdatedAt)}` : ''}
              </p>}
            </section>

            <section className="player-card">
              <header><span>Performance timeline</span><h2>Goal history</h2></header>
              {data.goalHistory.length === 0 && <p className="empty-copy">Goal-by-goal history will appear after the next approved total update.</p>}
              <div className="goal-history">
                {data.goalHistory.map((entry, index) => <article key={`${entry.updatedAt}-${entry.goals}-${index}`}>
                  <div className="history-delta">+{entry.weeklyGoals}</div>
                  <div className="history-copy">
                    <strong>{entry.previousGoals} → {entry.goals} season goals</strong>
                    <span>{entry.clubName} · {entry.leagueName}{entry.grade ? ` · ${entry.grade}` : ''}</span>
                  </div>
                  <time>{formatDate(entry.updatedAt)}</time>
                </article>)}
              </div>
            </section>

            <section className="player-card">
              <header><span>Career record</span><h2>Imported seasons</h2></header>
              <div className="season-list">
                {data.history.map(season => <article key={season.id}>
                  <ClubLogo src={season.clubLogoUrl} name={season.clubName} small />
                  <div className="season-copy">
                    <strong>{season.season}{season.grade ? ` · ${season.grade}` : ''}</strong>
                    <span>{season.clubName} · {season.leagueName}</span>
                  </div>
                  <div className="season-numbers">
                    <b>{season.goals}</b><small>goals</small>
                    <b>{season.matches ?? '—'}</b><small>matches</small>
                  </div>
                </article>)}
              </div>
            </section>
          </div>

          <aside className="player-sidebar-wrap">
            <section className="player-card player-sidebar">
              <header><span>Player details</span><h2>At a glance</h2></header>
              <dl>
                <div><dt>Club</dt><dd>{data.clubName}</dd></div>
                <div><dt>League</dt><dd>{data.leagueName}</dd></div>
                <div><dt>Season</dt><dd>{data.season}</dd></div>
                <div><dt>Grade</dt><dd>{data.grade ?? 'Not provided'}</dd></div>
                <div><dt>Location</dt><dd>{[data.town, data.stateName ?? data.state].filter(Boolean).join(', ') || 'Not provided'}</dd></div>
                <div><dt>League strength</dt><dd>{data.leagueStrength.toFixed(1)}</dd></div>
              </dl>
            </section>

            <section className="player-card player-records">
              <header><span>Individual honours</span><h2>Records</h2></header>
              {data.records.length === 0 && <p className="empty-copy">No current national player records held.</p>}
              {data.records.map(record => <article key={record.key}>
                <span>{record.label}</span>
                <strong>{record.value}</strong>
              </article>)}
            </section>
          </aside>
        </section>
      </>}
    </main>
    <Footer />
    <style>{`
      .player-page{min-height:100vh;background:#f3f5f7;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.player-shell{width:min(1180px,calc(100% - 36px));margin:0 auto}.player-state{min-height:55vh;display:grid;place-items:center;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.player-state.error{color:#d71920}.player-hero{background:#050505;color:#fff;border-bottom:5px solid #2daaf5}.player-hero-inner{min-height:330px;display:flex;justify-content:space-between;align-items:center;gap:30px;padding:48px 0}.player-identity{display:flex;align-items:center;gap:24px;min-width:0}.player-logo{width:112px;height:112px;display:grid;place-items:center;flex:0 0 auto}.player-logo.small{width:52px;height:52px}.player-logo img{width:100%;height:100%;object-fit:contain}.player-logo span{width:100%;height:100%;display:grid;place-items:center;border-radius:18px;background:#2daaf5;color:#050505;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px}.player-logo.small span{font-size:20px;border-radius:10px}.player-kicker,.player-card header span{color:#2daaf5;font-size:11px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.player-hero h1,.player-card h2,.player-rank strong,.history-delta,.player-records strong{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.player-hero h1{font-size:clamp(4rem,9vw,8rem);line-height:.82;margin:10px 0}.player-hero p{margin:0;color:#c8d0da;font-weight:750}.player-links{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}.player-links a{color:#050505;background:#2daaf5;text-decoration:none;border-radius:999px;padding:11px 16px;font-weight:950;text-transform:uppercase;font-size:12px}.player-rank{text-align:right}.player-rank span{display:block;color:#9da8b5;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.player-rank strong{display:block;color:#2daaf5;font-size:clamp(5rem,10vw,8rem);line-height:.8;margin-top:12px}.player-rank small{display:block;color:#c8d0da;margin-top:13px;font-weight:800}.player-content{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start;padding:30px 0 55px}.player-main,.player-sidebar-wrap{display:grid;gap:18px}.player-card{background:#fff;border:1px solid #dfe5eb;border-radius:12px;padding:24px;box-shadow:0 7px 24px rgba(17,24,39,.06)}.player-card h2{font-size:42px;line-height:.9;margin:6px 0 20px}.stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.stat-grid article{background:#f7f9fb;border:1px solid #e5e9ee;border-radius:10px;padding:18px}.stat-grid span{display:block;color:#687385;text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.12em}.stat-grid strong{display:block;color:#111318;font-family:'Bebas Neue',Impact,sans-serif;font-size:44px;line-height:1;margin-top:8px}.latest-summary{margin:16px 0 0;padding:14px 16px;background:#e8f6ff;border-left:4px solid #2daaf5;font-size:14px}.goal-history,.season-list{display:grid}.goal-history article,.season-list article{display:flex;align-items:center;gap:13px;padding:15px 0;border-top:1px solid #e8ecf0}.history-delta{width:58px;height:58px;display:grid;place-items:center;flex:0 0 auto;border-radius:50%;background:#2daaf5;color:#050505;font-size:28px}.history-copy{min-width:0;flex:1}.history-copy strong,.history-copy span{display:block}.history-copy span{color:#687385;font-size:13px;font-weight:750;margin-top:4px}.goal-history time{color:#687385;font-size:12px;font-weight:800;white-space:nowrap}.season-copy{min-width:0;flex:1}.season-copy strong,.season-copy span{display:block}.season-copy strong{font-size:17px}.season-copy span{color:#687385;font-size:13px;font-weight:750;margin-top:4px}.season-numbers{display:grid;grid-template-columns:auto auto;gap:2px 10px;text-align:right}.season-numbers b{font-size:20px}.season-numbers small{color:#687385;text-transform:uppercase;font-size:9px;font-weight:900}.player-sidebar-wrap{position:sticky;top:92px}.player-sidebar dl{margin:0}.player-sidebar dl>div{padding:13px 0;border-top:1px solid #e8ecf0}.player-sidebar dt{color:#687385;text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.12em}.player-sidebar dd{margin:5px 0 0;font-weight:850;line-height:1.35}.player-records article{background:#050505;color:#fff;border-radius:9px;padding:15px;margin-top:10px}.player-records article span{display:block;color:#2daaf5;text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.12em}.player-records strong{display:block;font-size:31px;line-height:1;margin-top:7px}.empty-copy{color:#687385;line-height:1.5;margin:0}@media(max-width:850px){.player-hero-inner{align-items:flex-start;flex-direction:column}.player-rank{text-align:left}.player-content{grid-template-columns:1fr}.player-sidebar-wrap{position:static}.stat-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.player-shell{width:min(100% - 24px,1180px)}.player-hero-inner{padding:32px 0}.player-identity{align-items:flex-start;gap:14px}.player-logo{width:72px;height:72px}.player-hero h1{font-size:3.7rem}.player-rank strong{font-size:5rem}.player-card{padding:18px}.stat-grid{grid-template-columns:1fr 1fr}.stat-grid strong{font-size:36px}.goal-history article{align-items:flex-start;flex-wrap:wrap}.goal-history time{width:100%;padding-left:71px}.season-list article{align-items:flex-start;flex-wrap:wrap}.season-numbers{width:100%;grid-template-columns:auto auto auto auto;text-align:left;padding-left:65px}}
    `}</style>
  </div>
}

function ClubLogo({ src, name, small = false }: { src: string | null; name: string; small?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'C'
  return <div className={`player-logo${small ? ' small' : ''}`} aria-hidden="true">{src ? <img src={src} alt="" /> : <span>{initials}</span>}</div>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <article><span>{label}</span><strong>{value}</strong></article>
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}
