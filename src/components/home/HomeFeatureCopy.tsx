import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function HomeFeatureCopy() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname !== '/') return

    const apply = () => {
      const content = document.querySelector<HTMLElement>('.pf-fixtures-panel .pf-feature-content')
      const heading = content?.querySelector('h2')
      const description = content?.querySelector('p')
      if (!heading || !description) return false

      heading.innerHTML = 'Fixtures &amp;<br><em>results</em>'
      description.textContent = 'Find leagues, ladders, clubs, upcoming fixtures and published results.'
      return true
    }

    if (apply()) return
    const observer = new MutationObserver(() => {
      if (apply()) observer.disconnect()
    })
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])

  return null
}
