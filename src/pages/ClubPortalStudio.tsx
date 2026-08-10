import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronRight, CircleDollarSign, Newspaper, Radio, ShieldCheck, Sparkles, Trophy, UsersRound } from 'lucide-react'
import StudioTeamSelection from '../components/studio/StudioTeamSelection'

type Session={access_token:string}
type Dashboard={club:{id:string;name:string;logoUrl:string|null;leagueName:string|null;stateName:string;season:string|null;grade:string|null;primaryColour:string|null};membership:{role:string}}
const KEY='playfooty.clubPortal.session.v1'
const CLUB_KEY='playfooty.coachApp.club.v1'
function session():Session|null{try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw) as Session:null}catch{return null}}

export default function ClubPortalStudio(){
 const{clubId=''}=useParams()
 const navigate=useNavigate()
 const[params]=useSearchParams()
 const view=params.get('view')||''
 const[data,setData]=useState<Dashboard|null>(null)
 const[loading,setLoading]=useState(true)
 const[error,setError]=useState('')
 const token=session()?.access_token??''
 const headers=useMemo(()=>({authorization:`Bearer ${token}`}),[token])

 useEffect(()=>{let live=true;setLoading(true);setError('');if(!token){setError('Sign in through the Club App to continue.');setLoading(false);return()=>{live=false}}
   void fetch(`/api/club-portal/clubs/${encodeURIComponent(clubId)}/dashboard`,{headers}).then(async r=>{const p=await r.json() as{data?:Dashboard;error?:string};if(!r.ok||!p.data)throw new Error(p.error||'Unable to load Studio');return p.data}).then(d=>{if(live)setData(d)}).catch(reason=>{if(live)setError(reason instanceof Error?reason.message:'Unable to load Studio')}).finally(()=>{if(live)setLoading(false)})
   return()=>{live=false}
 },[clubId,headers,token])

 function backToClub(){try{localStorage.setItem(CLUB_KEY,clubId)}catch{};navigate('/coach-app')}
 function logout(){try{localStorage.removeItem(KEY);localStorage.removeItem(CLUB_KEY)}catch{};navigate('/club-portal?returnTo=%2Fcoach-app')}
 function studioHome(){navigate(`/club-portal/${clubId}/studio`)}

 if(loading)return <main className="studio-app-state"><style>{styles}</style><span className="studio-spinner"/><strong>Opening Studio…</strong></main>
 if(error||!data)return <main className="studio-app-state"><style>{styles}</style><ShieldCheck/><strong>Studio unavailable</strong><p>{error||'This workspace is unavailable.'}</p><button onClick={backToClub}>Back to Club App</button></main>

 const fixtureMeta=[data.club.leagueName||data.club.stateName,data.club.season,data.club.grade].filter(Boolean).join(' · ')
 const teamSelection=view==='team-selection'
 return <main className="studio-app">
  <style>{styles}</style>
  <header className="studio-shell">
   <button className="studio-club" onClick={backToClub}>{data.club.logoUrl?<img src={data.club.logoUrl} alt=""/>:<div>PF</div>}<span><b>{data.club.name}</b><small>{fixtureMeta}</small></span></button>
   <div className="studio-title"><b>PLAYFOOTY STUDIO</b><span>{teamSelection?'TEAM SELECTION':'STUDIO DASHBOARD'}</span></div>
   <div className="studio-actions"><button onClick={teamSelection?studioHome:backToClub}>{teamSelection?'Studio dashboard':'Club dashboard'}</button><button onClick={logout}>Log out</button></div>
  </header>

  {teamSelection?<StudioTeamSelection clubId={clubId} token={token} club={data.club} onBack={studioHome}/>:<section className="studio-dashboard">
   <div className="studio-intro"><span>CLUB CONTENT HUB</span><h1>CREATE. PUBLISH. GO LIVE.</h1><p>Everything your club needs to create match content, tell stories and keep supporters connected.</p></div>

   <section className="studio-tools">
    <div className="studio-section-head"><div><span>OPEN DIRECTLY</span><h2>Studio Tools</h2></div><small>One dashboard for club content</small></div>
    <div className="studio-tool-grid">
     <Link to={`/club-portal/${clubId}/studio?view=team-selection`}><i><UsersRound/></i><span><small>TEAM MEDIA</small><strong>Team Selection</strong><em>Generate this week’s team graphic and social captions.</em></span><ChevronRight/></Link>
     <a href={`/coach-app?screen=match-day`}><i><Trophy/></i><span><small>MATCH DAY</small><strong>Live Game</strong><em>Open the live game and match-day content.</em></span><ChevronRight/></a>
     <Link to={`/club-portal/${clubId}/activity`}><i><CalendarDays/></i><span><small>CLUB CALENDAR</small><strong>Events</strong><em>Create and manage club event content.</em></span><ChevronRight/></Link>
     <div className="studio-tool coming"><i><CircleDollarSign/></i><span><small>COMMUNITY</small><strong>Fundraising</strong><em>Campaigns, drives and fundraising content.</em><b>COMING NEXT</b></span><ShieldCheck/></div>
     <div className="studio-tool coming"><i><Sparkles/></i><span><small>PLAYER & CLUB</small><strong>Milestones</strong><em>Celebrate games, goals and club achievements.</em><b>COMING NEXT</b></span><ShieldCheck/></div>
     <Link to={`/club-portal/${clubId}/news`}><i><Newspaper/></i><span><small>EDITORIAL</small><strong>News</strong><em>Write, edit and publish club stories.</em></span><ChevronRight/></Link>
     <a className="broadcast" href={`/live-stream.html?clubId=${encodeURIComponent(clubId)}`}><i><Radio/></i><span><small>GO LIVE</small><strong>Live Broadcast</strong><em>Broadcast the match with PlayFooty overlays.</em></span><ChevronRight/></a>
    </div>
   </section>
  </section>}
 </main>
}

const styles=`
.studio-app,.studio-app *{box-sizing:border-box}.studio-app{min-height:100vh;background:#eef3f7;color:#0b1720;font-family:Barlow,Inter,Arial,sans-serif}.studio-shell{position:sticky;top:0;z-index:20;min-height:78px;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:16px;padding:10px 18px;background:#07121b;border-bottom:1px solid #173140;color:#fff}.studio-club{min-width:0;display:flex;align-items:center;gap:11px;border:0;background:transparent;color:#fff;text-align:left;cursor:pointer}.studio-club>img,.studio-club>div{width:48px;height:48px;flex:0 0 48px;border-radius:12px;object-fit:contain;background:#fff;padding:4px}.studio-club>div{display:grid;place-items:center;color:#07121b;font-weight:1000}.studio-club span{display:flex;min-width:0;flex-direction:column}.studio-club b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px}.studio-club small{margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9fb0bd;font-size:10px}.studio-title{text-align:center}.studio-title b{display:block;color:#39b8ff;font-size:10px;font-weight:950;letter-spacing:.12em}.studio-title span{display:block;margin-top:2px;font:30px/1 'Bebas Neue',Impact,sans-serif;white-space:nowrap}.studio-actions{justify-self:end;display:flex;gap:8px}.studio-actions button{padding:10px 13px;border:1px solid #2a4456;border-radius:9px;background:#0b1721;color:#fff;font-weight:850;cursor:pointer}.studio-dashboard{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:26px 0 54px}.studio-intro{padding:28px 30px;border-radius:22px;background:linear-gradient(115deg,#07121b,#102c3e);color:#fff;box-shadow:0 18px 44px rgba(7,18,27,.16)}.studio-intro>span,.studio-section-head span{color:#39b8ff;font-size:11px;font-weight:950;letter-spacing:.15em}.studio-intro h1{margin:6px 0 8px;font:clamp(3.6rem,7vw,6.4rem)/.83 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.studio-intro p{max-width:760px;margin:0;color:#b6c5cf;font-size:15px}.studio-tools{margin-top:18px;padding:18px;border:1px solid #d4dee5;border-radius:20px;background:#fff}.studio-section-head{display:flex;align-items:end;justify-content:space-between;gap:14px;padding:3px 4px 16px}.studio-section-head h2{margin:4px 0 0;font:42px/1 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.studio-section-head small{color:#73818c}.studio-tool-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.studio-tool-grid>a,.studio-tool{min-height:132px;display:grid;grid-template-columns:52px minmax(0,1fr) 24px;align-items:center;gap:14px;padding:18px;border:1px solid #d7e0e6;border-radius:16px;background:#fff;color:#12212b;text-decoration:none;box-shadow:0 5px 14px rgba(20,42,56,.04)}.studio-tool-grid>a:hover{border-color:#42b8ff;box-shadow:0 10px 24px rgba(20,42,56,.08)}.studio-tool-grid i{width:50px;height:50px;display:grid;place-items:center;border-radius:14px;background:#e5f4fc;color:#128fd0}.studio-tool-grid i svg{width:26px;height:26px}.studio-tool-grid span{display:flex;min-width:0;flex-direction:column}.studio-tool-grid small{color:#159ee8;font-size:9px;font-weight:950;letter-spacing:.12em}.studio-tool-grid strong{margin-top:4px;font:31px/1 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.studio-tool-grid em{margin-top:6px;color:#61717d;font-size:13px;font-style:normal}.studio-tool-grid>a>svg,.studio-tool>svg{color:#80909a}.studio-tool.coming{opacity:.68;background:#f7f9fa}.studio-tool.coming b{margin-top:7px;color:#159ee8;font-size:9px;letter-spacing:.1em}.studio-tool-grid>a.broadcast{background:linear-gradient(135deg,#07121b,#0d2637);border-color:#159ee8;color:#fff}.studio-tool-grid>a.broadcast i{background:#39b8ff;color:#041019}.studio-tool-grid>a.broadcast em{color:#b7c7d1}.studio-tool-grid>a.broadcast>svg{color:#39b8ff}.studio-app-state{min-height:100vh;display:grid;place-items:center;align-content:center;gap:12px;background:#07121b;color:#fff;text-align:center;font-family:Barlow,Inter,Arial,sans-serif}.studio-app-state>svg{color:#39b8ff}.studio-app-state strong{font:36px/1 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.studio-app-state p{margin:0;color:#9fb0bd}.studio-app-state button{padding:12px 16px;border:0;border-radius:10px;background:#39b8ff;color:#061019;font-weight:950}.studio-spinner{width:34px;height:34px;border:3px solid rgba(57,184,255,.2);border-top-color:#39b8ff;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:760px){.studio-shell{grid-template-columns:minmax(0,1fr) auto}.studio-title{display:none}.studio-actions button:first-child{display:none}.studio-dashboard{width:min(100% - 18px,1180px);padding-top:12px}.studio-intro{padding:20px;border-radius:16px}.studio-intro h1{font-size:clamp(3rem,14vw,4.8rem)}.studio-tools{padding:12px;border-radius:16px}.studio-section-head{align-items:flex-start;flex-direction:column}.studio-section-head h2{font-size:36px}.studio-tool-grid{grid-template-columns:1fr}.studio-tool-grid>a,.studio-tool{min-height:112px;padding:14px}.studio-tool-grid strong{font-size:28px}}
`
