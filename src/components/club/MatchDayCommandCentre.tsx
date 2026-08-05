import { useEffect, type ReactNode } from 'react'
import './MatchDayFullscreenControlsOverride.css'

const LIVE_WIDTH = 1024
const LIVE_HEIGHT = 768

export default function MatchDayCommandCentre({ children }: { children: ReactNode }) {
  useEffect(() => {
    let mounted = true

    const fitLiveCanvas = () => {
      if (!mounted) return
      const viewport = window.visualViewport
      const width = viewport?.width || window.innerWidth
      const height = viewport?.height || window.innerHeight
      const scale = Math.min(width / LIVE_WIDTH, height / LIVE_HEIGHT)
      document.documentElement.style.setProperty('--pf-md-live-scale', String(Math.max(0.1, scale)))
    }

    const applyLiveLayout = () => {
      if (!mounted) return
      document.body.classList.add('pf-match-day-live', 'pf-match-day-focus')
      document.documentElement.classList.add('pf-match-day-focus-root')
      fitLiveCanvas()
      document.dispatchEvent(new Event('fullscreenchange'))
      window.dispatchEvent(new CustomEvent('playfooty:matchday-focus', { detail: { active: true } }))
    }

    applyLiveLayout()
    window.requestAnimationFrame(applyLiveLayout)
    const timer = window.setTimeout(applyLiveLayout, 120)

    window.addEventListener('resize', fitLiveCanvas)
    window.addEventListener('orientationchange', fitLiveCanvas)
    window.visualViewport?.addEventListener('resize', fitLiveCanvas)
    window.visualViewport?.addEventListener('scroll', fitLiveCanvas)

    return () => {
      mounted = false
      window.clearTimeout(timer)
      window.removeEventListener('resize', fitLiveCanvas)
      window.removeEventListener('orientationchange', fitLiveCanvas)
      window.visualViewport?.removeEventListener('resize', fitLiveCanvas)
      window.visualViewport?.removeEventListener('scroll', fitLiveCanvas)
      document.body.classList.remove('pf-match-day-live', 'pf-match-day-focus')
      document.documentElement.classList.remove('pf-match-day-focus-root')
      document.documentElement.style.removeProperty('--pf-md-live-scale')
      window.dispatchEvent(new CustomEvent('playfooty:matchday-focus', { detail: { active: false } }))
    }
  }, [])

  return <div className="md-command-live-layer launched">{children}</div>
}
