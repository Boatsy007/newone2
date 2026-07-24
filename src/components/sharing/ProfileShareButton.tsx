import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import ShareButton from './ShareButton'

function targetSelector(pathname: string) {
  // Club profiles keep their React tree fully native. Injecting a portal into the
  // club hero can conflict with tab rerenders on mobile Safari.
  if (/^\/league\/[^/]+$/.test(pathname)) return '.league-hero-actions'
  if (/^\/player\/[^/]+$/.test(pathname)) return '.player-links'
  return null
}

export default function ProfileShareButton() {
  const { pathname } = useLocation()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const selector = targetSelector(pathname)

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
    const observer = new MutationObserver(() => {
      if (resolve()) observer.disconnect()
    })
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname, selector])

  if (!target || !selector) return null

  const button = <ShareButton className="pf-profile-inline-share" label="Share" />

  return <>
    {createPortal(
      <span className="pf-profile-share-mount">{button}</span>,
      target,
    )}
    <style>{`
      .pf-profile-share-mount{display:inline-flex;align-items:center}
      .pf-profile-inline-share{display:inline-flex!important;align-items:center;justify-content:center;gap:8px!important;min-height:46px!important;padding:0 18px!important;border:1px solid #2daaf5!important;border-radius:999px!important;background:#2daaf5!important;color:#050505!important;box-shadow:none!important;font-family:'Barlow Condensed',Arial,sans-serif!important;font-size:12px!important;font-weight:950!important;letter-spacing:.1em!important;text-transform:uppercase!important;cursor:pointer!important}
      .pf-profile-inline-share:hover,.pf-profile-inline-share:focus-visible{background:#59bdff!important;border-color:#59bdff!important;outline:none!important}
      .pf-profile-inline-share:disabled{opacity:.72;cursor:wait!important}
      @media(max-width:720px){
        .league-hero-actions .pf-profile-share-mount{flex:1 1 100%}
        .league-hero-actions .pf-profile-inline-share{width:100%}
        .player-links .pf-profile-inline-share{min-height:40px!important;padding:0 15px!important}
      }
    `}</style>
  </>
}
