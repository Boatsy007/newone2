import { useLocation } from 'react-router-dom'

/**
 * Site-wide desktop layout system.
 * Keeps existing page data and mobile behaviour intact while giving large screens
 * consistent shells, readable line lengths, deliberate grids and denser controls.
 */
export default function DesktopLayoutPolish() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/admin')) return null

  return <style>{`
    @media (min-width: 1100px) {
      :root {
        --pf-desktop-shell: min(1580px, calc(100vw - 72px));
        --pf-reading-width: 820px;
        --pf-desktop-gap: clamp(20px, 1.8vw, 32px);
      }

      body { font-size: 16px; }
      .pf-shell,.club-profile-shell,.league-profile-shell {
        width: var(--pf-desktop-shell) !important;
        max-width: 1580px !important;
        margin-inline: auto !important;
      }

      .rankings-page,.clubs-page,.leagues-page,.gk-page,.news-page,.article-page,.player-page,
      .sf-page,.notifications-page,.match-centre,.records-page,.highlights-page {
        width: 100% !important;
      }

      .rankings-page > *,.clubs-page > *,.leagues-page > *,.gk-page > *,
      .news-page > *,.article-page > *,.player-page > * {
        max-width: 1580px;
        margin-inline: auto;
      }

      /* Navigation: stable spacing at all desktop widths. */
      .pf-nav-inner {
        width: min(100%, 1720px) !important;
        max-width: 1720px !important;
        padding-inline: clamp(24px, 2.4vw, 46px) !important;
        gap: clamp(18px, 1.8vw, 32px) !important;
      }
      .pf-desktop-links { flex: 1 1 auto !important; justify-content: center !important; gap: clamp(13px, 1.25vw, 24px) !important; }
      .pf-desktop-links a { font-size: 13px !important; letter-spacing: .055em !important; }
      .pf-login-actions a { padding-inline: 13px !important; }

      /* Homepage. */
      .pf-hero-inner {
        grid-template-columns: minmax(440px, .82fr) minmax(620px, 1.18fr) !important;
        min-height: clamp(610px, 43vw, 750px) !important;
      }
      .pf-hero-art { min-height: clamp(610px, 43vw, 750px) !important; }
      .pf-hero-copy { padding-right: clamp(28px, 3vw, 58px) !important; }
      .pf-club-strip { display:grid !important;grid-template-columns:repeat(5,minmax(0,1fr)) !important;gap:clamp(14px,1.2vw,22px) !important;overflow:visible !important; }
      .pf-club-card { min-height: 250px; }
      .pf-feature-grid,.pf-data-grid { gap: clamp(18px,1.6vw,28px) !important; }
      .pf-feature-panel { min-height: 360px !important; }
      .pf-feature-content { max-width: 72% !important;padding:clamp(30px,3vw,48px) !important; }

      /* Rankings, leagues, clubs and records. */
      .rankings-layout,.clubs-layout,.leagues-layout { align-items:start;gap:var(--pf-desktop-gap) !important; }
      .rankings-table,.gk-board,.ladder-shell { width:100% !important; }
      .rankings-table { table-layout:auto !important; }
      .club-grid,.league-grid { grid-template-columns:repeat(4,minmax(0,1fr)) !important;gap:clamp(14px,1.3vw,22px) !important; }
      .top10-grid,.featured-strip,.story-row { grid-template-columns:repeat(3,minmax(0,1fr)) !important;gap:clamp(14px,1.3vw,22px) !important; }
      .rankings-sidebar,.clubs-sidebar,.leagues-sidebar { min-width:310px; }
      .filters-panel,.directory-toolbar,.ladder-toolbar { padding:18px !important; }
      .records-page main,.records-page .shell,.highlights-page main { width:var(--pf-desktop-shell) !important;max-width:1580px !important;margin-inline:auto !important; }

      /* Profiles: generous identity column, readable content column. */
      .club-profile-shell,.league-profile-shell { display:block; }
      .club-profile-shell main,.league-profile-shell main { min-width:0; }
      .player-page .player-profile-photo { width:min(100%,520px) !important; }
      .player-page .player-profile-photo img { height:clamp(330px,31vw,470px) !important;max-height:470px !important; }
      .player-page article p,.article-page article p,.article-page .article-body { max-width:var(--pf-reading-width); }

      /* News and article publication geometry. */
      .news-page .news-grid,.news-page .story-grid { grid-template-columns:repeat(3,minmax(0,1fr)) !important;gap:22px !important; }
      .article-page article,.article-page .article-shell { width:min(1180px,calc(100vw - 96px)) !important;margin-inline:auto !important; }
      .article-page .article-body { font-size:18px;line-height:1.72; }

      /* Supporter feed and notifications use the centre of the viewport, not a narrow mobile column. */
      .sf-shell { width:min(1240px,calc(100% - 72px)) !important; }
      .sf-content { display:grid;grid-template-columns:minmax(0,1fr); }
      .sf-list { grid-template-columns:repeat(2,minmax(0,1fr));gap:16px !important; }
      .sf-card-link { min-height:150px; }
      .notifications-page > main,.notifications-page .shell { width:min(1180px,calc(100vw - 72px)) !important;margin-inline:auto !important; }

      /* Matches and searchable data pages. */
      .match-centre > main,.match-centre .match-shell,.match-detail main { width:var(--pf-desktop-shell) !important;max-width:1580px !important;margin-inline:auto !important; }
      .match-centre .match-grid,.matches-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:18px !important; }

      /* Club portal. */
      .cp-dashboard,.cpa,.cpp,.club-newsroom,.club-sponsors,.club-users,.club-team-selection {
        padding-inline:clamp(28px,3vw,48px) !important;
      }
      .cp-dashboard > *,.cpa > *,.cpp > *,.club-newsroom > *,.club-sponsors > *,.club-users > *,.club-team-selection > * {
        max-width:1420px !important;
      }
      .cp-layout { grid-template-columns:minmax(0,1fr) 370px !important;gap:22px !important; }
      .cp-tools { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
      .cp-summary { gap:14px !important; }

      /* League portal. */
      .lpd > *,.lpp > *,.lpa > *,
      .league-dashboard-shell,.league-profile-page > *,
      .league-newsroom > header,.league-newsroom > .layout,
      .league-sponsors > header,.league-sponsors > .layout,
      .league-media > header,.league-media > .layout,
      .league-activity > *,.league-users > * {
        width:min(1420px,calc(100vw - 72px)) !important;
        max-width:1420px !important;
        margin-inline:auto !important;
      }
      .lpd .layout { grid-template-columns:minmax(0,1fr) 370px !important;gap:22px !important; }
      .lpd .tools { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
      .league-dashboard .card .actions { display:grid !important;grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
      .league-dashboard .card .actions a { justify-content:center;text-align:center; }

      /* Tables and forms: use horizontal space while retaining readable controls. */
      table { font-variant-numeric:tabular-nums; }
      input,select,textarea,button { min-height:42px; }
      .toolbar,.tools,.filters-panel { align-items:center; }
    }

    @media (min-width: 1100px) and (max-width: 1320px) {
      .pf-shell,.club-profile-shell,.league-profile-shell { width:min(100% - 48px,1580px) !important; }
      .pf-club-strip,.club-grid,.league-grid { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
      .top10-grid,.featured-strip,.story-row,.news-page .news-grid,.news-page .story-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
      .cp-tools,.lpd .tools,.league-dashboard .card .actions { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
      .sf-list { grid-template-columns:1fr; }
    }

    @media (min-width: 1600px) {
      .pf-nav-inner { padding-inline:44px !important; }
      .cp-tools,.lpd .tools { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
      .sf-shell { width:min(1360px,calc(100% - 96px)) !important; }
    }
  `}</style>
}
