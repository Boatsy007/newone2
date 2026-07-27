import { useEffect, useState, type ReactNode } from 'react'
import { ensureFreshPortalSession, type PortalAuthSession } from '../../lib/portalAuth'

type PortalKind = 'club' | 'league'

const KEYS: Record<PortalKind, string> = {
  club: 'playfooty.clubPortal.session.v1',
  league: 'playfooty.leaguePortal.session.v1',
}

function read(kind: PortalKind): PortalAuthSession | null {
  try {
    const raw = localStorage.getItem(KEYS[kind])
    return raw ? JSON.parse(raw) as PortalAuthSession : null
  } catch {
    return null
  }
}

function save(kind: PortalKind, session: PortalAuthSession | null) {
  if (session) localStorage.setItem(KEYS[kind], JSON.stringify(session))
  else localStorage.removeItem(KEYS[kind])
  window.dispatchEvent(new CustomEvent('playfooty:portal-session', { detail: { kind, session } }))
}

function loginPath(kind: PortalKind, reason: string) {
  const base = kind === 'club' ? '/club-portal' : '/league-portal'
  const returnTo = `${window.location.pathname}${window.location.search}`
  return `${base}?returnTo=${encodeURIComponent(returnTo)}&reason=${encodeURIComponent(reason)}`
}

export default function PortalSessionBoundary({ kind, children }: { kind: PortalKind; children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('Checking your PlayFooty session…')

  useEffect(() => {
    let active = true
    let timer = 0

    const redirect = (reason: string) => {
      save(kind, null)
      window.location.replace(loginPath(kind, reason))
    }

    const refresh = async (initial = false) => {
      const stored = read(kind)
      if (!stored?.access_token || !stored.refresh_token) {
        redirect('signin-required')
        return
      }
      try {
        const fresh = await ensureFreshPortalSession(stored)
        if (!fresh?.access_token) throw new Error('Session unavailable')
        save(kind, fresh)
        if (active) setReady(true)
      } catch {
        if (initial && active) setMessage('Your session has expired. Returning you to sign in…')
        redirect('session-expired')
      }
    }

    void refresh(true)
    timer = window.setInterval(() => { void refresh(false) }, 60_000)
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(false) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [kind])

  if (!ready) return <main style={{ minHeight: '65vh', display: 'grid', placeItems: 'center', padding: 24, background: '#eef3f7', color: '#526070', fontWeight: 800 }}>{message}</main>
  return children
}
