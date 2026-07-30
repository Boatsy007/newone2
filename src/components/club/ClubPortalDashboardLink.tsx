import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import CoachingPortalTabs from './CoachingPortalTabs'

const MOBILE_WHITEBOARD_CSS = `
body.pf-mobile-whiteboard{overflow:hidden!important;background:#091018!important;overscroll-behavior:none!important}
body.pf-mobile-whiteboard #root>nav,body.pf-mobile-whiteboard #root>footer{display:none!important}
body.pf-mobile-whiteboard .wb{position:fixed!important;inset:0!important;z-index:99999!important;width:100vw!important;height:100dvh!important;min-height:0!important;box-sizing:border-box!important;overflow:hidden!important;padding:6px!important;background:#101820!important;-webkit-user-select:none!important;user-select:none!important}
body.pf-mobile-whiteboard .wb>header{max-width:none!important;height:44px!important;min-height:44px!important;box-sizing:border-box!important;padding:5px 8px!important;border-radius:8px!important;gap:8px!important}
body.pf-mobile-whiteboard .wb>header>div{display:none!important}
body.pf-mobile-whiteboard .wb>header>a,body.pf-mobile-whiteboard .wb>header>button{font-size:11px!important;padding:7px 9px!important;white-space:nowrap!important}
body.pf-mobile-whiteboard .wb>header>button{margin-left:auto!important}
body.pf-mobile-whiteboard .wb>.ok,body.pf-mobile-whiteboard .wb>.err{position:fixed!important;left:12px!important;right:12px!important;top:54px!important;z-index:5!important;margin:0!important;font-size:11px!important}
body.pf-mobile-whiteboard .wb>.meta{max-width:none!important;height:52px!important;box-sizing:border-box!important;display:flex!important;gap:6px!important;align-items:center!important;margin:5px 0!important;padding:5px!important;border-radius:8px!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
body.pf-mobile-whiteboard .wb>.meta::-webkit-scrollbar{display:none!important}
body.pf-mobile-whiteboard .wb>.meta label{flex:0 0 150px!important;font-size:7px!important}
body.pf-mobile-whiteboard .wb>.meta input,body.pf-mobile-whiteboard .wb>.meta select{height:29px!important;margin-top:2px!important;padding:4px 6px!important;font-size:10px!important}
body.pf-mobile-whiteboard .wb>.meta button{flex:0 0 auto!important;height:34px!important;padding:6px 9px!important;font-size:9px!important}
body.pf-mobile-whiteboard .wb>.workspace{max-width:none!important;height:calc(100dvh - 113px)!important;min-height:0!important;display:grid!important;grid-template-columns:150px minmax(0,1fr)!important;gap:6px!important;margin:0!important;overflow:hidden!important}
body.pf-mobile-whiteboard .wb>.workspace>aside{height:100%!important;min-height:0!important;overflow-y:auto!important;padding:6px!important;border-radius:8px!important}
body.pf-mobile-whiteboard .wb>.workspace>aside section{padding:5px!important}
body.pf-mobile-whiteboard .wb>.workspace>aside h2{font-size:17px!important;margin:3px 0 6px!important}
body.pf-mobile-whiteboard .player-bank{gap:4px!important}
body.pf-mobile-whiteboard .player-bank button{min-height:34px!important;padding:4px!important;font-size:9px!important}
body.pf-mobile-whiteboard .add-opp{padding:7px!important;font-size:9px!important}
body.pf-mobile-whiteboard .board-shell{height:100%!important;min-height:0!important;box-sizing:border-box!important;display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important;padding:5px!important;border-radius:8px!important;overflow:hidden!important}
body.pf-mobile-whiteboard .tools{display:flex!important;align-items:center!important;gap:4px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:0 0 4px!important;scrollbar-width:none!important}
body.pf-mobile-whiteboard .tools::-webkit-scrollbar{display:none!important}
body.pf-mobile-whiteboard .tools>span{display:none!important}
body.pf-mobile-whiteboard .tools button{flex:0 0 auto!important;min-width:38px!important;height:34px!important;padding:5px 7px!important;font-size:0!important;border-radius:7px!important}
body.pf-mobile-whiteboard .tools button svg{width:18px!important;height:18px!important;margin:0!important}
body.pf-mobile-whiteboard .tools label{flex:0 0 105px!important;font-size:7px!important}
body.pf-mobile-whiteboard .tools select{height:29px!important;margin-top:1px!important;padding:3px!important;font-size:9px!important}
body.pf-mobile-whiteboard .oval{align-self:center!important;justify-self:center!important;width:auto!important;height:min(calc(100dvh - 176px),calc((100vw - 170px) / 1.62))!important;max-width:100%!important;max-height:100%!important;aspect-ratio:1.62 / 1!important;border-radius:50%!important;touch-action:none!important;-webkit-touch-callout:none!important}
body.pf-mobile-whiteboard .marker{transform:translate(-50%,-50%) scale(.72)!important;transform-origin:center!important;touch-action:none!important}
body.pf-mobile-whiteboard .legend{min-height:24px!important;padding:3px!important;font-size:8px!important;gap:8px!important;overflow:hidden!important;white-space:nowrap!important}
body.pf-mobile-whiteboard .legend em{margin-left:auto!important;overflow:hidden!important;text-overflow:ellipsis!important}
body.pf-mobile-whiteboard .wb.is-fullscreen{padding:3px!important}
body.pf-mobile-whiteboard .wb.is-fullscreen>header{position:absolute!important;top:7px!important;right:7px!important;z-index:40!important;width:auto!important;height:auto!important;min-height:0!important;padding:0!important;background:transparent!important;box-shadow:none!important}
body.pf-mobile-whiteboard .wb.is-fullscreen>header>a,body.pf-mobile-whiteboard .wb.is-fullscreen>header>div{display:none!important}
body.pf-mobile-whiteboard .wb.is-fullscreen>header>button{margin:0!important;padding:8px 11px!important;background:rgba(9,16,24,.88)!important;color:#fff!important;border:1px solid rgba(255,255,255,.3)!important;border-radius:9px!important;font-size:10px!important;box-shadow:0 4px 14px rgba(0,0,0,.25)!important}
body.pf-mobile-whiteboard .wb.is-fullscreen>.meta,body.pf-mobile-whiteboard .wb.is-fullscreen>.ok,body.pf-mobile-whiteboard .wb.is-fullscreen>.err{display:none!important}
body.pf-mobile-whiteboard .wb.is-fullscreen>.workspace{width:100%!important;height:100%!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:0!important}
body.pf-mobile-whiteboard .wb.is-fullscreen>.workspace>aside{display:none!important}
body.pf-mobile-whiteboard .wb.is-fullscreen .board-shell{width:100%!important;height:100%!important;padding:4px!important;border-radius:0!important;grid-template-rows:auto minmax(0,1fr) auto!important}
body.pf-mobile-whiteboard .wb.is-fullscreen .tools{padding-right:102px!important}
body.pf-mobile-whiteboard .wb.is-fullscreen .oval{height:min(calc(100dvh - 62px),calc((100vw - 10px) / 1.62))!important;width:auto!important;max-width:calc(100vw - 10px)!important;max-height:calc(100dvh - 62px)!important}
body.pf-mobile-whiteboard .wb.is-fullscreen .legend{min-height:20px!important}
@media (max-width:900px) and (orientation:portrait){
 body.pf-mobile-whiteboard .wb{inset:auto!important;top:50%!important;left:50%!important;width:100dvh!important;height:100vw!important;transform:translate(-50%,-50%) rotate(90deg)!important;transform-origin:center!important}
 body.pf-mobile-whiteboard .wb>.workspace{height:calc(100vw - 113px)!important}
 body.pf-mobile-whiteboard .oval{height:min(calc(100vw - 176px),calc((100dvh - 170px) / 1.62))!important}
 body.pf-mobile-whiteboard .wb.is-fullscreen>.workspace{height:100%!important}
 body.pf-mobile-whiteboard .wb.is-fullscreen .oval{height:min(calc(100vw - 62px),calc((100dvh - 10px) / 1.62))!important;max-width:calc(100dvh - 10px)!important;max-height:calc(100vw - 62px)!important}
}
@media (max-height:500px) and (orientation:landscape){
 body.pf-mobile-whiteboard .wb>.meta{height:44px!important}
 body.pf-mobile-whiteboard .wb>.workspace{height:calc(100dvh - 105px)!important}
 body.pf-mobile-whiteboard .oval{height:min(calc(100dvh - 153px),calc((100vw - 170px) / 1.62))!important}
 body.pf-mobile-whiteboard .wb.is-fullscreen>.workspace{height:100%!important}
 body.pf-mobile-whiteboard .wb.is-fullscreen .oval{height:min(calc(100dvh - 62px),calc((100vw - 10px) / 1.62))!important}
}
`

function remapRotatedPointer(event: PointerEvent) {
  if (!document.body.classList.contains('pf-mobile-whiteboard')) return
  if (!window.matchMedia('(orientation: portrait)').matches) return
  const target = event.target instanceof Element ? event.target : null
  const oval = target?.closest<HTMLElement>('.oval')
  if (!oval) return

  const box = oval.getBoundingClientRect()
  if (!box.width || !box.height) return

  const screenX = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width))
  const screenY = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height))
  const localX = screenY
  const localY = 1 - screenX
  const mappedX = box.left + localX * box.width
  const mappedY = box.top + localY * box.height

  try {
    Object.defineProperty(event, 'clientX', { configurable: true, value: mappedX })
    Object.defineProperty(event, 'clientY', { configurable: true, value: mappedY })
  } catch {
    // Older browsers may expose immutable pointer coordinates.
  }
}

export default function ClubPortalDashboardLink() {
  const { pathname } = useLocation()
  useEffect(() => {
    const whiteboardMatch = pathname.match(/^\/club-portal\/([^/]+)\/whiteboard$/)
    let mobileStyle: HTMLStyleElement | null = null

    if (whiteboardMatch && window.matchMedia('(max-width: 900px)').matches) {
      document.body.classList.add('pf-mobile-whiteboard')
      mobileStyle = document.createElement('style')
      mobileStyle.dataset.pfMobileWhiteboard = 'true'
      mobileStyle.textContent = MOBILE_WHITEBOARD_CSS
      document.head.appendChild(mobileStyle)
      document.addEventListener('pointerdown', remapRotatedPointer, true)
      document.addEventListener('pointermove', remapRotatedPointer, true)
    }

    const connect = () => {
      if (pathname === '/club-portal') {
        document.querySelectorAll<HTMLAnchorElement>('.membership-list article a[href^="/team/"]').forEach(link => {
          const clubId = link.getAttribute('href')?.replace(/^\/team\//, '')
          if (!clubId) return
          link.setAttribute('href', `/club-portal/${clubId}`)
          link.childNodes.forEach(node => { if (node.nodeType === Node.TEXT_NODE) node.textContent = 'Open portal ' })
          link.setAttribute('aria-label', 'Open club management dashboard')
        })
      }

      const match = pathname.match(/^\/club-portal\/([^/]+)$/)
      if (match) {
        const clubId = match[1]
        document.querySelectorAll<HTMLAnchorElement>('.cp-tools a').forEach(link => {
          const label = link.querySelector('strong')?.textContent?.trim().toLowerCase()
          if (label !== 'team selection') return
          link.setAttribute('href', `/club-portal/${clubId}/team-selection`)
          link.setAttribute('aria-label', 'Open club team selection editor')
          let anchor: HTMLAnchorElement = link
          if (!document.querySelector('[data-player-availability-link]')) {
            const availability = link.cloneNode(true) as HTMLAnchorElement
            availability.dataset.playerAvailabilityLink = 'true'
            availability.setAttribute('href', `/club-portal/${clubId}/availability`)
            availability.setAttribute('aria-label', 'Open player availability dashboard')
            const strong = availability.querySelector('strong')
            const detail = availability.querySelector('span')
            if (strong) strong.textContent = 'Player availability'
            if (detail) detail.textContent = 'Invite players and track weekly responses'
            link.insertAdjacentElement('afterend', availability)
            anchor = availability
          } else {
            anchor = document.querySelector<HTMLAnchorElement>('[data-player-availability-link]') ?? link
          }
          if (!document.querySelector('[data-coach-whiteboard-link]')) {
            const whiteboard = link.cloneNode(true) as HTMLAnchorElement
            whiteboard.dataset.coachWhiteboardLink = 'true'
            whiteboard.setAttribute('href', `/club-portal/${clubId}/whiteboard`)
            whiteboard.setAttribute('aria-label', 'Open coach tactical whiteboard')
            const strong = whiteboard.querySelector('strong')
            const detail = whiteboard.querySelector('span')
            if (strong) strong.textContent = 'Coach whiteboard'
            if (detail) detail.textContent = 'Position players, draw movement and save plays'
            anchor.insertAdjacentElement('afterend', whiteboard)
          }
        })
      }
    }
    connect()
    const observer = new MutationObserver(connect)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      document.body.classList.remove('pf-mobile-whiteboard')
      document.removeEventListener('pointerdown', remapRotatedPointer, true)
      document.removeEventListener('pointermove', remapRotatedPointer, true)
      mobileStyle?.remove()
    }
  }, [pathname])
  return <CoachingPortalTabs/>
}
