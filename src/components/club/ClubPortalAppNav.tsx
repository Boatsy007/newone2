import { Activity, BarChart3, ClipboardCheck, ClipboardList, Dumbbell, Home, Image, PackageSearch, Settings2, ShieldCheck, Sparkles, Swords, UserRound, Users, Wrench } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import ClubHqCommandCentre from './ClubHqCommandCentre'

const COACHING_SECTIONS=new Set(['coaching','availability','team-selection','whiteboard'])
const ANALYTICS_SECTIONS=new Set(['analytics','activity'])
type SectionItem={label:string;description:string;href:string;icon:typeof Home;active:boolean}

export default function ClubPortalAppNav(){
 const{pathname,search}=useLocation()
 const match=pathname.match(/^\/club-portal\/([^/]+)(?:\/([^/?#]+))?(?:\/|$)/)
 const clubId=match?.[1]??''
 const section=match?.[2]??''
 const view=new URLSearchParams(search).get('view')
 if(!clubId||section==='whiteboard')return <ClubHqCommandCentre/>
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
 return <><ClubHqCommandCentre/>{createPortal(navigation,document.body)}</>
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
.club-hq-bottom{position:fixed;left:0;right:0;bottom:0;z-index:100300;padding:7px 7px calc(7px + env(safe-area-inset-bottom));background:rgba(250,251,252,.97);border-top:1px solid #dfe4e8;box-shadow:0 -8px 28px rgba(15,23,42,.09);backdrop-filter:blur(18px);transition:transform .2s ease,opacity .2s ease}.club-hq-bottom>div{width:min(920px,100%);margin:0 auto;display:grid;grid-template-columns:repeat(6,1fr);gap:4px}.club-hq-bottom a{display:flex;min-width:0;min-height:56px;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:14px;color:#8b949d;text-decoration:none;font-size:9px;font-weight:900}.club-hq-bottom a.active{color:#087bbf;background:#e6f5fe}.club-hq-bottom a.active svg{stroke-width:2.8}.pf-menu-open .club-hq-bottom{transform:translateY(calc(100% + 24px));opacity:0;pointer-events:none}.club-section-sidebar,.club-section-mobile{display:none}body:has(.club-hq-bottom) .cp-dashboard,body:has(.club-hq-bottom) .club-portal-page,body:has(.club-hq-bottom) .club-portal-profile,body:has(.club-hq-bottom) .club-portal-page-wrap,body:has(.club-hq-bottom) .cpp,body:has(.club-hq-bottom) .cps,body:has(.club-hq-bottom) .cpu,body:has(.club-hq-bottom) .ca,body:has(.club-hq-bottom) .cpa{box-sizing:border-box;padding-bottom:112px!important}
@media(min-width:761px){.club-hq-bottom{left:50%;right:auto;bottom:18px;width:min(920px,calc(100% - 36px));transform:translateX(-50%);border:1px solid #dfe4e8;border-radius:22px;padding:8px;box-shadow:0 14px 38px rgba(15,23,42,.14)}.club-hq-bottom a{min-height:60px;font-size:10px}.club-section-sidebar{position:fixed;inset:0 auto 0 0;z-index:100250;display:block;width:238px;box-sizing:border-box;padding:22px 14px 110px;background:#101317;color:#fff;overflow-y:auto;box-shadow:12px 0 34px rgba(15,23,42,.12)}.club-section-back{display:flex;align-items:center;gap:7px;margin:0 8px 26px;color:#fff;text-decoration:none;font-size:12px;font-weight:900}.club-section-title{display:grid;gap:4px;margin:0 9px 20px}.club-section-title span{color:#52c0ff;font-size:9px;font-weight:950;letter-spacing:.18em}.club-section-title strong{font:34px/1 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.club-section-sidebar nav{display:grid;gap:5px}.club-section-sidebar nav a{display:grid;grid-template-columns:34px 1fr;align-items:center;gap:8px;padding:10px;border-radius:13px;color:#aeb7bf;text-decoration:none}.club-section-sidebar nav a>svg{justify-self:center}.club-section-sidebar nav a>span{display:grid;gap:2px}.club-section-sidebar nav a strong{font-size:12px}.club-section-sidebar nav a small{color:#74808a;font-size:8px;line-height:1.3}.club-section-sidebar nav a.active{background:#1f2a33;color:#fff}.club-section-sidebar nav a.active svg{color:#52c0ff;stroke-width:2.8}.club-section-sidebar nav a.active small{color:#a7cce1}body:has(.club-section-sidebar) #root>nav,body:has(.club-section-sidebar) #root>footer{margin-left:238px!important}}
@media(max-width:1100px) and (min-width:761px){.club-section-sidebar{width:210px}.club-section-sidebar nav a small{display:none}body:has(.club-section-sidebar) #root>nav,body:has(.club-section-sidebar) #root>footer{margin-left:210px!important}}
@media(max-width:760px){.club-hq-bottom a{font-size:8px}.club-hq-bottom a svg{width:20px;height:20px}.club-section-mobile{position:sticky;top:0;z-index:100220;display:flex;gap:6px;overflow-x:auto;padding:8px 9px;border-bottom:1px solid #dfe4e8;background:rgba(250,251,252,.97);box-shadow:0 7px 18px rgba(15,23,42,.05);backdrop-filter:blur(18px);scrollbar-width:none}.club-section-mobile a{display:flex;flex:0 0 auto;min-height:42px;align-items:center;gap:6px;padding:0 11px;border-radius:11px;color:#7f8992;text-decoration:none;font-size:9px;font-weight:900;white-space:nowrap}.club-section-mobile a.active{background:#e6f5fe;color:#087bbf}}
@media(max-width:430px){.club-hq-bottom a{font-size:7px}.club-hq-bottom a svg{width:19px;height:19px}}
`
