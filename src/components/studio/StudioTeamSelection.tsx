import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clipboard, Download, Image as ImageIcon, LoaderCircle, LockKeyhole, RefreshCw } from 'lucide-react'

type Club = { id:string; name:string; logoUrl:string|null; leagueName:string|null; stateName:string; season:string|null; grade:string|null; primaryColour:string|null }
type Player = { clubPlayerId:string; positionCode:string; playerName:string; jumperNumber:number|null }
type Sheet = { id:string; roundLabel:string; opponentName:string|null; matchDate:string|null; status:string; grade:string; players:Player[] }
type Context = {
 club:{id:string;name:string;logoUrl:string|null}
 fixture:{id:string;leagueId:string;season:string;grade:string;round:string|null;homeClubId:string|null;awayClubId:string|null;homeName:string;awayName:string;matchDate:string|null;venue:string|null}|null
 teamSheet:{id:string;clubId:string;playerCount:number}|null
 nextStep:'SELECT_SIDE'|'MATCH_DAY'
}
type Props = { clubId:string; token:string; club:Club; onBack:()=>void }

const FIELD_ROWS:Array<Array<string[]>> = [
 [['RFP','FP_RIGHT'],['FF'],['LFP','FP_LEFT']],
 [['RHF','HFF_RIGHT'],['CHF'],['LHF','HFF_LEFT']],
 [['R','RUCK'],['RR','RUCK_ROVER'],['ROV','ROVER']],
 [['RW','WING_RIGHT'],['C','CENTRE'],['LW','WING_LEFT']],
 [['RHB','HBF_RIGHT'],['CHB'],['LHB','HBF_LEFT']],
 [['RBP','BP_RIGHT'],['FB'],['LBP','BP_LEFT']],
]
const ROW_LABELS=['F','HF','FOL','C','HB','B']
const FIELD_CODES=new Set(FIELD_ROWS.flat(2))

function norm(value:string|null|undefined){return (value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function safeColour(value:string|null|undefined,fallback:string){return /^#[0-9a-f]{6}$/i.test(value||'')?value!:fallback}
function dateLabel(value:string|null|undefined){if(!value)return'DATE TBC';const date=new Date(value);return Number.isNaN(date.getTime())?'DATE TBC':date.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).toUpperCase()}
function shortName(name:string){const parts=name.trim().split(/\s+/);return parts.length>1?`${parts[0]}\n${parts.slice(1).join(' ')}`:name}
async function loadImage(url:string|null){if(!url)return null;return new Promise<HTMLImageElement|null>(resolve=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=url})}
function findPlayer(sheet:Sheet,codes:string[]){return sheet.players.find(player=>codes.includes(player.positionCode))||null}
function assignedFieldCount(sheet:Sheet|null){if(!sheet)return 0;const occupied=new Set<string>();for(const row of FIELD_ROWS){for(const aliases of row){if(findPlayer(sheet,aliases))occupied.add(aliases[0])}}return occupied.size}
function interchange(sheet:Sheet){return sheet.players.filter(player=>{const code=player.positionCode.toUpperCase();return !FIELD_CODES.has(code)&&(code==='INT'||code.startsWith('INT')||code.startsWith('INTERCHANGE'))}).slice(0,4)}
function opponent(context:Context|null,club:Club){const fixture=context?.fixture;if(!fixture)return'';const clubNames=[club.name,context?.club.name].map(norm);if(clubNames.includes(norm(fixture.homeName)))return fixture.awayName;if(clubNames.includes(norm(fixture.awayName)))return fixture.homeName;if(fixture.homeClubId===club.id||fixture.homeClubId===context?.club.id)return fixture.awayName;if(fixture.awayClubId===club.id||fixture.awayClubId===context?.club.id)return fixture.homeName;return fixture.awayName}
function fixtureCaption(context:Context,club:Club){const fixture=context.fixture;const opp=opponent(context,club)||'our opposition';const round=fixture?.round||'this week';const when=fixture?.matchDate?new Date(fixture.matchDate).toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'}):'';const where=fixture?.venue||'';return [`TEAM SELECTION | ${round.toUpperCase()}`,`Our side is locked in to take on ${opp}.`,[when,where].filter(Boolean).join(' · '),'Get behind the team.'].filter(Boolean).join('\n\n')}
function shortCaption(context:Context,club:Club){const fixture=context.fixture;const opp=opponent(context,club)||'our opposition';return `${fixture?.round?`${fixture.round} | `:''}${club.name} v ${opp}. Our team is locked in.`}

export default function StudioTeamSelection({clubId,token,club,onBack}:Props){
 const canvas=useRef<HTMLCanvasElement>(null)
 const[context,setContext]=useState<Context|null>(null)
 const[sheet,setSheet]=useState<Sheet|null>(null)
 const[loading,setLoading]=useState(true)
 const[busy,setBusy]=useState(false)
 const[error,setError]=useState('')
 const[message,setMessage]=useState('')
 const[imageUrl,setImageUrl]=useState('')
 const[caption,setCaption]=useState('')
 const[compactCaption,setCompactCaption]=useState('')
 const[assetId,setAssetId]=useState('')
 const headers=useMemo(()=>({authorization:`Bearer ${token}`}),[token])

 async function request(path:string,options:RequestInit={}){const response=await fetch(path,{...options,headers:{...headers,...(options.headers||{})}});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'Request failed');return payload}
 async function load(){setLoading(true);setError('');setMessage('');try{const contextPayload=await request(`/api/club-portal/coach-app/context?clubId=${encodeURIComponent(clubId)}`);const next=contextPayload.data as Context;setContext(next);if(!next.teamSheet){setSheet(null);return}const ownerId=next.teamSheet.clubId||next.club.id;const sheetPayload=await request(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(ownerId)}/sheets`);const sheets=(Array.isArray(sheetPayload.data)?sheetPayload.data:[]) as Sheet[];setSheet(sheets.find(item=>item.id===next.teamSheet?.id)||null)}catch(reason){setError(reason instanceof Error?reason.message:'Unable to load this week’s selected side')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[clubId,token])

 const fieldCount=assignedFieldCount(sheet)
 const ready=Boolean(context?.fixture&&sheet&&fieldCount>=18)
 const opp=opponent(context,club)

 async function generate(){if(!ready||!context||!sheet||!canvas.current)return;setBusy(true);setError('');setMessage('');setAssetId('');try{const ctx=canvas.current.getContext('2d');if(!ctx)throw new Error('Canvas is unavailable');const W=1080,H=1350,primary=safeColour(club.primaryColour,'#082f6d'),secondary='#42b8ff';canvas.current.width=W;canvas.current.height=H
   const gradient=ctx.createLinearGradient(0,0,W,H);gradient.addColorStop(0,primary);gradient.addColorStop(1,'#061427');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H)
   ctx.globalAlpha=.12;ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(W*.52,0);ctx.lineTo(W,0);ctx.lineTo(W,H*.42);ctx.closePath();ctx.fill();ctx.globalAlpha=1
   const logo=await loadImage(club.logoUrl);if(logo){const scale=Math.min(150/logo.width,150/logo.height);ctx.drawImage(logo,75,55,logo.width*scale,logo.height*scale)}
   ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='900 58px Arial';ctx.fillText('TEAM',75,245);ctx.fillStyle=secondary;ctx.font='900 104px Arial';ctx.fillText('SELECTION',75,330)
   ctx.fillStyle='#fff';ctx.font='700 30px Arial';ctx.textAlign='right';ctx.fillText((context.fixture?.round||sheet.roundLabel||'MATCH WEEK').toUpperCase(),1005,95);ctx.font='900 34px Arial';ctx.fillText(`V ${opp||sheet.opponentName||'OPPONENT TBC'}`.toUpperCase(),1005,143);ctx.textAlign='left'
   ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(75,370);ctx.lineTo(1005,370);ctx.stroke()
   const startY=425,rowH=120,colX=[250,535,820]
   FIELD_ROWS.forEach((row,rowIndex)=>{const y=startY+rowIndex*rowH;ctx.fillStyle='rgba(255,255,255,.82)';ctx.font='900 24px Arial';ctx.fillText(ROW_LABELS[rowIndex],75,y+42);row.forEach((aliases,col)=>drawPlayer(ctx,findPlayer(sheet,aliases),colX[col],y,secondary));ctx.strokeStyle='rgba(255,255,255,.2)';ctx.beginPath();ctx.moveTo(145,y+86);ctx.lineTo(1005,y+86);ctx.stroke()})
   const bench=interchange(sheet),benchY=startY+FIELD_ROWS.length*rowH+12;ctx.fillStyle='rgba(255,255,255,.82)';ctx.font='900 24px Arial';ctx.fillText('INT',75,benchY+35);bench.forEach((player,index)=>drawPlayer(ctx,player,250+(index%3)*285,benchY+Math.floor(index/3)*82,secondary))
   ctx.fillStyle=secondary;ctx.font='900 25px Arial';ctx.fillText(dateLabel(context.fixture?.matchDate||sheet.matchDate),75,1280);ctx.fillStyle='#fff';ctx.font='700 21px Arial';ctx.fillText((club.leagueName||context.fixture?.grade||sheet.grade||'COMMUNITY FOOTBALL').toUpperCase(),75,1315)
   const dataUrl=canvas.current.toDataURL('image/png');setImageUrl(dataUrl);setCaption(fixtureCaption(context,club));setCompactCaption(shortCaption(context,club))
   const upload=await request(`/api/club-portal/media/clubs/${encodeURIComponent(clubId)}/upload`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({dataUrl,contentType:'image/png',title:`${context.fixture?.round||sheet.roundLabel||'Match week'} team selection`,description:`${club.name} team selection${opp?` v ${opp}`:''}`,mediaType:'TEAM_SELECTION',status:'READY',width:1080,height:1350,tags:['team selection',context.fixture?.round||sheet.roundLabel,opp].filter(Boolean),sourceEntityType:'TEAM_SHEET',sourceEntityId:sheet.id})})
   const createdId=upload.data?.id||upload.data?.asset?.id||upload.asset?.id||upload.id||'';setAssetId(createdId)
   if(createdId){try{const prepared=await request(`/api/club-portal/media-publishing/clubs/${encodeURIComponent(clubId)}/assets/${encodeURIComponent(createdId)}`);if(prepared.data?.suggestion?.caption)setCaption(prepared.data.suggestion.caption)}catch{/* Graphic remains usable with the fixture-based caption if publishing suggestions are unavailable. */}}
   setMessage('Team selection media package generated and saved.')
  }catch(reason){setError(reason instanceof Error?reason.message:'Unable to generate the team selection media package')}finally{setBusy(false)}}

 function download(){if(!imageUrl)return;const anchor=document.createElement('a');anchor.download=`${club.name}-${context?.fixture?.round||'team-selection'}.png`.toLowerCase().replace(/[^a-z0-9.-]+/g,'-');anchor.href=imageUrl;anchor.click()}
 async function copy(value:string,label:string){try{await navigator.clipboard.writeText(value);setMessage(`${label} copied`)}catch{setError(`Unable to copy ${label.toLowerCase()} on this device`)}}

 if(loading)return <section className="sts-state"><LoaderCircle className="sts-spin"/><strong>Checking this week’s selection…</strong></section>
 return <section className="sts">
  <div className="sts-back"><button onClick={onBack}><ArrowLeft/> Studio Dashboard</button></div>
  <div className="sts-hero"><span>TEAM SELECTION MEDIA</span><h1>ONE TAP. MATCH-WEEK PACKAGE.</h1><p>PlayFooty automatically uses the upcoming fixture and the side already selected for this week.</p></div>
  {error&&<div className="sts-alert error">{error}</div>}{message&&<div className="sts-alert success"><CheckCircle2/>{message}</div>}
  <div className="sts-status">
   <article><small>CURRENT FIXTURE</small><strong>{context?.fixture?.round||'No upcoming round'}</strong><span>{context?.fixture?`${club.name} v ${opp||'Opponent TBC'}`:'The next fixture has not been resolved.'}</span></article>
   <article><small>TEAM SELECTION</small><strong>{fieldCount}/18</strong><span>{ready?'Selected side ready for media.':'Complete this week’s 18 on-field positions to unlock the package.'}</span></article>
   <article><small>MEDIA PACKAGE</small><strong>{imageUrl?'READY':ready?'UNLOCKED':'LOCKED'}</strong><span>{imageUrl?'Graphic and captions generated.':ready?'Ready to generate.':'Automatically unlocks after selection.'}</span></article>
  </div>
  {!ready?<div className="sts-locked"><LockKeyhole/><div><span>WAITING FOR TEAM SELECTION</span><h2>The media package unlocks automatically.</h2><p>No round picker. No team-sheet picker. Once the current side has 18 players placed on the field, Studio uses that saved selection for the upcoming fixture.</p></div><button onClick={()=>void load()}><RefreshCw/> Check again</button></div>:
  <div className="sts-ready"><div><span>THIS WEEK IS READY</span><h2>{context?.fixture?.round||sheet?.roundLabel} · v {opp||sheet?.opponentName||'Opponent'}</h2><p>{dateLabel(context?.fixture?.matchDate||sheet?.matchDate)}{context?.fixture?.venue?` · ${context.fixture.venue}`:''}</p></div><button onClick={()=>void generate()} disabled={busy}><ImageIcon/>{busy?'Generating package…':imageUrl?'Regenerate Team Selection Media Package':'Generate Team Selection Media Package'}</button></div>}
  {imageUrl&&<section className="sts-package"><div className="sts-preview"><header><span>IMAGE</span><strong>1080 × 1350</strong></header><img src={imageUrl} alt={`${club.name} team selection graphic`}/><button onClick={download}><Download/> Download image</button></div><div className="sts-captions"><header><span>CAPTIONS</span><strong>Ready to post</strong></header><label>Primary social caption<textarea value={caption} onChange={event=>setCaption(event.target.value)}/><button onClick={()=>void copy(caption,'Caption')}><Clipboard/> Copy caption</button></label><label>Short caption<textarea value={compactCaption} onChange={event=>setCompactCaption(event.target.value)}/><button onClick={()=>void copy(compactCaption,'Short caption')}><Clipboard/> Copy short caption</button></label>{assetId&&<small>Saved to the existing PlayFooty Media Centre as asset {assetId.slice(0,8)}…</small>}</div></section>}
  <canvas ref={canvas} className="sts-canvas" aria-hidden="true"/>
  <style>{styles}</style>
 </section>
}

function drawPlayer(ctx:CanvasRenderingContext2D,player:Player|null,x:number,y:number,accent:string){ctx.textAlign='center';if(!player){ctx.fillStyle='rgba(255,255,255,.35)';ctx.font='700 22px Arial';ctx.fillText('—',x,y+30);ctx.textAlign='left';return}const lines=shortName(player.playerName).split('\n');ctx.fillStyle='rgba(255,255,255,.88)';ctx.font='500 22px Arial';ctx.fillText(lines[0].toUpperCase(),x,y+20);ctx.fillStyle='#fff';ctx.font='900 25px Arial';ctx.fillText((lines[1]||lines[0]).toUpperCase(),x,y+50);if(player.jumperNumber){ctx.fillStyle=accent;ctx.font='900 17px Arial';ctx.fillText(`#${player.jumperNumber}`,x,y+74)}ctx.textAlign='left'}

const styles=`
.sts,.sts *{box-sizing:border-box}.sts{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:22px 0 54px;color:#0b1720;font-family:Barlow,Inter,Arial,sans-serif}.sts-back button{display:flex;align-items:center;gap:7px;border:0;background:transparent;color:#536470;font-weight:900;cursor:pointer}.sts-back svg{width:18px}.sts-hero{margin-top:14px;padding:26px 29px;border-radius:21px;background:linear-gradient(115deg,#07121b,#102c3e);color:#fff;box-shadow:0 18px 44px rgba(7,18,27,.15)}.sts-hero>span,.sts-ready span,.sts-locked span{color:#39b8ff;font-size:10px;font-weight:950;letter-spacing:.15em}.sts-hero h1{margin:7px 0 8px;font:clamp(3.4rem,7vw,6rem)/.84 'Bebas Neue',Impact,sans-serif}.sts-hero p{margin:0;color:#b6c5cf}.sts-status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.sts-status article{display:flex;min-height:112px;flex-direction:column;padding:15px 17px;border:1px solid #d5e0e7;border-radius:15px;background:#fff}.sts-status small{color:#159ee8;font-size:9px;font-weight:950;letter-spacing:.12em}.sts-status strong{margin-top:7px;font:32px/1 'Bebas Neue',Impact,sans-serif}.sts-status span{margin-top:6px;color:#687783;font-size:11px;line-height:1.35}.sts-ready,.sts-locked{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:12px;padding:20px;border:1px solid #d5e0e7;border-radius:17px;background:#fff}.sts-ready h2,.sts-locked h2{margin:5px 0 4px;font:38px/1 'Bebas Neue',Impact,sans-serif}.sts-ready p,.sts-locked p{margin:0;color:#687783}.sts-ready>button,.sts-locked>button,.sts-preview>button,.sts-captions label button{display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:11px;padding:13px 16px;background:#39b8ff;color:#061019;font-weight:950;cursor:pointer}.sts-ready>button{min-height:58px;max-width:390px;font-size:13px;text-transform:uppercase}.sts-ready>button:disabled{opacity:.55}.sts-locked{justify-content:flex-start;background:#f8fafb}.sts-locked>svg{width:42px;height:42px;flex:0 0 auto;color:#7d8d98}.sts-locked>div{flex:1}.sts-locked>button{background:#e5edf2}.sts-package{display:grid;grid-template-columns:minmax(310px,.85fr) minmax(0,1.15fr);gap:12px;margin-top:12px}.sts-preview,.sts-captions{padding:16px;border:1px solid #d5e0e7;border-radius:17px;background:#fff}.sts-preview header,.sts-captions header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.sts-preview header span,.sts-captions header span{color:#159ee8;font-size:9px;font-weight:950;letter-spacing:.12em}.sts-preview header strong,.sts-captions header strong{font:26px/1 'Bebas Neue',Impact,sans-serif}.sts-preview img{display:block;width:100%;max-height:620px;object-fit:contain;border-radius:10px;background:#07121b}.sts-preview>button{width:100%;margin-top:10px;background:#07121b;color:#fff}.sts-captions{display:grid;align-content:start;gap:13px}.sts-captions label{display:grid;gap:7px;color:#536470;font-size:10px;font-weight:950;text-transform:uppercase}.sts-captions textarea{width:100%;min-height:150px;padding:13px;border:1px solid #cdd9e1;border-radius:11px;background:#f9fbfc;color:#111;font:500 14px/1.5 Barlow,Inter,sans-serif;resize:vertical;text-transform:none}.sts-captions label:nth-of-type(2) textarea{min-height:90px}.sts-captions label button{justify-self:start;padding:10px 12px;background:#e5edf2}.sts-captions small{color:#7a8892}.sts-alert{display:flex;align-items:center;gap:8px;margin-top:12px;padding:11px 14px;border-radius:11px;font-weight:850}.sts-alert svg{width:18px}.sts-alert.error{background:#ffe7e7;color:#9d1e1e}.sts-alert.success{background:#e0f8eb;color:#126f40}.sts-state{min-height:55vh;display:grid;place-items:center;align-content:center;gap:12px;color:#536470}.sts-state strong{font:32px/1 'Bebas Neue',Impact,sans-serif}.sts-spin{color:#39b8ff;animation:sts-spin .8s linear infinite}@keyframes sts-spin{to{transform:rotate(360deg)}}.sts-canvas{position:fixed;left:-9999px;top:-9999px;width:1080px;height:1350px}
@media(max-width:760px){.sts{width:min(100% - 18px,1180px);padding-top:12px}.sts-hero{padding:20px;border-radius:16px}.sts-status{grid-template-columns:1fr}.sts-ready,.sts-locked{align-items:flex-start;flex-direction:column}.sts-ready>button,.sts-locked>button{width:100%;max-width:none}.sts-package{grid-template-columns:1fr}.sts-preview img{max-height:none}}
`