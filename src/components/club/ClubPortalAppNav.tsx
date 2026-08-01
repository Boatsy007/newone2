import { Building2, Home, Newspaper, UserRound } from 'lucide-react'
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
  {label:'News',href:`/club-portal/${clubId}/news`,icon:Newspaper,active:section==='news'},
  {label:'Sponsors',href:`/club-portal/${clubId}/sponsors`,icon:Building2,active:section==='sponsors'},
  {label:'Profile',href:`/club-portal/${clubId}/profile`,icon:UserRound,active:section==='profile'},
 ]
 return createPortal(<><nav className="club-app-bottom" aria-label="Club app navigation"><div>{items.map(item=><Link key={item.label} to={item.href} className={item.active?'active':''} aria-current={item.active?'page':undefined}><item.icon size={22}/><span>{item.label}</span></Link>)}</div></nav><style>{styles}</style></>,document.body)
}

const styles=`
.club-app-bottom{position:fixed;left:0;right:0;bottom:0;z-index:100200;padding:7px 12px calc(7px + env(safe-area-inset-bottom));background:rgba(250,251,252,.96);border-top:1px solid #dfe4e8;box-shadow:0 -8px 28px rgba(15,23,42,.09);backdrop-filter:blur(18px);transition:transform .2s ease,opacity .2s ease}.club-app-bottom>div{width:min(620px,100%);margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr)}.club-app-bottom a{display:flex;min-height:54px;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:13px;color:#92989f;text-decoration:none;font-size:10px;font-weight:850}.club-app-bottom a.active{color:#087bbf;background:#e6f5fe}.club-app-bottom a.active svg{stroke-width:2.8}.pf-menu-open .club-app-bottom{transform:translateY(calc(100% + 24px));opacity:0;pointer-events:none}.club-app-bottom~*{}body:has(.club-app-bottom) .cp-dashboard,body:has(.club-app-bottom) .club-portal-page{padding-bottom:96px!important}@media(min-width:761px){.club-app-bottom{left:50%;right:auto;bottom:18px;width:min(620px,calc(100% - 36px));transform:translateX(-50%);border:1px solid #dfe4e8;border-radius:20px;padding:7px;box-shadow:0 12px 34px rgba(15,23,42,.15)}.pf-menu-open .club-app-bottom{transform:translate(-50%,calc(100% + 40px))}}
`
