import { BarChart3, ChevronRight, Clapperboard, CreditCard, Globe2, Settings2, ShieldCheck, Trophy, UsersRound } from 'lucide-react'

export type ClubAppArea = 'coaching' | 'studio' | 'memberships' | 'website' | 'operations' | 'analytics' | 'permissions'

type Props = {
  clubName: string
  logoUrl: string | null
  allowedAreas?: ClubAppArea[]
  onOpen: (area: ClubAppArea) => void
}

const areas: Array<{key:ClubAppArea;title:string;description:string;icon:typeof Trophy;live:boolean}> = [
  {key:'coaching',title:'Coaching',description:'Plan the week, select the team and run Match Day.',icon:Trophy,live:true},
  {key:'studio',title:'Studio',description:'Create club media, graphics, articles and match content.',icon:Clapperboard,live:true},
  {key:'memberships',title:'Memberships',description:'Create membership offers, manage members and digital cards.',icon:CreditCard,live:true},
  {key:'website',title:'Website',description:'Manage the club profile, public pages and website content.',icon:Globe2,live:false},
  {key:'operations',title:'Operations',description:'Coordinate volunteers, tasks, equipment and club activity.',icon:Settings2,live:false},
  {key:'analytics',title:'Analytics',description:'Review club, team, player and commercial performance.',icon:BarChart3,live:false},
  {key:'permissions',title:'Permissions',description:'Add users and control access down to individual pages.',icon:UsersRound,live:true},
]

function currentClubId(){
  try{return localStorage.getItem('playfooty.coachApp.club.v1')||''}catch{return''}
}

function openStudio(){
  const clubId=currentClubId()
  if(clubId)window.location.assign(`/club-portal/${encodeURIComponent(clubId)}/studio`)
}

function openMemberships(){
  const clubId=currentClubId()
  if(clubId)window.location.assign(`/club-portal/${encodeURIComponent(clubId)}?area=memberships`)
}

export default function CoachAppClubDashboard({clubName,logoUrl,allowedAreas=areas.map(area=>area.key),onOpen}:Props){
  const allowed=new Set(allowedAreas)
  return <section className="cacd">
    <style>{styles}</style>
    <header className="cacd-hero">
      <div className="cacd-club">{logoUrl?<img src={logoUrl} alt=""/>:<b>PF</b>}</div>
      <div><span>PlayFooty Club</span><h1>{clubName}</h1><p>Choose the part of the club you want to manage.</p></div>
    </header>
    <div className="cacd-grid">{areas.map(area=>{
      const Icon=area.icon
      const canOpen=allowed.has(area.key)
      return <button key={area.key} className={area.live&&canOpen?'live':''} disabled={!canOpen||!area.live} onClick={()=>area.key==='studio'?openStudio():area.key==='memberships'?openMemberships():onOpen(area.key)}>
        <i><Icon/></i><span><small>{area.live?'Available now':'Coming next'}</small><strong>{area.title}</strong><em>{area.description}</em></span>
        {area.live&&canOpen?<ChevronRight/>:<ShieldCheck/>}
      </button>
    })}</div>
    <footer><ShieldCheck/><span>Access will be controlled by each person’s club role and permissions.</span></footer>
  </section>
}

const styles=`
.cacd,.cacd *{box-sizing:border-box}.cacd{min-height:calc(100vh - 78px);padding:24px 24px 46px;background:#eef3f7;color:#0b1720;font-family:Barlow,Inter,Arial,sans-serif}.cacd>*{width:min(1180px,100%);margin-left:auto;margin-right:auto}.cacd-hero{display:flex;align-items:center;gap:18px;padding:26px;border-radius:22px;background:#07121b;color:#fff;box-shadow:0 18px 44px rgba(7,18,27,.18)}.cacd-club{width:76px;height:76px;display:grid;place-items:center;flex:0 0 76px;border-radius:19px;background:#fff;color:#07121b;overflow:hidden}.cacd-club img{width:100%;height:100%;object-fit:contain;padding:7px}.cacd-club b{font-size:24px;font-weight:1000}.cacd-hero span{display:block;color:#39b8ff;font-size:12px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.cacd-hero h1{margin:3px 0 4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:46px;line-height:.96;text-transform:uppercase}.cacd-hero p{margin:0;color:#aec0cc;font-size:16px}.cacd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:18px}.cacd-grid button{min-height:176px;display:grid;grid-template-columns:62px 1fr 28px;align-items:center;gap:16px;padding:22px;text-align:left;border:1px solid #cad6de;border-radius:20px;background:#fff;color:#12212b;box-shadow:0 8px 22px rgba(27,48,61,.06)}.cacd-grid button.live{border-color:#159ee8;background:linear-gradient(135deg,#07121b,#0d2637);color:#fff;box-shadow:0 14px 34px rgba(7,18,27,.2);cursor:pointer}.cacd-grid button:disabled{opacity:.72;cursor:default}.cacd-grid button i{width:58px;height:58px;display:grid;place-items:center;border-radius:16px;background:#e5f4fc;color:#128fd0}.cacd-grid button.live i{background:#39b8ff;color:#041019}.cacd-grid button i svg{width:28px;height:28px}.cacd-grid button span{display:flex;flex-direction:column;min-width:0}.cacd-grid small{color:#159ee8;font-size:10px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.cacd-grid strong{margin-top:4px;font-family:'Bebas Neue',Impact,sans-serif;font-size:34px;line-height:1;text-transform:uppercase}.cacd-grid em{margin-top:7px;color:#61717d;font-size:14px;font-style:normal;line-height:1.35}.cacd-grid button.live em{color:#b7c7d1}.cacd-grid>button>svg{width:24px}.cacd footer{display:flex;align-items:center;gap:9px;margin-top:18px;padding:14px 16px;border:1px solid #cedae1;border-radius:14px;background:#fff;color:#536470;font-size:13px;font-weight:800}.cacd footer svg{width:18px;color:#159ee8}
@media(max-width:720px){.cacd{padding:16px 14px 30px}.cacd-hero{padding:20px}.cacd-club{width:62px;height:62px;flex-basis:62px}.cacd-hero h1{font-size:36px}.cacd-grid{grid-template-columns:1fr;gap:12px}.cacd-grid button{min-height:132px;grid-template-columns:52px 1fr 22px;padding:17px}.cacd-grid button i{width:50px;height:50px}.cacd-grid strong{font-size:29px}}
`
