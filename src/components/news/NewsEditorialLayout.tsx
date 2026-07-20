import { useLocation } from 'react-router-dom'

/**
 * Keeps the public News page focused entirely on editorial content.
 * Rankings, movers and league-strength dashboards remain on their dedicated pages.
 */
export default function NewsEditorialLayout() {
  const { pathname } = useLocation()
  if (pathname !== '/news') return null

  return <style>{`
    body .news-page .news-sidebar,
    body .news-page aside.news-sidebar {
      display: none !important;
      visibility: hidden !important;
      width: 0 !important;
      height: 0 !important;
      overflow: hidden !important;
    }

    body .news-page .news-layout {
      display: block !important;
      grid-template-columns: none !important;
      max-width: 1180px !important;
      margin-inline: auto !important;
    }

    body .news-page .news-main {
      width: 100% !important;
      max-width: none !important;
    }
  `}</style>
}
