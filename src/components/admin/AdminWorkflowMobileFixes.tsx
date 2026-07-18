import { useLocation } from 'react-router-dom'

export default function AdminWorkflowMobileFixes() {
  const { pathname } = useLocation()
  if (pathname !== '/admin') return null

  return <style>{`
    @media (max-width: 820px) {
      html, body, #root { width: 100%; max-width: 100%; overflow-x: hidden; }
      .aw, .aw .aws, .aw .main, .aw .content, .aw .page { width: 100%; max-width: 100%; min-width: 0; }

      .aw .top {
        height: 72px;
        padding: 0 14px;
        gap: 12px;
      }
      .aw .top > div { min-width: 0; }
      .aw .top small {
        font-size: 9px;
        line-height: 1.2;
        letter-spacing: .11em;
        white-space: nowrap;
      }
      .aw .top strong {
        display: block;
        max-width: calc(100vw - 92px);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 24px;
        line-height: 1;
      }
      .aw .hamb {
        flex: 0 0 48px;
        width: 48px;
        height: 48px;
        padding: 0;
      }

      .aw .side {
        width: min(86vw, 330px);
        right: auto;
        inset: 0 auto 0 0;
        height: 100dvh;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding-bottom: max(22px, env(safe-area-inset-bottom));
        box-shadow: 24px 0 55px rgba(0,0,0,.38);
      }
      .aw .shade.open { z-index: 35; }
      .aw .side { z-index: 40; }
      .aw .logo img { width: 155px; max-width: 100%; }
      .aw .nav button, .aw .nav a { min-height: 48px; font-size: 16px; }

      .aw .content {
        padding: 14px 12px calc(36px + env(safe-area-inset-bottom));
      }
      .aw .page { gap: 14px; }
      .aw .hero {
        border-radius: 18px;
        padding: 24px 20px;
      }
      .aw .hero h1 {
        margin: 10px 0 8px;
        font-size: clamp(3.25rem, 17vw, 4.7rem);
        line-height: .86;
        overflow-wrap: anywhere;
      }
      .aw .hero p {
        margin: 0;
        font-size: 15px;
        line-height: 1.45;
      }

      .aw .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .aw .stat, .aw .card { padding: 16px; border-radius: 16px; min-width: 0; }
      .aw .stat span { font-size: 10px; line-height: 1.2; }
      .aw .stat b { font-size: 34px; margin-top: 8px; }

      .aw .acts { grid-template-columns: 1fr; gap: 9px; }
      .aw .act {
        width: 100%;
        min-width: 0;
        grid-template-columns: 42px minmax(0, 1fr) 20px;
        min-height: 68px;
        padding: 12px;
        font-size: 17px;
      }
      .aw .act i { width: 42px; height: 42px; }
      .aw .act span { min-width: 0; overflow-wrap: anywhere; }

      .aw .states {
        flex-wrap: nowrap;
        overflow-x: auto;
        padding: 2px 1px 7px;
        margin: 0 -1px;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .aw .states::-webkit-scrollbar { display: none; }
      .aw .states button { flex: 0 0 auto; white-space: nowrap; }

      .aw .toolbar {
        grid-template-columns: 1fr;
        gap: 9px;
        padding: 12px;
      }
      .aw .toolbar input, .aw .toolbar select, .aw .toolbar button {
        width: 100%;
        min-width: 0;
      }

      .aw .list { gap: 9px; }
      .aw .row {
        width: 100%;
        min-width: 0;
        grid-template-columns: 48px minmax(0,1fr) auto;
        gap: 10px;
        padding: 12px;
        border-radius: 14px;
      }
      .aw .rl { width: 48px; height: 48px; border-radius: 12px; }
      .aw .row > div:nth-child(2) { min-width: 0; }
      .aw .row strong {
        min-width: 0;
        font-size: 16px;
        line-height: 1.15;
        overflow-wrap: anywhere;
      }
      .aw .row small {
        display: block;
        margin-top: 3px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .aw .row > button, .aw .row > a {
        flex: 0 0 auto;
        padding: 9px 12px !important;
        font-size: 12px;
      }

      .aw .editor { border-radius: 16px; }
      .aw .eh {
        align-items: flex-start;
        flex-direction: column;
        padding: 16px;
      }
      .aw .eh h2 { margin: 0; overflow-wrap: anywhere; }
      .aw .eb { padding: 15px; gap: 15px; }
      .aw .form { grid-template-columns: 1fr; gap: 11px; }
      .aw .wide { grid-column: auto; }
      .aw .field, .aw .field input, .aw .field textarea, .aw .field select { width: 100%; min-width: 0; }
      .aw .inline { align-items: stretch; flex-direction: column; }
      .aw .inline > * { width: 100%; }

      .aw .table {
        display: block;
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .aw .table th, .aw .table td { white-space: nowrap; }
      .aw .empty { padding: 24px 16px; }
      .aw .toast {
        left: 12px;
        right: 12px;
        bottom: calc(12px + env(safe-area-inset-bottom));
        text-align: center;
      }
    }

    @media (max-width: 430px) {
      .aw .grid { grid-template-columns: 1fr 1fr; }
      .aw .stat { padding: 14px; }
      .aw .stat b { font-size: 31px; }
      .aw .hero h1 { font-size: clamp(3rem, 18vw, 4.25rem); }
      .aw .row { grid-template-columns: 44px minmax(0,1fr) auto; }
      .aw .rl { width: 44px; height: 44px; }
    }
  `}</style>
}
