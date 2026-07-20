import { useEffect, useState } from 'react'
import { Bell, Menu, Search, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import GlobalSearch, { useSearchController } from '../rankings/GlobalSearch'
import UnifiedSearchExtras from '../rankings/UnifiedSearchExtras'
import FollowButton from '../supporter/FollowButton'
import ShareButton from '../sharing/ShareButton'
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
  const claimPath = clubMatch ? `/claim-club/${clubMatch[1]}` : null
  const followTarget: FollowTarget | null = clubMatch
    ? { entityType: 'CLUB', entityId: clubMatch[1] }
    : leagueMatch
      ? { entityType: 'LEAGUE', entityId: leagueMatch[1] }
      : playerMatch
        ? { entityType: 'PLAYER', entityId: playerMatch[1] }
        : null

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    let active = true
    const refreshUnread = () => {
      loadFeed().then(items => {
        if (!active) return
        const read = readIds()
        setUnread(items.filter(item => !read.has(item.id)).length)
      }).catch(() => { if (active) setUnread(0) })
    }
    refreshUnread()
    window.addEventListener('playfooty:follows-changed', refreshUnread)
    window.addEventListener('playfooty:notifications-read', refreshUnread)
    return () => {
      active = false
      window.removeEventListener('playfooty:follows-changed', refreshUnread)
      window.removeEventListener('playfooty:notifications-read', refreshUnread)
    }
  }, [])

  const openSearch = () => { setOpen(false); search.open() }

  return <>
    <header className="pf-nav">
      <div className="pf-nav-inner">
        <Link to="/" className="pf-brand" aria-label="PlayFooty home">
          <img
            src={HEADER_LOGO_PATH}
            alt="PlayFooty"
            onError={event => {
              const image = event.currentTarget
              if (image.src !== HEADER_LOGO_FALLBACK) image.src = HEADER_LOGO_FALLBACK
            }}
          />
        </Link>
        <nav className="pf-desktop-links" aria-label="Main navigation">
          {links.map(link => <Link key={link.href} to={link.href} className={location.pathname.startsWith(link.href) ? 'active' : ''}>{link.label}</Link>)}
        </nav>
        <div className="pf-nav-actions">
          <button type="button" className="pf-search" aria-label="Search clubs, leagues, players and news" onClick={openSearch}><Search size={22} /></button>
          <ShareButton />
          <Link to="/notifications" className={`pf-notifications ${location.pathname === '/notifications' ? 'active' : ''}`} aria-label={`${unread} unread notifications`}><Bell size={22}/>{unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}</Link>
          <Link to="/admin" className="pf-primary-action">Club login</Link>
          <button className="pf-menu-button" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? <X size={28} /> : <Menu size={28} />}</button>
        </div>
      </div>
    </header>

    {open && <div className="pf-mobile-menu">
      <nav aria-label="Mobile navigation">
        <Link to="/feed"><span>For You</span><small>Your feed</small></Link>
        {links.filter(link => link.href !== '/feed').map((link, index) => <Link key={link.href} to={link.href}><span>{link.label}</span><small>{String(index + 1).padStart(2, '0')}</small></Link>)}
      </nav>
      <div className="pf-mobile-menu-actions">
        <div className="pf-mobile-utilities">
          <button type="button" className="pf-mobile-search" onClick={openSearch}><Search size={20} /> Search</button>
          <div className="pf-mobile-share"><ShareButton /></div>
        </div>
        <Link to="/admin" className="pf-mobile-cta">Club login</Link>
      </div>
    </div>}

    {followTarget && <div className={`pf-profile-follow ${claimPath ? 'with-claim' : ''}`}><FollowButton entityType={followTarget.entityType} entityId={followTarget.entityId}/></div>}
    {claimPath && <Link to={claimPath} className="pf-claim-club-fab">Manage this club</Link>}
    <GlobalSearch controller={search} />
    <UnifiedSearchExtras />

    <style>{`
      .pf-nav{position:sticky;top:0;z-index:80;background:#050505;color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}
      .pf-nav-inner{height:76px;max-width:1500px;margin:0 auto;padding:0 30px;display:flex;align-items:center;gap:30px}
      .pf-brand{display:flex;align-items:center;flex:0 0 auto}.pf-brand img{display:block;width:174px;height:auto}
      .pf-desktop-links{display:flex;align-items:center;gap:20px;margin-left:auto}.pf-desktop-links a{position:relative;color:#fff;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:900;letter-spacing:.05em;padding:28px 0 25px}.pf-desktop-links a:after{content:'';position:absolute;left:0;right:0;bottom:17px;height:3px;background:#2daaf5;transform:scaleX(0);transform-origin:left;transition:transform .2s}.pf-desktop-links a:hover:after,.pf-desktop-links a.active:after{transform:scaleX(1)}
      .pf-nav-actions{display:flex;align-items:center;gap:10px}.pf-search,.pf-notifications,.pf-share-action{position:relative;display:flex;align-items:center;justify-content:center;gap:7px;color:#fff;height:42px;border:0;background:transparent;cursor:pointer;border-radius:999px;text-decoration:none;font:inherit}.pf-search,.pf-notifications{width:42px}.pf-share-action{padding:0 12px;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:900;text-transform:uppercase}.pf-search:hover,.pf-search:focus-visible,.pf-notifications:hover,.pf-notifications:focus-visible,.pf-notifications.active,.pf-share-action:hover,.pf-share-action:focus-visible{background:rgba(255,255,255,.1);outline:none}.pf-notifications span{position:absolute;right:-1px;top:1px;min-width:17px;height:17px;padding:0 4px;box-sizing:border-box;display:grid;place-items:center;border-radius:999px;background:#2daaf5;color:#050505;font-size:9px;font-weight:950;border:2px solid #050505}.pf-primary-action{background:#2daaf5;color:#050505;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:900;letter-spacing:.055em;padding:14px 22px;border-radius:999px}.pf-menu-button{display:none;border:0;background:transparent;color:#fff;padding:8px}
      .pf-mobile-menu{position:fixed;z-index:70;inset:76px 0 0;background:#050505;color:#fff;padding:12px 24px 24px;overflow:auto;display:flex;flex-direction:column}.pf-mobile-menu nav{display:grid}.pf-mobile-menu nav a{display:flex;align-items:center;justify-content:space-between;min-height:58px;color:#fff;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.14);padding:8px 0}.pf-mobile-menu nav span{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2rem,9vw,3.2rem);line-height:.88;text-transform:uppercase}.pf-mobile-menu nav small{color:#2daaf5;font-size:11px;font-weight:950;letter-spacing:.04em;text-transform:uppercase}.pf-mobile-menu-actions{margin-top:auto;padding-top:18px;background:#050505}.pf-mobile-utilities{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pf-mobile-search,.pf-mobile-cta,.pf-mobile-share .pf-share-action{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;box-sizing:border-box;text-align:center;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-weight:900;padding:13px 12px;border-radius:999px}.pf-mobile-search{border:1px solid rgba(255,255,255,.24);background:#fff;color:#050505}.pf-mobile-share .pf-share-action{height:100%;border:1px solid rgba(255,255,255,.24);color:#fff;background:transparent}.pf-mobile-cta{margin-top:10px;background:#2daaf5;color:#050505}
      .pf-profile-follow{position:fixed;right:18px;bottom:18px;z-index:64}.pf-profile-follow.with-claim{bottom:72px}.pf-claim-club-fab{position:fixed;right:18px;bottom:18px;z-index:65;background:#42b8ff;color:#050505;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:950;letter-spacing:.05em;padding:13px 18px;border-radius:999px;border:1px solid rgba(5,5,5,.14);box-shadow:0 10px 28px rgba(0,0,0,.2)}
      @media(max-width:1280px){.pf-desktop-links,.pf-primary-action{display:none}.pf-nav-inner{height:72px;padding:0 18px}.pf-brand img{width:166px}.pf-nav-actions{margin-left:auto}.pf-nav-actions>.pf-share-action{width:42px;padding:0}.pf-nav-actions>.pf-share-action span{display:none}.pf-menu-button{display:block}.pf-mobile-menu{inset:72px 0 0}}
      @media(max-width:480px){.pf-brand img{width:140px}.pf-search,.pf-notifications,.pf-nav-actions>.pf-share-action{width:34px;height:36px}.pf-nav-inner{gap:5px;padding:0 10px}.pf-nav-actions{gap:4px}.pf-menu-button{padding:6px}.pf-profile-follow{right:12px;bottom:12px}.pf-profile-follow.with-claim{bottom:66px}.pf-claim-club-fab{right:12px;bottom:12px;padding:12px 15px}.pf-mobile-menu{padding-left:20px;padding-right:20px}.pf-mobile-menu nav a{min-height:54px}.pf-mobile-menu nav span{font-size:clamp(1.9rem,8.6vw,2.8rem)}}
    `}</style>
  </>
}