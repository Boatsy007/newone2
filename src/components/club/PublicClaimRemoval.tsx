import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Club onboarding is invitation-first. Public club profiles do not advertise
 * claiming, while the existing request workflow remains available as a quiet
 * fallback inside the signed-in Club Portal.
 */
export default function PublicClaimRemoval() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [requestOpen, setRequestOpen] = useState(() => new URLSearchParams(search).get('request') === '1')

  useEffect(() => {
    const claimMatch = pathname.match(/^\/claim-club\/([^/]+)/)
    if (claimMatch) navigate(`/team/${claimMatch[1]}`, { replace: true })
  }, [navigate, pathname])

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
      <h2>{requestOpen ? 'Request access' : 'Access is provided by PlayFooty invitation'}</h2>
      {!requestOpen ? (
        <>
          <p>PlayFooty contacts each club and invites its approved representatives. Open the secure link supplied by PlayFooty while signed in with this email address.</p>
          <button type="button" onClick={() => setFallback(true)}>Don&apos;t have an invitation? Request access</button>
        </>
      ) : (
        <div className="pf-request-note">
          <p>Use the form below only when your club has asked for access but has not yet received an invitation. Every request is manually reviewed by PlayFooty.</p>
          <button type="button" onClick={() => setFallback(false)}>Back to invitation access</button>
        </div>
      )}
    </section>,
    panel,
  ) : null

  return <>
    {invitationPanel}
    <style>{`
      a[href^="/claim-club/"],
      .pf-claim-club-fab,
      .club-hero-claim,
      [class*="claim-club"],
      [class*="club-claim"] {
        display: none !important;
      }
      .club-portal-panel .claim-section { display: ${requestOpen ? 'block' : 'none'}; }
      .pf-invite-first{border-top:1px solid #e1e6eb;margin-top:22px;padding-top:22px;display:grid;gap:8px}
      .pf-invite-first>span{color:#0783c9;font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
      .pf-invite-first h2{margin:0!important;font-family:'Bebas Neue',Impact,sans-serif;font-size:34px!important;line-height:1;text-transform:uppercase}
      .pf-invite-first p{margin:3px 0;color:#687385;line-height:1.55;font-size:14px}
      .pf-invite-first button{justify-self:start;border:0;background:none;color:#087bbf;padding:7px 0;font:inherit;font-size:13px;font-weight:900;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
      .pf-request-note{display:grid;gap:4px}
    `}</style>
  </>
}
