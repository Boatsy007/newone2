import { Film, Star } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export default function AdminHighlightsShortcut() {
  const { pathname } = useLocation()
  if (pathname !== '/admin') return null

  return <Link className="pf-admin-highlights-shortcut" to="/admin/highlights">
    <span><Film size={21} /></span>
    <strong>Highlights</strong>
    <small>Review videos and choose homepage features</small>
    <Star size={18} />
    <style>{`
      .pf-admin-highlights-shortcut{position:fixed;right:18px;bottom:18px;z-index:120;display:grid;grid-template-columns:42px minmax(0,1fr) 22px;align-items:center;column-gap:11px;width:min(360px,calc(100vw - 36px));padding:13px 15px;border-radius:15px;background:#35b6ff;color:#050505;text-decoration:none;border:1px solid rgba(5,5,5,.14);box-shadow:0 14px 34px rgba(5,5,5,.22);font-family:Inter,Arial,sans-serif}
      .pf-admin-highlights-shortcut>span{grid-row:1/3;display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#050505;color:#35b6ff}.pf-admin-highlights-shortcut>strong{font-size:16px}.pf-admin-highlights-shortcut>small{font-size:10px;font-weight:750;opacity:.74}.pf-admin-highlights-shortcut>svg{grid-column:3;grid-row:1/3}
      @media(max-width:620px){.pf-admin-highlights-shortcut{right:12px;bottom:12px;width:calc(100vw - 24px)}}
    `}</style>
  </Link>
}
