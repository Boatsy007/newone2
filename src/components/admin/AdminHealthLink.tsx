import { Activity, CalendarClock, Layers3 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

export default function AdminHealthLink() {
  const { pathname } = useLocation()
  if (pathname !== '/admin') return null
  return <>
    <div className="admin-ops-links">
      <Link to="/admin/maintenance-queue"><CalendarClock size={18}/><span>OCR Planner</span></Link>
      <Link to="/admin/league-coverage"><Layers3 size={18}/><span>League Rollout</span></Link>
      <Link to="/admin/health"><Activity size={18}/><span>System Health</span></Link>
    </div>
    <style>{`
      .admin-ops-links{position:fixed;right:18px;bottom:18px;z-index:95;display:flex;gap:9px;align-items:center}
      .admin-ops-links a{display:flex;align-items:center;gap:9px;padding:13px 18px;border:1px solid rgba(5,5,5,.15);border-radius:999px;background:#35b6ff;color:#050505;text-decoration:none;text-transform:uppercase;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:950;letter-spacing:.04em;box-shadow:0 12px 34px rgba(0,0,0,.2)}
      .admin-ops-links a:nth-child(2){background:#050505;color:#fff}
      .admin-ops-links a:hover,.admin-ops-links a:focus-visible{background:#fff;color:#050505;outline:3px solid rgba(53,182,255,.32)}
      @media(max-width:900px){.admin-ops-links{right:12px;bottom:12px;display:grid}.admin-ops-links a{padding:10px 13px}.admin-ops-links span{font-size:10px}}
    `}</style>
  </>
}
