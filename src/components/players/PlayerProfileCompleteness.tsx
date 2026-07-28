import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'

type PlayerProfile = {
  playerId: string
  playerName: string
  clubName: string
  clubLogoUrl: string | null
}

type PlayerDetails = { photoUrl: string | null }

type Article = {
  id: string
  slug: string
  title: string
  summary?: string | null
  category?: string | null
  date?: string | null
  heroSeed?: string | null
}

function useTarget(selector: string | null) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setTarget(null)
    if (!selector) return
    const resolve = () => {
      const found = document.querySelector<HTMLElement>(selector)
      if (!found) return false
      setTarget(found)
      return true
    }
    if (resolve()) return
    const observer = new MutationObserver(() => { if (resolve()) observer.disconnect() })
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [selector])
  return target
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'PF'
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export default function PlayerProfileCompleteness() {
  const { pathname } = useLocation()
  const match = pathname.match(/^\/player\/([^/]+)$/)
  const playerId = match ? decodeURIComponent(match[1]) : null
  const identityTarget = useTarget(playerId ? '.player-identity' : null)
  const newsTarget = useTarget(playerId ? '.player-main' : null)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [details, setDetails] = useState<PlayerDetails | null>(null)
  const [articles, setArticles] = useState<Article[]>([])

  useEffect(() => {
    let active = true
    setProfile(null)
    setDetails(null)
    setArticles([])
    if (!playerId) return
    const encoded = encodeURIComponent(playerId)
    Promise.all([
      fetch(`/api/goal-kickers/player/${encoded}`).then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<{ data?: PlayerProfile }>
      }),
      fetch(`/api/players/${encoded}/details`).then(async response => response.ok ? response.json() as Promise<{ data?: PlayerDetails | null }> : { data: null }).catch(() => ({ data: null })),
    ]).then(async ([profilePayload, detailsPayload]) => {
      const nextProfile = profilePayload.data ?? null
      if (!active || !nextProfile) return
      setProfile(nextProfile)
      setDetails(detailsPayload.data ?? null)
      const ids = [...new Set([playerId, nextProfile.playerId].filter(Boolean))]
      const responses = await Promise.all(ids.map(id => fetch(`/api/news?playerId=${encodeURIComponent(id)}`).then(async response => response.ok ? response.json() as Promise<{ data?: Article[] }> : { data: [] }).catch(() => ({ data: [] }))))
      if (!active) return
      const byId = new Map<string, Article>()
      for (const response of responses) for (const article of response.data ?? []) byId.set(article.id || article.slug, article)
      setArticles([...byId.values()].sort((a, b) => Date.parse(b.date ?? '') - Date.parse(a.date ?? '')).slice(0, 6))
    }).catch(() => {})
    return () => { active = false }
  }, [playerId])

  const image = details?.photoUrl || profile?.clubLogoUrl || null
  const identity = useMemo(() => profile ? <div className="pf-player-identity-media" aria-label={`${profile.playerName} profile image`}>
    {image ? <img src={image} alt={`${profile.playerName}${details?.photoUrl ? ' player profile' : ` — ${profile.clubName}`}`} /> : <span>{initials(profile.playerName)}</span>}
  </div> : null, [details?.photoUrl, image, profile])

  if (!playerId) return null
  return <>
    {identityTarget && identity ? createPortal(<span className="pf-player-identity-mount">{identity}</span>, identityTarget) : null}
    {newsTarget && articles.length ? createPortal(<section className="player-card pf-player-news">
      <header><span>Latest coverage</span><h2>News featuring {profile?.playerName?.split(' ')[0] ?? 'this player'}</h2></header>
      <div className="pf-player-news-grid">{articles.map(article => <Link key={article.id || article.slug} to={`/news/${article.slug}`}>
        <div><span>{article.category || 'PlayFooty news'}{formatDate(article.date) ? ` · ${formatDate(article.date)}` : ''}</span><strong>{article.title}</strong>{article.summary ? <p>{article.summary}</p> : null}</div>
        <b aria-hidden>Read article →</b>
      </Link>)}</div>
    </section>, newsTarget) : null}
    <style>{`
      .pf-player-identity-mount{order:-1;display:block;flex:0 0 auto}.pf-player-identity-media{width:112px;height:112px;display:grid;place-items:center;overflow:hidden;border-radius:20px;background:#fff;border:1px solid rgba(255,255,255,.22)}.pf-player-identity-media img{width:100%;height:100%;object-fit:cover}.pf-player-identity-media span{display:grid;place-items:center;width:100%;height:100%;background:#2daaf5;color:#050505;font-family:'Bebas Neue',Impact,sans-serif;font-size:42px}
      .pf-player-news-grid{display:grid;gap:10px}.pf-player-news-grid>a{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:16px;border:1px solid #e4e9ee;border-radius:10px;background:#f8fafb;color:#111318;text-decoration:none}.pf-player-news-grid>a:hover,.pf-player-news-grid>a:focus-visible{border-color:#2daaf5;outline:none}.pf-player-news-grid span{display:block;color:#2daaf5;font-size:10px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.pf-player-news-grid strong{display:block;margin-top:5px;font-size:18px;line-height:1.25}.pf-player-news-grid p{margin:7px 0 0;color:#687385;line-height:1.45}.pf-player-news-grid b{flex:0 0 auto;color:#177fbd;font-size:12px;text-transform:uppercase}
      @media(max-width:620px){.pf-player-identity-media{width:82px;height:82px;border-radius:15px}.pf-player-identity-media span{font-size:31px}.pf-player-news-grid>a{align-items:flex-start;flex-direction:column}.pf-player-news-grid b{margin-top:2px}}
    `}</style>
  </>
}
