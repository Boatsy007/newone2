import { useLocation } from 'react-router-dom'

export default function HomeHeroNumberOneMobileFix() {
  const { pathname } = useLocation()
  if (pathname !== '/') return null

  return <style>{`
    @media (max-width: 760px) {
      .pfhc-ranking-side {
        width: 100% !important;
        margin-top: auto !important;
      }

      .pfhc-ranking-label {
        margin-bottom: 10px !important;
        font-size: 10px !important;
        letter-spacing: .14em !important;
      }

      .pfhc-number-one {
        width: 100% !important;
        min-width: 0 !important;
        display: grid !important;
        grid-template-columns: 42px 58px minmax(0, 1fr) 64px !important;
        grid-template-areas: 'rank logo details rating' !important;
        align-items: center !important;
        gap: 10px !important;
        padding: 14px 12px !important;
        overflow: hidden !important;
      }

      .pfhc-number-one > .pfhc-number-badge {
        grid-area: rank !important;
        width: 40px !important;
        height: 40px !important;
        font-size: 27px !important;
      }

      .pfhc-number-one > img,
      .pfhc-number-one > span:not(.pfhc-number-badge):has(img),
      .pfhc-number-one > div:nth-of-type(1):has(img) {
        grid-area: logo !important;
        width: 58px !important;
        height: 58px !important;
        max-width: 58px !important;
        max-height: 58px !important;
        object-fit: contain !important;
      }

      .pfhc-number-one > div {
        grid-area: details !important;
        min-width: 0 !important;
        overflow: hidden !important;
      }

      .pfhc-number-one > div > strong {
        display: block !important;
        font-size: 19px !important;
        line-height: 1 !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        margin: 0 !important;
      }

      .pfhc-number-one > div > small {
        display: block !important;
        margin-top: 5px !important;
        font-size: 10px !important;
        line-height: 1.2 !important;
        white-space: normal !important;
      }

      .pfhc-number-one > div > em {
        display: block !important;
        margin-top: 6px !important;
        font-size: 11px !important;
        line-height: 1 !important;
      }

      .pfhc-number-one > b {
        grid-area: rating !important;
        justify-self: end !important;
        align-self: center !important;
        font-size: 31px !important;
        line-height: 1 !important;
        white-space: nowrap !important;
      }

      .pfhc-number-one svg,
      .pfhc-number-one picture,
      .pfhc-number-one picture img {
        max-width: 58px !important;
        max-height: 58px !important;
        object-fit: contain !important;
      }
    }
  `}</style>
}
