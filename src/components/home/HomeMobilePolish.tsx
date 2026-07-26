import { useLocation } from 'react-router-dom'

/** Final mobile-only homepage presentation layer. No data or navigation behaviour changes. */
export default function HomeMobilePolish() {
  const { pathname } = useLocation()
  if (pathname !== '/') return null

  return <style>{`
    @media (max-width: 760px) {
      html, body, #root {
        max-width: 100%;
        overflow-x: clip;
      }

      .pf-home {
        width: 100%;
        overflow-x: clip;
      }

      .pf-shell {
        width: calc(100% - 24px) !important;
        max-width: none !important;
      }

      /* News hero */
      #pf-home-hero-carousel-slot,
      .pf-hero-carousel,
      .pf-hero-carousel-track,
      .pf-hero-carousel-slide {
        width: 100% !important;
        max-width: 100% !important;
      }

      .pf-hero-carousel-slide,
      .pfhc-news,
      .pfhc-feature {
        min-height: min(690px, calc(100svh - 62px)) !important;
      }

      .pfhc-news-image img {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
      }

      .pfhc-news-copy,
      .pfhc-feature-copy {
        min-height: min(690px, calc(100svh - 62px)) !important;
        justify-content: flex-end !important;
        padding-top: 84px !important;
        padding-bottom: 78px !important;
      }

      .pfhc-news h2,
      .pfhc-feature h2 {
        max-width: 100% !important;
        margin-top: 11px !important;
        font-size: clamp(3rem, 15vw, 4.25rem) !important;
        line-height: .86 !important;
        overflow-wrap: anywhere;
      }

      .pfhc-news-copy > p,
      .pfhc-feature-copy > p {
        max-width: 100% !important;
        margin-bottom: 19px !important;
        font-size: 14px !important;
        line-height: 1.42 !important;
      }

      .pfhc-news-copy > b,
      .pfhc-feature-copy > b {
        min-height: 44px;
        padding: 12px 16px !important;
      }

      .pf-hero-carousel-controls {
        bottom: 18px !important;
        width: calc(100% - 32px);
        justify-content: center;
      }

      .pf-hero-carousel-controls button {
        flex: 1 1 0;
        width: auto !important;
        max-width: 54px;
        min-height: 7px;
      }

      /* Consistent section spacing and headings */
      #pf-home-mvp-slot,
      .pf-feature-grid > .pf-featured-games,
      .pf-feature-grid > .pf-featured-highlights,
      .pf-player-records-home,
      .pf-records-home {
        scroll-margin-top: 76px;
      }

      .pfleaders-head,
      .pf-featured-games > header,
      .pf-featured-highlights > header,
      .pf-player-records-head,
      .pf-records-head,
      .pf-section-head {
        min-width: 0;
      }

      .pfleaders-head h2,
      .pf-featured-games h2,
      .pf-featured-highlights h2,
      .pf-player-records-head h2,
      .pf-records-head h2,
      .pf-section-head h2 {
        max-width: 100%;
        font-size: clamp(2.55rem, 12vw, 3.35rem) !important;
        line-height: .88 !important;
        overflow-wrap: anywhere;
      }

      .pf-featured-games > header,
      .pf-featured-highlights > header {
        margin-left: 12px !important;
        margin-right: 12px !important;
      }

      .pf-featured-games header > a,
      .pf-featured-highlights header > a,
      .pf-section-head > a {
        flex: 0 0 auto;
        min-height: 36px;
        display: inline-flex;
        align-items: center;
      }

      /* Every swipe row uses the same gutter and visible next-card cue */
      .pfleaders-row,
      .pf-featured-games-row,
      .pf-featured-highlights-row,
      .pf-player-records-strip,
      .pf-records-strip {
        width: 100% !important;
        max-width: 100% !important;
        gap: 12px !important;
        overscroll-behavior-x: contain;
        scroll-snap-type: x mandatory !important;
        scroll-padding-left: 12px !important;
        padding-left: 12px !important;
        padding-right: 12px !important;
        padding-bottom: 12px !important;
        box-sizing: border-box;
      }

      .pfleaders-card,
      .pf-featured-game-card,
      .pf-featured-highlight-card,
      .pf-player-record-card,
      .pf-record-card {
        scroll-snap-align: start !important;
        scroll-snap-stop: always;
        flex-basis: calc(100vw - 42px) !important;
        width: calc(100vw - 42px) !important;
        max-width: 420px !important;
        min-width: 0 !important;
        border-radius: 14px !important;
      }

      /* Top performers */
      .pfleaders {
        width: 100% !important;
        padding-bottom: 38px !important;
      }

      .pfleaders-head {
        width: calc(100% - 24px);
        margin-left: auto;
        margin-right: auto;
      }

      .pfleaders-feature {
        min-height: 188px !important;
        padding: 20px 96px 18px 17px !important;
      }

      .pfleaders-feature-copy > strong {
        font-size: 49px !important;
      }

      .pfleaders-feature-copy > b {
        max-width: 100%;
        margin-top: 18px !important;
        font-size: 25px !important;
        overflow-wrap: anywhere;
      }

      .pfleaders-feature-copy > em {
        max-width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .pfleaders-feature-logo {
        right: 12px !important;
        bottom: 15px !important;
        width: 72px !important;
        height: 72px !important;
        padding: 8px !important;
        border-radius: 15px !important;
        overflow: hidden !important;
      }

      .pfleaders-feature-logo > *,
      .pfleaders-feature-logo img,
      .pfleaders-feature-logo svg {
        width: 54px !important;
        height: 54px !important;
        max-width: 54px !important;
        max-height: 54px !important;
        object-fit: contain !important;
        object-position: center !important;
        margin: auto !important;
      }

      .pfleaders-list-row {
        grid-template-columns: 46px minmax(0, 1fr) auto !important;
        gap: 8px !important;
        min-height: 62px !important;
        padding: 7px 11px !important;
      }

      .pfleaders-list-logo {
        width: 40px !important;
        height: 40px !important;
      }

      .pfleaders-list-logo > *,
      .pfleaders-list-logo img,
      .pfleaders-list-logo svg {
        width: 30px !important;
        height: 30px !important;
        max-width: 30px !important;
        max-height: 30px !important;
        object-fit: contain !important;
      }

      .pfleaders-list-player strong {
        font-size: 14px !important;
      }

      .pfleaders-list-row > b {
        max-width: 70px !important;
        font-size: 15px !important;
      }

      /* Featured games */
      .pf-featured-game-top {
        padding: 13px 10px 10px !important;
      }

      .pf-featured-game-context {
        min-height: 38px;
      }

      .pf-featured-game-teams {
        grid-template-columns: minmax(0, 1fr) 42px minmax(0, 1fr) !important;
        gap: 6px !important;
        margin-top: 11px !important;
      }

      .pf-featured-game-logo {
        width: 70px !important;
        height: 70px !important;
        padding: 8px !important;
        border-radius: 15px !important;
      }

      .pf-featured-game-logo img,
      .pf-featured-game-logo svg {
        width: 52px !important;
        height: 52px !important;
        max-width: 52px !important;
        max-height: 52px !important;
        object-fit: contain !important;
      }

      .pf-featured-game-teams strong {
        max-width: 100%;
        font-size: clamp(1.28rem, 6.5vw, 1.65rem) !important;
        overflow-wrap: anywhere;
      }

      .pf-featured-game-teams > b {
        width: 40px !important;
        height: 40px !important;
        font-size: 23px !important;
      }

      .pf-featured-game-metrics {
        padding-left: 11px !important;
        padding-right: 11px !important;
      }

      .pf-game-metric > div:first-child {
        grid-template-columns: minmax(55px, 1fr) minmax(100px, 1.35fr) minmax(55px, 1fr) !important;
      }

      .pf-game-metric strong {
        font-size: 14px !important;
      }

      .pf-game-metric span {
        font-size: 11px !important;
      }

      .pf-featured-game-card footer a {
        min-width: 0;
        padding: 13px 6px !important;
        font-size: 10px !important;
        overflow-wrap: anywhere;
      }

      /* Highlights */
      .pf-featured-highlight-media {
        aspect-ratio: 16 / 9 !important;
      }

      .pf-featured-highlight-player {
        left: 13px !important;
        right: 56px !important;
        bottom: 13px !important;
        font-size: clamp(2rem, 10vw, 2.65rem) !important;
        overflow-wrap: anywhere;
      }

      .pf-featured-highlight-play {
        width: 50px !important;
        height: 50px !important;
      }

      .pf-featured-highlight-club {
        min-height: 68px;
        padding: 10px 12px !important;
      }

      .pf-featured-highlight-club > a,
      .pf-featured-highlight-empty-logo {
        flex-basis: 46px !important;
        width: 46px !important;
        height: 46px !important;
      }

      .pf-featured-highlight-club img,
      .pf-featured-highlight-club svg {
        max-width: 39px !important;
        max-height: 39px !important;
        object-fit: contain !important;
      }

      /* Records and share controls */
      .pf-player-record-card,
      .pf-record-card {
        padding-bottom: 54px !important;
      }

      .pf-player-record-card > .pf-auto-share,
      .pf-record-card > .pf-auto-share,
      .pfleaders-card > .pf-auto-share,
      .pf-featured-highlight-card > .pf-auto-share,
      .pf-featured-game-card > .pf-auto-share {
        top: auto !important;
        right: 10px !important;
        bottom: 10px !important;
        z-index: 4 !important;
      }

      /* Base homepage panels below portals */
      .pf-feature-grid,
      .pf-data-grid {
        width: calc(100% - 24px) !important;
        grid-template-columns: 1fr !important;
        gap: 14px !important;
      }

      .pf-feature-panel {
        min-height: 260px !important;
      }

      .pf-feature-content {
        max-width: 88% !important;
        padding: 23px !important;
      }

      .pf-band-inner {
        align-items: flex-start !important;
        flex-direction: column !important;
        gap: 14px !important;
      }

      /* Clear, stable loading states */
      .pfleaders-skeleton,
      .pf-featured-game-card.is-placeholder,
      .pf-featured-highlight-card.is-placeholder {
        min-height: 420px;
      }

      img[loading='lazy'] {
        content-visibility: auto;
      }
    }

    @media (max-width: 380px) {
      .pfleaders-card,
      .pf-featured-game-card,
      .pf-featured-highlight-card,
      .pf-player-record-card,
      .pf-record-card {
        flex-basis: calc(100vw - 30px) !important;
        width: calc(100vw - 30px) !important;
      }

      .pfleaders-row,
      .pf-featured-games-row,
      .pf-featured-highlights-row,
      .pf-player-records-strip,
      .pf-records-strip {
        padding-left: 8px !important;
        padding-right: 8px !important;
      }

      .pfhc-news h2,
      .pfhc-feature h2 {
        font-size: 2.85rem !important;
      }
    }
  `}</style>
}
