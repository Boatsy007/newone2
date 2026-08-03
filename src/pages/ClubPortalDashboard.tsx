import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'
import { TeamLogo } from '../components/rankings/bits'

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

  const accent=data?.club.primaryColour||'#2daaf5'

  return <><Nav/><main className="cp-dashboard">{loading?
    <div className="cp-state">Loading your club workspace…</div>:
    error||!data?
      <section className="cp-error"><ShieldCheck size={38}/><h1>Club access required</h1><p>{error||'This dashboard is unavailable.'}</p><Link to="/club-portal">Return to Club Portal <ArrowRight size={16}/></Link></section>:
      <>
        <header className="cp-hero" style={{'--accent':accent} as React.CSSProperties}>
          <div className="cp-club"><TeamLogo name={data.club.name} src={data.club.logoUrl??undefined} size={82}/><div><span>{data.club.leagueName||data.club.stateName}</span><h1>{data.club.name}</h1><p>{[data.club.season,data.club.grade,roleLabel(data.membership.role)].filter(Boolean).join(' · ')}</p></div></div>
          <div className="cp-hero-actions"><Link to={`/team/${data.club.id}`}>View public club <ArrowRight size={16}/></Link>{data.club.leagueId&&<Link to={`/league/${data.club.leagueId}`}>League page</Link>}</div>
        </header>
        <section className="cp-main" aria-label="Club HQ Command Centre" />
      </>
  }</main><Footer/><style>{styles}</style></>
}

const styles=`
.cp-dashboard{min-height:75vh;background:#eef3f7;padding:28px clamp(14px,4vw,42px) 60px;color:#111318}.cp-dashboard>*{max-width:1240px;margin-left:auto;margin-right:auto}.cp-state,.cp-error{min-height:55vh;display:grid;place-items:center;text-align:center}.cp-error{align-content:center}.cp-error h1{font-family:'Bebas Neue',Impact,sans-serif;font-size:54px;margin:12px 0 0;text-transform:uppercase}.cp-error p{color:#687385}.cp-error a{display:inline-flex;align-items:center;gap:7px;color:#111;text-decoration:none;font-weight:900}.cp-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:28px;border-radius:20px;background:linear-gradient(115deg,#0c1118,#17212d);color:#fff;border-left:6px solid var(--accent)}.cp-club{display:flex;align-items:center;gap:18px;min-width:0}.cp-club span{color:#77cfff;font-size:11px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.cp-club h1{margin:5px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(3rem,7vw,5rem);line-height:.85;text-transform:uppercase}.cp-club p{margin:0;color:#b8c3cf}.cp-hero-actions{display:flex;gap:9px;flex-wrap:wrap}.cp-hero-actions a{padding:11px 14px;border:1px solid rgba(255,255,255,.22);border-radius:999px;color:#fff;text-decoration:none;font-size:12px;font-weight:900;display:flex;gap:7px;align-items:center}.cp-main{display:grid;gap:16px;margin-top:16px}.cp-main>.hqcc{width:100%;box-sizing:border-box}@media(max-width:900px){.cp-hero{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.cp-dashboard{padding:14px 10px 42px}.cp-hero{padding:20px}.cp-club{align-items:flex-start}.cp-club h1{font-size:3.2rem}.cp-hero-actions{width:100%}.cp-hero-actions a{justify-content:center;flex:1}}
`