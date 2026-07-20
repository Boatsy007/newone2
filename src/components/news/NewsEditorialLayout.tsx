import { useLocation } from 'react-router-dom'

/**
 * Keeps the public News page focused on editorial content.
 * Rankings, movers and league-strength dashboards belong on their dedicated pages.
 */
export default function NewsEditorialLayout() {
  const { pathname } = useLocation()
  if (pathname !== '/news') return null

  return <style>{`
    .news-page .news-sidebar {
      display: none !important;
    }

    .news-page .news-layout {
      grid-template-columns: minmax(0, 1fr) !important;
      max-width: 1180px;
      margin-inline: auto;
    }

    .news-page .news-main {
      width: 100%;
    }
  `}</style>
}
