import { Activity } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export default function AdminHealthLink() {
  const { pathname } = useLocation()
  if (pathname !== '/admin') return null
  return <>
    <Link className="admin-health-link" to="/admin/health"><Activity size={18}/><span>System Health</span></Link>
    <style>{`
      .admin-health-link{position:fixed;right:18px;bottom:18px;z-index:95;display:flex;align-items:center;gap:9px;padding:13px 18px;border:1px solid rgba(5,5,5,.15);border-radius:999px;background:#35b6ff;color:#050505;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:950;letter-spacing:.04em;box-shadow:0 12px 34px rgba(0,0,0,.2)}
      .admin-health-link:hover,.admin-health-link:focus-visible{background:#fff;outline:3px solid rgba(53,182,255,.32)}
      @media(max-width:620px){.admin-health-link{right:12px;bottom:12px;padding:12px 15px}.admin-health-link span{font-size:12px}}
    `}</style>
  </>
}
