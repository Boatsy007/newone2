import { useLocation } from 'react-router-dom'

/** Homepage presentation corrections. Data and card behaviour stay unchanged. */
export default function HomeDesktopPolish() {
  const { pathname } = useLocation()
  if (pathname !== '/') return null

  return <style>{`
    .pf-club-card:nth-child(1) .pf-rank-chip {
      color: #211400 !important;
      background: linear-gradient(145deg, #fff4a8 0%, #dca72d 24%, #fff0a0 46%, #b87812 70%, #f5d66b 100%) !important;
      border: 1px solid #8d5b08 !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.82), inset 0 -2px 4px rgba(92,49,0,.28), 0 4px 10px rgba(151,91,0,.24) !important;
      text-shadow: 0 1px 0 rgba(255,255,255,.55) !important;
    }

    .pf-club-card:nth-child(2) .pf-rank-chip {
      color: #1b2025 !important;
      background: linear-gradient(145deg, #ffffff 0%, #bfc5cb 24%, #f5f7f9 47%, #8f969d 70%, #d9dde1 100%) !important;
      border: 1px solid #727980 !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.95), inset 0 -2px 4px rgba(38,45,52,.22), 0 4px 10px rgba(74,82,90,.2) !important;
      text-shadow: 0 1px 0 rgba(255,255,255,.72) !important;
    }

    .pf-club-card:nth-child(3) .pf-rank-chip {
      color: #2b1508 !important;
      background: linear-gradient(145deg, #ffd6a0 0%, #b96b2d 24%, #efb36f 47%, #7f3f17 70%, #d98b4a 100%) !important;
      border: 1px solid #6f3513 !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.62), inset 0 -2px 4px rgba(73,31,7,.3), 0 4px 10px rgba(110,55,18,.22) !important;
      text-shadow: 0 1px 0 rgba(255,255,255,.4) !important;
    }

    @media (min-width: 981px) {
      .pf-player-records-strip,
      .pf-records-strip {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(0, 1fr)) !important;
        gap: 14px !important;
        overflow: visible !important;
        width: 100% !important;
      }

      .pf-player-record-card,
      .pf-record-card {
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        flex: none !important;
        padding-bottom: 58px !important;
      }

      .pf-player-record-card > .pf-auto-share,
      .pf-record-card > .pf-auto-share {
        top: auto !important;
        right: 12px !important;
        bottom: 12px !important;
      }

      .pf-nav-inner {
        width: 100% !important;
        max-width: none !important;
        padding-left: clamp(24px, 3vw, 58px) !important;
        padding-right: clamp(24px, 3vw, 58px) !important;
        gap: clamp(24px, 2.4vw, 44px) !important;
      }

      .pf-desktop-links {
        flex: 1 1 auto !important;
        justify-content: space-evenly !important;
        gap: clamp(18px, 1.8vw, 34px) !important;
        margin-left: 0 !important;
      }

      .pf-desktop-links a {
        font-size: 15px !important;
        letter-spacing: .065em !important;
      }

      .pf-nav-actions {
        flex: 0 0 auto !important;
      }
    }

    @media (min-width: 981px) and (max-width: 1280px) {
      .pf-player-records-strip,
      .pf-records-strip {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }
    }
  `}</style>
}
