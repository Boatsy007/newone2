import { useLocation } from 'react-router-dom'

export default function HomeTopPerformersLogoFix() {
  const { pathname } = useLocation()
  if (pathname !== '/') return null

  return <style>{`
    .pfleaders-feature-logo {
      width: 82px !important;
      height: 82px !important;
      right: 16px !important;
      bottom: 18px !important;
      padding: 8px !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      display: grid !important;
      place-items: center !important;
    }

    .pfleaders-feature-logo > * {
      width: 100% !important;
      height: 100% !important;
      max-width: 66px !important;
      max-height: 66px !important;
      object-fit: contain !important;
      object-position: center !important;
      margin: auto !important;
    }

    .pfleaders-feature-logo img,
    .pfleaders-feature-logo svg {
      width: 100% !important;
      height: 100% !important;
      max-width: 66px !important;
      max-height: 66px !important;
      object-fit: contain !important;
      object-position: center !important;
      margin: auto !important;
    }

    .pfleaders-list-logo {
      overflow: hidden !important;
      display: grid !important;
      place-items: center !important;
    }

    .pfleaders-list-logo > *,
    .pfleaders-list-logo img,
    .pfleaders-list-logo svg {
      width: 34px !important;
      height: 34px !important;
      max-width: 34px !important;
      max-height: 34px !important;
      object-fit: contain !important;
      object-position: center !important;
      margin: auto !important;
    }

    @media (max-width: 620px) {
      .pfleaders-feature {
        padding-right: 102px !important;
      }

      .pfleaders-feature-logo {
        width: 78px !important;
        height: 78px !important;
        right: 14px !important;
        bottom: 18px !important;
        padding: 9px !important;
      }

      .pfleaders-feature-logo > *,
      .pfleaders-feature-logo img,
      .pfleaders-feature-logo svg {
        max-width: 60px !important;
        max-height: 60px !important;
      }

      .pfleaders-list-logo > *,
      .pfleaders-list-logo img,
      .pfleaders-list-logo svg {
        width: 32px !important;
        height: 32px !important;
        max-width: 32px !important;
        max-height: 32px !important;
      }
    }
  `}</style>
}
