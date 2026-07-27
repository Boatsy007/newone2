import { useLocation } from 'react-router-dom'

/** Desktop-only page corrections. Existing data, routes and mobile layouts stay unchanged. */
export default function PublicDesktopPagePolish() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/admin')) return null

  return <style>{`
    @media (min-width: 1181px) {
      /* Homepage */
      .pf-hero-inner {
        min-height: clamp(620px, 46vw, 760px) !important;
        grid-template-columns: minmax(460px, .9fr) minmax(620px, 1.1fr) !important;
        column-gap: clamp(28px, 4vw, 72px) !important;
      }
      .pf-hero-copy { padding-block: clamp(54px, 5vw, 84px) !important; }
      .pf-hero-art { min-height: clamp(620px, 46vw, 760px) !important; }
      .pf-number-one { left: 4% !important; right: 0 !important; bottom: 38px !important; }
      .pf-feature-grid,.pf-data-grid { gap: clamp(20px, 2vw, 30px) !important; }
      .pf-feature-panel { min-height: 360px !important; }
      .pf-feature-content { max-width: 74% !important; padding: clamp(32px, 3vw, 48px) !important; }
      .pf-list-card { min-width: 0 !important; }

      /* Rankings, clubs, leagues and goal kickers */
      .rankings-page,.clubs-page,.leagues-page,.gk-page {
        width: min(1600px, calc(100% - 64px)) !important;
        margin-inline: auto !important;
      }
      .rankings-layout,.clubs-layout,.leagues-layout {
        grid-template-columns: minmax(0, 1fr) minmax(280px, 340px) !important;
        gap: clamp(22px, 2.4vw, 38px) !important;
      }
      .rankings-sidebar,.clubs-sidebar,.leagues-sidebar { min-width: 0 !important; }
      .top10-grid,.club-grid,.league-grid { gap: 18px !important; }
      .rankings-table,.gk-board { width: 100% !important; }
      .ladder-shell,.clubs-directory,.league-directory,.gk-board { overflow-x: auto !important; }

      /* Club and league profiles */
      .club-profile-shell,.league-profile-shell {
        width: min(1520px, calc(100% - 64px)) !important;
        max-width: 1520px !important;
        margin-inline: auto !important;
      }
      .club-profile-shell > main,.league-profile-shell > main,
      .club-profile-shell .profile-content,.league-profile-shell .profile-content {
        min-width: 0 !important;
      }
      .club-profile-shell .grid,.league-profile-shell .grid { gap: clamp(18px, 2vw, 30px) !important; }
      .club-profile-shell table,.league-profile-shell table { width: 100% !important; }

      /* Match Centre */
      .mc-shell { width: min(1500px, calc(100% - 64px)) !important; }
      .mc-hero { padding: 68px 0 62px !important; }
      .mc-hero h1 { font-size: clamp(5.6rem, 8vw, 9rem) !important; }
      .mc-filters {
        grid-template-columns: minmax(260px,1.6fr) minmax(105px,.55fr) minmax(180px,1fr) minmax(105px,.55fr) minmax(105px,.55fr) minmax(145px,.7fr) auto !important;
        gap: 12px !important;
        padding: 20px !important;
      }
      .mc-list { grid-template-columns: repeat(3,minmax(0,1fr)) !important; gap: 18px !important; }
      .mc-card-main { padding: 22px !important; }
      .mc-teams { min-height: 118px !important; }
      .mc-team strong { font-size: 16px !important; }
      .mc-group { margin-top: 32px !important; }

      /* News */
      .news-page {
        width: min(1560px, calc(100% - 64px)) !important;
        margin-inline: auto !important;
      }
      .news-header { padding-inline: 0 !important; }
      .featured-story {
        display: grid !important;
        grid-template-columns: minmax(0,1.35fr) minmax(360px,.65fr) !important;
        align-items: stretch !important;
        gap: clamp(24px, 3vw, 46px) !important;
      }
      .featured-image { min-height: 430px !important; }
      .featured-copy { padding: clamp(30px, 3vw, 48px) 0 !important; }
      .news-layout {
        grid-template-columns: minmax(0,1fr) minmax(300px,360px) !important;
        gap: clamp(26px, 3vw, 48px) !important;
      }
      .story-grid { grid-template-columns: repeat(3,minmax(0,1fr)) !important; gap: 20px !important; }
      .story-grid.compact { grid-template-columns: repeat(3,minmax(0,1fr)) !important; }
      .news-sidebar { min-width: 0 !important; }
      .side-card { width: 100% !important; }

      /* League and Club portal desktop pages */
      .league-dashboard-shell,.league-profile-shell,.league-news-shell,.league-sponsors-shell,
      .league-users-shell,.league-activity-shell,.league-media-shell,
      .club-portal-shell,.club-dashboard-shell {
        width: min(1440px, calc(100% - 64px)) !important;
        max-width: 1440px !important;
      }
      .league-dashboard .actions { display:grid !important; grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
      .league-dashboard .actions a { justify-content:center !important; text-align:center !important; }
    }

    @media (min-width: 1181px) and (max-width: 1380px) {
      .mc-list { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
      .story-grid,.story-grid.compact { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
      .featured-story { grid-template-columns: minmax(0,1.15fr) minmax(330px,.85fr) !important; }
      .league-dashboard .actions { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
    }
  `}</style>
}
