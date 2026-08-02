import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const SESSION_KEY='playfooty.clubPortal.session.v1'
const ROWS=[['BP_LEFT','FB','BP_RIGHT'],['HBF_LEFT','CHB','HBF_RIGHT'],['WING_LEFT','CENTRE','WING_RIGHT'],['RUCK','RUCK_ROVER','ROVER'],['HFF_LEFT','CHF','HFF_RIGHT'],['FP_LEFT','FF','FP_RIGHT']]
const LABELS=['B','HB','C','R','HF','F']
const BENCH=['INTERCHANGE_1','INTERCHANGE_2','INTERCHANGE_3','INTERCHANGE_4']
const EMG=['EMERGENCY_1','EMERGENCY_2','EMERGENCY_3']

type Player={positionCode:string;playerName:string;jumperNumber:number|null}
type Sheet={id:string;roundLabel:string;opponentName:string|null;matchDate:string|null;status:string;grade:string;players:Player[]}
type Club={clubName:string;logoUrl:string|null;primaryColour:string|null;secondaryColour:string|null;leagueName:string|null}
type Fixture={matchDate?:string|null;matchTime?:string|null;time?:string|null;venue?:string|null;venueName?:string|null;groundName?:string|null;homeClubName?:string|null;homeName?:string|null;awayClubName?:string|null;awayName?:string|null}
type GeneratedGraphic={dataUrl:string;filename:string}
type ModalState={open:boolean;status:'loading'|'success'|'error';title:string;message:string;graphic:GeneratedGraphic|null}

function readToken(){try{const raw=localStorage.getItem(SESSION_KEY);if(!raw)return'';const parsed=JSON.parse(raw) as{access_token?:string};return parsed.access_token||''}catch{return''}}
function safeColour(value:string|null|undefined,fallback:string){return /^#[0-9a-f]{6}$/i.test(value||'')?String(value):fallback}
function normalise(value:string|null|undefined){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function playerAt(sheet:Sheet,code:string){return sheet.players.find(player=>player.positionCode===code)||null}
function dateLabel(value:string|null|undefined){if(!value)return'DATE TBC';const date=new Date(value);return Number.isNaN(date.getTime())?'DATE TBC':date.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).toUpperCase()}
function timeLabel(value:string|null|undefined){if(!value)return'TIME TBC';const raw=String(value).trim();const match=raw.match(/^(\d{1,2}):(\d{2})/);if(!match)return raw.toUpperCase();const hour=Number(match[1]),minute=match[2],suffix=hour>=12?'PM':'AM',display=hour%12||12;return `${display}:${minute}${suffix}`}
function fixtureOpponent(fixture:Fixture){return fixture.awayClubName||fixture.awayName||fixture.homeClubName||fixture.homeName||''}
function findFixture(fixtures:Fixture[],sheet:Sheet){const opponent=normalise(sheet.opponentName);const date=String(sheet.matchDate||'').slice(0,10);return fixtures.find(item=>{const names=[item.homeClubName,item.homeName,item.awayClubName,item.awayName].map(normalise);const fixtureDate=String(item.matchDate||'').slice(0,10);return(!opponent||names.includes(opponent))&&(!date||fixtureDate===date)})||fixtures.find(item=>normalise(fixtureOpponent(item))===opponent)||null}
async function loadImage(url:string|null,label:string){if(!url)throw new Error(`${label} was not returned.`);return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`${label} could not be loaded by this browser.`));image.src=url})}
function cover(ctx:CanvasRenderingContext2D,image:HTMLImageElement,w:number,h:number){const scale=Math.max(w/image.width,h/image.height);const dw=image.width*scale,dh=image.height*scale;ctx.drawImage(image,(w-dw)/2,(h-dh)/2,dw,dh)}
function drawPlayer(ctx:CanvasRenderingContext2D,player:Player|null,x:number,y:number){ctx.textAlign='center';if(!player){ctx.fillStyle='rgba(255,255,255,.38)';ctx.font='700 21px Arial';ctx.fillText('—',x,y+28);ctx.textAlign='left';return}const parts=player.playerName.trim().split(/\s+/);ctx.fillStyle='rgba(255,255,255,.84)';ctx.font='600 20px Arial';ctx.fillText((parts[0]||'').toUpperCase(),x,y+18);ctx.fillStyle='#fff';ctx.font='900 24px Arial';ctx.fillText((parts.slice(1).join(' ')||parts[0]||'').toUpperCase(),x,y+46);if(player.jumperNumber){ctx.fillStyle='rgba(255,255,255,.72)';ctx.font='800 15px Arial';ctx.fillText(`#${player.jumperNumber}`,x,y+68)}ctx.textAlign='left'}

async function generateGraphic(clubId:string,onProgress:(title:string,message:string)=>void):Promise<GeneratedGraphic>{
 const token=readToken();if(!token)throw new Error('Your club session has expired. Please sign in again.')
 const headers:Record<string,string>={authorization:`Bearer ${token}`}
 const getJson=async(url:string,options:RequestInit={})=>{let response:Response;try{response=await fetch(url,{...options,headers:{...(options.headers as Record<string,string>|undefined),...headers}})}catch(error){throw new Error(error instanceof Error?`Connection failed: ${error.message}`:'Connection to the image service failed.')}const payload=await response.json().catch(()=>({})) as any;if(!response.ok)throw new Error(payload.error||`Request failed (${response.status})`);return payload}

 onProgress('Loading team','Checking the published team, fixture and club branding…')
 const[sheetPayload,clubPayload,fixturePayload]=await Promise.all([
  getJson(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`),
  fetch(`/api/clubs/${encodeURIComponent(clubId)}`).then(async response=>{const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to load club');return payload}),
  fetch(`/api/fixtures/club/${encodeURIComponent(clubId)}`).then(response=>response.ok?response.json():({data:[]})).catch(()=>({data:[]}))
 ])
 const sheets=(Array.isArray(sheetPayload.data)?sheetPayload.data:[]) as Sheet[]
 const sheet=sheets.find(item=>item.status==='PUBLISHED')
 if(!sheet)throw new Error('Publish a team before generating the image.')
 const club=(clubPayload.data||null) as Club|null
 if(!club)throw new Error('Club details could not be loaded.')
 const fixtures=(Array.isArray(fixturePayload.data)?fixturePayload.data:[]) as Fixture[]
 const fixture=findFixture(fixtures,sheet)
 const venue=fixture?.venueName||fixture?.groundName||fixture?.venue||'GROUND TBC'
 const matchDate=fixture?.matchDate||sheet.matchDate
 const matchTime=fixture?.matchTime||fixture?.time||null

 onProgress('Creating AI design','Generating a background in the club colours. This can take up to a minute…')
 const ai=await getJson(`/api/club-portal/ai-graphics/clubs/${encodeURIComponent(clubId)}/team-background`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clubName:club.clubName,opponentName:sheet.opponentName,primaryColour:club.primaryColour,secondaryColour:club.secondaryColour,style:'premium broadcast'})})

 onProgress('Building graphic','Adding the exact team, match details and club logo…')
 const background=await loadImage(ai.data?.dataUrl||null,'The AI background')
 const canvas=document.createElement('canvas');const W=1080,H=1350;canvas.width=W;canvas.height=H
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image canvas is unavailable.')
 cover(ctx,background,W,H);ctx.fillStyle='rgba(2,10,24,.62)';ctx.fillRect(0,0,W,H)
 const shade=ctx.createLinearGradient(0,0,0,H);shade.addColorStop(0,'rgba(0,0,0,.08)');shade.addColorStop(1,'rgba(0,0,0,.82)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H)
 const secondary=safeColour(club.secondaryColour,'#f4b000')
 let logo:HTMLImageElement|null=null
 if(club.logoUrl){try{logo=await loadImage(club.logoUrl,'The club logo')}catch{logo=null}}
 if(logo){const scale=Math.min(130/logo.width,130/logo.height);ctx.drawImage(logo,72,55,logo.width*scale,logo.height*scale)}
 ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='900 58px Arial';ctx.fillText('TEAM',72,245);ctx.fillStyle=secondary;ctx.font='900 102px Arial';ctx.fillText('SELECTION',72,325)
 ctx.fillStyle='#fff';ctx.textAlign='right';ctx.font='800 27px Arial';ctx.fillText(sheet.roundLabel.toUpperCase(),1000,75);ctx.font='900 32px Arial';ctx.fillText(`V ${sheet.opponentName||'OPPONENT TBC'}`.toUpperCase(),1000,120)
 ctx.fillStyle='rgba(255,255,255,.88)';ctx.font='800 20px Arial';ctx.fillText(`${dateLabel(matchDate)} · ${timeLabel(matchTime)}`,1000,158);ctx.fillStyle=secondary;ctx.font='900 19px Arial';ctx.fillText(venue.toUpperCase(),1000,190);ctx.textAlign='left'
 const startY=405,rowH=118,colX=[265,545,825]
 ROWS.forEach((row,index)=>{const y=startY+index*rowH;ctx.fillStyle=secondary;ctx.font='900 24px Arial';ctx.fillText(LABELS[index],72,y+38);row.forEach((code,col)=>drawPlayer(ctx,playerAt(sheet,code),colX[col],y));ctx.strokeStyle='rgba(255,255,255,.2)';ctx.beginPath();ctx.moveTo(145,y+82);ctx.lineTo(1008,y+82);ctx.stroke()})
 let y=startY+ROWS.length*rowH+8;ctx.fillStyle=secondary;ctx.font='900 22px Arial';ctx.fillText('INT',72,y+30);BENCH.forEach((code,index)=>drawPlayer(ctx,playerAt(sheet,code),245+(index%3)*285,y+Math.floor(index/3)*72));y+=155;ctx.fillStyle=secondary;ctx.fillText('EMG',72,y+30);EMG.forEach((code,index)=>drawPlayer(ctx,playerAt(sheet,code),245+index*285,y))
 const filename=`${club.clubName}-${sheet.roundLabel}-team-selection.png`.toLowerCase().replace(/[^a-z0-9.-]+/g,'-')
 return{dataUrl:canvas.toDataURL('image/png'),filename}
}

async function shareGraphic(graphic:GeneratedGraphic){
 const blob=await fetch(graphic.dataUrl).then(response=>response.blob())
 const file=new File([blob],graphic.filename,{type:'image/png'})
 const shareNavigator=navigator as Navigator&{canShare?:(data:ShareData)=>boolean}
 if(!navigator.share||shareNavigator.canShare&&!shareNavigator.canShare({files:[file]}))throw new Error('Sharing this image is not supported in this browser.')
 await navigator.share({files:[file],title:'PlayFooty team selection'})
}
function isShareCancellation(reason:unknown){return reason instanceof DOMException&&(reason.name==='AbortError'||reason.name==='NotAllowedError')||reason instanceof Error&&/cancel|abort/i.test(reason.message)}
function openGraphic(graphic:GeneratedGraphic){const popup=window.open('','_blank');if(!popup)throw new Error('Allow pop-ups for PlayFooty, then try again.');popup.document.open();popup.document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${graphic.filename}</title><style>html,body{margin:0;background:#000;min-height:100%;display:grid;place-items:center}img{display:block;max-width:100%;height:auto}p{position:fixed;left:12px;right:12px;bottom:12px;margin:0;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.72);color:#fff;text-align:center;font:600 14px -apple-system,BlinkMacSystemFont,sans-serif}</style></head><body><img src="${graphic.dataUrl}" alt="Team selection graphic"><p>Press and hold the image, then choose Save to Photos.</p></body></html>`);popup.document.close()}
function downloadGraphic(graphic:GeneratedGraphic){const anchor=document.createElement('a');anchor.download=graphic.filename;anchor.href=graphic.dataUrl;document.body.appendChild(anchor);anchor.click();anchor.remove()}

export default function TeamSelectionDeepLink(){
 const{pathname,search}=useLocation();const navigate=useNavigate()
 const[modal,setModal]=useState<ModalState>({open:false,status:'loading',title:'Generating image',message:'Preparing your team graphic…',graphic:null})
 const closeModal=()=>setModal(current=>current.status==='loading'?current:{...current,open:false})

 useEffect(()=>{document.body.style.overflow=modal.open?'hidden':'';return()=>{document.body.style.overflow=''}},[modal.open])
 useEffect(()=>{const handleClick=(event:MouseEvent)=>{const graphicButton=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-team-graphic-action]'):null;if(graphicButton){const clubId=graphicButton.dataset.clubId;if(clubId){event.preventDefault();if(graphicButton.disabled)return;graphicButton.disabled=true;setModal({open:true,status:'loading',title:'Preparing graphic',message:'Loading the published team…',graphic:null});void generateGraphic(clubId,(title,message)=>setModal({open:true,status:'loading',title,message,graphic:null})).then(graphic=>setModal({open:true,status:'success',title:'Graphic ready',message:'Preview the image, then open it to save to Photos or use Share.',graphic})).catch(reason=>setModal({open:true,status:'error',title:'Image generation failed',message:reason instanceof Error?reason.message:'Unable to generate the image.',graphic:null})).finally(()=>{graphicButton.disabled=false})}return}const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('.club-feature-game-card footer a'):null;if(!anchor)return;const url=new URL(anchor.href,window.location.origin);const match=url.pathname.match(/^\/team\/([^/]+)$/);if(!match)return;event.preventDefault();navigate(`/team/${match[1]}?tab=team-selection`)};document.addEventListener('click',handleClick);return()=>document.removeEventListener('click',handleClick)},[navigate])
 useEffect(()=>{const portalMatch=pathname.match(/^\/club-portal\/([^/]+)\/team-selection\/?$/);if(!portalMatch)return;let cancelled=false;const connect=()=>{if(cancelled)return;const head=document.querySelector<HTMLElement>('.cpts-sheet-head>div:last-child');if(!head||head.querySelector('[data-team-graphic-action]'))return;const button=document.createElement('button');button.type='button';button.dataset.teamGraphicAction='true';button.dataset.clubId=portalMatch[1];button.className='team-graphic-action';button.textContent='Generate image';button.setAttribute('aria-label','Generate team selection social image');head.appendChild(button)};connect();const observer=new MutationObserver(connect);observer.observe(document.body,{childList:true,subtree:true});return()=>{cancelled=true;observer.disconnect()}},[pathname])
 useEffect(()=>{if(!/^\/team\/[^/]+$/.test(pathname)||new URLSearchParams(search).get('tab')!=='team-selection')return;let observer:MutationObserver|null=null;let timeout=0;const open=()=>{const stack=document.querySelector<HTMLElement>('.club-team-selection-stack');if(!stack||stack.getAttribute('aria-hidden')==='true')return false;window.setTimeout(()=>stack.scrollIntoView({behavior:'smooth',block:'start'}),120);return true};if(!open()){observer=new MutationObserver(()=>{if(open())observer?.disconnect()});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-hidden','style']});timeout=window.setTimeout(()=>observer?.disconnect(),10000)}return()=>{observer?.disconnect();window.clearTimeout(timeout)}},[pathname,search])

 if(!modal.open)return null
 return <div className="tg-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)closeModal()}}><section className={`tg-modal ${modal.status}`} role="dialog" aria-modal="true" aria-labelledby="tg-modal-title"><div className="tg-modal-icon">{modal.status==='loading'?<span className="tg-spinner"/>:modal.status==='success'?'✓':'!'}</div><span className="tg-modal-kicker">AI MEDIA STUDIO</span><h2 id="tg-modal-title">{modal.title}</h2><p>{modal.message}</p>{modal.status==='loading'?<div className="tg-progress"><i/></div>:null}{modal.status==='success'&&modal.graphic?<><img className="tg-preview" src={modal.graphic.dataUrl} alt="Generated team selection graphic"/><div className="tg-actions"><button type="button" className="primary" onClick={()=>{try{openGraphic(modal.graphic!)}catch(reason){setModal(current=>({...current,message:reason instanceof Error?reason.message:'Unable to open the image.'}))}}}>Open image to save</button><button type="button" onClick={()=>void shareGraphic(modal.graphic!).catch(reason=>{if(isShareCancellation(reason))return;setModal(current=>({...current,message:reason instanceof Error?reason.message:'Unable to share the image.'}))})}>Share</button><button type="button" onClick={()=>downloadGraphic(modal.graphic!)}>Download file</button><button type="button" className="ghost" onClick={closeModal}>Close</button></div></>:modal.status==='error'?<button type="button" onClick={closeModal}>Close</button>:null}<style>{modalStyles}</style></section></div>
}

const modalStyles=`.tg-modal-backdrop{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:16px;background:rgba(3,8,15,.8);backdrop-filter:blur(8px)}.tg-modal{width:min(470px,100%);max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;padding:26px 22px;border-radius:22px;background:#fff;color:#111318;text-align:center;box-shadow:0 26px 80px rgba(0,0,0,.4);font-family:Barlow,Inter,Arial,sans-serif}.tg-modal-icon{width:62px;height:62px;margin:0 auto 14px;display:grid;place-items:center;border-radius:50%;background:#e8f7ff;color:#0783c9;font-size:32px;font-weight:950}.tg-modal.success .tg-modal-icon{background:#e2f8ec;color:#126c40}.tg-modal.error .tg-modal-icon{background:#ffe9e9;color:#a51d16}.tg-modal-kicker{color:#0783c9;font-size:10px;font-weight:950;letter-spacing:.16em}.tg-modal h2{margin:8px 0 10px;font-family:'Bebas Neue',Impact,sans-serif;font-size:40px;line-height:.95;text-transform:uppercase}.tg-modal p{margin:0;color:#667384;font-size:15px;line-height:1.5}.tg-modal button{width:100%;border:0;border-radius:11px;padding:14px;background:#111318;color:#fff;font-weight:950;text-transform:uppercase}.tg-modal button.primary{background:#35b6ff;color:#071019}.tg-modal button.ghost{background:#e9eef2;color:#111318}.tg-actions{display:grid;gap:9px;margin-top:14px}.tg-preview{display:block;width:100%;height:auto;margin-top:18px;border-radius:14px;background:#07172b;box-shadow:0 12px 30px rgba(0,0,0,.18)}.tg-progress{height:8px;margin-top:24px;overflow:hidden;border-radius:99px;background:#dfe8ef}.tg-progress i{display:block;width:42%;height:100%;border-radius:99px;background:#35b6ff;animation:tgProgress 1.25s ease-in-out infinite}.tg-spinner{width:28px;height:28px;border:4px solid rgba(7,131,201,.2);border-top-color:#0783c9;border-radius:50%;animation:tgSpin .8s linear infinite}@keyframes tgSpin{to{transform:rotate(360deg)}}@keyframes tgProgress{0%{transform:translateX(-110%)}100%{transform:translateX(250%)}}`