import { useEffect, useRef, useState, type ReactNode } from 'react'
import './MatchDayFullscreenControlsOverride.css'
import './MatchDayCommandCentre.css'

const LIVE_WIDTH = 1024
const LIVE_HEIGHT = 768
const LOADING_STAGE_TIME = 7000
const MIN_LOADING_TIME = LOADING_STAGE_TIME * 3
const MAX_LOADING_TIME = 30000
const FULLSCREEN_PROMPT_SESSION_KEY = 'pf-match-day-fullscreen-choice'

const loadingStages = [
  'LOADING LIVE TEAM',
  'LOADING GAME PLAN',
  'LOADING AI ASSISTANT COACH',
]

const matchControlLabels = ['START', 'NEXT QUARTER', 'FINISH MATCH', 'RESTART'] as const

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

function matchesControl(button: HTMLButtonElement, label: string) {
  if (button.dataset.mdMatchControls === 'true') return false
  const text = normalise(button.textContent || '')
  const wanted = normalise(label)
  if (wanted === 'START') return ['START', 'STARTMATCH', 'RESUME', 'RESUMEMATCH'].includes(text)
  if (wanted === 'NEXTQUARTER') return ['NEXTQUARTER', 'ENDQUARTER'].includes(text)
  if (wanted === 'FINISHMATCH') return ['FINISHMATCH', 'ENDMATCH'].includes(text)
  if (wanted === 'RESTART') return ['RESTART', 'RESTARTMATCH', 'RESETMATCH'].includes(text)
  return text === wanted
}

function replaceKpiText(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (normalise(node.textContent || '').includes('KPI')) {
      node.textContent = (node.textContent || '').replace(/KPI'?S?/i, 'MATCH')
      return
    }
    node = walker.nextNode()
  }
  root.textContent = 'MATCH'
}

export default function MatchDayCommandCentre({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStage, setLoadingStage] = useState(0)
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.sessionStorage.getItem(FULLSCREEN_PROMPT_SESSION_KEY) !== 'done'
  })

  const dismissFullscreenPrompt = () => {
    window.sessionStorage.setItem(FULLSCREEN_PROMPT_SESSION_KEY, 'done')
    setShowFullscreenPrompt(false)
  }

  const enterFullscreenFromPrompt = async () => {
    const board = hostRef.current?.querySelector<FullscreenElement>('.md')
    if (!board) return
    try {
      if (board.requestFullscreen) {
        await board.requestFullscreen({ navigationUI: 'hide' }).catch(() => board.requestFullscreen())
      } else if (board.webkitRequestFullscreen) {
        await Promise.resolve(board.webkitRequestFullscreen())
      }
    } catch {
      // iPad Safari may refuse native fullscreen. The fitted view remains available.
    } finally {
      dismissFullscreenPrompt()
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 40)
    }
  }

  useEffect(() => {
    let mounted = true
    let frame = 0
    let reconcilingControls = false
    const startedAt = Date.now()
    const host = hostRef.current
    if (!host) return

    const findOriginalControl = (board: HTMLElement, label: string) =>
      [...board.querySelectorAll<HTMLButtonElement>('button')].find(button => matchesControl(button, label))

    const activateOriginalControl = (source: HTMLButtonElement) => {
      source.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' }))
      source.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      source.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'touch' }))
      source.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      source.click()
    }

    const reconcileMatchControls = () => {
      if (!mounted || reconcilingControls) return
      const board = host.querySelector<HTMLElement>('.md')
      if (!board) return

      const kpiButton = [...board.querySelectorAll<HTMLButtonElement>('button')].find(button =>
        button.dataset.mdMatchControls !== 'true' && normalise(button.textContent || '').includes('KPI'),
      )
      if (!kpiButton?.parentElement) return

      reconcilingControls = true
      try {
        matchControlLabels.forEach(label => {
          const source = findOriginalControl(board, label)
          if (!source) return
          if (!source.dataset.mdOriginalStyle) source.dataset.mdOriginalStyle = source.getAttribute('style') || '__empty__'
          source.dataset.mdConsolidatedControl = 'true'
          source.style.setProperty('position', 'absolute', 'important')
          source.style.setProperty('left', '-10000px', 'important')
          source.style.setProperty('top', '-10000px', 'important')
          source.style.setProperty('width', '1px', 'important')
          source.style.setProperty('height', '1px', 'important')
          source.style.setProperty('opacity', '0', 'important')
          source.style.setProperty('pointer-events', 'none', 'important')
        })

        const tabParent = kpiButton.parentElement
        if (window.getComputedStyle(tabParent).position === 'static') {
          tabParent.dataset.mdOriginalPosition = tabParent.style.position || '__empty__'
          tabParent.style.position = 'relative'
        }

        let tab = tabParent.querySelector<HTMLButtonElement>('[data-md-control-tab="true"]')
        if (!tab) {
          tab = kpiButton.cloneNode(true) as HTMLButtonElement
          tab.removeAttribute('id')
          tab.type = 'button'
          tab.dataset.mdMatchControls = 'true'
          tab.dataset.mdControlTab = 'true'
          tab.setAttribute('aria-controls', 'md-match-control-panel')
          tab.setAttribute('aria-expanded', 'false')
          tab.setAttribute('aria-label', 'Open match controls')
          replaceKpiText(tab)
          tabParent.appendChild(tab)
        }
        tab.classList.add('md-match-control-tab')
        tab.style.setProperty('position', 'absolute', 'important')
        tab.style.setProperty('left', `${kpiButton.offsetLeft}px`, 'important')
        tab.style.setProperty('top', `${Math.max(0, kpiButton.offsetTop - kpiButton.offsetHeight - 6)}px`, 'important')
        tab.style.setProperty('width', `${kpiButton.offsetWidth}px`, 'important')
        tab.style.setProperty('height', `${kpiButton.offsetHeight}px`, 'important')
        tab.style.setProperty('margin', '0', 'important')
        tab.style.setProperty('z-index', '9401', 'important')
        tab.style.setProperty('background', '#d92d20', 'important')
        tab.style.setProperty('background-color', '#d92d20', 'important')
        tab.style.setProperty('background-image', 'none', 'important')
        tab.style.setProperty('border-color', '#ef5a50', 'important')
        tab.style.setProperty('color', '#fff', 'important')

        let panel = tabParent.querySelector<HTMLDivElement>('#md-match-control-panel')
        if (!panel) {
          panel = document.createElement('div')
          panel.id = 'md-match-control-panel'
          panel.dataset.mdMatchControls = 'true'
          panel.className = 'md-match-control-panel'
          panel.hidden = true
          panel.setAttribute('role', 'dialog')
          panel.setAttribute('aria-label', 'Match controls')

          matchControlLabels.forEach(label => {
            const action = document.createElement('button')
            action.type = 'button'
            action.dataset.mdMatchControls = 'true'
            action.dataset.mdControlAction = normalise(label)
            action.textContent = label
            action.addEventListener('click', event => {
              event.preventDefault()
              event.stopPropagation()
              const source = findOriginalControl(board, label)
              if (!source) return
              activateOriginalControl(source)
              panel!.hidden = true
              tab?.setAttribute('aria-expanded', 'false')
              window.setTimeout(reconcileMatchControls, 50)
            })
            panel!.appendChild(action)
          })
          tabParent.appendChild(panel)
        }

        const syncPanel = () => {
          if (!tab || !panel) return
          panel.style.left = `${tab.offsetLeft + tab.offsetWidth + 8}px`
          panel.style.top = `${tab.offsetTop}px`
          panel.querySelectorAll<HTMLButtonElement>('[data-md-control-action]').forEach(action => {
            const source = findOriginalControl(board, action.textContent || '')
            action.disabled = !source
          })
        }
        syncPanel()

        if (tab.dataset.mdToggleBound !== 'true') {
          tab.dataset.mdToggleBound = 'true'
          tab.addEventListener('click', event => {
            event.preventDefault()
            event.stopPropagation()
            if (!panel) return
            panel.hidden = !panel.hidden
            tab?.setAttribute('aria-expanded', String(!panel.hidden))
            syncPanel()
          })
        }
      } finally {
        reconcilingControls = false
      }
    }

    const closeMatchControls = (event: Event) => {
      const target = event.target as Node | null
      const panel = host.querySelector<HTMLDivElement>('#md-match-control-panel')
      const tab = host.querySelector<HTMLButtonElement>('[data-md-control-tab="true"]')
      if (!panel || panel.hidden || !target || panel.contains(target) || tab?.contains(target)) return
      panel.hidden = true
      tab?.setAttribute('aria-expanded', 'false')
    }

    const closeMatchControlsOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const panel = host.querySelector<HTMLDivElement>('#md-match-control-panel')
      const tab = host.querySelector<HTMLButtonElement>('[data-md-control-tab="true"]')
      if (!panel || panel.hidden) return
      panel.hidden = true
      tab?.setAttribute('aria-expanded', 'false')
      tab?.focus()
    }

    const wakeLiveMatchEnhancers = () => {
      document.dispatchEvent(new Event('fullscreenchange'))
      document.dispatchEvent(new Event('webkitfullscreenchange'))
      window.dispatchEvent(new Event('resize'))
    }

    const liveMatchReady = () => {
      const board = host.querySelector<HTMLElement>('.md')
      if (!board) return false
      const stats = board.querySelector<HTMLElement>('.md-fs-stats')
      const kpiButton = [...board.querySelectorAll<HTMLButtonElement>('button')].find(button =>
        normalise(button.textContent || '').includes('KPI'),
      )
      return Boolean(
        board.querySelector('.md-scoreboard') &&
        board.querySelector('.md-ground') &&
        board.querySelector('.md-bench') &&
        stats && stats.childElementCount > 0 &&
        board.querySelector('.md-ai-coach-placeholder') &&
        kpiButton,
      )
    }

    const checkReady = () => {
      if (!mounted) return
      const elapsed = Date.now() - startedAt
      if ((elapsed >= MIN_LOADING_TIME && liveMatchReady()) || elapsed >= MAX_LOADING_TIME) setLoading(false)
    }

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
          ;['position','left','top','width','height','min-width','min-height','max-width','max-height','margin','transform','transform-origin']
            .forEach(property => board.style.removeProperty(property))
          reconcileMatchControls()
          checkReady()
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
        Object.assign(board.style, {
          position: 'absolute', left: '50%', top: '0', width: `${LIVE_WIDTH}px`, height: `${LIVE_HEIGHT}px`,
          minWidth: `${LIVE_WIDTH}px`, minHeight: `${LIVE_HEIGHT}px`, maxWidth: `${LIVE_WIDTH}px`,
          maxHeight: `${LIVE_HEIGHT}px`, margin: '0', transform: `translateX(-50%) scale(${safeScale})`,
          transformOrigin: 'top center',
        })
        reconcileMatchControls()
        checkReady()
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
        // The fitted layout remains available if native fullscreen is refused.
      }
      window.setTimeout(fitCanonicalLayout, 40)
    }

    fitCanonicalLayout()
    wakeLiveMatchEnhancers()
    reconcileMatchControls()

    const observer = new ResizeObserver(fitCanonicalLayout)
    observer.observe(host)
    const mutationObserver = new MutationObserver(() => {
      fitCanonicalLayout()
      reconcileMatchControls()
      checkReady()
    })
    mutationObserver.observe(host, { childList: true, subtree: true })

    host.addEventListener('click', handleFullscreenButton, true)
    document.addEventListener('pointerdown', closeMatchControls)
    document.addEventListener('keydown', closeMatchControlsOnEscape)
    window.addEventListener('resize', fitCanonicalLayout)
    window.addEventListener('orientationchange', fitCanonicalLayout)
    window.visualViewport?.addEventListener('resize', fitCanonicalLayout)
    window.visualViewport?.addEventListener('scroll', fitCanonicalLayout)
    document.addEventListener('fullscreenchange', fitCanonicalLayout)
    document.addEventListener('webkitfullscreenchange', fitCanonicalLayout as EventListener)

    const retries = [60, 240, 700].map(delay => window.setTimeout(() => {
      fitCanonicalLayout()
      wakeLiveMatchEnhancers()
      reconcileMatchControls()
    }, delay))
    const stageTwo = window.setTimeout(() => mounted && setLoadingStage(1), LOADING_STAGE_TIME)
    const stageThree = window.setTimeout(() => mounted && setLoadingStage(2), LOADING_STAGE_TIME * 2)
    const readinessPoll = window.setInterval(() => {
      wakeLiveMatchEnhancers()
      reconcileMatchControls()
      checkReady()
    }, 500)

    return () => {
      mounted = false
      window.cancelAnimationFrame(frame)
      retries.forEach(timer => window.clearTimeout(timer))
      window.clearTimeout(stageTwo)
      window.clearTimeout(stageThree)
      window.clearInterval(readinessPoll)
      observer.disconnect()
      mutationObserver.disconnect()
      host.removeEventListener('click', handleFullscreenButton, true)
      document.removeEventListener('pointerdown', closeMatchControls)
      document.removeEventListener('keydown', closeMatchControlsOnEscape)
      window.removeEventListener('resize', fitCanonicalLayout)
      window.removeEventListener('orientationchange', fitCanonicalLayout)
      window.visualViewport?.removeEventListener('resize', fitCanonicalLayout)
      window.visualViewport?.removeEventListener('scroll', fitCanonicalLayout)
      document.removeEventListener('fullscreenchange', fitCanonicalLayout)
      document.removeEventListener('webkitfullscreenchange', fitCanonicalLayout as EventListener)

      host.querySelectorAll<HTMLElement>('[data-md-consolidated-control="true"]').forEach(control => {
        const original = control.dataset.mdOriginalStyle
        if (original === '__empty__') control.removeAttribute('style')
        else if (original !== undefined) control.setAttribute('style', original)
        delete control.dataset.mdOriginalStyle
        delete control.dataset.mdConsolidatedControl
      })
      host.querySelectorAll<HTMLElement>('[data-md-match-controls="true"]').forEach(element => element.remove())
      host.querySelectorAll<HTMLElement>('[data-md-original-position]').forEach(element => {
        const original = element.dataset.mdOriginalPosition
        if (original === '__empty__') element.style.removeProperty('position')
        else if (original) element.style.position = original
        delete element.dataset.mdOriginalPosition
      })
      document.body.classList.remove('pf-match-day-focus')
      document.documentElement.classList.remove('pf-match-day-focus-root')
    }
  }, [])

  return (
    <div ref={hostRef} className="md-canonical-live-host">
      {children}
      {loading && (
        <div className="md-live-loading-overlay" role="status" aria-live="polite">
          <div className="md-live-loading-card">
            <div className="md-live-loading-ring" aria-hidden="true" />
            <span>PLAYFOOTY COACHING</span>
            <strong key={loadingStage}>{loadingStages[loadingStage]}</strong>
            <small>Live data can take up to 30 seconds to load.</small>
          </div>
        </div>
      )}
      {!loading && showFullscreenPrompt && (
        <div className="md-fullscreen-prompt-overlay" role="dialog" aria-modal="true" aria-labelledby="md-fullscreen-prompt-title">
          <div className="md-fullscreen-prompt-card">
            <span>PLAYFOOTY MATCH DAY</span>
            <strong id="md-fullscreen-prompt-title">Match Day works best in Full Screen</strong>
            <p>For the best coaching experience, open Match Day in full screen.</p>
            <button type="button" className="md-fullscreen-prompt-primary" onClick={enterFullscreenFromPrompt}>Enter Full Screen</button>
            <button type="button" className="md-fullscreen-prompt-secondary" onClick={dismissFullscreenPrompt}>Continue Anyway</button>
          </div>
        </div>
      )}
    </div>
  )
}
