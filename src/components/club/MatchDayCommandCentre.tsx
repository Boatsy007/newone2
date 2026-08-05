import { useEffect, useRef, type ReactNode } from 'react'
import './MatchDayFullscreenControlsOverride.css'

const LIVE_WIDTH = 1024
const LIVE_HEIGHT = 768

type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null }

export default function MatchDayCommandCentre({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    let frame = 0
    const host = hostRef.current
    if (!host) return

    const fitCanonicalLayout = () => {
      if (!mounted) return
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (!mounted) return

        const board = host.querySelector<HTMLElement>('.md')
        if (!board) return

        const doc = document as FullscreenDocument
        const nativeFullscreen = Boolean(document.fullscreenElement || doc.webkitFullscreenElement)

        document.body.classList.add('pf-match-day-focus')

        if (nativeFullscreen) {
          board.style.removeProperty('position')
          board.style.removeProperty('left')
          board.style.removeProperty('top')
          board.style.removeProperty('width')
          board.style.removeProperty('height')
          board.style.removeProperty('min-width')
          board.style.removeProperty('min-height')
          board.style.removeProperty('max-width')
          board.style.removeProperty('max-height')
          board.style.removeProperty('margin')
          board.style.removeProperty('transform')
          board.style.removeProperty('transform-origin')
          return
        }

        const viewport = window.visualViewport
        const viewportWidth = viewport?.width || window.innerWidth
        const viewportHeight = viewport?.height || window.innerHeight
        const viewportTop = viewport?.offsetTop || 0
        const rect = host.getBoundingClientRect()

        const availableWidth = Math.max(1, Math.min(rect.width || viewportWidth, viewportWidth - Math.max(0, rect.left)))
        const availableHeight = Math.max(1, viewportHeight - Math.max(0, rect.top - viewportTop))
        const scale = Math.min(availableWidth / LIVE_WIDTH, availableHeight / LIVE_HEIGHT)
        const safeScale = Math.max(0.1, scale)

        host.style.height = `${availableHeight}px`
        board.style.position = 'absolute'
        board.style.left = '50%'
        board.style.top = '0'
        board.style.width = `${LIVE_WIDTH}px`
        board.style.height = `${LIVE_HEIGHT}px`
        board.style.minWidth = `${LIVE_WIDTH}px`
        board.style.minHeight = `${LIVE_HEIGHT}px`
        board.style.maxWidth = `${LIVE_WIDTH}px`
        board.style.maxHeight = `${LIVE_HEIGHT}px`
        board.style.margin = '0'
        board.style.transform = `translateX(-50%) scale(${safeScale})`
        board.style.transformOrigin = 'top center'
      })
    }

    document.body.classList.add('pf-match-day-focus')
    fitCanonicalLayout()

    const observer = new ResizeObserver(fitCanonicalLayout)
    observer.observe(host)

    const mutationObserver = new MutationObserver(fitCanonicalLayout)
    mutationObserver.observe(host, { childList: true, subtree: true })

    window.addEventListener('resize', fitCanonicalLayout)
    window.addEventListener('orientationchange', fitCanonicalLayout)
    window.visualViewport?.addEventListener('resize', fitCanonicalLayout)
    window.visualViewport?.addEventListener('scroll', fitCanonicalLayout)
    document.addEventListener('fullscreenchange', fitCanonicalLayout)
    document.addEventListener('webkitfullscreenchange', fitCanonicalLayout as EventListener)

    const retryA = window.setTimeout(fitCanonicalLayout, 60)
    const retryB = window.setTimeout(fitCanonicalLayout, 220)

    return () => {
      mounted = false
      window.cancelAnimationFrame(frame)
      window.clearTimeout(retryA)
      window.clearTimeout(retryB)
      observer.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', fitCanonicalLayout)
      window.removeEventListener('orientationchange', fitCanonicalLayout)
      window.visualViewport?.removeEventListener('resize', fitCanonicalLayout)
      window.visualViewport?.removeEventListener('scroll', fitCanonicalLayout)
      document.removeEventListener('fullscreenchange', fitCanonicalLayout)
      document.removeEventListener('webkitfullscreenchange', fitCanonicalLayout as EventListener)
      document.body.classList.remove('pf-match-day-focus')
    }
  }, [])

  return (
    <div ref={hostRef} className="md-canonical-live-host">
      {children}
      <style>{`
        .md-canonical-live-host {
          position: relative;
          width: 100%;
          min-width: 0;
          min-height: 1px;
          overflow: hidden;
          background: #07111c;
        }

        .md-canonical-live-host > .md {
          overflow: hidden !important;
        }
      `}</style>
    </div>
  )
}
