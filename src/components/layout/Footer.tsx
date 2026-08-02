import { memo } from 'react'
import { Link, useLocation } from 'react-router-dom'

const FOOTER_LOGO_PATH = '/Playfooty-logo-modern.png'
const FOOTER_LOGO_FALLBACK = 'https://raw.githubusercontent.com/Boatsy007/newone2/newone1/public/Playfooty-logo-modern.png'

export default memo(function Footer() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/club-portal')) return null

  return <footer className="pf-footer">
    <div className="pf-footer-cta">
      <div className="pf-footer-cta-inner">
        <div><strong>Every game. Every player. Every club.</strong><span>Australia's home of community football.</span></div>
        <Link to="/directory">Explore PlayFooty <span aria-hidden>→</span></Link>
      </div>
    </div>
    <div className="pf-footer-inner">
      <Link to="/" className="pf-footer-logo" aria-label="PlayFooty home">
        <img
          src={FOOTER_LOGO_PATH}
          alt="PlayFooty"
          onError={event => {
            const image = event.currentTarget
            if (image.src !== FOOTER_LOGO_FALLBACK) image.src = FOOTER_LOGO_FALLBACK
          }}
        />
      </Link>
      <nav aria-label="Footer navigation">
        <Link to="/about">About</Link>
        <Link to="/directory">Clubs</Link>
        <Link to="/leagues">Leagues</Link>
        <Link to="/news">News</Link>
        <Link to="/support">Support</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/disclaimer">Disclaimer</Link>
        <Link to="/community-guidelines">Guidelines</Link>
      </nav>
      <div className="pf-socials" aria-label="Social links"><span>IG</span><span>F</span><span>TT</span><span>YT</span></div>
    </div>
    <div className="pf-footer-bottom">© {new Date().getFullYear()} PlayFooty · Australia's home of community football.</div>
    <style>{`
      .pf-footer{background:#050505;color:#fff;border-top:1px solid rgba(255,255,255,.12)}
      .pf-footer-cta{background:#2daaf5;color:#050505;border-top:3px solid #050505;border-bottom:3px solid #050505}.pf-footer-cta-inner{width:min(1440px,calc(100% - 48px));min-height:92px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:24px}.pf-footer-cta strong{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(2rem,4vw,3.4rem);line-height:.9;text-transform:uppercase}.pf-footer-cta span{display:block;font-weight:700;margin-top:4px}.pf-footer-cta a{display:inline-flex;align-items:center;gap:16px;background:#050505;color:#fff;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-weight:900;padding:15px 22px;border-radius:6px;white-space:nowrap}.pf-footer-cta a span{margin:0;font-size:18px}
      .pf-footer-inner{width:min(1440px,calc(100% - 48px));min-height:112px;margin:0 auto;display:grid;grid-template-columns:220px 1fr auto;align-items:center;gap:35px}.pf-footer-logo{display:flex;align-items:center}.pf-footer-logo img{display:block;width:184px;height:auto}.pf-footer nav{display:flex;justify-content:center;flex-wrap:wrap;gap:18px 25px}.pf-footer nav a{color:#fff;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:900;letter-spacing:.07em}.pf-footer nav a:hover,.pf-footer nav a:focus-visible{color:#2daaf5}.pf-socials{display:flex;gap:11px}.pf-socials span{width:30px;height:30px;border:1px solid rgba(255,255,255,.25);border-radius:50%;display:grid;place-items:center;font-size:9px;font-weight:900}.pf-footer-bottom{text-align:center;border-top:1px solid rgba(255,255,255,.12);padding:13px 20px;color:rgba(255,255,255,.55);font-size:11px;font-weight:700}
      @media(max-width:760px){.pf-footer-cta-inner{width:min(100% - 28px,1440px);min-height:0;padding:27px 0;display:grid}.pf-footer-cta a{justify-content:center;width:100%}.pf-footer-inner{width:min(100% - 28px,1440px);grid-template-columns:1fr;padding:32px 0;text-align:center;gap:24px}.pf-footer-logo{justify-content:center}.pf-footer-logo img{width:210px}.pf-footer nav{gap:15px 18px}.pf-socials{justify-content:center}}
    `}</style>
  </footer>
})