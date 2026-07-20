import { useLocation } from 'react-router-dom'

/** Visual polish for the existing live league ladder without changing its data or links. */
export default function LeagueLadderPolish() {
  const { pathname } = useLocation()
  if (!pathname.startsWith('/league/')) return null

  return <style>{`
    .league-profile-page #ladder {
      --pf-ladder-navy: #071a34;
      --pf-ladder-blue: #25aef3;
      --pf-ladder-line: #dfe7f0;
      --pf-ladder-muted: #6f7d91;
    }

    .league-profile-page #ladder > div:last-of-type > .gn-card,
    .league-profile-page #ladder .gn-card:has(.lad-grid) {
      border: 1px solid var(--pf-ladder-line) !important;
      border-radius: 18px !important;
      background: #fff !important;
      box-shadow: 0 16px 38px rgba(7, 26, 52, .09) !important;
      overflow: hidden !important;
    }

    .league-profile-page #ladder .lad-grid:first-child {
      min-height: 48px;
      padding-block: 14px !important;
      border-bottom: 0 !important;
      background: var(--pf-ladder-navy) !important;
      color: rgba(255,255,255,.72) !important;
      letter-spacing: .16em !important;
    }

    .league-profile-page #ladder button.gn-row {
      position: relative;
      min-height: 74px;
      padding-block: 14px !important;
      border-left-width: 4px !important;
      transition: background .16s ease, transform .16s ease, box-shadow .16s ease;
    }

    .league-profile-page #ladder button.gn-row:hover {
      background: #f7fbff !important;
      transform: translateY(-1px);
      box-shadow: inset 0 1px 0 rgba(37,174,243,.1), inset 0 -1px 0 rgba(37,174,243,.1);
    }

    .league-profile-page #ladder button.gn-row:focus-visible {
      outline: 3px solid rgba(37,174,243,.34);
      outline-offset: -3px;
      z-index: 2;
    }

    .league-profile-page #ladder button.gn-row > .font-display:first-child {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      justify-content: center;
      background: #eef4f9;
      color: var(--pf-ladder-navy) !important;
      font-size: 18px !important;
    }

    .league-profile-page #ladder button.gn-row:first-of-type > .font-display:first-child {
      background: linear-gradient(145deg,#f8dc83,#b98518 58%,#f4cf66);
      color: #342100 !important;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 4px 10px rgba(126,87,8,.2);
    }

    .league-profile-page #ladder button.gn-row > span:nth-child(2) > span:last-child > .font-display {
      color: var(--pf-ladder-navy) !important;
      letter-spacing: -.02em;
    }

    .league-profile-page #ladder button.gn-row > span:last-child {
      color: var(--pf-ladder-blue) !important;
      font-size: 22px !important;
    }

    .league-profile-page #ladder button.gn-row img {
      background: #fff;
      border: 1px solid #e5ebf2;
      border-radius: 50%;
      padding: 2px;
    }

    .league-profile-page #ladder .gn-card > div:last-child:not(.lad-grid) {
      background: #f7f9fc;
      border-top: 1px solid var(--pf-ladder-line);
      padding-block: 13px !important;
    }

    @media (max-width: 820px) {
      .league-profile-page #ladder .gn-card:has(.lad-grid) {
        border-radius: 16px !important;
      }

      .league-profile-page #ladder .lad-grid:first-child {
        grid-template-columns: 38px minmax(0,1fr) 68px !important;
        min-height: 42px;
        padding: 11px 12px !important;
      }

      .league-profile-page #ladder .lad-grid:first-child > span:nth-child(n+3):not(:last-child) {
        display: none !important;
      }

      .league-profile-page #ladder button.gn-row {
        grid-template-columns: 38px minmax(0,1fr) 68px !important;
        min-height: 82px;
        padding: 13px 12px !important;
        gap: 9px !important;
      }

      .league-profile-page #ladder button.gn-row > .font-display:first-child {
        width: 32px;
        height: 32px;
        border-radius: 9px;
      }

      .league-profile-page #ladder button.gn-row > span:nth-child(2) {
        gap: 9px !important;
      }

      .league-profile-page #ladder button.gn-row > span:nth-child(2) > span:last-child > .font-display {
        font-size: 15px !important;
      }

      .league-profile-page #ladder button.gn-row > span:nth-child(2) > span:last-child > .font-condensed {
        font-size: 10px !important;
        max-width: 100%;
      }

      .league-profile-page #ladder button.gn-row > span:last-child {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: center;
        line-height: 1;
      }

      .league-profile-page #ladder .gn-card > div:last-child:not(.lad-grid) {
        gap: 10px !important;
        padding-inline: 14px !important;
        font-size: 9.5px !important;
      }
    }
  `}</style>
}
