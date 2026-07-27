import { useLocation } from 'react-router-dom'

/** Desktop-only density and width rules for all Control Centre screens. */
export default function AdminDesktopPolish(){
 const{pathname}=useLocation()
 if(!pathname.startsWith('/admin'))return null
 return <style>{`
  @media(min-width:1100px){
   :root{--pf-admin-shell:min(1540px,calc(100vw - 310px));--pf-admin-gap:clamp(16px,1.5vw,26px)}
   .aw .aws{grid-template-columns:270px minmax(0,1fr)!important}
   .aw .side{padding:24px 17px!important}
   .aw .content{max-width:1540px!important;padding:30px clamp(24px,2.6vw,44px) 70px!important}
   .aw .top{height:82px!important;padding-inline:clamp(26px,2.6vw,44px)!important}
   .aw .hero{padding:clamp(34px,3vw,52px)!important}
   .aw .hero h1{font-size:clamp(5rem,6.8vw,8.2rem)!important;max-width:1000px}
   .aw .grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:var(--pf-admin-gap)!important}
   .aw .acts{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px!important}
   .aw .toolbar{grid-template-columns:minmax(280px,1fr) auto auto!important;gap:12px!important;padding:16px!important}
   .aw .list{gap:12px!important}
   .aw .row{grid-template-columns:64px minmax(0,1fr) auto!important;padding:16px 18px!important}
   .aw .form{grid-template-columns:repeat(3,minmax(0,1fr))!important}
   .aw .form .wide{grid-column:1/-1!important}
   .aw .editor{border-radius:18px!important}
   .aw .table{font-variant-numeric:tabular-nums}

   .membership-admin,.rollout,.nd-page,.admin-health,.launch-readiness,.coverage-page,.maintenance-page{
    padding-inline:clamp(28px,3vw,52px)!important
   }
   .membership-admin>header,.membership-admin>.notice-box,.membership-admin>.invite-box,.membership-admin>.toolbar,.membership-admin>.list,.membership-admin>.msg,
   .rollout>* ,.nd-page>* ,.admin-health>* ,.launch-readiness>* ,.coverage-page>* ,.maintenance-page>*{
    max-width:1480px!important;width:100%!important;margin-left:auto!important;margin-right:auto!important
   }
   .membership-admin .invite-box form{grid-template-columns:1.35fr 1.35fr 1.2fr .8fr auto!important}
   .membership-admin .list{grid-template-columns:repeat(2,minmax(0,1fr))!important}
   .membership-admin .list article{display:flex;flex-direction:column;min-height:310px}
   .membership-admin .list footer{margin-top:auto}
   .rollout .stats,.nd-stats{grid-template-columns:repeat(6,minmax(0,1fr))!important}
   .rollout .grid,.nd-grid{grid-template-columns:minmax(0,1.15fr) minmax(380px,.85fr)!important;gap:20px!important}
   .rollout table,.nd-recent{font-variant-numeric:tabular-nums}
   .rollout .organisations{grid-template-columns:repeat(3,minmax(0,1fr))!important}
   .rollout .bulk textarea{min-height:230px}
  }
  @media(min-width:1100px) and (max-width:1320px){
   .aw .acts{grid-template-columns:repeat(2,minmax(0,1fr))!important}
   .aw .form{grid-template-columns:repeat(2,minmax(0,1fr))!important}
   .membership-admin .list{grid-template-columns:1fr!important}
   .rollout .organisations{grid-template-columns:repeat(2,minmax(0,1fr))!important}
   .rollout .grid,.nd-grid{grid-template-columns:1fr!important}
  }
 `}</style>
}
