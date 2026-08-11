import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Users } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { TeamLogo } from '../components/rankings/bits'
import ClubHqAiDailyBrief from '../components/club/ClubHqAiDailyBrief'
import ClubHqUpcomingSchedule from '../components/club/ClubHqUpcomingSchedule'
import ClubHqSponsorStatusSync from '../components/club/ClubHqSponsorStatusSync'
import ClubAppMemberships from './ClubAppMemberships'

type Dashboard = {
  club:{id:string;name:string;shortName:string|null;logoUrl:string|null;primaryColour:string|null;secondaryColour:string|null;state:string;stateName:string;leagueId:string|null;leagueName:string|null;season:string|null;grade:string|null}
  membership:{id:string;role:string;status:string}
}

type Session={access_token:string}
const SESSION_KEY='playfooty.clubPortal.session.v1'
function session():Session|null{try{const raw=localStorage.getItem(SESSION_KEY);return raw?JSON.parse(raw) as Session:null}catch{return null}}
function roleLabel(value:string){return value.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}

export default function ClubPortalDashboard(){
  const{clubId=''}=useParams()
  const[search]=useSearchParams()
  const[data,setData]=useState<Dashboard|null>(null)
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')

  useEffect(()=>{
    const current=session()
    if(!current){setError('Sign in through the Club Portal to continue.');setLoading(false);return}
    let live=true
    void fetch(`/api/club-portal/clubs/${encodeURIComponent(clubId)}/dashboard`,{headers:{authorization:`Bearer ${current.access_token}`}})
      .then(async response=>{
        const payload=await response.json() as {data?:Dashboard;error?:string}
        if(!response.ok)throw new Error(payload.error||'Unable to load club dashboard')
        if(live)setData(payload.data??null)
      })
      .catch(reason=>{if(live)setError(reason instanceof Error?reason.message:'Unable to load club dashboard')})
      .finally(()=>{if(live)setLoading(false)})
    return()=>{live=false}
  },[clubId])

  if(search.get('area')==='memberships')return <ClubAppMemberships/>
  const accent=data?.club.primaryColour||'#2daaf5'
  const canManageMemberships=data?.membership.role==='OWNER'||data?.membership.role==='ADMIN'

  return <><Nav/><main className="cp-dashboard">{loading?
    <div className="cp-state">Loading your club workspace…</div>:
    error||!data?
      <section className="cp-error"><ShieldCheck size={38}/><h1>Club access required</h1><p>{error||'This dashboard is unavailable.'}</p><Link to="/club-portal">Return to Club Portal <ArrowRight size={16}/></Link></section>:
      <>
        <ClubHqSponsorStatusSync clubId={data.club.id}/>
        <header className="cp-hero" style={{'--accent':accent} as React.CSSProperties}>
          <div className="cp-club"><TeamLogo name={data.club.name} src={data.club.logoUrl??undefined} size={82}/><div><span>{data.club.leagueName||data.club.stateName}</span><h1>{data.club.name}</h1><p>{[data.club.season,data.club.grade,roleLabel(data.membership.role)].filter(Boolean).join(' · ')}</p></div></div>
          <div className="cp-hero-actions"><Link to={`/team/${data.club.id}`}>View public club <ArrowRight size={16}/></Link>{data.club.leagueId&&<Link to={`/league/${data.club.leagueId}`}>League page</Link>}</div>
        </header>
        <section className="cp-main" aria-label="Club HQ Command Centre">
          {canManageMemberships&&<Link className="cp-memberships-launch" to={`/club-portal/${data.club.id}?area=memberships`}><i><Users/></i><span><small>CLUB MEMBERSHIPS</small><strong>Memberships</strong><p>Create membership products and build the club's supporter membership foundation.</p></span><b>Open <ArrowRight/></b></Link>}
          <ClubHqAiDailyBrief clubId={data.club.id}/><ClubHqUpcomingSchedule clubId={data.club.id}/>
        </section>
      </>
  }</main><Footer/><style>{styles}</style></>
}

const styles=`
.cp-dashboard{min-height:75vh;background:#eef3f7;padding:28px clamp(14px,4vw,42px) 60px;color:#111318;overflow-x:hidden}.cp-dashboard,.cp-dashboard *{box-sizing:border-box}.cp-dashboard>*{max-width:1240px;margin-left:auto;margin-right:auto;min-width:0}.cp-state,.cp-error{min-height:55vh;display:grid;place-items:center;text-align:center}.cp-error{align-content:center}.cp-error h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:54px;margin:12px 0 0;text-transform:uppercase}.cp-error p{color:#687385}.cp-error a{display:inline-flex;align-items:center;gap:7px;color:#111;text-decoration:none;font-weight:900}.cp-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:28px;border-radius:20px;background:linear-gradient(115deg,#0c1118,#17212d);color:#fff;border-left:6px solid var(--accent);overflow:hidden}.cp-club{display:flex;align-items:center;gap:18px;min-width:0}.cp-club>div{min-width:0}.cp-club span{color:#77cfff;font-size:11px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.cp-club h1{margin:5px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(3rem,7vw,5rem);line-height:.85;text-transform:uppercase;overflow-wrap:anywhere}.cp-club p{margin:0;color:#b8c3cf;overflow-wrap:anywhere}.cp-hero-actions{display:flex;gap:9px;flex-wrap:wrap}.cp-hero-actions a{padding:11px 14px;border:1px solid rgba(255,255,255,.22);border-radius:999px;color:#fff;text-decoration:none;font-size:12px;font-weight:900;display:flex;gap:7px;align-items:center}.cp-main{display:grid;gap:16px;margin-top:16px;min-width:0}.cp-main>.hqcc,.cp-main>.hq-ai-brief,.cp-main>.hq-schedule{width:100%;max-width:100%;min-width:0;box-sizing:border-box}.cp-memberships-launch{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:14px;align-items:center;padding:17px;border:1px solid #d8e2e9;border-radius:16px;background:#fff;color:#111318;text-decoration:none;box-shadow:0 8px 24px rgba(15,23,42,.05)}.cp-memberships-launch>i{display:grid;place-items:center;width:54px;height:54px;border-radius:14px;background:#e8f6fe;color:#0783c9}.cp-memberships-launch>i svg{width:27px;height:27px}.cp-memberships-launch>span{display:grid;gap:2px}.cp-memberships-launch small{color:#0783c9;font-size:8px;font-weight:950;letter-spacing:.13em}.cp-memberships-launch strong{font:31px/1 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.cp-memberships-launch p{margin:0;color:#6d7985;font-size:11px}.cp-memberships-launch>b{display:flex;align-items:center;gap:5px;padding:10px 12px;border-radius:9px;background:#111820;color:#fff;font-size:10px;text-transform:uppercase}.cp-memberships-launch>b svg{width:14px}@media(max-width:900px){.cp-hero{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.cp-dashboard{width:100%;max-width:100vw;padding:10px 8px 118px!important}.cp-hero{width:100%;padding:16px;border-left-width:4px;border-radius:15px}.cp-club{width:100%;gap:11px}.cp-club>span,.cp-club img{flex:0 0 auto}.cp-club h1{font-size:clamp(2.25rem,12vw,3.05rem);line-height:.9}.cp-club span{font-size:9px;letter-spacing:.1em}.cp-club p{font-size:11px}.cp-hero-actions{width:100%;display:grid;grid-template-columns:1fr}.cp-hero-actions a{width:100%;justify-content:center}.cp-main{width:100%;gap:10px;margin-top:10px}.cp-memberships-launch{grid-template-columns:44px minmax(0,1fr);gap:10px;padding:13px}.cp-memberships-launch>i{width:44px;height:44px}.cp-memberships-launch>span strong{font-size:27px}.cp-memberships-launch>b{grid-column:1/-1;justify-content:center}.cp-main .hq-ai-brief,.cp-main .hq-schedule,.cp-main .hqcc{max-width:100%;min-width:0;padding:14px!important;border-radius:14px}.cp-main .hq-ai-brief{grid-template-columns:38px minmax(0,1fr)!important;gap:10px!important}.cp-main .hq-ai-icon{width:38px!important;height:38px!important}.cp-main .hq-ai-copy{min-width:0}.cp-main .hq-ai-copy h2{font-size:25px!important;overflow-wrap:anywhere}.cp-main .hq-ai-copy p{font-size:12px;overflow-wrap:anywhere}.cp-main .hq-ai-brief>a,.cp-main .hq-ai-brief>button{grid-column:1/-1;width:100%;justify-content:center}.cp-main .hq-schedule>header{gap:8px}.cp-main .hq-schedule h2{font-size:31px!important}.cp-main .hq-schedule-grid{grid-template-columns:minmax(0,1fr)!important;gap:8px}.cp-main .hq-schedule-grid>section{min-width:0;padding:11px}.cp-main .hq-schedule a{grid-template-columns:32px minmax(0,1fr) auto!important;gap:7px}.cp-main .hq-schedule a i{width:32px;height:32px}.cp-main .hq-schedule a span{min-width:0}.cp-main .hq-schedule a strong,.cp-main .hq-schedule a small{overflow-wrap:anywhere}.cp-main .hq-schedule a em{font-size:8px}.cp-main .hqcc>header{gap:10px}.cp-main .hqcc h2{font-size:36px!important}.cp-main .hqcc-counts{width:100%;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px}.cp-main .hqcc-counts b{min-width:0!important;padding:8px 4px!important;font-size:20px!important}.cp-main .hqcc>nav{width:100%;margin:12px 0!important;padding-bottom:2px;overflow-x:auto}.cp-main .hqcc>nav button{flex:0 0 auto;padding:8px 10px!important}.cp-main .hqcc-today{grid-template-columns:minmax(0,1fr)!important;gap:8px!important}.cp-main .hqcc-today>div{min-width:0;padding:11px!important}.cp-main .hqcc-today a,.cp-main .hqcc-action,.cp-main .hqcc-today article,.cp-main .hqcc-list article{grid-template-columns:34px minmax(0,1fr)!important;gap:8px!important}.cp-main .hqcc-today a>em,.cp-main .hqcc-action>em,.cp-main .hqcc-today article>time,.cp-main .hqcc-list article>time{grid-column:2;justify-self:start}.cp-main .hqcc strong,.cp-main .hqcc small{overflow-wrap:anywhere}.cp-main .hqcc-create{grid-template-columns:minmax(0,1fr)!important}.cp-main .hqcc-create input{min-width:0;width:100%}}
`
