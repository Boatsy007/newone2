import { useEffect, useRef, type ReactNode } from 'react'
import './MatchDayFullscreenControlsOverride.css'

const LIVE_WIDTH = 1024
const LIVE_HEIGHT = 768

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

function normalise(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

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

        document.body.classList.add('pf-match-day-focus')
        document.documentElement.classList.add('pf-match-day-focus-root')

        const doc = document as FullscreenDocument
        const nativeFullscreen = Boolean(document.fullscreenElement || doc.webkitFullscreenElement)
        host.classList.toggle('native-fullscreen', nativeFullscreen)

        if (nativeFullscreen) {
          host.style.removeProperty('height')
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
        const leftInset = Math.max(0, rect.left)
        const topInset = Math.max(0, rect.top - viewportTop)
        const availableWidth = Math.max(1, Math.min(rect.width || viewportWidth, viewportWidth - leftInset))
        const availableHeight = Math.max(1, viewportHeight - topInset - 10)
        const safeScale = Math.max(0.1, Math.min(availableWidth / LIVE_WIDTH, availableHeight / LIVE_HEIGHT))

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

    const handleFullscreenButton = async (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest('button') as HTMLButtonElement | null
      if (!target || !normalise(target.textContent || '').includes('FULLSCREEN')) return
      event.preventDefault()
      event.stopPropagation()

      const board = host.querySelector<FullscreenElement>('.md')
      if (!board) return
      const doc = document as FullscreenDocument

      try {
        if (document.fullscreenElement || doc.webkitFullscreenElement) {
          if (document.exitFullscreen) await document.exitFullscreen()
          else await Promise.resolve(doc.webkitExitFullscreen?.())
        } else if (board.requestFullscreen) {
          await board.requestFullscreen({ navigationUI: 'hide' }).catch(() => board.requestFullscreen())
        } else if (board.webkitRequestFullscreen) {
          await Promise.resolve(board.webkitRequestFullscreen())
        }
      } catch {
        // iPad Safari may refuse native fullscreen; the fitted live layout remains usable.
      }

      window.setTimeout(fitCanonicalLayout, 40)
    }

    fitCanonicalLayout()

    const observer = new ResizeObserver(fitCanonicalLayout)
    observer.observe(host)
    const mutationObserver = new MutationObserver(fitCanonicalLayout)
    mutationObserver.observe(host, { childList: true, subtree: true })

    host.addEventListener('click', handleFullscreenButton, true)
    window.addEventListener('resize', fitCanonicalLayout)
    window.addEventListener('orientationchange', fitCanonicalLayout)
    window.visualViewport?.addEventListener('resize', fitCanonicalLayout)
    window.visualViewport?.addEventListener('scroll', fitCanonicalLayout)
    document.addEventListener('fullscreenchange', fitCanonicalLayout)
    document.addEventListener('webkitfullscreenchange', fitCanonicalLayout as EventListener)

    const retryA = window.setTimeout(fitCanonicalLayout, 60)
    const retryB = window.setTimeout(fitCanonicalLayout, 240)
    const retryC = window.setTimeout(fitCanonicalLayout, 700)

    return () => {
      mounted = false
      window.cancelAnimationFrame(frame)
      window.clearTimeout(retryA)
      window.clearTimeout(retryB)
      window.clearTimeout(retryC)
      observer.disconnect()
      mutationObserver.disconnect()
      host.removeEventListener('click', handleFullscreenButton, true)
      window.removeEventListener('resize', fitCanonicalLayout)
      window.removeEventListener('orientationchange', fitCanonicalLayout)
      window.visualViewport?.removeEventListener('resize', fitCanonicalLayout)
      window.visualViewport?.removeEventListener('scroll', fitCanonicalLayout)
      document.removeEventListener('fullscreenchange', fitCanonicalLayout)
      document.removeEventListener('webkitfullscreenchange', fitCanonicalLayout as EventListener)
      document.body.classList.remove('pf-match-day-focus')
      document.documentElement.classList.remove('pf-match-day-focus-root')
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

        .md-canonical-live-host:not(.native-fullscreen) > .md {
          overflow: hidden !important;
        }

        .md-canonical-live-host:not(.native-fullscreen) .md {
          width: 1024px !important;
          height: 768px !important;
          min-width: 1024px !important;
          min-height: 768px !important;
        }

        .md-canonical-live-host:not(.native-fullscreen) .md-layout {
          width: 1024px !important;
          height: 768px !important;
        }

        .md-canonical-live-host:not(.native-fullscreen) .md-toolbar {
          top: 6px !important;
          left: 256px !important;
          width: 492px !important;
          max-width: 492px !important;
        }

        .md-canonical-live-host:not(.native-fullscreen) .md-clock {
          left: 524px !important;
          width: 132px !important;
        }

        .md-canonical-live-host:not(.native-fullscreen) .md-fs-score {
          top: 6px !important;
          left: 674px !important;
          right: 12px !important;
          width: auto !important;
        }

        .md-canonical-live-host:not(.native-fullscreen) .md-fs-stats {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: absolute !important;
          z-index: 70 !important;
          top: 52px !important;
          left: 524px !important;
          right: auto !important;
          width: 488px !important;
          height: 318px !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }

        .md-canonical-live-host:not(.native-fullscreen) .md-ai-coach-placeholder {
          position: absolute !important;
          left: 524px !important;
          right: auto !important;
          bottom: 14px !important;
          width: 488px !important;
          height: 374px !important;
        }

        .md-canonical-live-host:not(.native-fullscreen) .md-ground-wrap {
          inset: 124px 10px 142px 10px !important;
          width: auto !important;
          height: auto !important;
        }

        .md-canonical-live-host:not(.native-fullscreen) .md-ground {
          width: 399px !important;
          max-height: 498px !important;
        }

        .md-canonical-live-host:not(.native-fullscreen) .md-bench {
          left: 14px !important;
          right: 14px !important;
          bottom: 25px !important;
        }

        .md-canonical-live-host:not(.native-fullscreen) .md-bench-head {
          bottom: 116px !important;
        }
      `}</style>
    </div>
  )
}
