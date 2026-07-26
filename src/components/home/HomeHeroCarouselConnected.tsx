import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { allArticles, loadPublished } from '../../news/content'
import { useHomeData } from './useHomeData'
import HomeHeroCarousel from './HomeHeroCarousel'
import HomeHeroNumberOneMobileFix from './HomeHeroNumberOneMobileFix'

type PublicArticle = { slug: string; tags?: Record<string, unknown> }

export default function HomeHeroCarouselConnected() {
  const { pathname } = useLocation()
  const home = useHomeData()
  const [newsReady, setNewsReady] = useState(false)

  useEffect(() => {
    if (pathname !== '/') { setNewsReady(false); return }
    let active = true
    let restoreTimer = 0
    const changed: Array<{ article: ReturnType<typeof allArticles>[number]; heroSeed: string }> = []

    void Promise.all([
      loadPublished(),
      fetch('/api/news').then(response => response.ok ? response.json() : { data: [] }) as Promise<{ data?: PublicArticle[] }>,
    ]).then(([, payload]) => {
      if (!active) return
      const featured = new Set((payload.data ?? [])
        .filter(article => article.tags?.homepageFeatured === true)
        .map(article => article.slug))

      for (const article of allArticles()) {
        article.featured = featured.has(article.slug)
        if (!article.featured) {
          changed.push({ article, heroSeed: article.heroSeed })
          article.heroSeed = ''
        }
      }

      setNewsReady(true)
      restoreTimer = window.setTimeout(() => {
        for (const item of changed) item.article.heroSeed = item.heroSeed
      }, 1000)
    }).catch(() => { if (active) setNewsReady(true) })

    return () => {
      active = false
      window.clearTimeout(restoreTimer)
      for (const item of changed) item.article.heroSeed = item.heroSeed
    }
  }, [pathname])

  if (pathname !== '/') return null
  return <>
    <style>{`.pf-hero{display:none!important}`}</style>
    {newsReady && <>
      <HomeHeroCarousel top={home.entries[0]} updatedAt={home.generatedAt} />
      <HomeHeroNumberOneMobileFix />
    </>}
  </>
}
