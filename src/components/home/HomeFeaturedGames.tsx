import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { TeamLogo } from '../rankings/bits'

type TeamMetric={clubId:string;clubName:string;logoUrl:string|null;nationalRank:number|null;ladderPosition:number|null;attackRating:number;defensiveRating:number;wins:number;losses:number;draws:number;percentage:number;teamSelectionUrl:string}
type FeaturedGame={id:string;fixtureId:string;leagueId:string;leagueName:string;state:string;season:string;grade:string;round:string|null;matchDate:string|null;venue:string|null;selectionReason?:string;home:TeamMetric;away:TeamMetric}
type RankingRow={rank:number;clubId:string;clubName:string;logoUrl?:string|null;leagueId:string;record:{wins:number;losses:number;draws:number;played:number};goalsFor:number;goalsAgainst:number;percentage:number;points:number}

const placeholderTeam=(side:string):TeamMetric=>({clubId:'',clubName:`${side} team`,logoUrl:null,nationalRank:null,ladderPosition:null,attackRating:0,defensiveRating:0,wins:0,losses:0,draws:0,percentage:0,teamSelectionUrl:'/matches'})
const placeholders:FeaturedGame[]=Array.from({length:3},(_,index)=>({id:`featured-game-placeholder-${index+1}`,fixtureId:'',leagueId:'',leagueName:'No qualifying game yet',state:'',season:String(new Date().getFullYear()),grade:'Senior Football',round:'This week',matchDate:null,venue:null,selectionReason:'The next eligible fixture will appear automatically',home:placeholderTeam('Home'),away:placeholderTeam('Away')}))

export default function HomeFeaturedGames(){
  const{pathname}=useLocation(),[target,setTarget]=useState<HTMLElement|null>(null),[games,setGames]=useState<FeaturedGame[]>([])
  useEffect(()=>{if(pathname!=='/'){setTarget(null);return}let observer:MutationObserver|null=null;const attach=()=>{const grid=document.querySelector<HTMLElement>('.pf-feature-grid');if(!grid)return false;setTarget(grid);return true};if(!attach()){observer=new MutationObserver(()=>{if(attach())observer?.disconnect()});observer.observe(document.body,{childList:true,subtree:true})}return()=>observer?.disconnect()},[pathname])
  useEffect(()=>{if(pathname!=='/')return;let active=true;void Promise.all([
    fetch('/api/featured-games').then(r=>r.ok?r.json():Promise.reject(new Error(`HTTP ${r.status}`))),
    fetch('/api/rankings').then(r=>r.ok?r.json():Promise.reject(new Error(`HTTP ${r.status}`))),
  ]).then(([featured,rankings]:[{data?:FeaturedGame[]},{data?:RankingRow[]}])=>{if(!active)return;const rows=Array.isArray(featured.data)?featured.data.slice(0,3):[];const rankingRows=Array.isArray(rankings.data)?rankings.data:[];setGames(enrichGames(rows,rankingRows))}).catch(()=>{if(active)setGames([])});return()=>{active=false}},[pathname])
  if(!target||pathname!=='/')return null
  const rows=placeholders.map((placeholder,index)=>games[index]??placeholder)
  return createPortal(<section className="pf-featured-games gk-no-auto-share"><header><div><span>This week's featured match-ups</span><h2>Around the Grounds</h2></div><Link to="/matches">All games</Link></header><div className="pf-featured-games-row">{rows.map(game=><GameCard key={game.id} game={game} placeholder={game.id.startsWith('featured-game-placeholder-')}/>)}</div><style>{styles}</style></section>,target)
}

function enrichGames(games:FeaturedGame[],rows:RankingRow[]){
  const byClub=new Map(rows.map(row=>[row.clubId,row]))
  const byLeague=new Map<string,RankingRow[]>()
  for(const row of rows){const list=byLeague.get(row.leagueId)??[];list.push(row);byLeague.set(row.leagueId,list)}
  for(const list of byLeague.values())list.sort((a,b)=>b.points-a.points||b.percentage-a.percentage||b.record.wins-a.record.wins||a.clubName.localeCompare(b.clubName))
  const enrich=(team:TeamMetric,leagueId:string)=>{const row=byClub.get(team.clubId);if(!row)return team;const league=byLeague.get(leagueId)??[];const played=row.record.played||0;const scored=played>0?row.goalsFor/played:0;const conceded=played>0?row.goalsAgainst/played:0;const rates=league.filter(item=>item.record.played>0).map(item=>({scored:item.goalsFor/item.record.played,conceded:item.goalsAgainst/item.record.played}));const avgScored=rates.length?rates.reduce((sum,item)=>sum+item.scored,0)/rates.length:0;const avgConceded=rates.length?rates.reduce((sum,item)=>sum+item.conceded,0)/rates.length:0;return{...team,clubName:row.clubName||team.clubName,logoUrl:row.logoUrl??team.logoUrl,nationalRank:row.rank||team.nationalRank,ladderPosition:league.findIndex(item=>item.clubId===team.clubId)+1||team.ladderPosition,attackRating:avgScored>0&&scored>0?Math.min(200,Math.round((scored/avgScored)*1000)/10):team.attackRating,defensiveRating:avgConceded>0?Math.min(200,conceded===0?200:Math.round((avgConceded/conceded)*1000)/10):team.defensiveRating,wins:row.record.wins,losses:row.record.losses,draws:row.record.draws,percentage:row.percentage}}
  return games.map(game=>({...game,home:enrich(game.home,game.leagueId),away:enrich(game.away,game.leagueId)}))
}

function GameCard({game,placeholder}:{game:FeaturedGame;placeholder:boolean}){
  const [homeWins,awayWins]=relativeHigher(game.home.wins,game.away.wins)
  const [homeLosses,awayLosses]=relativeLower(game.home.losses,game.away.losses)
  const [homePercentage,awayPercentage]=relativeHigher(game.home.percentage,game.away.percentage)
  const metrics=[
    {label:'National ranking',home:rank(game.home.nationalRank),away:rank(game.away.nationalRank),homeWidth:rankWidth(game.home.nationalRank),awayWidth:rankWidth(game.away.nationalRank)},
    {label:'League ladder',home:rank(game.home.ladderPosition),away:rank(game.away.ladderPosition),homeWidth:rankWidth(game.home.ladderPosition),awayWidth:rankWidth(game.away.ladderPosition)},
    {label:'Attack rating',home:game.home.attackRating.toFixed(1),away:game.away.attackRating.toFixed(1),homeWidth:ratingWidth(game.home.attackRating),awayWidth:ratingWidth(game.away.attackRating)},
    {label:'Defensive rating',home:game.home.defensiveRating.toFixed(1),away:game.away.defensiveRating.toFixed(1),homeWidth:ratingWidth(game.home.defensiveRating),awayWidth:ratingWidth(game.away.defensiveRating)},
    {label:'Wins',home:String(game.home.wins),away:String(game.away.wins),homeWidth:homeWins,awayWidth:awayWins},
    {label:'Losses',home:String(game.home.losses),away:String(game.away.losses),homeWidth:homeLosses,awayWidth:awayLosses},
    {label:'Percentage',home:`${game.home.percentage.toFixed(1)}%`,away:`${game.away.percentage.toFixed(1)}%`,homeWidth:homePercentage,awayWidth:awayPercentage},
  ]
  const details=[game.round,formatDate(game.matchDate),game.venue].filter(Boolean)
  return <article className={`pf-featured-game-card${placeholder?' is-placeholder':''}`}>
    <div className="pf-featured-game-top">
      <small>{game.leagueName}</small>
      {details.length>0&&<div className="pf-featured-game-context">{details.map((detail,index)=><span key={`${detail}-${index}`}>{detail}</span>)}</div>}
      <div className="pf-featured-game-reason">{game.selectionReason??'Featured matchup this week'}</div>
      <div className="pf-featured-game-teams"><Team team={game.home}/><b>VS</b><Team team={game.away}/></div>
    </div>
    <div className="pf-featured-game-metrics">{metrics.map(metric=><Metric key={metric.label}{...metric}/>)}</div>
    <div className="pf-rating-note">Attack and defence ratings are league-normalised · 100 = league average</div>
    <footer><Link to={game.home.teamSelectionUrl}>See {shortName(game.home.clubName)} team<ArrowRight size={16}/></Link><Link to={game.away.teamSelectionUrl}>See {shortName(game.away.clubName)} team<ArrowRight size={16}/></Link></footer>
  </article>
}
function Team({team}:{team:TeamMetric}){
  const content=<><span className="pf-featured-game-logo"><TeamLogo name={team.clubName} src={team.logoUrl??undefined} size={112}/></span><strong>{team.clubName}</strong></>
  return team.clubId?<Link className="pf-featured-team-link" to={`/team/${encodeURIComponent(team.clubId)}`} aria-label={`View ${team.clubName}`}>{content}</Link>:<div>{content}</div>
}
function Metric({label,home,away,homeWidth,awayWidth}:{label:string;home:string;away:string;homeWidth:number;awayWidth:number}){return <div className="pf-game-metric"><div><strong>{home}</strong><span>{label}</span><strong>{away}</strong></div><div className="pf-game-bars"><i><b style={{width:`${clampWidth(homeWidth)}%`}}/></i><i><b style={{width:`${clampWidth(awayWidth)}%`}}/></i></div></div>}
const rank=(value:number|null)=>value?`#${value}`:'—'
const clampWidth=(value:number)=>Math.max(0,Math.min(100,Number.isFinite(value)?value:0))
const rankWidth=(value:number|null)=>value==null||value<=0?0:100/value
const ratingWidth=(value:number)=>clampWidth((value/200)*100)
const relativeHigher=(home:number,away:number):[number,number]=>{const best=Math.max(home,away);return best<=0?[0,0]:[(home/best)*100,(away/best)*100]}
const relativeLower=(home:number,away:number):[number,number]=>{const worst=Math.max(home,away);if(worst<=0)return[100,100];return[((worst-home)/worst)*100,((worst-away)/worst)*100]}
const shortName=(value:string)=>value.split(/\s+/).slice(0,2).join(' ')
const formatDate=(value:string|null)=>value?new Date(value).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'}):null

const styles=`
.pf-feature-grid>.pf-featured-games{grid-column:1/-1;order:-1;width:100%;min-width:0;overflow:hidden;padding:38px 0 48px;border-top:12px solid #eef3f7;background:#fff;font-family:Barlow,Inter,Arial,sans-serif;color:#111318}
.pf-featured-games>header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 24px 18px}.pf-featured-games header span{display:block;color:#0783c9;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.pf-featured-games h2{margin:5px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.7rem,5vw,4.8rem);line-height:.88;text-transform:uppercase;color:#111318}.pf-featured-games header>a{color:#42b8ff;text-decoration:none;text-transform:uppercase;font-size:11px;font-weight:900;white-space:nowrap}
.pf-featured-games-row{display:flex;gap:18px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 24px 12px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.pf-featured-games-row::-webkit-scrollbar{display:none}.pf-featured-game-card{flex:0 0 min(760px,88vw);overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always;border:1px solid #dce3eb;border-radius:18px;background:#fff;color:#111318;box-shadow:0 12px 30px rgba(17,24,39,.10)}
.pf-featured-game-top{padding:18px 24px 10px;background:linear-gradient(135deg,#34104f,#0b1430 52%,#0a4970);color:#fff;border-bottom:5px solid #42b8ff}.pf-featured-game-top>small{display:block;text-align:center;color:#d8e4ef;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.pf-featured-game-context{display:flex;justify-content:center;flex-wrap:wrap;gap:5px 12px;margin-top:7px;color:#fff;font-size:12px;font-weight:800}.pf-featured-game-context span+span:before{content:'·';margin-right:12px;color:#42b8ff}.pf-featured-game-reason{width:max-content;max-width:100%;margin:10px auto 0;padding:5px 10px;border:1px solid rgba(66,184,255,.35);border-radius:999px;background:rgba(66,184,255,.12);color:#bfe8ff;font-size:10px;font-weight:900;letter-spacing:.05em;text-align:center;text-transform:uppercase}.pf-featured-game-teams{display:grid;grid-template-columns:minmax(0,1fr) 60px minmax(0,1fr);align-items:center;gap:12px;margin-top:13px}.pf-featured-game-teams>div,.pf-featured-team-link{display:grid;justify-items:center;text-align:center;gap:8px}.pf-featured-team-link{color:inherit;text-decoration:none;border-radius:20px}.pf-featured-team-link:focus-visible{outline:3px solid #42b8ff;outline-offset:4px}.pf-featured-game-logo{display:grid;place-items:center;width:124px;height:124px;padding:4px;box-sizing:border-box;overflow:hidden;border:1px solid rgba(255,255,255,.5);border-radius:22px;background:#fff}.pf-featured-game-logo>span{width:100%!important;height:100%!important}.pf-featured-game-logo img{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important}.pf-featured-game-teams strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(1.65rem,3vw,2.5rem);line-height:.95;text-transform:uppercase}.pf-featured-game-teams>b{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:rgba(255,255,255,.1);font-family:'Bebas Neue',Impact,sans-serif;font-size:31px;color:#42b8ff}
.pf-featured-game-metrics{padding:8px 22px;background:#fff}.pf-game-metric{padding:13px 0;border-bottom:1px solid #e3e7ec}.pf-game-metric:last-child{border-bottom:0}.pf-game-metric>div:first-child{display:grid;grid-template-columns:1fr minmax(130px,1.3fr) 1fr;align-items:center;gap:10px}.pf-game-metric strong{font-size:19px}.pf-game-metric strong:last-child{text-align:right}.pf-game-metric span{text-align:center;font-size:15px;font-weight:850}.pf-game-bars{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}.pf-game-bars i{height:8px;border-radius:999px;background:#eef1f4;overflow:hidden}.pf-game-bars i:first-child{display:flex;justify-content:flex-end}.pf-game-bars b{display:block;height:100%;border-radius:999px;background:#1d4ed8}.pf-game-bars i:last-child b{background:#16a34a}.pf-rating-note{padding:0 22px 14px;color:#667085;font-size:11px;font-weight:750;text-align:center;background:#fff}
.pf-featured-game-card footer{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #dce3eb;background:#fff}.pf-featured-game-card footer a{display:flex;align-items:center;justify-content:center;gap:8px;padding:17px 12px;color:#075ca8;text-decoration:none;font-weight:900;text-align:center}.pf-featured-game-card footer a+a{border-left:1px solid #dce3eb}.pf-featured-game-card.is-placeholder{opacity:.92}.pf-featured-game-card.is-placeholder .pf-rating-note{display:none}
@media(min-width:1200px){.pf-featured-game-card{flex-basis:calc((100% - 36px)/2)}}
@media(max-width:620px){.pf-feature-grid>.pf-featured-games{padding:26px 0 32px;border-top-width:9px}.pf-featured-games>header{margin:0 12px 14px;align-items:end}.pf-featured-games h2{font-size:2.75rem}.pf-featured-games header span{font-size:8px}.pf-featured-games header>a{font-size:9px}.pf-featured-games-row{gap:11px;padding:1px 12px 9px}.pf-featured-game-card{flex-basis:calc(100vw - 38px);border-radius:14px}.pf-featured-game-top{padding:14px 12px 9px}.pf-featured-game-context{gap:4px 8px;font-size:10px}.pf-featured-game-context span+span:before{margin-right:8px}.pf-featured-game-reason{font-size:8px;padding:4px 8px}.pf-featured-game-teams{grid-template-columns:minmax(0,1fr) 46px minmax(0,1fr);gap:7px}.pf-featured-game-logo{width:94px;height:94px;padding:3px;border-radius:16px}.pf-featured-game-logo>span{width:100%!important;height:100%!important}.pf-featured-game-logo img{max-width:none!important;max-height:none!important}.pf-featured-game-teams strong{font-size:1.55rem}.pf-featured-game-teams>b{width:44px;height:44px;font-size:25px}.pf-featured-game-metrics{padding:5px 13px}.pf-game-metric{padding:10px 0}.pf-game-metric>div:first-child{grid-template-columns:1fr minmax(112px,1.4fr) 1fr;gap:5px}.pf-game-metric strong{font-size:15px}.pf-game-metric span{font-size:12px}.pf-game-bars{gap:7px;margin-top:6px}.pf-rating-note{padding:0 13px 12px;font-size:9px}.pf-featured-game-card footer a{padding:14px 7px;font-size:11px}}
`