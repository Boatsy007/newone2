import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const MOBILE_WHITEBOARD_CSS = `
body.pf-mobile-whiteboard{overflow:hidden!important;background:#091018!important}
body.pf-mobile-whiteboard #root>nav,body.pf-mobile-whiteboard #root>footer{display:none!important}
body.pf-mobile-whiteboard .wb{position:fixed!important;inset:0!important;z-index:99999!important;width:100vw!important;height:100dvh!important;min-height:0!important;box-sizing:border-box!important;overflow:hidden!important;padding:6px!important;background:#101820!important}
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
body.pf-mobile-whiteboard .oval{align-self:center!important;justify-self:center!important;width:auto!important;height:min(calc(100dvh - 176px),calc((100vw - 170px) / 1.62))!important;max-width:100%!important;max-height:100%!important;aspect-ratio:1.62 / 1!important;border-radius:50%!important;touch-action:none!important}
body.pf-mobile-whiteboard .marker{transform:translate(-50%,-50%) scale(.72)!important;transform-origin:center!important}
body.pf-mobile-whiteboard .legend{min-height:24px!important;padding:3px!important;font-size:8px!important;gap:8px!important;overflow:hidden!important;white-space:nowrap!important}
body.pf-mobile-whiteboard .legend em{margin-left:auto!important;overflow:hidden!important;text-overflow:ellipsis!important}
.pf-whiteboard-rotate{display:none}
@media (max-width:900px) and (orientation:portrait){
 body.pf-mobile-whiteboard .pf-whiteboard-rotate{position:fixed;inset:0;z-index:100001;display:grid;place-content:center;text-align:center;padding:30px;background:#071019;color:#fff}
 body.pf-mobile-whiteboard .pf-whiteboard-rotate strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:46px;line-height:.9;text-transform:uppercase}
 body.pf-mobile-whiteboard .pf-whiteboard-rotate span{max-width:290px;margin:12px auto 0;color:#b9c7d4;font-weight:700;line-height:1.45}
 body.pf-mobile-whiteboard .pf-whiteboard-rotate i{display:block;width:58px;height:92px;margin:0 auto 24px;border:4px solid #42b8ff;border-radius:12px;transform:rotate(90deg);box-shadow:0 0 30px rgba(66,184,255,.3)}
}
@media (max-height:500px) and (orientation:landscape){
 body.pf-mobile-whiteboard .wb>.meta{height:44px!important}
 body.pf-mobile-whiteboard .wb>.workspace{height:calc(100dvh - 105px)!important}
 body.pf-mobile-whiteboard .oval{height:min(calc(100dvh - 153px),calc((100vw - 170px) / 1.62))!important}
}
`

export default function ClubPortalDashboardLink() {
  const { pathname } = useLocation()
  useEffect(() => {
    const whiteboardMatch = pathname.match(/^\/club-portal\/([^/]+)\/whiteboard$/)
    let mobileStyle: HTMLStyleElement | null = null
    let rotatePrompt: HTMLDivElement | null = null
    let attemptedLandscape = false

    const requestLandscape = async () => {
      if (attemptedLandscape) return
      attemptedLandscape = true
      try {
        const board = document.querySelector<HTMLElement>('.wb')
        if (board && !document.fullscreenElement && board.requestFullscreen) await board.requestFullscreen()
      } catch { /* iPhone Safari commonly blocks programmatic fullscreen */ }
      try {
        const orientation = screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> }
        if (orientation?.lock) await orientation.lock('landscape')
      } catch { /* rotation remains controlled by the user when unsupported */ }
    }

    if (whiteboardMatch && window.matchMedia('(max-width: 900px)').matches) {
      document.body.classList.add('pf-mobile-whiteboard')
      mobileStyle = document.createElement('style')
      mobileStyle.dataset.pfMobileWhiteboard = 'true'
      mobileStyle.textContent = MOBILE_WHITEBOARD_CSS
      document.head.appendChild(mobileStyle)

      rotatePrompt = document.createElement('div')
      rotatePrompt.className = 'pf-whiteboard-rotate'
      rotatePrompt.innerHTML = '<div><i aria-hidden="true"></i><strong>Rotate your phone</strong><span>The coach whiteboard is designed for landscape. Turn your phone sideways to use the full oval.</span></div>'
      document.body.appendChild(rotatePrompt)
      document.addEventListener('pointerdown', requestLandscape, { once: true })
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
      mobileStyle?.remove()
      rotatePrompt?.remove()
      document.removeEventListener('pointerdown', requestLandscape)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
      try {
        const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void }
        orientation?.unlock?.()
      } catch { /* unsupported */ }
    }
  }, [pathname])
  return null
}
