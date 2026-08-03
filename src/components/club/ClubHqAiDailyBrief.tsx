import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

type Session={access_token:string}
type Dashboard={
 club:{name:string}
 profile:{completion:number}
 teamSelection:null|{status:string;roundLabel:string;opponentName:string|null;matchDate?:string|null}
 news:{drafts:number;pending:number}
 sponsors?:{active:number}
 users:{pending:number}
}
type Coordination={counts:{openTasks:number;unreadNotifications:number;pendingApprovals:number}}
type LiveMatch={status?:string;quarter?:number;opponentName?:string;homeGoals?:number;homeBehinds?:number;awayGoals?:number;awayBehinds?:number}
const SESSION_KEY='playfooty.clubPortal.session.v1'
function session():Session|null{try{const raw=localStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw) as Session:null}catch{return null}}
function score(goals=0,behinds=0){return `${goals}.${behinds} (${goals*6+behinds})`}
function greeting(){const hour=new Date().getHours();return hour<12?'Good morning':hour<18?'Good afternoon':'Good evening'}

export default function ClubHqAiDailyBrief({clubId}:{clubId:string}){
 const[current]=useState(()=>session())
 const[dashboard,setDashboard]=useState<Dashboard|null>(null)
 const[coordination,setCoordination]=useState<Coordination|null>(null)
 const[live,setLive]=useState<LiveMatch|null>(null)
 const[error,setError]=useState('')
 const headers=useMemo<Record<string,string>>(()=>{const next:Record<string,string>={};if(current)next.authorization=`Bearer ${current.access_token}`;return next},[current])

 useEffect(()=>{
  if(!clubId||!current)return
  let active=true
  const load=async()=>{
   try{
    const[dashResponse,coordResponse,liveResponse]=await Promise.all([
     fetch(`/api/club-portal/clubs/${encodeURIComponent(clubId)}/dashboard`,{headers}),
     fetch(`/api/club-portal/coordination/clubs/${encodeURIComponent(clubId)}`,{headers}),
     fetch(`/api/live-match/clubs/${encodeURIComponent(clubId)}`,{headers}),
    ])
    const[dashPayload,coordPayload,livePayload]=await Promise.all([dashResponse.json().catch(()=>({})),coordResponse.json().catch(()=>({})),liveResponse.json().catch(()=>({}))])
    if(!dashResponse.ok||!coordResponse.ok)throw new Error('Unable to prepare the daily brief')
    if(!active)return
    setDashboard((dashPayload as {data?:Dashboard}).data||null)
    setCoordination((coordPayload as {data?:Coordination}).data||null)
    setLive(liveResponse.ok?((livePayload as {data?:LiveMatch}).data||null):null)
    setError('')
   }catch(reason){if(active)setError(reason instanceof Error?reason.message:'Unable to prepare the daily brief')}
  }
  void load();const timer=window.setInterval(()=>void load(),15000)
  return()=>{active=false;window.clearInterval(timer)}
 },[clubId,headers,current])

 const brief=useMemo(()=>{
  if(!dashboard)return null
  const points:string[]=[]
  const liveActive=Boolean(live&&live.status&&!['FINISHED','FINAL','COMPLETED'].includes(live.status.toUpperCase()))
  if(liveActive)points.push(`The live match is in quarter ${live?.quarter||'-'} against ${live?.opponentName||'the opposition'}, with the score ${score(live?.homeGoals,live?.homeBehinds)} to ${score(live?.awayGoals,live?.awayBehinds)}.`)
  else if(!dashboard.teamSelection)points.push('The next team selection has not been prepared yet.')
  else if(dashboard.teamSelection.status==='DRAFT')points.push(`${dashboard.teamSelection.roundLabel} team selection is still a draft and needs to be published.`)
  else points.push(`${dashboard.teamSelection.roundLabel}${dashboard.teamSelection.opponentName?` against ${dashboard.teamSelection.opponentName}`:''} is published and ready for media.`)
  const approvals=coordination?.counts.pendingApprovals||0,tasks=coordination?.counts.openTasks||0,unread=coordination?.counts.unreadNotifications||0
  if(approvals||tasks||unread)points.push(`There ${approvals+tasks+unread===1?'is':'are'} ${approvals+tasks+unread} outstanding item${approvals+tasks+unread===1?'':'s'} across tasks, approvals and notifications.`)
  const media=dashboard.news.drafts+dashboard.news.pending
  if(media)points.push(`${media} media item${media===1?' is':'s are'} still in progress.`)
  if(dashboard.users.pending)points.push(`${dashboard.users.pending} club access request${dashboard.users.pending===1?' is':'s are'} waiting for review.`)
  if(dashboard.profile.completion<100)points.push(`The public club profile is ${dashboard.profile.completion}% complete.`)
  if((dashboard.sponsors?.active||0)===0)points.push('No active sponsor is connected to Club HQ yet.')
  const urgent=liveActive?`/club-portal/${clubId}/media?section=live`:approvals?'#approvals':dashboard.users.pending?`/club-portal/${clubId}/users`:dashboard.teamSelection?.status==='DRAFT'||!dashboard.teamSelection?`/club-portal/${clubId}/team-selection`:media?`/club-portal/${clubId}/media`:dashboard.profile.completion<100?`/club-portal/${clubId}/profile`:`/club-portal/${clubId}/coaching`
  return{points:points.slice(0,4),urgent,label:liveActive?'Create live update':approvals?'Review approvals':dashboard.users.pending?'Review access':dashboard.teamSelection?.status==='DRAFT'||!dashboard.teamSelection?'Open team selection':media?'Open media studio':dashboard.profile.completion<100?'Complete profile':'Open coaching'}
 },[dashboard,coordination,live,clubId])

 if(!dashboard&&!error)return null
 return <section className="hq-ai-brief"><div className="hq-ai-icon"><Sparkles size={24}/></div><div className="hq-ai-copy"><span>AI DAILY BRIEF</span><h2>{greeting()}{dashboard?.club.name?`, ${dashboard.club.name}`:''}</h2>{error?<p>{error}</p>:<>{brief?.points.map(point=><p key={point}>{point}</p>)}</>}</div>{brief&&(brief.urgent.startsWith('#')?<button type="button" onClick={()=>document.querySelector<HTMLButtonElement>('.hqcc>nav button:nth-child(3)')?.click()}>{brief.label}<ArrowRight size={16}/></button>:<Link to={brief.urgent}>{brief.label}<ArrowRight size={16}/></Link>)}<style>{styles}</style></section>
}

const styles=`.hq-ai-brief{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:16px;padding:20px;border:1px solid #cfe7f4;border-radius:18px;background:linear-gradient(135deg,#f6fbff,#e9f7ff);box-shadow:0 10px 28px rgba(15,23,42,.045)}.hq-ai-icon{display:grid;width:46px;height:46px;place-items:center;border-radius:14px;background:#111820;color:#58c4ff}.hq-ai-copy>span{color:#087bbf;font-size:9px;font-weight:950;letter-spacing:.16em}.hq-ai-copy h2{margin:4px 0 8px;font:34px/1 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.hq-ai-copy p{margin:5px 0;color:#4f5d68;line-height:1.45}.hq-ai-brief>a,.hq-ai-brief>button{display:flex;align-items:center;gap:7px;padding:11px 14px;border:0;border-radius:999px;background:#111820;color:#fff;text-decoration:none;font-size:11px;font-weight:900;white-space:nowrap}@media(max-width:760px){.hq-ai-brief{grid-template-columns:auto 1fr}.hq-ai-brief>a,.hq-ai-brief>button{grid-column:1/-1;justify-content:center}.hq-ai-copy h2{font-size:29px}}`
