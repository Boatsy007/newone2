import { useLocation } from 'react-router-dom'
import { useHomeData } from './useHomeData'
import HomeHeroCarousel from './HomeHeroCarousel'

export default function HomeHeroCarouselConnected() {
  const { pathname } = useLocation()
  const home = useHomeData()
  if (pathname !== '/') return null
  return <HomeHeroCarousel top={home.entries[0]} updatedAt={home.generatedAt} />
}
