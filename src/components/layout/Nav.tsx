import { useEffect, useState } from 'react'
import { Menu, Search, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const links = [
  { label: 'News', href: '/news' },
  { label: 'Rankings', href: '/rankings' },
  { label: 'Leagues', href: '/leagues' },
  { label: 'Clubs', href: '/directory' },
  { label: 'Goal Kickers', href: '/goal-kickers' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

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
          <Link to="/directory" className="pf-search" aria-label="Search clubs and leagues"><Search size={22} /></Link>
          <Link to="/rankings" className="pf-primary-action">View rankings</Link>
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
      <Link to="/rankings" className="pf-mobile-cta">Open national rankings</Link>
    </div>}

    <style>{`
      .pf-nav{position:sticky;top:0;z-index:80;background:#050505;color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}
      .pf-nav-inner{height:82px;max-width:1500px;margin:0 auto;padding:0 28px;display:flex;align-items:center;gap:30px}
      .pf-brand{display:flex;align-items:center;flex:0 0 auto}.pf-brand img{display:block;width:205px;height:auto}
      .pf-desktop-links{display:flex;align-items:center;gap:28px;margin-left:auto}.pf-desktop-links a{position:relative;color:#fff;text-decoration:none;text-transform:uppercase;font-size:13px;font-weight:950;letter-spacing:.05em;padding:31px 0 27px}.pf-desktop-links a:after{content:'';position:absolute;left:0;right:0;bottom:20px;height:3px;background:#42b8ff;transform:scaleX(0);transform-origin:left;transition:transform .2s}.pf-desktop-links a:hover:after,.pf-desktop-links a.active:after{transform:scaleX(1)}
      .pf-nav-actions{display:flex;align-items:center;gap:14px}.pf-search{display:grid;place-items:center;color:#fff;width:44px;height:44px}.pf-primary-action{background:#42b8ff;color:#050505;text-decoration:none;text-transform:uppercase;font-size:12px;font-weight:1000;letter-spacing:.06em;padding:15px 22px;border-radius:999px}.pf-menu-button{display:none;border:0;background:transparent;color:#fff;padding:8px}
      .pf-mobile-menu{position:fixed;z-index:70;inset:82px 0 0;background:#050505;color:#fff;padding:24px 24px 40px;overflow:auto}.pf-mobile-menu nav{display:grid}.pf-mobile-menu nav a{display:flex;align-items:center;justify-content:space-between;color:#fff;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.16);padding:19px 0}.pf-mobile-menu nav span{font-family:Impact,'Arial Narrow Bold',sans-serif;font-size:clamp(2.2rem,11vw,4rem);line-height:.9;text-transform:uppercase}.pf-mobile-menu nav small{color:#42b8ff;font-weight:950}.pf-mobile-cta{display:block;margin-top:28px;background:#42b8ff;color:#050505;text-align:center;text-decoration:none;text-transform:uppercase;font-weight:1000;padding:17px;border-radius:999px}
      @media(max-width:1050px){.pf-desktop-links,.pf-primary-action{display:none}.pf-nav-inner{height:76px;padding:0 18px}.pf-brand img{width:178px}.pf-nav-actions{margin-left:auto}.pf-menu-button{display:block}.pf-mobile-menu{inset:76px 0 0}}
      @media(max-width:480px){.pf-brand img{width:158px}.pf-search{width:36px;height:36px}.pf-nav-inner{gap:8px}}
    `}</style>
  </>
}
