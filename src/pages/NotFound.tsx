import { useEffect } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import Nav from '../components/layout/Nav'
import Footer from '../components/layout/Footer'

export default function NotFound() {
  const location = useLocation()
  useEffect(() => {
    document.title = 'Page not found | PlayFooty'
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.head.appendChild(document.createElement('meta'))
    robots.name = 'robots'; const previous = robots.content; robots.content = 'noindex,follow'
    return () => { robots.content = previous }
  }, [])

  return <><Nav/><main className="not-found"><style>{styles}</style><section><span>404</span><h1>That page is out of bounds</h1><p>We could not find <code>{location.pathname}</code>. The page may have moved, been archived or never existed.</p><div><Link to="/"><ArrowLeft size={18}/>Back home</Link><Link to="/directory"><Search size={18}/>Find a club</Link></div></section></main><Footer/></>
}

const styles = `.not-found{min-height:68vh;display:grid;place-items:center;padding:50px 18px;background:#eef2f6;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.not-found section{width:min(760px,100%);padding:clamp(34px,7vw,70px);border-radius:24px;background:#050505;color:#fff;text-align:center}.not-found section>span{display:block;color:#35b6ff;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(6rem,20vw,13rem);line-height:.7}.not-found h1{margin:26px 0 13px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(3rem,8vw,5.6rem);line-height:.86;text-transform:uppercase}.not-found p{max-width:590px;margin:0 auto;color:#c9d1db;font-size:17px;line-height:1.55}.not-found code{color:#fff;word-break:break-all}.not-found div{display:flex;justify-content:center;gap:11px;flex-wrap:wrap;margin-top:27px}.not-found a{display:inline-flex;align-items:center;gap:8px;padding:13px 18px;border-radius:999px;background:#35b6ff;color:#050505;text-decoration:none;font-weight:950;text-transform:uppercase}.not-found a:first-child{background:#fff}`
