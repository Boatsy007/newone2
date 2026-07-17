import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { sharePlayFootyPath } from './ShareButton'

const SHAREABLE = [
  /^\/team\/[^/]+$/,
  /^\/league\/[^/]+$/,
  /^\/player\/[^/]+$/,
  /^\/match\/(fixture|result)\/[^/]+$/,
  /^\/news\/[^/]+$/,
  /^\/highlights(?:\/[^/]+)?$/,
]

function isShareable(path: string) {
  return SHAREABLE.some(pattern => pattern.test(path))
}

function labelFor(path: string) {
  if (path.startsWith('/player/')) return 'Share player'
  if (path.startsWith('/match/')) return 'Share match'
  if (path.startsWith('/league/')) return 'Share league'
  if (path.startsWith('/team/')) return 'Share club'
  if (path.startsWith('/news/')) return 'Share story'
  return 'Share'
}

export default function AutoShareButtons() {
  const { pathname } = useLocation()

  useEffect(() => {
    let timer = 0
    const enhance = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
          if (anchor.dataset.pfShareEnhanced === 'true') return
          const href = anchor.getAttribute('href') ?? ''
          const url = new URL(href, window.location.origin)
          if (url.origin !== window.location.origin || !isShareable(url.pathname)) return
          if (anchor.closest('.pf-nav,.pf-mobile-menu,.pf-share-action,.pf-auto-share')) return

          anchor.dataset.pfShareEnhanced = 'true'
          anchor.classList.add('pf-share-host')
          const control = document.createElement('button')
          control.type = 'button'
          control.className = 'pf-auto-share'
          control.setAttribute('aria-label', `${labelFor(url.pathname)} as a PlayFooty graphic`)
          control.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.7 6.8-4.1M8.6 13.3l6.8 4.1"/></svg><span>Share</span>'
          control.addEventListener('click', async event => {
            event.preventDefault()
            event.stopPropagation()
            control.disabled = true
            control.classList.add('creating')
            control.querySelector('span')!.textContent = 'Creating'
            try {
              const result = await sharePlayFootyPath(`${url.pathname}${url.search}`)
              control.querySelector('span')!.textContent = result === 'copied' ? 'Copied' : 'Share'
              if (result === 'copied') window.setTimeout(() => { control.querySelector('span')!.textContent = 'Share' }, 1600)
            } catch {
              control.querySelector('span')!.textContent = 'Share'
            } finally {
              control.disabled = false
              control.classList.remove('creating')
            }
          })
          anchor.appendChild(control)
        })
      }, 80)
    }

    enhance()
    const observer = new MutationObserver(enhance)
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => { window.clearTimeout(timer); observer.disconnect() }
  }, [pathname])

  return <style>{`
    .pf-share-host{position:relative!important}
    .pf-auto-share{position:absolute;right:8px;top:8px;z-index:8;display:flex;align-items:center;gap:5px;border:1px solid rgba(5,5,5,.14);border-radius:999px;background:rgba(255,255,255,.94);color:#050505;padding:7px 9px;box-shadow:0 5px 16px rgba(0,0,0,.12);font-family:'Barlow Condensed',Arial,sans-serif;font-size:10px;font-weight:950;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;backdrop-filter:blur(8px)}
    .pf-auto-share svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.pf-auto-share circle{fill:currentColor;stroke:none}
    .pf-auto-share:hover,.pf-auto-share:focus-visible{background:#2daaf5;outline:none}.pf-auto-share.creating{opacity:.7;cursor:wait}
    .rankings-table .pf-auto-share,.goal-table .pf-auto-share{position:static;margin-left:auto;flex:0 0 auto}
    @media(max-width:640px){.pf-auto-share{padding:7px}.pf-auto-share span{display:none}.rankings-table .pf-auto-share,.goal-table .pf-auto-share{display:flex}}
  `}</style>
}
