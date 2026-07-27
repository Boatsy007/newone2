import { useLocation } from 'react-router-dom'

/**
 * Additive desktop-only layout corrections.
 * Mobile and tablet component behaviour remains owned by the existing pages.
 */
export default function DesktopLayoutPolish() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/admin')) return null

  return <style>{`
    @media (min-width: 1100px) {
      :root { --pf-desktop-shell: min(1600px, calc(100vw - 72px)); }

      .pf-shell,
      .club-profile-shell,
      .league-profile-shell {
        width: var(--pf-desktop-shell) !important;
        max-width: 1600px !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      .rankings-page,
      .clubs-page,
      .leagues-page,
      .gk-page,
      .news-page,
      .article-page,
      .player-page {
        width: 100% !important;
      }

      .rankings-page > *,
      .clubs-page > *,
      .leagues-page > *,
      .gk-page > *,
      .news-page > *,
      .article-page > *,
      .player-page > * {
        max-width: 1600px;
        margin-left: auto;
        margin-right: auto;
      }

      .pf-hero-inner {
        grid-template-columns: minmax(470px, .82fr) minmax(620px, 1.18fr) !important;
        min-height: clamp(620px, 45vw, 760px) !important;
      }

      .pf-hero-art {
        min-height: clamp(620px, 45vw, 760px) !important;
      }

      .pf-hero-copy {
        padding-right: clamp(24px, 3vw, 56px) !important;
      }

      .pf-club-strip {
        display: grid !important;
        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        gap: clamp(14px, 1.2vw, 22px) !important;
        overflow: visible !important;
      }

      .pf-club-card {
        min-height: 250px;
      }

      .pf-feature-grid,
      .pf-data-grid {
        gap: clamp(18px, 1.6vw, 28px) !important;
      }

      .pf-feature-panel {
        min-height: 360px !important;
      }

      .pf-feature-content {
        max-width: 72% !important;
        padding: clamp(30px, 3vw, 48px) !important;
      }

      .rankings-layout,
      .clubs-layout,
      .leagues-layout {
        align-items: start;
        gap: clamp(22px, 2vw, 34px) !important;
      }

      .rankings-table,
      .gk-board,
      .ladder-shell {
        width: 100% !important;
      }

      .rankings-table {
        table-layout: auto !important;
      }

      .club-grid,
      .league-grid,
      .top10-grid,
      .featured-strip,
      .story-row {
        gap: clamp(14px, 1.3vw, 22px) !important;
      }

      .club-grid,
      .league-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      }

      .top10-grid,
      .featured-strip,
      .story-row {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }

      .league-dashboard-shell,
      .league-profile-page > *,
      .league-newsroom > header,
      .league-newsroom > .layout,
      .league-sponsors > header,
      .league-sponsors > .layout,
      .league-media > header,
      .league-media > .layout,
      .league-activity > *,
      .league-users > * {
        width: min(1320px, calc(100vw - 72px)) !important;
        max-width: 1320px !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      .league-dashboard .card .actions {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }

      .league-dashboard .card .actions a {
        justify-content: center;
        text-align: center;
      }
    }

    @media (min-width: 1100px) and (max-width: 1320px) {
      .pf-shell,
      .club-profile-shell,
      .league-profile-shell {
        width: min(100% - 48px, 1600px) !important;
      }

      .pf-club-strip {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }

      .club-grid,
      .league-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }

      .league-dashboard .card .actions {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
    }
  `}</style>
}
