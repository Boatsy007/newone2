import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Reuses the existing homepage rankings hero inside the first carousel slide.
 * This preserves the original footballer artwork and live number-one club card
 * without duplicating or replacing the rankings data flow.
 */
export default function HomeHeroOriginalRanking() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname !== '/') return

    let active = true
    let observer: MutationObserver | null = null

    const apply = () => {
      if (!active) return false
      const original = document.querySelector<HTMLElement>('.pf-hero[data-pf-original-hero="true"]')
      const firstSlide = document.querySelector<HTMLElement>('#pf-home-hero-carousel-slot .pf-hero-carousel-slide:first-child')
      if (!original || !firstSlide) return false

      let mount = firstSlide.querySelector<HTMLElement>('[data-pf-original-ranking-clone="true"]')
      if (!mount) {
        firstSlide.replaceChildren()
        mount = document.createElement('div')
        mount.dataset.pfOriginalRankingClone = 'true'
        mount.className = 'pf-original-ranking-clone'
        firstSlide.appendChild(mount)
      }

      if (!mount.firstElementChild) {
        const clone = original.cloneNode(true) as HTMLElement
        clone.removeAttribute('data-pf-original-hero')
        clone.style.removeProperty('display')
        clone.style.display = 'block'
        mount.appendChild(clone)
      }

      return true
    }

    if (!apply()) {
      observer = new MutationObserver(() => {
        if (apply()) observer?.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      active = false
      observer?.disconnect()
      document.querySelector('[data-pf-original-ranking-clone="true"]')?.remove()
    }
  }, [pathname])

  if (pathname !== '/') return null

  return <style>{`
    .pf-original-ranking-clone,
    .pf-original-ranking-clone > .pf-hero {
      width: 100%;
      min-height: 640px;
    }
    .pf-original-ranking-clone > .pf-hero {
      display: block !important;
    }
    @media (max-width: 760px) {
      .pf-original-ranking-clone,
      .pf-original-ranking-clone > .pf-hero {
        min-height: 680px;
      }
    }
  `}</style>
}
