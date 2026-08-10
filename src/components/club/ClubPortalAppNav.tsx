import { Activity, BarChart3, ClipboardCheck, ClipboardList, Dumbbell, Home, Image, LoaderCircle, PackageSearch, Settings2, ShieldCheck, Sparkles, Swords, UserRound, Users, Wrench } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ClubHqCommandCentre from './ClubHqCommandCentre'
import ClubCoachingCommandCentre from './ClubCoachingCommandCentre'

const COACHING_SECTIONS=new Set(['coaching','availability','team-selection','whiteboard'])
const STUDIO_SECTIONS=new Set(['studio','media','news'])
const ANALYTICS_SECTIONS=new Set(['analytics','activity'])
type SectionItem={label:string;description:string;href:string;icon:typeof Home;active:boolean}
type LoadingTarget={label:string;path:string;startedAt:number}

export default function ClubPortalAppNav(){
 const{pathname,search}=useLocation()
 const match=pathname.match(/^\/club-portal\/([^/]+)(?:\/([^/?#]+))?(?:\/|$)/)
 const clubId=match?.[1]??''
 const section=match?.[2]??''
 const searchParams=new URLSearchParams(search)
 const view=searchParams.get('view')
 const area=searchParams.get('area')
 const[profileHost,setProfileHost]=useState<Element|null>(null)
 const[loadingTarget,setLoadingTarget]=useState<LoadingTarget|null>(null)
 const finishTimer=useRef<number|null>(null)
 useEffect(()=>{if(section!=='profile'){setProfileHost(null);return}const frame=requestAnimationFrame(()=>setProfileHost(document.querySelector('.cpp')));return()=>cancelAnimationFrame(frame)},[pathname,section])
 useEffect(()=>{if(!clubId)return;const handleClick=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;const destination=new URL(anchor.href,window.location.href);if(destination.origin!==window.location.origin||!destination.pathname.startsWith(`/club-portal/${clubId}`))return;if(destination.pathname===pathname&&destination.search===search)return;if(finishTimer.current!==null){window.clearTimeout(finishTimer.current);finishTimer.current=null}setLoadingTarget({label:getLoadingLabel(destination.pathname,destination.search),path:`${destination.pathname}${destination.search}`,startedAt:Date.now()})};document.addEventListener('click',handleClick,true);return()=>document.removeEventListener('click',handleClick,true)},[clubId,pathname,search])
 useEffect(()=>{if(!loadingTarget||`${pathname}${search}`!==loadingTarget.path)return;const root=document.getElementById('root');if(!root)return;let settled=false;const finish=()=>{if(settled)return;settled=true;observer.disconnect();window.clearTimeout(fallback);const remaining=Math.max(0,700-(Date.now()-loadingTarget.startedAt));finishTimer.current=window.setTimeout(()=>{setLoadingTarget(current=>current?.path===loadingTarget.path?null:current);finishTimer.current=null},remaining)};const pageStillLoading=()=>/(^|\n)\s*Loading(?:\s+[^\n.]+)?(?:\.{3}|…)?\s*($|\n)/i.test(root.innerText);const check=()=>{window.requestAnimationFrame(()=>{if(!pageStillLoading())finish()})};const observer=new MutationObserver(check);observer.observe(root,{subtree:true,childList:true,characterData:true});const initial=window.setTimeout(check,80);const fallback=window.setTimeout(finish,15000);return()=>{window.clearTimeout(initial);window.clearTimeout(fallback);observer.disconnect()}},[pathname,search,loadingTarget])
 useEffect(()=>()=>{if(finishTimer.current!==null)window.clearTimeout(finishTimer.current)},[])
 const loadingLabel=loadingTarget?.label??null
 const loadingCard=loadingLabel?createPortal(<div className="club-page-loading" role="status" aria-live="polite" aria-label={`Loading ${loadingLabel}`}><div className="club-page-loading-card"><LoaderCircle size={34}/><span>CLUB HQ</span><strong>Loading {loadingLabel}</strong><p>Please wait while your {loadingLabel.toLowerCase()} workspace opens.</p></div></div>,document.body):null
 if(!clubId||section==='whiteboard')return <><ClubHqCommandCentre/>{loadingCard}<style>{styles}</style></>
 // Memberships is a self-contained Club App module, not a desktop Club HQ page.
 if(!section&&area==='memberships')return <><ClubHqCommandCentre/>{loadingCard}<style>{styles}</style></>
 // Studio is a self-contained app dashboard. Do not inject Club HQ bottom/side navigation on this screen.
 if(section==='studio')return <><ClubHqCommandCentre/>{loadingCard}<style>{styles}</style></>
 const items=[
  {label:'Home',href:`/club-portal/${clubId}`,icon:Home,active:!section},
  {label:'Coaching',href:`/club-portal/${clubId}/coaching`,icon:ClipboardList,active:COACHING_SECTIONS.has(section)},
  {label:'Operations',href:`/club-portal/${clubId}/volunteers`,icon:Settings2,active:section==='volunteers'||section==='equipment'},
  {label:'Studio',href:`/club-portal/${clubId}/studio`,icon:Image,active:STUDIO_SECTIONS.has(section)},
  {label:'Analytics',href:`/club-portal/${clubId}/analytics`,icon:BarChart3,active:ANALYTICS_SECTIONS.has(section)},
  {label:'Profile',href:`/club-portal/${clubId}/profile`,icon:UserRound,active:['profile','sponsors','users','plans'].includes(section)},
 ]
 const sectionItems=getSectionItems(clubId,section,view)
 const sectionTitle=getSectionTitle(section)
 const navigation=<><nav className="club-hq-bottom" aria-label="Club HQ navigation"><div>{items.map(item=><Link key={item.label} to={item.href} className={item.active?'active':''} aria-current={item.active?'page':undefined}><item.icon size={22}/><span>{item.label}</span></Link>)}</div></nav>{sectionItems.length>0&&<><aside className="club-section-sidebar"><Link className="club-section-back" to={`/club-portal/${clubId}`}><Home size={17}/> Club HQ</Link><div className="club-section-title"><span>PLAYFOOTY</span><strong>{sectionTitle}</strong></div><nav>{sectionItems.map(item=><Link key={item.label} to={item.href} className={item.active?'active':''} aria-current={item.active?'page':undefined}><item.icon size={19}/><span><strong>{item.label}</strong><small>{item.description}</small></span></Link>)}</nav></aside><nav className="club-section-mobile" aria-label={`${sectionTitle} navigation`}>{sectionItems.map(item=><Link key={item.label} to={item.href} className={item.active?'active':''}><item.icon size={18}/><span>{item.label}</span></Link>)}</nav></>}<style>{styles}</style></>
 const sponsorShortcut=profileHost?createPortal(<Link className="club-profile-sponsor-card" to={`/club-portal/${clubId}/sponsors`}><ShieldCheck size={28}/><span><small>CLUB PARTNERS</small><strong>Sponsors</strong><p>Manage sponsor logos, placements, links and approval status from the records shown on your public profile.</p></span><b>Manage sponsors</b></Link>,profileHost):null
 const coachingCommand=section==='coaching'&&!view?<ClubCoachingCommandCentre clubId={clubId}/>:null
 return <><ClubHqCommandCentre/>{coachingCommand}{createPortal(navigation,document.body)}{sponsorShortcut}{loadingCard}</>
}

function getLoadingLabel(pathname:string,search:string){
 const section=pathname.match(/^\/club-portal\/[^/]+(?:\/([^/?#]+))?/)?.[1]??''
 const view=new URLSearchParams(search).get('view')
 const area=new URLSearchParams(search).get('area')
 if(!section&&area==='memberships')return'Memberships'
 if(!section)return'Home'
 if(section==='coaching'&&view==='team')return'Team'
 if(section==='coaching'&&view==='training')return'Training'
 if(section==='coaching'&&view==='match-day')return'Match Day'
 if(section==='coaching'&&view==='opposition')return'Opposition'
 if(section==='coaching'&&view==='player-development')return'Development'
 if(section==='analytics'&&view==='media')return'Media Analytics'
 const labels:Record<string,string>={coaching:'Coaching',availability:'Availability','team-selection':'Team Selection',whiteboard:'Whiteboard',volunteers:'Volunteers & Rosters',equipment:'Equipment & Stocktake',studio:'Studio',media:'Media Library',news:'Newsroom',analytics:'Club Analytics',activity:'Activity',profile:'Club Profile',sponsors:'Sponsors',users:'Users & Permissions',plans:'Plan'}
 return labels[section]??'Club HQ'
}
function getSectionTitle(section:string){if(COACHING_SECTIONS.has(section))return'Coaching';if(section==='volunteers'||section==='equipment')return'Operations';if(STUDIO_SECTIONS.has(section))return'Studio';if(ANALYTICS_SECTIONS.has(section))return'Analytics';if(['profile','sponsors','users','plans'].includes(section))return'Profile';return''}
function getSectionItems(clubId:string,section:string,view:string|null):SectionItem[]{
 if(COACHING_SECTIONS.has(section))return[
  {label:'Overview',description:'Coaching command centre',href:`/club-portal/${clubId}/coaching`,icon:Home,active:section==='coaching'&&!view},
  {label:'Team',description:'Squad and weekly planning',href:`/club-portal/${clubId}/coaching?view=team`,icon:Users,active:section==='coaching'&&view==='team'},
  {label:'Availability',description:'Weekly player responses',href:`/club-portal/${clubId}/availability`,icon:ClipboardCheck,active:section==='availability'},
  {label:'Team Selection',description:'Name and publish the side',href:`/club-portal/${clubId}/team-selection`,icon:ShieldCheck,active:section==='team-selection'},
  {label:'Training',description:'Sessions and attendance',href:`/club-portal/${clubId}/coaching?view=training`,icon:Dumbbell,active:section==='coaching'&&view==='training'},
  {label:'Match Day',description:'Live scoring and review',href:`/club-portal/${clubId}/coaching?view=match-day`,icon:Swords,active:section==='coaching'&&view==='match-day'},
  {label:'Opposition',description:'Plan for the next opponent',href:`/club-portal/${clubId}/coaching?view=opposition`,icon:ClipboardList,active:section==='coaching'&&view==='opposition'},
  {label:'Development',description:'Player notes and progress',href:`/club-portal/${clubId}/coaching?view=player-development`,icon:Sparkles,active:section==='coaching'&&view==='player-development'},
  {label:'Whiteboard',description:'Tactics and saved plays',href:`/club-portal/${clubId}/whiteboard`,icon:Wrench,active:section==='whiteboard'},
 ]
 if(section==='volunteers'||section==='equipment')return[
  {label:'Volunteers & Rosters',description:'People, roles and shifts',href:`/club-portal/${clubId}/volunteers`,icon:Users,active:section==='volunteers'},
  {label:'Equipment & Stocktake',description:'Inventory, condition and alerts',href:`/club-portal/${clubId}/equipment`,icon:PackageSearch,active:section==='equipment'},
 ]
 if(STUDIO_SECTIONS.has(section))return[
  {label:'Studio',description:'Media command centre',href:`/club-portal/${clubId}/studio`,icon:Image,active:section==='studio'},
  {label:'Media Library',description:'Shared club images and assets',href:`/club-portal/${clubId}/media`,icon:Image,active:section==='media'},
  {label:'Newsroom',description:'Create and publish club stories',href:`/club-portal/${clubId}/news`,icon:ClipboardList,active:section==='news'},
 ]
 if(ANALYTICS_SECTIONS.has(section))return[
  {label:'Club Analytics',description:'Profile and audience performance',href:`/club-portal/${clubId}/analytics`,icon:BarChart3,active:section==='analytics'&&view!=='media'},
  {label:'Media Analytics',description:'Content and creative performance',href:`/club-portal/${clubId}/analytics?view=media`,icon:Image,active:section==='analytics'&&view==='media'},
  {label:'Activity',description:'Recent Club HQ actions',href:`/club-portal/${clubId}/activity`,icon:Activity,active:section==='activity'},
 ]
 if(['profile','sponsors','users','plans'].includes(section))return[
  {label:'Club Profile',description:'Brand, details and public profile',href:`/club-portal/${clubId}/profile`,icon:UserRound,active:section==='profile'},
  {label:'Sponsors',description:'Partners, logos and placements',href:`/club-portal/${clubId}/sponsors`,icon:ShieldCheck,active:section==='sponsors'},
  {label:'Users & Permissions',description:'Staff access and roles',href:`/club-portal/${clubId}/users`,icon:Users,active:section==='users'},
  {label:'Plan',description:'Club HQ subscription',href:`/club-portal/${clubId}/plans`,icon:ClipboardList,active:section==='plans'},
 ]
 return[]
}

const styles=`
.club-page-loading{position:fixed;inset:0;z-index:100500;display:grid;place-items:center;padding:22px;background:rgba(241,245,249,.72);backdrop-filter:blur(7px)}.club-page-loading-card{width:min(390px,calc(100vw - 36px));box-sizing:border-box;display:flex;flex-direction:column;align-items:center;padding:30px 26px 27px;border:1px solid #dce4ea;border-radius:20px;background:#fff;text-align:center;box-shadow:0 22px 70px rgba(15,23,42,.18)}.club-page-loading-card>svg{color:#42b8ff;animation:club-page-loader-spin .8s linear infinite}.club-page-loading-card>span{margin-top:17px;color:#0783c9;font-size:9px;font-weight:950;letter-spacing:.18em}.club-page-loading-card>strong{margin-top:7px;color:#111318;font:36px/1 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.club-page-loading-card>p{margin:9px 0 0;color:#687385;font-size:13px;line-height:1.45}@keyframes club-page-loader-spin{to{transform:rotate(360deg)}}
.club-hq-bottom{position:fixed;left:0;right:0;bottom:0;z-index:100300;padding:7px 7px calc(7px + env(safe-area-inset-bottom));background:rgba(250,251,252,.97);border-top:1px solid #dfe4e8;box-shadow:0 -8px 28px rgba(15,23,42,.09);backdrop-filter:blur(18px);transition:transform .2s ease,opacity .2s ease}.club-hq-bottom>div{width:min(920px,100%);margin:0 auto;display:grid;grid-template-columns:repeat(6,1fr);gap:4px}.club-hq-bottom a{display:flex;min-width:0;min-height:56px;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:14px;color:#8b949d;text-decoration:none;font-size:9px;font-weight:900}.club-hq-bottom a.active{color:#087bbf;background:#e6f5fe}.club-hq-bottom a.active svg{stroke-width:2.8}.pf-menu-open .club-hq-bottom{transform:translateY(calc(100% + 24px));opacity:0;pointer-events:none}.club-section-sidebar,.club-section-mobile{display:none}.club-profile-sponsor-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:16px;max-width:1240px;margin:14px auto 0;padding:18px 20px;border:1px solid #dce4ea;border-radius:14px;background:#fff;color:#111318;text-decoration:none;box-shadow:0 8px 24px rgba(15,23,42,.045)}.club-profile-sponsor-card>svg{color:#0783c9}.club-profile-sponsor-card span{display:grid;gap:3px}.club-profile-sponsor-card small{color:#0783c9;font-size:9px;font-weight:950;letter-spacing:.14em}.club-profile-sponsor-card strong{font:31px/1 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.club-profile-sponsor-card p{margin:0;color:#687385;font-size:12px}.club-profile-sponsor-card b{padding:10px 13px;border-radius:9px;background:#111318;color:#fff;font-size:11px;text-transform:uppercase}body:has(.club-hq-bottom) .cp-dashboard,body:has(.club-hq-bottom) .club-portal-page,body:has(.club-hq-bottom) .club-portal-profile,body:has(.club-hq-bottom) .club-portal-page-wrap,body:has(.club-hq-bottom) .cpp,body:has(.club-hq-bottom) .cps,body:has(.club-hq-bottom) .cpu,body:has(.club-hq-bottom) .ca,body:has(.club-hq-bottom) .cpa{box-sizing:border-box;padding-bottom:112px!important}
@media(min-width:761px){.club-section-sidebar{position:fixed;left:0;top:64px;bottom:0;z-index:100250;display:flex;width:230px;box-sizing:border-box;flex-direction:column;padding:18px 12px 94px;background:#0a121a;border-right:1px solid #182b39;color:#fff;overflow-y:auto}.club-section-back{display:flex;align-items:center;gap:7px;color:#a9bac6;text-decoration:none;font-size:10px;font-weight:900;text-transform:uppercase}.club-section-title{display:grid;gap:2px;margin:19px 7px 15px}.club-section-title span{color:#42b8ff;font-size:8px;font-weight:950;letter-spacing:.16em}.club-section-title strong{font:30px/1 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.club-section-sidebar nav{display:grid;gap:4px}.club-section-sidebar nav>a{display:grid;grid-template-columns:27px minmax(0,1fr);align-items:center;gap:7px;padding:10px;border-radius:10px;color:#a9bac6;text-decoration:none}.club-section-sidebar nav>a.active{background:#142736;color:#fff}.club-section-sidebar nav>a.active>svg{color:#42b8ff}.club-section-sidebar nav>a span{display:grid;gap:2px}.club-section-sidebar nav>a strong{font-size:11px}.club-section-sidebar nav>a small{color:#718695;font-size:8px;line-height:1.25}body:has(.club-section-sidebar) .club-portal-page,body:has(.club-section-sidebar) .club-portal-profile,body:has(.club-section-sidebar) .club-portal-page-wrap,body:has(.club-section-sidebar) .cpp,body:has(.club-section-sidebar) .cps,body:has(.club-section-sidebar) .cpu,body:has(.club-section-sidebar) .ca,body:has(.club-section-sidebar) .cpa,body:has(.club-section-sidebar) .studio-app{margin-left:230px!important;width:calc(100% - 230px)!important}}
@media(max-width:760px){.club-section-mobile{display:flex;gap:6px;overflow-x:auto;padding:8px 9px;background:#0a121a;border-bottom:1px solid #182b39}.club-section-mobile a{flex:0 0 auto;display:flex;align-items:center;gap:5px;padding:8px 10px;border-radius:9px;color:#91a4b1;text-decoration:none;font-size:9px;font-weight:900}.club-section-mobile a.active{background:#153044;color:#fff}.club-section-mobile a.active svg{color:#42b8ff}}
`
