import { useEffect, useState } from 'react'
import { Bell, Menu, Search, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import GlobalSearch, { useSearchController } from '../rankings/GlobalSearch'
import UnifiedSearchExtras from '../rankings/UnifiedSearchExtras'
import FollowButton from '../supporter/FollowButton'
import ShareButton from '../sharing/ShareButton'
import DesktopLayoutPolish from './DesktopLayoutPolish'
import { loadFeed, readIds, type FollowEntity } from '../../lib/supporter'

const links = [
  { label: 'For You', href: '/feed' },
  { label: 'News', href: '/news' },
  { label: 'Goals', href: '/goal-kickers' },
  { label: 'Rankings', href: '/rankings' },
  { label: 'Highlights', href: '/highlights' },
  { label: 'Matches', href: '/matches' },
  { label: 'Leagues', href: '/leagues' },
  { label: 'Clubs', href: '/directory' },
]
const HEADER_LOGO_PATH = '/Playfooty-logo-modern.png'
const HEADER_LOGO_FALLBACK = 'https://raw.githubusercontent.com/Boatsy007/newone2/newone1/public/Playfooty-logo-modern.png'
type FollowTarget = { entityType: FollowEntity; entityId: string }

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const location = useLocation()
  const search = useSearchController()
  const clubMatch = location.pathname.match(/^\/team\/([^/]+)/)
  const leagueMatch = location.pathname.match(/^\/league\/([^/]+)/)
  const playerMatch = location.pathname.match(/^\/player\/([^/]+)/)
  const followTarget: FollowTarget | null = clubMatch ? { entityType: 'CLUB', entityId: clubMatch[1] } : leagueMatch ? { entityType: 'LEAGUE', entityId: leagueMatch[1] } : playerMatch ? { entityType: 'PLAYER', entityId: playerMatch[1] } : null

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open])
  useEffect(() => {
    let active = true
    const refreshUnread = () => { loadFeed().then(items => { if (!active) return; const read = readIds(); setUnread(items.filter(item => !read.has(item.id)).length) }).catch(() => { if (active) setUnread(0) }) }
    refreshUnread(); window.addEventListener('playfooty:follows-changed', refreshUnread); window.addEventListener('playfooty:notifications-read', refreshUnread)
    return () => { active = false; window.removeEventListener('playfooty:follows-changed', refreshUnread); window.removeEventListener('playfooty:notifications-read', refreshUnread) }
  }, [])
  const openSearch = () => { setOpen(false); search.open() }

  return <>
    <DesktopLayoutPolish />
    <header className="pf-nav"><div className="pf-nav-inner">
      <Link to="/" className="pf-brand" aria-label="PlayFooty home"><img src={HEADER_LOGO_PATH} alt="PlayFooty" onError={event => { const image = event.currentTarget; if (image.src !== HEADER_LOGO_FALLBACK) image.src = HEADER_LOGO_FALLBACK }}/></Link>
      <nav className="pf-desktop-links" aria-label="Main navigation">{links.map(link => <Link key={link.href} to={link.href} className={location.pathname.startsWith(link.href) ? 'active' : ''}>{link.label}</Link>)}</nav>
      <div className="pf-nav-actions">
        <button type="button" className="pf-search" aria-label="Search clubs, leagues, players and news" onClick={openSearch}><Search size={22}/></button>
        <ShareButton/>
        <Link to="/notifications" className={`pf-notifications ${location.pathname === '/notifications' ? 'active' : ''}`} aria-label={`${unread} unread notifications`}><Bell size={22}/>{unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}</Link>
        <div className="pf-login-actions"><Link to="/club-portal">Club Login</Link><Link to="/league-portal">League Login</Link></div>
        <button className="pf-menu-button" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? <X size={28}/> : <Menu size={28}/>}</button>
      </div>
    </div></header>
    {open && <div className="pf-mobile-menu"><nav aria-label="Mobile navigation"><Link to="/feed"><span>For You</span><small>Your feed</small></Link>{links.filter(link => link.href !== '/feed').map((link,index)=><Link key={link.href} to={link.href}><span>{link.label}</span><small>{String(index+1).padStart(2,'0')}</small></Link>)}</nav><div className="pf-mobile-menu-actions"><div className="pf-mobile-utilities"><button type="button" className="pf-mobile-search" onClick={openSearch}><Search size={20}/> Search</button><div className="pf-mobile-share"><ShareButton/></div></div><div className="pf-mobile-login"><Link to="/club-portal">Club Login</Link><Link to="/league-portal">League Login</Link></div></div></div>}
    {followTarget && <div className="pf-profile-follow"><FollowButton entityType={followTarget.entityType} entityId={followTarget.entityId}/></div>}
    <GlobalSearch controller={search}/><UnifiedSearchExtras/>
    <style>{`
      .pf-nav{position:sticky;top:0;z-index:80;background:#050505;color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}.pf-nav-inner{height:76px;max-width:1600px;margin:0 auto;padding:0 30px;display:flex;align-items:center;gap:24px}.pf-brand{display:flex;align-items:center;flex:0 0 auto}.pf-brand img{display:block;width:174px;height:auto}.pf-desktop-links{display:flex;align-items:center;gap:clamp(10px,1vw,20px);margin-left:auto;min-width:0}.pf-desktop-links a{position:relative;color:#fff;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-size:clamp(11px,.82vw,13px);font-weight:900;letter-spacing:.045em;padding:28px 0 25px;white-space:nowrap}.pf-desktop-links a:after{content:'';position:absolute;left:0;right:0;bottom:17px;height:3px;background:#2daaf5;transform:scaleX(0);transform-origin:left;transition:transform .2s}.pf-desktop-links a:hover:after,.pf-desktop-links a.active:after{transform:scaleX(1)}
      .pf-nav-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}.pf-search,.pf-notifications,.pf-share-action{position:relative;display:flex;align-items:center;justify-content:center;gap:7px;color:#fff;height:42px;border:0;background:transparent;cursor:pointer;border-radius:999px;text-decoration:none;font:inherit}.pf-search,.pf-notifications{width:42px}.pf-share-action{padding:0 10px;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:900;text-transform:uppercase}.pf-search:hover,.pf-notifications:hover,.pf-notifications.active,.pf-share-action:hover{background:rgba(255,255,255,.1)}.pf-notifications span{position:absolute;right:-1px;top:1px;min-width:17px;height:17px;padding:0 4px;display:grid;place-items:center;border-radius:999px;background:#2daaf5;color:#050505;font-size:9px;font-weight:950;border:2px solid #050505}.pf-login-actions{display:flex;gap:7px}.pf-login-actions a{color:#fff;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-size:11px;font-weight:900;padding:10px 12px;border:1px solid rgba(255,255,255,.24);border-radius:999px;white-space:nowrap}.pf-login-actions a:last-child{background:#2daaf5;color:#050505;border-color:#2daaf5}.pf-menu-button{display:none;border:0;background:transparent;color:#fff;padding:8px}
      .pf-mobile-menu{position:fixed;z-index:70;inset:76px 0 0;background:#050505;color:#fff;padding:12px 24px 24px;overflow:auto;display:flex;flex-direction:column}.pf-mobile-menu nav{display:grid}.pf-mobile-menu nav a{display:flex;align-items:center;justify-content:space-between;min-height:58px;color:#fff;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.14);padding:8px 0}.pf-mobile-menu nav span{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2rem,9vw,3.2rem);line-height:.88;text-transform:uppercase}.pf-mobile-menu nav small{color:#2daaf5;font-size:11px;font-weight:950}.pf-mobile-menu-actions{margin-top:auto;padding-top:18px}.pf-mobile-utilities{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pf-mobile-search,.pf-mobile-share .pf-share-action{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;box-sizing:border-box;padding:13px 12px;border-radius:999px}.pf-mobile-search{border:1px solid rgba(255,255,255,.24);background:#fff;color:#050505}.pf-mobile-share .pf-share-action{height:100%;border:1px solid rgba(255,255,255,.24);color:#fff}.pf-mobile-login{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.pf-mobile-login a{text-align:center;text-decoration:none;text-transform:uppercase;font-weight:900;padding:13px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.24);color:#fff}.pf-mobile-login a:last-child{background:#2daaf5;color:#050505;border-color:#2daaf5}.pf-profile-follow{position:fixed;right:18px;bottom:18px;z-index:64}
      @media(max-width:1180px){.pf-desktop-links,.pf-login-actions{display:none}.pf-nav-inner{height:72px;padding:0 18px}.pf-brand img{width:166px}.pf-nav-actions{margin-left:auto}.pf-nav-actions>.pf-share-action{width:42px;padding:0}.pf-nav-actions>.pf-share-action span{display:none}.pf-menu-button{display:block}.pf-mobile-menu{inset:72px 0 0}}
      @media(min-width:1181px) and (max-width:1380px){.pf-nav-inner{padding:0 20px;gap:16px}.pf-brand img{width:154px}.pf-desktop-links{gap:10px}.pf-login-actions a{padding:9px 10px;font-size:10px}.pf-share-action span{display:none}.pf-share-action{width:42px;padding:0}}
      @media(max-width:480px){.pf-brand img{width:140px}.pf-search,.pf-notifications,.pf-nav-actions>.pf-share-action{width:34px;height:36px}.pf-nav-inner{gap:5px;padding:0 10px}.pf-nav-actions{gap:4px}.pf-menu-button{padding:6px}.pf-mobile-menu{padding-left:20px;padding-right:20px}}
    `}</style>
  </>
}
