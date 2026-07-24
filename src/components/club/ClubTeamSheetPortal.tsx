import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'

type SelectedPlayer = { id:string; clubPlayerId:string; playerId:string|null; playerName:string; jumperNumber:number|null; positionCode:string }
type TeamSheet = { id:string; clubId:string; clubName:string|null; clubLogoUrl:string|null; primaryColour:string|null; secondaryColour:string|null; leagueId:string|null; leagueName:string|null; season:string; grade:string; roundLabel:string; opponentName:string|null; matchDate:string|null; status:string; players:SelectedPlayer[] }

const LABELS:Record<string,string>={BP_LEFT:'BP',FB:'FB',BP_RIGHT:'BP',HBF_LEFT:'HBF',CHB:'CHB',HBF_RIGHT:'HBF',WING_LEFT:'WING',CENTRE:'CENTRE',WING_RIGHT:'WING',HFF_LEFT:'HFF',CHF:'CHF',HFF_RIGHT:'HFF',FP_LEFT:'FP',FF:'FF',FP_RIGHT:'FP',RUCK:'RUCK',RUCK_ROVER:'R/R',ROVER:'ROVER'}
const FIELD_ROWS=[['BP_LEFT','FB','BP_RIGHT'],['HBF_LEFT','CHB','HBF_RIGHT'],['WING_LEFT','CENTRE','WING_RIGHT'],['RUCK','RUCK_ROVER','ROVER'],['HFF_LEFT','CHF','HFF_RIGHT'],['FP_LEFT','FF','FP_RIGHT']]

export default function ClubTeamSheetPortal(){
 const { pathname }=useLocation()
 const [target,setTarget]=useState<HTMLElement|null>(null)
 const [sheet,setSheet]=useState<TeamSheet|null>(null)
 const [loading,setLoading]=useState(false)
 const clubId=pathname.startsWith('/team/')?decodeURIComponent(pathname.slice('/team/'.length)):''

 useEffect(()=>{
  if(!clubId){setTarget(null);return}
  let active=true
  let timer=0
  const findTarget=()=>{
   if(!active)return
   const slot=document.getElementById('pf-club-team-sheet-slot')
   if(slot)setTarget(slot)
   else timer=window.setTimeout(findTarget,50)
  }
  findTarget()
  return()=>{active=false;window.clearTimeout(timer);setTarget(null)}
 },[clubId])

 useEffect(()=>{if(!clubId)return;let alive=true;setLoading(true);fetch(`/api/team-sheets/club/${encodeURIComponent(clubId)}`).then(r=>r.ok?r.json():Promise.reject(new Error(String(r.status)))).then((p:{data?:TeamSheet|null})=>{if(alive)setSheet(p.data??null)}).catch(()=>{if(alive)setSheet(null)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[clubId])
 if(!target)return null
 const emptyPositions=new Map<string,SelectedPlayer>()
 const byPosition=sheet?new Map(sheet.players.map(player=>[player.positionCode,player])):emptyPositions
 const bench=sheet?sheet.players.filter(player=>player.positionCode.startsWith('INTERCHANGE_')):[]
 const emergencies=sheet?sheet.players.filter(player=>player.positionCode.startsWith('EMERGENCY_')):[]
 const primary=sheet?.primaryColour||'#42b8ff',secondary=sheet?.secondaryColour||'#101318'
 return createPortal(<section className="club-team-sheet">
  <header><div><small>SELECTED TEAM</small><h2>{loading?'Loading team…':sheet?sheet.roundLabel:'Team not named yet'}</h2><p>{sheet?`${sheet.grade}${sheet.opponentName?` · v ${sheet.opponentName}`:''}${sheet.matchDate?` · ${new Date(sheet.matchDate).toLocaleDateString('en-AU',{day:'numeric',month:'short'})}`:''}`:'The oval is ready. Published player names will appear in their selected positions.'}</p></div>{sheet?.leagueId?<Link to={`/league/${sheet.leagueId}`}>{sheet.leagueName}</Link>:null}</header>
  <div className="club-team-board" style={{'--team-primary':primary,'--team-secondary':secondary} as React.CSSProperties}><div className="club-team-goals top"><i/><i/><i/><i/></div>{FIELD_ROWS.map((row,index)=><div className={`club-team-row row-${index}`} key={index}>{row.map(code=><Position key={code} code={code} player={byPosition.get(code)}/>)}</div>)}<div className="club-team-centre-circle"/><div className="club-team-goals bottom"><i/><i/><i/><i/></div></div>
  <div className="club-team-list"><strong>Interchange</strong>{[1,2,3,4].map(index=>{const player=bench.find(row=>row.positionCode===`INTERCHANGE_${index}`);return player?<PlayerLink key={player.id} player={player}/>:<span key={index}>Position {index}</span>})}</div>
  <div className="club-team-list emergency"><strong>Emergencies</strong>{[1,2,3].map(index=>{const player=emergencies.find(row=>row.positionCode===`EMERGENCY_${index}`);return player?<PlayerLink key={player.id} player={player}/>:<span key={index}>Position {index}</span>})}</div><style>{styles}</style>
 </section>,target)
}

function Position({code,player}:{code:string;player?:SelectedPlayer}){return <div className="club-team-position"><span>{LABELS[code]}</span>{player?<PlayerLink player={player}/>:<em>—</em>}</div>}
function PlayerLink({player}:{player:SelectedPlayer}){const label=`${player.jumperNumber?`${player.jumperNumber}. `:''}${player.playerName}`;return player.playerId?<Link to={`/player/${player.playerId}`}>{label}</Link>:<span>{label}</span>}

const styles=`.club-team-sheet{margin:0;background:#fff;border:1px solid #dfe5eb;border-radius:14px;padding:22px;box-shadow:0 6px 18px rgba(17,24,39,.05);font-family:Barlow,Inter,Arial,sans-serif}.club-team-sheet header{display:flex;justify-content:space-between;align-items:end;gap:16px;margin-bottom:18px}.club-team-sheet header small{color:#118fd3;font-weight:900;letter-spacing:.15em}.club-team-sheet h2{font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;line-height:.9;margin:5px 0}.club-team-sheet header p{margin:0;color:#687385}.club-team-sheet header>a{color:#118fd3;font-weight:800;text-decoration:none}.club-team-board{position:relative;width:min(620px,100%);aspect-ratio:4/5.2;margin:0 auto;padding:12% 7%;box-sizing:border-box;border:4px solid var(--team-secondary);border-radius:48%/16%;overflow:hidden;background:repeating-linear-gradient(0deg,#b8dc91 0 8.33%,#9fce78 8.33% 16.66%);box-shadow:inset 0 0 0 4px rgba(255,255,255,.55)}.club-team-board:before,.club-team-board:after{content:'';position:absolute;left:8%;right:8%;height:19%;border:3px solid rgba(16,19,24,.55);border-radius:50%;z-index:0}.club-team-board:before{top:7%;border-bottom-color:transparent}.club-team-board:after{bottom:7%;border-top-color:transparent}.club-team-row{position:relative;z-index:2;display:grid;grid-template-columns:repeat(3,1fr);align-items:center;gap:6px;height:14.1%}.club-team-position{text-align:center;min-width:0}.club-team-position>span{display:block;font-size:9px;font-weight:900;color:#38434d}.club-team-position>a,.club-team-position>span:last-child,.club-team-position>em{display:block;margin-top:3px;color:#0b1117;font-size:12px;font-weight:900;text-decoration:none;font-style:normal;line-height:1.05;text-shadow:0 1px rgba(255,255,255,.7);overflow-wrap:anywhere}.club-team-position>a:hover{color:#067fbd}.club-team-centre-circle{position:absolute;left:50%;top:50%;width:13%;aspect-ratio:1;border:3px solid rgba(16,19,24,.6);border-radius:50%;transform:translate(-50%,-50%);z-index:1}.club-team-goals{position:absolute;left:50%;display:flex;justify-content:space-between;width:22%;height:8%;transform:translateX(-50%);z-index:3}.club-team-goals.top{top:0}.club-team-goals.bottom{bottom:0}.club-team-goals i{display:block;width:2px;height:100%;background:#111}.club-team-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;align-items:center}.club-team-list strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:22px;margin-right:6px}.club-team-list a,.club-team-list span{background:#eef3f7;border-radius:999px;padding:7px 10px;color:#111318;text-decoration:none;font-size:12px;font-weight:800}.club-team-list.emergency{opacity:.82}@media(max-width:620px){.club-team-sheet{padding:16px 10px}.club-team-sheet h2{font-size:34px}.club-team-sheet header{align-items:start}.club-team-sheet header>a{font-size:11px;text-align:right;max-width:120px}.club-team-board{padding-left:4%;padding-right:4%}.club-team-position>a,.club-team-position>span:last-child,.club-team-position>em{font-size:9px}.club-team-position>span{font-size:7px}}`
