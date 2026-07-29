import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { useSeo } from '../lib/seo'

type MatchData = {
  id: string; sourceId?: string | null; leagueId?: string | null; leagueName?: string | null; state?: string | null
  season?: string | null; grade?: string | null; round?: number | string | null; matchDate?: string | null; matchTime?: string | null
  venue?: string | null; homeClubId?: string | null; homeClubName?: string | null; homeName?: string | null
  awayClubId?: string | null; awayClubName?: string | null; awayName?: string | null; homeScore?: number | null
  awayScore?: number | null; homePoints?: number | null; awayPoints?: number | null; homeGoals?: number | null
  homeBehinds?: number | null; awayGoals?: number | null; awayBehinds?: number | null; status?: string | null
  sourceUrl?: string | null; verified?: boolean | null
}
type Kicker={playerName:string;goals:number;playerId?:string|null}
type MatchExtra={homeQuarterScores?:Array<string|null>;awayQuarterScores?:Array<string|null>;homeBestPlayers?:string[];awayBestPlayers?:string[];homeGoalKickers?:Kicker[];awayGoalKickers?:Kicker[];notes?:string|null}
type Payload = { data?: MatchData; error?: string }
type ClubLogoPayload = { data?: { logoUrl?: string | null; club?: { logoUrl?: string | null } } }

export default function MatchDetail() {
  const { kind = 'fixture', matchId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const safeKind = kind === 'result' ? 'result' : 'fixture'
  const [data, setData] = useState<MatchData | null>(null)
  const [detail,setDetail]=useState<MatchExtra|null>(null)
  const [homeLogo, setHomeLogo] = useState<string | null>(null)
  const [awayLogo, setAwayLogo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setData(null); setDetail(null); setHomeLogo(null); setAwayLogo(null)
    const prefixedFootball = matchId.startsWith('football:')
    const footballSource = prefixedFootball || searchParams.get('source') === 'football'
    const sourceId = prefixedFootball ? matchId.slice('football:'.length) : matchId
    const collection = safeKind === 'result' ? 'results' : 'fixtures'
    const primary = footballSource ? `/api/${collection}/football/${encodeURIComponent(sourceId)}` : `/api/${collection}/${encodeURIComponent(sourceId)}`
    const fallback = footballSource ? `/api/${collection}/${encodeURIComponent(sourceId)}` : `/api/${collection}/football/${encodeURIComponent(sourceId)}`
    const request = async (url: string) => { const response=await fetch(url);const payload=await response.json() as Payload;if(!response.ok||!payload.data)throw new Error(payload.error??'Match not found');return payload.data }
    request(primary).catch(()=>request(fallback)).then(async next=>{if(!active)return;setData(next);if(safeKind==='result'){const id=next.sourceId??sourceId;try{const response=await fetch(`/api/match-details/football/${encodeURIComponent(id)}`);const payload=await response.json() as {data?:MatchExtra|null};if(active&&response.ok)setDetail(payload.data??null)}catch{if(active)setDetail(null)}}}).catch((reason:Error)=>{if(active)setError(reason.message)}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  }, [matchId, safeKind, searchParams])

  useEffect(() => {
    let active = true
    const loadLogo = async (clubId?: string | null) => { if(!clubId)return null;try{const response=await fetch(`/api/clubs/${encodeURIComponent(clubId)}`);if(!response.ok)return null;const payload=await response.json() as ClubLogoPayload;return payload.data?.logoUrl??payload.data?.club?.logoUrl??null}catch{return null} }
    void Promise.all([loadLogo(data?.homeClubId),loadLogo(data?.awayClubId)]).then(([home,away])=>{if(active){setHomeLogo(home);setAwayLogo(away)}})
    return()=>{active=false}
  }, [data?.homeClubId, data?.awayClubId])

  const home = data?.homeClubName ?? data?.homeName ?? 'Home team'
  const away = data?.awayClubName ?? data?.awayName ?? 'Away team'
  const canonicalPath = `/match/${safeKind}/${matchId}${searchParams.get('source') === 'football' ? '?source=football' : ''}`
  useSeo({title:data?`${home} v ${away} | PlayFooty Match Centre`:'Match Centre | PlayFooty',description:data?`${home} versus ${away}${data.leagueName?` in ${data.leagueName}`:''}. View the ${safeKind==='result'?'final score, quarter scores, best players and goal kickers':'fixture'}, venue, round and competition information.`:'Community football match details.',path:canonicalPath})

  const hasQuarters=Boolean(detail?.homeQuarterScores?.some(Boolean)||detail?.awayQuarterScores?.some(Boolean))
  const hasBest=Boolean(detail?.homeBestPlayers?.length||detail?.awayBestPlayers?.length)
  const hasKickers=Boolean(detail?.homeGoalKickers?.length||detail?.awayGoalKickers?.length)

  return <div className="md-page"><Nav/><main>
    {loading&&<div className="md-state">Loading match centre…</div>}
    {!loading&&error&&<div className="md-state error"><div><strong>Match unavailable</strong><span>{error}</span><Link to="/matches">Return to Match Centre</Link></div></div>}
    {!loading&&data&&<>
      <section className="md-hero"><div className="md-shell"><div className="md-breadcrumb"><Link to="/matches">Match Centre</Link><span>›</span>{data.leagueId?<Link to={`/league/${data.leagueId}`}>{data.leagueName??'League'}</Link>:<span>{data.leagueName??'Community football'}</span>}</div><div className="md-meta"><span>{safeKind==='result'?'Final result':statusLabel(data.status)}</span><small>{formatDate(data.matchDate)}{data.round!=null?` · ${roundLabel(data.round)}`:''}{data.grade?` · ${data.grade}`:''}</small></div><div className="md-scoreboard"><TeamBlock id={data.homeClubId} name={home} logoUrl={homeLogo}/><ScoreBlock data={data} result={safeKind==='result'}/><TeamBlock id={data.awayClubId} name={away} logoUrl={awayLogo}/></div>{safeKind==='result'&&<p className="md-margin">{marginText(data,home,away)}</p>}</div></section>
      {(hasQuarters||hasBest||hasKickers||detail?.notes)&&<section className="md-shell md-detail-stack">
        {hasQuarters&&<article className="md-card"><header><span>Period scores</span><h2>Quarter by quarter</h2></header><div className="md-quarters"><b>Team</b>{[1,2,3,4].map(q=><b key={q}>Q{q}</b>)}<TeamName id={data.homeClubId} name={home}/>{[0,1,2,3].map(i=><strong key={`h${i}`}>{detail?.homeQuarterScores?.[i]??'—'}</strong>)}<TeamName id={data.awayClubId} name={away}/>{[0,1,2,3].map(i=><strong key={`a${i}`}>{detail?.awayQuarterScores?.[i]??'—'}</strong>)}</div></article>}
        {(hasBest||hasKickers)&&<div className="md-two">
          {hasBest&&<article className="md-card"><header><span>Match honours</span><h2>Best players</h2></header><TeamLists home={home} away={away} homeRows={detail?.homeBestPlayers??[]} awayRows={detail?.awayBestPlayers??[]}/></article>}
          {hasKickers&&<article className="md-card"><header><span>Scoring</span><h2>Goal kickers</h2></header><KickerLists home={home} away={away} homeRows={detail?.homeGoalKickers??[]} awayRows={detail?.awayGoalKickers??[]}/></article>}
        </div>}
        {detail?.notes&&<article className="md-card"><header><span>Match notes</span><h2>Game summary</h2></header><p className="md-notes">{detail.notes}</p></article>}
      </section>}
      <section className="md-shell md-grid"><article className="md-card"><header><span>Match information</span><h2>Game details</h2></header><dl><Info label="Competition" value={data.leagueName??'Not provided'} link={data.leagueId?`/league/${data.leagueId}`:undefined}/><Info label="State" value={data.state??'Not provided'}/><Info label="Season" value={data.season??'Not provided'}/><Info label="Grade" value={data.grade??'Not provided'}/><Info label="Round" value={data.round==null?'Not provided':roundLabel(data.round)}/><Info label="Date" value={formatDate(data.matchDate)}/><Info label="Time" value={data.matchTime??timeFromDate(data.matchDate)??'Not provided'}/><Info label="Venue" value={data.venue??'Not provided'}/><Info label="Data status" value={data.verified?'Verified':'Imported'}/></dl></article><aside className="md-card"><header><span>Quick links</span><h2>Explore</h2></header><div className="md-links">{data.homeClubId&&<Link to={`/team/${data.homeClubId}`}>View {home}</Link>}{data.awayClubId&&<Link to={`/team/${data.awayClubId}`}>View {away}</Link>}{data.leagueId&&<Link to={`/league/${data.leagueId}`}>View league</Link>}<Link to={`/matches?tab=${safeKind==='result'?'results':'fixtures'}${data.leagueId?`&league=${encodeURIComponent(data.leagueId)}`:''}`}>More from this competition</Link>{data.sourceUrl&&<a href={data.sourceUrl} target="_blank" rel="noreferrer">Open source record</a>}</div></aside></section>
    </>}
  </main><Footer/><style>{styles}</style></div>
}
function TeamBlock({id,name,logoUrl}:{id?:string|null;name:string;logoUrl?:string|null}){const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'FC';const content=<><span className={logoUrl?'has-logo':''}>{logoUrl?<img src={logoUrl} alt={`${name} logo`}/>:initials}</span><strong>{name}</strong></>;return id?<Link to={`/team/${id}`} className="md-team">{content}</Link>:<div className="md-team">{content}</div>}
function TeamName({id,name}:{id?:string|null;name:string}){return id?<Link to={`/team/${id}`}>{name}</Link>:<span>{name}</span>}
function ScoreBlock({data,result}:{data:MatchData;result:boolean}){const home=data.homeScore??data.homePoints,away=data.awayScore??data.awayPoints;if(!result)return <div className="md-score"><b>VS</b><small>{data.matchTime??timeFromDate(data.matchDate)??statusLabel(data.status)}</small></div>;return <div className="md-score"><div><b>{home??'—'}</b>{data.homeGoals!=null&&<small>{data.homeGoals}.{data.homeBehinds??0}</small>}</div><i>Final</i><div><b>{away??'—'}</b>{data.awayGoals!=null&&<small>{data.awayGoals}.{data.awayBehinds??0}</small>}</div></div>}
function TeamLists({home,away,homeRows,awayRows}:{home:string;away:string;homeRows:string[];awayRows:string[]}){return <div className="md-team-lists"><div><h3>{home}</h3>{homeRows.length?homeRows.map((name,i)=><span key={`${name}-${i}`}>{name}</span>):<em>Not provided</em>}</div><div><h3>{away}</h3>{awayRows.length?awayRows.map((name,i)=><span key={`${name}-${i}`}>{name}</span>):<em>Not provided</em>}</div></div>}
function KickerLists({home,away,homeRows,awayRows}:{home:string;away:string;homeRows:Kicker[];awayRows:Kicker[]}){const group=(name:string,rows:Kicker[])=><div><h3>{name}</h3>{rows.length?rows.map((row,i)=>row.playerId?<Link key={`${row.playerName}-${i}`} to={`/player/${row.playerId}`}><span>{row.playerName}</span><b>{row.goals}</b></Link>:<p key={`${row.playerName}-${i}`}><span>{row.playerName}</span><b>{row.goals}</b></p>):<em>Not provided</em>}</div>;return <div className="md-team-lists kickers">{group(home,homeRows)}{group(away,awayRows)}</div>}
function Info({label,value,link}:{label:string;value:string;link?:string}){return <div><dt>{label}</dt><dd>{link?<Link to={link}>{value}</Link>:value}</dd></div>}
function marginText(data:MatchData,home:string,away:string){const h=Number(data.homeScore??data.homePoints),a=Number(data.awayScore??data.awayPoints);if(!Number.isFinite(h)||!Number.isFinite(a))return'Final';if(h===a)return'Draw';return `${h>a?home:away} won by ${Math.abs(h-a)} point${Math.abs(h-a)===1?'':'s'}`}
function statusLabel(value?:string|null){return value?value.toLowerCase().replace(/_/g,' ').replace(/^./,c=>c.toUpperCase()):'Upcoming fixture'}
function roundLabel(value:string|number){const text=String(value);return /^round\b/i.test(text)?text:`Round ${text}`}
function formatDate(value?:string|null){if(!value)return'Date to be confirmed';const date=new Date(value);return Number.isNaN(date.getTime())?'Date to be confirmed':date.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
function timeFromDate(value?:string|null){if(!value||!/[T ]\d{2}:\d{2}/.test(value))return null;const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'})}
const styles=`.md-page{min-height:100vh;background:#f3f5f7;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.md-shell{width:min(1120px,calc(100% - 36px));margin:0 auto}.md-state{min-height:65vh;display:grid;place-items:center;font-weight:950;text-transform:uppercase;letter-spacing:.12em;text-align:center}.md-state.error{color:#d71920}.md-state.error strong,.md-state.error span,.md-state.error a{display:block}.md-state.error span{margin-top:8px;color:#687385;text-transform:none;letter-spacing:0}.md-state.error a{margin-top:18px;color:#087bbf}.md-hero{background:#050505;color:#fff;border-bottom:5px solid #2daaf5;padding:28px 0 42px}.md-breadcrumb{display:flex;align-items:center;gap:9px;color:#9da8b5;font-size:12px;font-weight:850}.md-breadcrumb a{color:#fff;text-decoration:none}.md-meta{text-align:center;margin-top:25px}.md-meta span{display:block;color:#2daaf5;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.16em}.md-meta small{display:block;margin-top:8px;color:#c8d0da;font-weight:800}.md-scoreboard{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:30px;margin-top:32px}.md-team{display:flex;flex-direction:column;align-items:center;text-align:center;color:#fff;text-decoration:none}.md-team>span{width:96px;height:96px;border-radius:20px;background:#2daaf5;color:#050505;display:grid;place-items:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:38px;overflow:hidden}.md-team>span.has-logo{background:#fff;padding:8px}.md-team>span img{width:100%;height:100%;object-fit:contain}.md-team strong{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:clamp(2rem,5vw,4.8rem);line-height:.88;margin-top:15px}.md-score{display:flex;align-items:center;gap:16px;text-align:center}.md-score>div{display:grid}.md-score b{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(4.5rem,10vw,8rem);line-height:.8;color:#2daaf5}.md-score i,.md-score small{font-style:normal;text-transform:uppercase;font-size:10px;font-weight:950;letter-spacing:.12em;color:#9da8b5}.md-margin{text-align:center;margin:24px 0 0;color:#dce5ed;font-weight:900}.md-detail-stack{display:grid;gap:18px;padding-top:28px}.md-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start;padding:28px 0 56px}.md-two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.md-card{background:#fff;border:1px solid #dfe5eb;border-radius:12px;padding:24px;box-shadow:0 7px 22px rgba(17,24,39,.06)}.md-card header span{color:#2daaf5;text-transform:uppercase;font-size:10px;font-weight:950;letter-spacing:.15em}.md-card h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase;font-size:42px;line-height:.9;margin:6px 0 20px}.md-card h3{font-size:13px;margin:0 0 10px}.md-card dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0}.md-card dl>div{background:#f7f9fb;border:1px solid #e7ebef;border-radius:10px;padding:14px}.md-card dt{color:#687385;text-transform:uppercase;font-size:9px;font-weight:950;letter-spacing:.12em}.md-card dd{margin:6px 0 0;font-weight:850}.md-card dd a{color:#111318}.md-links{display:grid;gap:9px}.md-links a{display:block;border:1px solid #dfe5eb;border-radius:9px;padding:12px;color:#111318;text-decoration:none;font-weight:850}.md-quarters{display:grid;grid-template-columns:minmax(160px,1.4fr) repeat(4,minmax(70px,1fr));gap:8px;align-items:center}.md-quarters>b{color:#687385;font-size:10px;text-transform:uppercase}.md-quarters>a,.md-quarters>span{font-weight:900;color:#111;text-decoration:none}.md-quarters>strong{text-align:center;padding:12px;background:#f5f8fa;border-radius:8px}.md-team-lists{display:grid;grid-template-columns:1fr 1fr;gap:14px}.md-team-lists>div{padding:14px;background:#f7f9fb;border-radius:9px}.md-team-lists span,.md-team-lists em{display:block;margin:7px 0}.md-team-lists em{color:#687385}.md-team-lists.kickers a,.md-team-lists.kickers p{display:flex;justify-content:space-between;gap:10px;margin:7px 0;color:#111;text-decoration:none}.md-team-lists.kickers b{color:#168fd2}.md-notes{white-space:pre-wrap;line-height:1.65;color:#4c5865}@media(max-width:760px){.md-shell{width:min(100% - 20px,1120px)}.md-scoreboard{grid-template-columns:1fr auto 1fr;gap:8px}.md-team>span{width:64px;height:64px}.md-team strong{font-size:26px}.md-score b{font-size:58px}.md-score{gap:7px}.md-grid,.md-two{grid-template-columns:1fr}.md-card{padding:17px}.md-card dl{grid-template-columns:1fr}.md-quarters{grid-template-columns:minmax(95px,1.3fr) repeat(4,minmax(45px,1fr));font-size:12px}.md-team-lists{grid-template-columns:1fr}.md-score i{display:none}}`
