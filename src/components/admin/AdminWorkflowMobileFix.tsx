import { useLocation } from 'react-router-dom'

/** Shared responsive layout corrections for every Control Centre route. */
export default function AdminWorkflowMobileFix() {
  const { pathname } = useLocation()
  if (!pathname.startsWith('/admin')) return null

  return <style>{`
    @media (min-width: 1101px) {
      :root { --pf-admin-gap: clamp(16px,1.5vw,26px); }
      .aw .aws { grid-template-columns: 270px minmax(0,1fr) !important; }
      .aw .side { padding: 24px 17px !important; }
      .aw .content { max-width: 1540px !important; padding: 30px clamp(24px,2.6vw,44px) 70px !important; }
      .aw .top { height: 82px !important; padding-inline: clamp(26px,2.6vw,44px) !important; }
      .aw .hero { padding: clamp(34px,3vw,52px) !important; }
      .aw .hero h1 { font-size: clamp(5rem,6.8vw,8.2rem) !important; max-width: 1000px; }
      .aw .grid { grid-template-columns: repeat(4,minmax(0,1fr)) !important; gap: var(--pf-admin-gap) !important; }
      .aw .acts { grid-template-columns: repeat(3,minmax(0,1fr)) !important; gap: 14px !important; }
      .aw .toolbar { grid-template-columns: minmax(280px,1fr) auto auto !important; gap: 12px !important; padding: 16px !important; }
      .aw .list { gap: 12px !important; }
      .aw .row { grid-template-columns: 64px minmax(0,1fr) auto !important; padding: 16px 18px !important; }
      .aw .form { grid-template-columns: repeat(3,minmax(0,1fr)) !important; }
      .aw .form .wide { grid-column: 1/-1 !important; }
      .aw .editor { border-radius: 18px !important; }
      .aw .table { font-variant-numeric: tabular-nums; }

      .membership-admin,.rollout,.nd-page,.admin-health,.launch-readiness,.coverage-page,.maintenance-page {
        padding-inline: clamp(28px,3vw,52px) !important;
      }
      .membership-admin>header,.membership-admin>.notice-box,.membership-admin>.invite-box,.membership-admin>.toolbar,.membership-admin>.list,.membership-admin>.msg,
      .rollout>*,.nd-page>*,.admin-health>*,.launch-readiness>*,.coverage-page>*,.maintenance-page>* {
        max-width: 1480px !important; width: 100% !important; margin-left: auto !important; margin-right: auto !important;
      }
      .membership-admin .invite-box form { grid-template-columns: 1.35fr 1.35fr 1.2fr .8fr auto !important; }
      .membership-admin .list { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
      .membership-admin .list article { display:flex;flex-direction:column;min-height:310px; }
      .membership-admin .list footer { margin-top:auto; }
      .rollout .stats,.nd-stats { grid-template-columns: repeat(6,minmax(0,1fr)) !important; }
      .rollout .grid,.nd-grid { grid-template-columns:minmax(0,1.15fr) minmax(380px,.85fr) !important;gap:20px !important; }
      .rollout table,.nd-recent { font-variant-numeric:tabular-nums; }
      .rollout .organisations { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
      .rollout .bulk textarea { min-height:230px; }
    }

    @media (min-width: 1101px) and (max-width: 1320px) {
      .aw .acts { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
      .aw .form { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
      .membership-admin .list { grid-template-columns: 1fr !important; }
      .rollout .organisations { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
      .rollout .grid,.nd-grid { grid-template-columns:1fr !important; }
    }

    @media (max-width: 1100px) {
      html, body, #root { width: 100%; max-width: 100%; overflow-x: hidden; }
      .aw, .aws, .main, .content, .page { width: 100%; min-width: 0; max-width: 100%; }
      .aws { display: block !important; }
      .side { position:fixed !important;top:0 !important;bottom:0 !important;left:0 !important;width:min(86vw,340px) !important;height:100dvh !important;max-width:340px !important;transform:translateX(-105%) !important;transition:transform .22s ease !important;overflow-y:auto !important;overscroll-behavior:contain;box-shadow:18px 0 50px rgba(0,0,0,.35); }
      .side.open { transform: translateX(0) !important; }
      .shade.open { display:block !important;position:fixed !important;inset:0 !important;z-index:30 !important;background:rgba(0,0,0,.48) !important; }
      .main { width: 100% !important; }
      .top { height:72px !important;padding:0 16px !important;width:100% !important; }
      .top > div { min-width:0; }
      .top small { font-size:9px !important;line-height:1.2; }
      .top strong { font-size:25px !important;line-height:1; }
      .hamb { display:grid !important;place-items:center !important;flex:0 0 48px; }
      .content { width:100% !important;max-width:none !important;padding:16px 12px 42px !important;overflow-x:hidden !important; }
      .hero { width:100% !important;padding:26px 22px !important;border-radius:18px !important; }
      .hero h1 { font-size:clamp(3.2rem,16vw,5rem) !important;line-height:.88 !important;overflow-wrap:anywhere; }
      .hero p { font-size:16px !important;line-height:1.45 !important; }
      .grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:10px !important; }
      .stat { padding:16px !important;min-width:0 !important; }
      .stat b { font-size:34px !important; }
      .acts { grid-template-columns:1fr !important;gap:10px !important; }
      .act { width:100% !important;min-width:0 !important;grid-template-columns:44px minmax(0,1fr) 20px !important;padding:13px !important;font-size:17px !important; }
      .toolbar { grid-template-columns:1fr !important;width:100% !important; }
      .toolbar > * { width:100% !important;min-width:0 !important; }
      .states { flex-wrap:nowrap !important;overflow-x:auto !important;padding-bottom:4px;scrollbar-width:none; }
      .states::-webkit-scrollbar { display:none; }
      .states button { flex:0 0 auto; }
      .row { width:100% !important;min-width:0 !important;grid-template-columns:50px minmax(0,1fr) auto !important;gap:10px !important;padding:12px !important; }
      .row strong,.row small { overflow-wrap:anywhere; }
      .row button { white-space:nowrap;padding:9px 12px !important; }
      .rl { width:48px !important;height:48px !important; }
      .editor,.card,.table { width:100% !important;max-width:100% !important; }
      .eh { align-items:flex-start !important;flex-direction:column !important; }
      .eb { padding:16px !important; }
      .form { grid-template-columns:1fr !important; }
      .wide { grid-column:auto !important; }
      .inline { align-items:stretch !important; }
      .inline > * { max-width:100%; }
      .table { display:block;overflow-x:auto;-webkit-overflow-scrolling:touch; }
      .foot { padding-bottom:max(18px,env(safe-area-inset-bottom)); }
    }

    @media (max-width: 430px) {
      .grid { grid-template-columns:1fr 1fr !important; }
      .top { padding:0 12px !important; }
      .top strong { font-size:23px !important; }
      .content { padding-left:10px !important;padding-right:10px !important; }
      .hero { padding:24px 18px !important; }
      .row { grid-template-columns:46px minmax(0,1fr) !important; }
      .row > button { grid-column:1/-1;width:100%; }
    }
  `}</style>
}
