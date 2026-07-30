import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { portalSessionFromLocation, type PortalAuthSession } from '../../lib/portalAuth'
import ClubProfileTheme from './ClubProfileTheme'

/**
 * Club onboarding is invitation-first. Public club profiles do not advertise
 * claiming, while the existing request workflow remains available as a quiet
 * fallback inside the signed-in Club Portal.
 *
 * This component also completes verified email invitations automatically:
 * verified session -> accept invite -> open the protected dashboard.
 */
export default function PublicClaimRemoval() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [requestOpen, setRequestOpen] = useState(() => new URLSearchParams(search).get('request') === '1')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    const claimMatch = pathname.match(/^\/claim-club\/([^/]+)/)
    if (claimMatch) navigate(`/team/${claimMatch[1]}`, { replace: true })
  }, [navigate, pathname])

  useEffect(() => {
    const portalType = pathname === '/club-portal' ? 'club' : pathname === '/league-portal' ? 'league' : null
    if (!portalType) return

    const verifiedSession = portalSessionFromLocation()
    if (!verifiedSession) return

    const storageKey = portalType === 'club' ? 'playfooty.clubPortal.session.v1' : 'playfooty.leaguePortal.session.v1'
    localStorage.setItem(storageKey, JSON.stringify(verifiedSession satisfies PortalAuthSession))
    const invite = new URLSearchParams(search).get('invite')

    if (!invite) {
      window.location.replace(pathname)
      return
    }

    setAccepting(true)
    const endpoint = portalType === 'club' ? '/api/club-portal/invitations/accept' : '/api/league-portal/invitations/accept'
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${verifiedSession.access_token}` },
      body: JSON.stringify({ token: invite }),
    }).then(async response => {
      const payload = await response.json().catch(() => ({})) as {
        data?: { membership?: { clubId?: string; leagueId?: string } }
        error?: string
      }
      if (!response.ok) throw new Error(payload.error || 'Unable to accept this invitation')
      const targetId = portalType === 'club' ? payload.data?.membership?.clubId : payload.data?.membership?.leagueId
      window.location.replace(targetId ? `/${portalType}-portal/${encodeURIComponent(targetId)}` : `/${portalType}-portal`)
    }).catch(error => {
      sessionStorage.setItem('playfooty.portalInviteError', error instanceof Error ? error.message : 'Unable to accept this invitation')
      window.location.replace(`/${portalType}-portal?invite=${encodeURIComponent(invite)}`)
    })
  }, [pathname, search])

  useEffect(() => {
    if (pathname !== '/club-portal') {
      setPanel(null)
      setSignedIn(false)
      return
    }

    const sync = () => {
      setPanel(document.querySelector<HTMLElement>('.club-portal-panel'))
      setSignedIn(Boolean(document.querySelector('.club-portal-panel .account-bar')))
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])

  useEffect(() => {
    setRequestOpen(new URLSearchParams(search).get('request') === '1')
  }, [search])

  const setFallback = (open: boolean) => {
    setRequestOpen(open)
    const params = new URLSearchParams(search)
    if (open) params.set('request', '1')
    else params.delete('request')
    navigate({ pathname: '/club-portal', search: params.toString() ? `?${params}` : '' }, { replace: true })
  }

  const invitationPanel = panel && signedIn ? createPortal(
    <section className="pf-invite-first">
      <span>Club access</span>
      <h2>{requestOpen ? 'Request access' : 'Use your PlayFooty invitation'}</h2>
      {!requestOpen ? (
        <>
          <p>Open the secure invitation sent by PlayFooty. Once you sign in, your club is added automatically and the portal opens.</p>
          <button type="button" onClick={() => setFallback(true)}>No invitation yet? Request access</button>
        </>
      ) : (
        <div className="pf-request-note">
          <p>Use the form below only when PlayFooty has asked you to request access. Every request is manually reviewed.</p>
          <button type="button" onClick={() => setFallback(false)}>Back to invitation access</button>
        </div>
      )}
    </section>,
    panel,
  ) : null

  return <>
    <ClubProfileTheme />
    {accepting && <div className="pf-invite-overlay"><div><b>Opening your PlayFooty portal…</b><span>Your invitation is being applied automatically.</span></div></div>}
    {invitationPanel}
    <style>{`
      a[href^="/claim-club/"],
      .pf-claim-club-fab,
      .club-hero-claim,
      [class*="claim-club"],
      [class*="club-claim"] { display: none !important; }
      .club-portal-panel .claim-section { display: ${requestOpen ? 'block' : 'none'}; }
      .pf-invite-first{border-top:1px solid #e1e6eb;margin-top:22px;padding-top:22px;display:grid;gap:8px}
      .pf-invite-first>span{color:#0783c9;font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
      .pf-invite-first h2{margin:0!important;font-family:'Bebas Neue',Impact,sans-serif;font-size:34px!important;line-height:1;text-transform:uppercase}
      .pf-invite-first p{margin:3px 0;color:#687385;line-height:1.55;font-size:14px}
      .pf-invite-first button{justify-self:start;border:0;background:none;color:#087bbf;padding:7px 0;font:inherit;font-size:13px;font-weight:900;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
      .pf-request-note{display:grid;gap:4px}
      .pf-invite-overlay{position:fixed;inset:0;z-index:10000;background:rgba(5,5,5,.88);display:grid;place-items:center;padding:24px;color:#fff;text-align:center}
      .pf-invite-overlay>div{display:grid;gap:8px}.pf-invite-overlay b{font-family:'Bebas Neue',Impact,sans-serif;font-size:36px;text-transform:uppercase}.pf-invite-overlay span{color:#cbd5e1}
    `}</style>
  </>
}
