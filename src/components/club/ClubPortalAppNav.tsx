import { BarChart3, ClipboardList, Home, Image, Settings2, UserRound } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'

const COACHING_SECTIONS=new Set(['coaching','availability','team-selection','whiteboard'])

export default function ClubPortalAppNav(){
 const{pathname}=useLocation()
 const match=pathname.match(/^\/club-portal\/([^/]+)(?:\/([^/?#]+))?(?:\/|$)/)
 const clubId=match?.[1]??''
 const section=match?.[2]??''
 const visible=Boolean(clubId&&!COACHING_SECTIONS.has(section))
 if(!visible)return null
 const items=[
  {label:'Home',href:`/club-portal/${clubId}`,icon:Home,active:!section},
  {label:'Coaching',href:`/club-portal/${clubId}/coaching`,icon:ClipboardList,active:false},
  {label:'Operations',href:`/club-portal/${clubId}/volunteers`,icon:Settings2,active:section==='volunteers'||section==='equipment'},
  {label:'Media',href:`/club-portal/${clubId}/media`,icon:Image,active:section==='media'||section==='news'||section==='milestones'},
  {label:'Analytics',href:`/club-portal/${clubId}/analytics`,icon:BarChart3,active:section==='analytics'},
  {label:'Profile',href:`/club-portal/${clubId}/profile`,icon:UserRound,active:section==='profile'||section==='sponsors'},
 ]
 return createPortal(<><nav className="club-app-bottom" aria-label="Club HQ navigation"><div>{items.map(item=><Link key={item.label} to={item.href} className={item.active?'active':''} aria-current={item.active?'page':undefined}><item.icon size={22}/><span>{item.label}</span></Link>)}</div></nav><style>{styles}</style></>,document.body)
}

const styles=`
.club-app-bottom{position:fixed;left:0;right:0;bottom:0;z-index:100200;padding:7px 7px calc(7px + env(safe-area-inset-bottom));background:rgba(250,251,252,.96);border-top:1px solid #dfe4e8;box-shadow:0 -8px 28px rgba(15,23,42,.09);backdrop-filter:blur(18px);transition:transform .2s ease,opacity .2s ease}.club-app-bottom>div{width:min(1040px,100%);margin:0 auto;display:grid;grid-template-columns:repeat(6,1fr);gap:4px}.club-app-bottom a{display:flex;min-width:0;min-height:56px;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:14px;color:#8b949d;text-decoration:none;font-size:9px;font-weight:900;transition:background .15s ease,color .15s ease,transform .15s ease}.club-app-bottom a:active{transform:scale(.97)}.club-app-bottom a.active{color:#087bbf;background:#e6f5fe}.club-app-bottom a.active svg{stroke-width:2.8}.pf-menu-open .club-app-bottom{transform:translateY(calc(100% + 24px));opacity:0;pointer-events:none}body:has(.club-app-bottom) .cp-dashboard,body:has(.club-app-bottom) .club-portal-page{padding-bottom:96px!important}@media(min-width:761px){.club-app-bottom{left:50%;right:auto;bottom:18px;width:min(920px,calc(100% - 36px));transform:translateX(-50%);border:1px solid #dfe4e8;border-radius:22px;padding:8px;box-shadow:0 14px 38px rgba(15,23,42,.14)}.pf-menu-open .club-app-bottom{transform:translate(-50%,calc(100% + 40px))}.club-app-bottom a{min-height:60px;font-size:10px}}@media(max-width:720px){.club-app-bottom>div{min-width:0}.club-app-bottom a{font-size:8px}.club-app-bottom a svg{width:20px;height:20px}}@media(max-width:430px){.club-app-bottom a span{font-size:7px}.club-app-bottom a{gap:3px;padding:0 2px}}
`
