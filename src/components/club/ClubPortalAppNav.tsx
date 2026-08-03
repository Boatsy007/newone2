import { Activity, BarChart3, ClipboardCheck, ClipboardList, Dumbbell, Home, Image, LoaderCircle, PackageSearch, Settings2, ShieldCheck, Sparkles, Swords, UserRound, Users, Wrench } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import ClubHqCommandCentre from './ClubHqCommandCentre'
import ClubCoachingCommandCentre from './ClubCoachingCommandCentre'

const COACHING_SECTIONS=new Set(['coaching','availability','team-selection','whiteboard'])
const ANALYTICS_SECTIONS=new Set(['analytics','activity'])
type SectionItem={label:string;description:string;href:string;icon:typeof Home;active:boolean}
type LoadingTarget={label:string;path:string;startedAt:number}

export default function ClubPortalAppNav(){
 const{pathname,search}=useLocation()
 const match=pathname.match(/^\/club-portal\/([^/]+)(?:\/([^/?#]+))?(?:\/|$)/)
 const clubId=match?.[1]??''
 const section=match?.[2]??''
 const view=new URLSearchParams(search).get('view')
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
 const items=[
  {label:'Home',href:`/club-portal/${clubId}`,icon:Home,active:!section},
  {label:'Coaching',href:`/club-portal/${clubId}/coaching`,icon:ClipboardList,active:COACHING_SECTIONS.has(section)},
  {label:'Operations',href:`/club-portal/${clubId}/volunteers`,icon:Settings2,active:section==='volunteers'||section==='equipment'},
  {label:'Media',href:`/club-portal/${clubId}/media`,icon:Image,active:section==='media'||section==='news'||section==='milestones'},
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
 if(!section)return'Home'
 if(section==='coaching'&&view==='team')return'Team'
 if(section==='coaching'&&view==='training')return'Training'
 if(section==='coaching'&&view==='match-day')return'Match Day'
 if(section==='coaching'&&view==='opposition')return'Opposition'
 if(section==='coaching'&&view==='player-development')return'Development'
 if(section==='analytics'&&view==='media')return'Media Analytics'
 const labels:Record<string,string>={coaching:'Coaching',availability:'Availability','team-selection':'Team Selection',whiteboard:'Whiteboard',volunteers:'Volunteers & Rosters',equipment:'Equipment & Stocktake',media:'Media Studio',news:'AI News',milestones:'Milestones',analytics:'Club Analytics',activity:'Activity',profile:'Club Profile',sponsors:'Sponsors',users:'Users & Permissions',plans:'Plan'}
 return labels[section]??'Club HQ'
}
function getSectionTitle(section:string){if(COACHING_SECTIONS.has(section))return'Coaching';if(section==='volunteers'||section==='equipment')return'Operations';if(ANALYTICS_SECTIONS.has(section))return'Analytics';if(['profile','sponsors','users','plans'].includes(section))return'Profile';return''}
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
@media(min-width:761px){.club-hq-bottom{left:50%;right:auto;bottom:18px;width:min(920px,calc(100% - 36px));transform:translateX(-50%);border:1px solid #dfe4e8;border-radius:22px;padding:8px;box-shadow:0 14px 38px rgba(15,23,42,.14)}.club-hq-bottom a{min-height:60px;font-size:10px}.club-section-sidebar{position:fixed;inset:0 auto 0 0;z-index:100250;display:block;width:238px;box-sizing:border-box;padding:22px 14px 110px;background:#101317;color:#fff;overflow-y:auto;box-shadow:12px 0 34px rgba(15,23,42,.12)}.club-section-back{display:flex;align-items:center;gap:7px;margin:0 8px 26px;color:#fff;text-decoration:none;font-size:12px;font-weight:900}.club-section-title{display:grid;gap:4px;margin:0 9px 20px}.club-section-title span{color:#52c0ff;font-size:9px;font-weight:950;letter-spacing:.18em}.club-section-title strong{font:34px/1 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.club-section-sidebar nav{display:grid;gap:5px}.club-section-sidebar nav a{display:grid;grid-template-columns:34px 1fr;align-items:center;gap:8px;padding:10px;border-radius:13px;color:#aeb7bf;text-decoration:none}.club-section-sidebar nav a>svg{justify-self:center}.club-section-sidebar nav a>span{display:grid;gap:2px}.club-section-sidebar nav a strong{font-size:12px}.club-section-sidebar nav a small{color:#74808a;font-size:8px;line-height:1.3}.club-section-sidebar nav a.active{background:#1f2a33;color:#fff}.club-section-sidebar nav a.active svg{color:#52c0ff;stroke-width:2.8}.club-section-sidebar nav a.active small{color:#a7cce1}body:has(.club-section-sidebar) #root>nav,body:has(.club-section-sidebar) #root>footer{margin-left:238px!important}}
@media(max-width:1100px) and (min-width:761px){.club-section-sidebar{width:210px}.club-section-sidebar nav a small{display:none}body:has(.club-section-sidebar) #root>nav,body:has(.club-section-sidebar) #root>footer{margin-left:210px!important}.club-profile-sponsor-card{grid-template-columns:auto 1fr}.club-profile-sponsor-card b{grid-column:2;width:max-content}}
@media(max-width:760px){.club-page-loading{align-items:center;padding-bottom:calc(92px + env(safe-area-inset-bottom))}.club-page-loading-card{padding:27px 21px 24px;border-radius:17px}.club-page-loading-card>strong{font-size:32px}.club-hq-bottom a{font-size:8px}.club-hq-bottom a svg{width:20px;height:20px}.club-section-mobile{position:sticky;top:0;z-index:100220;display:flex;gap:6px;overflow-x:auto;padding:8px 9px;border-bottom:1px solid #dfe4e8;background:rgba(250,251,252,.97);box-shadow:0 7px 18px rgba(15,23,42,.05);backdrop-filter:blur(18px);scrollbar-width:none}.club-section-mobile a{display:flex;flex:0 0 auto;min-height:42px;align-items:center;gap:6px;padding:0 11px;border-radius:11px;color:#7f8992;text-decoration:none;font-size:9px;font-weight:900;white-space:nowrap}.club-section-mobile a.active{background:#e6f5fe;color:#087bbf}.club-profile-sponsor-card{grid-template-columns:auto 1fr;margin:14px 0 0;padding:15px}.club-profile-sponsor-card b{grid-column:1/-1;text-align:center}}
@media(max-width:430px){.club-hq-bottom a{font-size:7px}.club-hq-bottom a svg{width:19px;height:19px}}
`