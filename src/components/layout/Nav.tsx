import { useEffect, useState } from 'react'
import { Menu, Search, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import GlobalSearch, { useSearchController } from '../rankings/GlobalSearch'

const links = [
  { label: 'News', href: '/news' },
  { label: 'Rankings', href: '/rankings' },
  { label: 'Ladders', href: '/leagues' },
  { label: 'Clubs', href: '/directory' },
  { label: 'Highlights', href: '/highlights' },
  { label: 'Stats', href: '/goal-kickers' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const search = useSearchController()

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const openSearch = () => {
    setOpen(false)
    search.open()
  }

  return <>
    <header className="pf-nav">
      <div className="pf-nav-inner">
        <Link to="/" className="pf-brand" aria-label="PlayFooty home">
          <img src="/playfooty-logo-modern.svg" alt="PlayFooty" />
        </Link>

        <nav className="pf-desktop-links" aria-label="Main navigation">
          {links.map(link => <Link key={link.href} to={link.href} className={location.pathname.startsWith(link.href) ? 'active' : ''}>{link.label}</Link>)}
        </nav>

        <div className="pf-nav-actions">
          <button type="button" className="pf-search" aria-label="Search clubs, leagues, players and news" onClick={openSearch}><Search size={22} /></button>
          <Link to="/admin" className="pf-primary-action">Club login</Link>
          <button className="pf-menu-button" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(value => !value)}>
            {open ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>
    </header>

    {open && <div className="pf-mobile-menu">
      <nav aria-label="Mobile navigation">
        {links.map((link, index) => <Link key={link.href} to={link.href}><span>{link.label}</span><small>{String(index + 1).padStart(2, '0')}</small></Link>)}
      </nav>
      <button type="button" className="pf-mobile-search" onClick={openSearch}><Search size={20} /> Search PlayFooty</button>
      <Link to="/admin" className="pf-mobile-cta">Club login</Link>
    </div>}

    <GlobalSearch controller={search} />

    <style>{`
      .pf-nav{position:sticky;top:0;z-index:80;background:#050505;color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}
      .pf-nav-inner{height:76px;max-width:1500px;margin:0 auto;padding:0 30px;display:flex;align-items:center;gap:30px}
      .pf-brand{display:flex;align-items:center;flex:0 0 auto}.pf-brand img{display:block;width:174px;height:auto}
      .pf-desktop-links{display:flex;align-items:center;gap:27px;margin-left:auto}.pf-desktop-links a{position:relative;color:#fff;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-size:14px;font-weight:900;letter-spacing:.055em;padding:28px 0 25px}.pf-desktop-links a:after{content:'';position:absolute;left:0;right:0;bottom:17px;height:3px;background:#2daaf5;transform:scaleX(0);transform-origin:left;transition:transform .2s}.pf-desktop-links a:hover:after,.pf-desktop-links a.active:after{transform:scaleX(1)}
      .pf-nav-actions{display:flex;align-items:center;gap:13px}.pf-search{display:grid;place-items:center;color:#fff;width:42px;height:42px;border:0;background:transparent;cursor:pointer;border-radius:50%}.pf-search:hover,.pf-search:focus-visible{background:rgba(255,255,255,.1);outline:none}.pf-primary-action{background:#2daaf5;color:#050505;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:900;letter-spacing:.055em;padding:14px 22px;border-radius:999px}.pf-menu-button{display:none;border:0;background:transparent;color:#fff;padding:8px}
      .pf-mobile-menu{position:fixed;z-index:70;inset:76px 0 0;background:#050505;color:#fff;padding:24px 24px 40px;overflow:auto}.pf-mobile-menu nav{display:grid}.pf-mobile-menu nav a{display:flex;align-items:center;justify-content:space-between;color:#fff;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.16);padding:18px 0}.pf-mobile-menu nav span{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2.4rem,12vw,4.3rem);line-height:.9;text-transform:uppercase}.pf-mobile-menu nav small{color:#2daaf5;font-weight:950}.pf-mobile-search,.pf-mobile-cta{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;box-sizing:border-box;margin-top:22px;text-align:center;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-weight:900;padding:17px;border-radius:999px}.pf-mobile-search{border:1px solid rgba(255,255,255,.24);background:#fff;color:#050505}.pf-mobile-cta{margin-top:12px;background:#2daaf5;color:#050505}
      @media(max-width:1150px){.pf-desktop-links,.pf-primary-action{display:none}.pf-nav-inner{height:72px;padding:0 18px}.pf-brand img{width:166px}.pf-nav-actions{margin-left:auto}.pf-menu-button{display:block}.pf-mobile-menu{inset:72px 0 0}}
      @media(max-width:480px){.pf-brand img{width:148px}.pf-search{width:36px;height:36px}.pf-nav-inner{gap:8px;padding:0 12px}}
    `}</style>
  </>
}
