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
      :root {
        --pf-desktop-wide: min(1440px, calc(100vw - 72px));
        --pf-desktop-standard: min(1240px, calc(100vw - 72px));
        --pf-desktop-reading: min(820px, calc(100vw - 72px));
        --pf-desktop-gutter: 36px;
        --pf-section-gap: 24px;
        --pf-card-pad: 24px;
      }

      body {
        text-rendering: optimizeLegibility;
      }

      .pf-shell,
      .club-profile-shell,
      .league-profile-shell {
        width: var(--pf-desktop-wide) !important;
        max-width: 1440px !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      .club-profile-area {
        max-width: 1240px !important;
        padding-left: 32px !important;
        padding-right: 32px !important;
        gap: var(--pf-section-gap) !important;
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
        max-width: 1440px;
        margin-left: auto;
        margin-right: auto;
      }

      .article-page article,
      .article-page .article-body,
      .news-article-body {
        max-width: 820px !important;
      }

      #main-content p,
      #main-content li,
      #main-content td,
      #main-content input,
      #main-content select,
      #main-content textarea {
        font-size: max(15px, 1rem);
      }

      #main-content small,
      #main-content .font-condensed {
        letter-spacing: .025em;
      }

      #main-content .font-condensed {
        font-weight: 650;
      }

      #main-content [style*="font-size: 10px"],
      #main-content [style*="fontSize: 10"],
      #main-content [style*="font-size: 11px"] {
        letter-spacing: .08em !important;
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
        gap: clamp(16px, 1.25vw, 22px) !important;
        overflow: visible !important;
      }

      .pf-club-card {
        min-height: 250px;
      }

      .pf-feature-grid,
      .pf-data-grid {
        gap: var(--pf-section-gap) !important;
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
        gap: clamp(24px, 2vw, 34px) !important;
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
        gap: clamp(16px, 1.3vw, 22px) !important;
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

      .gn-card,
      .club-feed-card,
      .club-info-panel,
      .club-stats-stack > section {
        border-radius: 12px;
      }

      .club-stats-stack,
      .club-info-stack,
      .club-shared-live,
      .club-team-selection-stack {
        gap: var(--pf-section-gap) !important;
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
        width: var(--pf-desktop-standard) !important;
        max-width: 1240px !important;
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
      :root {
        --pf-desktop-gutter: 24px;
      }

      .pf-shell,
      .club-profile-shell,
      .league-profile-shell {
        width: min(100% - 48px, 1440px) !important;
      }

      .club-profile-area {
        padding-left: 24px !important;
        padding-right: 24px !important;
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