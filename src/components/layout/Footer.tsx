import { memo } from 'react'
import { Link } from 'react-router-dom'

export default memo(function Footer() {
  return <footer className="pf-footer">
    <div className="pf-footer-inner">
      <Link to="/" className="pf-footer-logo"><img src="/playfooty-logo-modern.svg" alt="PlayFooty" /></Link>
      <nav aria-label="Footer navigation">
        <Link to="/about">About</Link>
        <Link to="/directory">Clubs</Link>
        <Link to="/leagues">Leagues</Link>
        <Link to="/news">News</Link>
        <span>Privacy</span>
        <span>Terms</span>
      </nav>
      <div className="pf-footer-mark" aria-hidden="true">PF</div>
    </div>
    <div className="pf-footer-bottom">© {new Date().getFullYear()} PlayFooty · Australia's home of community football.</div>
    <style>{`
      .pf-footer{background:#050505;color:#fff;border-top:1px solid rgba(255,255,255,.12)}.pf-footer-inner{width:min(1440px,calc(100% - 48px));min-height:118px;margin:0 auto;display:grid;grid-template-columns:220px 1fr auto;align-items:center;gap:35px}.pf-footer-logo img{display:block;width:190px}.pf-footer nav{display:flex;justify-content:center;flex-wrap:wrap;gap:26px}.pf-footer nav a,.pf-footer nav span{color:#fff;text-decoration:none;text-transform:uppercase;font-size:11px;font-weight:950;letter-spacing:.07em}.pf-footer nav a:hover{color:#42b8ff}.pf-footer-mark{width:42px;height:42px;display:grid;place-items:center;background:#42b8ff;color:#050505;font-family:Impact,'Arial Narrow Bold',sans-serif;font-size:20px;transform:skewX(-8deg)}.pf-footer-bottom{text-align:center;border-top:1px solid rgba(255,255,255,.12);padding:14px 20px;color:rgba(255,255,255,.55);font-size:11px;font-weight:700}
      @media(max-width:760px){.pf-footer-inner{width:min(100% - 28px,1440px);grid-template-columns:1fr;padding:32px 0;text-align:center;gap:24px}.pf-footer-logo{display:flex;justify-content:center}.pf-footer nav{gap:18px}.pf-footer-mark{margin:0 auto}}
    `}</style>
  </footer>
})