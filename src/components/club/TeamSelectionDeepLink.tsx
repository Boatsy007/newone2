import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const SESSION_KEY='playfooty.clubPortal.session.v1'
const ROWS=[['BP_LEFT','FB','BP_RIGHT'],['HBF_LEFT','CHB','HBF_RIGHT'],['WING_LEFT','CENTRE','WING_RIGHT'],['RUCK','RUCK_ROVER','ROVER'],['HFF_LEFT','CHF','HFF_RIGHT'],['FP_LEFT','FF','FP_RIGHT']]
const LABELS=['B','HB','C','R','HF','F']
const BENCH=['INTERCHANGE_1','INTERCHANGE_2','INTERCHANGE_3','INTERCHANGE_4']
const EMG=['EMERGENCY_1','EMERGENCY_2','EMERGENCY_3']

type Player={positionCode:string;playerName:string;jumperNumber:number|null}
type Sheet={id:string;roundLabel:string;opponentName:string|null;matchDate:string|null;status:string;grade:string;players:Player[]}
type Club={clubName:string;logoUrl:string|null;primaryColour:string|null;secondaryColour:string|null;leagueName:string|null}

function readToken(){try{const raw=localStorage.getItem(SESSION_KEY);if(!raw)return'';const parsed=JSON.parse(raw) as{access_token?:string};return parsed.access_token||''}catch{return''}}
function safeColour(value:string|null|undefined,fallback:string){return /^#[0-9a-f]{6}$/i.test(value||'')?String(value):fallback}
function playerAt(sheet:Sheet,code:string){return sheet.players.find(player=>player.positionCode===code)||null}
function dateLabel(value:string|null){if(!value)return'DATE TBC';const date=new Date(value);return Number.isNaN(date.getTime())?'DATE TBC':date.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).toUpperCase()}
async function loadImage(url:string|null){if(!url)return null;return new Promise<HTMLImageElement|null>(resolve=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=url})}
function cover(ctx:CanvasRenderingContext2D,image:HTMLImageElement,w:number,h:number){const scale=Math.max(w/image.width,h/image.height);const dw=image.width*scale,dh=image.height*scale;ctx.drawImage(image,(w-dw)/2,(h-dh)/2,dw,dh)}
function drawPlayer(ctx:CanvasRenderingContext2D,player:Player|null,x:number,y:number){ctx.textAlign='center';if(!player){ctx.fillStyle='rgba(255,255,255,.38)';ctx.font='700 21px Arial';ctx.fillText('—',x,y+28);ctx.textAlign='left';return}const parts=player.playerName.trim().split(/\s+/);ctx.fillStyle='rgba(255,255,255,.84)';ctx.font='600 20px Arial';ctx.fillText((parts[0]||'').toUpperCase(),x,y+18);ctx.fillStyle='#fff';ctx.font='900 24px Arial';ctx.fillText((parts.slice(1).join(' ')||parts[0]||'').toUpperCase(),x,y+46);if(player.jumperNumber){ctx.fillStyle='rgba(255,255,255,.72)';ctx.font='800 15px Arial';ctx.fillText(`#${player.jumperNumber}`,x,y+68)}ctx.textAlign='left'}
function setInlineMessage(text:string,isError=false){let box=document.querySelector<HTMLElement>('[data-team-graphic-message]');if(!box){box=document.createElement('div');box.dataset.teamGraphicMessage='true';const sheet=document.querySelector('.cpts-sheet');sheet?.prepend(box)}box.textContent=text;box.style.cssText=`margin:0 0 12px;padding:11px 13px;border-radius:9px;font-weight:800;background:${isError?'#fff0f0':'#e7f7ff'};color:${isError?'#a51d16':'#0d4f72'}`}

async function generateAndDownload(clubId:string,button:HTMLButtonElement){
 const token=readToken();if(!token)throw new Error('Your club session has expired. Please sign in again.')
 const headers:Record<string,string>={authorization:`Bearer ${token}`}
 const getJson=async(url:string,options:RequestInit={})=>{const response=await fetch(url,{...options,headers:{...(options.headers as Record<string,string>|undefined),...headers}});const payload=await response.json().catch(()=>({})) as any;if(!response.ok)throw new Error(payload.error||'Request failed');return payload}
 const[sheetPayload,clubPayload]=await Promise.all([getJson(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(clubId)}/sheets`),fetch(`/api/clubs/${encodeURIComponent(clubId)}`).then(async response=>{const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Unable to load club');return payload})])
 const sheets=(Array.isArray(sheetPayload.data)?sheetPayload.data:[]) as Sheet[]
 const sheet=sheets.find(item=>item.status==='PUBLISHED')
 if(!sheet)throw new Error('Publish a team before generating the image.')
 const club=(clubPayload.data||null) as Club|null
 if(!club)throw new Error('Club details could not be loaded.')
 button.textContent='Generating AI…'
 const ai=await getJson(`/api/club-portal/ai-graphics/clubs/${encodeURIComponent(clubId)}/team-background`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clubName:club.clubName,opponentName:sheet.opponentName,primaryColour:club.primaryColour,secondaryColour:club.secondaryColour,style:'premium broadcast'})})
 const background=await loadImage(ai.data?.dataUrl||null)
 if(!background)throw new Error('The AI background could not be loaded.')
 const canvas=document.createElement('canvas');const W=1080,H=1350;canvas.width=W;canvas.height=H
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image canvas is unavailable.')
 cover(ctx,background,W,H);ctx.fillStyle='rgba(2,10,24,.62)';ctx.fillRect(0,0,W,H)
 const shade=ctx.createLinearGradient(0,0,0,H);shade.addColorStop(0,'rgba(0,0,0,.08)');shade.addColorStop(1,'rgba(0,0,0,.82)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H)
 const secondary=safeColour(club.secondaryColour,'#f4b000');const logo=await loadImage(club.logoUrl)
 if(logo){const scale=Math.min(130/logo.width,130/logo.height);ctx.drawImage(logo,72,55,logo.width*scale,logo.height*scale)}
 ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='900 58px Arial';ctx.fillText('TEAM',72,245);ctx.fillStyle=secondary;ctx.font='900 102px Arial';ctx.fillText('SELECTION',72,325)
 ctx.fillStyle='#fff';ctx.textAlign='right';ctx.font='800 27px Arial';ctx.fillText(sheet.roundLabel.toUpperCase(),1000,88);ctx.font='900 32px Arial';ctx.fillText(`V ${sheet.opponentName||'OPPONENT TBC'}`.toUpperCase(),1000,132);ctx.textAlign='left'
 const startY=405,rowH=118,colX=[265,545,825]
 ROWS.forEach((row,index)=>{const y=startY+index*rowH;ctx.fillStyle=secondary;ctx.font='900 24px Arial';ctx.fillText(LABELS[index],72,y+38);row.forEach((code,col)=>drawPlayer(ctx,playerAt(sheet,code),colX[col],y));ctx.strokeStyle='rgba(255,255,255,.2)';ctx.beginPath();ctx.moveTo(145,y+82);ctx.lineTo(1008,y+82);ctx.stroke()})
 let y=startY+ROWS.length*rowH+8;ctx.fillStyle=secondary;ctx.font='900 22px Arial';ctx.fillText('INT',72,y+30);BENCH.forEach((code,index)=>drawPlayer(ctx,playerAt(sheet,code),245+(index%3)*285,y+Math.floor(index/3)*72));y+=155;ctx.fillStyle=secondary;ctx.fillText('EMG',72,y+30);EMG.forEach((code,index)=>drawPlayer(ctx,playerAt(sheet,code),245+index*285,y))
 ctx.fillStyle=secondary;ctx.font='900 23px Arial';ctx.fillText(dateLabel(sheet.matchDate),72,1284);ctx.fillStyle='#fff';ctx.font='700 19px Arial';ctx.fillText((club.leagueName||sheet.grade||'COMMUNITY FOOTBALL').toUpperCase(),72,1318)
 const anchor=document.createElement('a');anchor.download=`${club.clubName}-${sheet.roundLabel}-team-selection.png`.toLowerCase().replace(/[^a-z0-9.-]+/g,'-');anchor.href=canvas.toDataURL('image/png');anchor.click()
 setInlineMessage('Team graphic generated and downloaded.')
}

export default function TeamSelectionDeepLink(){
  const{pathname,search}=useLocation();const navigate=useNavigate()
  useEffect(()=>{const handleClick=(event:MouseEvent)=>{const graphic=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-team-graphic-action]'):null;if(graphic){const clubId=graphic.dataset.clubId;if(clubId){event.preventDefault();if(graphic.disabled)return;graphic.disabled=true;const original=graphic.textContent||'Generate image';void generateAndDownload(clubId,graphic).catch(reason=>setInlineMessage(reason instanceof Error?reason.message:'Unable to generate image',true)).finally(()=>{graphic.disabled=false;graphic.textContent=original})}return}const anchor=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('.club-feature-game-card footer a'):null;if(!anchor)return;const url=new URL(anchor.href,window.location.origin);const match=url.pathname.match(/^\/team\/([^/]+)$/);if(!match)return;event.preventDefault();navigate(`/team/${match[1]}?tab=team-selection`)};document.addEventListener('click',handleClick);return()=>document.removeEventListener('click',handleClick)},[navigate])
  useEffect(()=>{const portalMatch=pathname.match(/^\/club-portal\/([^/]+)\/team-selection\/?$/);if(!portalMatch)return;let cancelled=false;const connect=()=>{if(cancelled)return;const head=document.querySelector<HTMLElement>('.cpts-sheet-head>div:last-child');if(!head||head.querySelector('[data-team-graphic-action]'))return;const button=document.createElement('button');button.type='button';button.dataset.teamGraphicAction='true';button.dataset.clubId=portalMatch[1];button.className='team-graphic-action';button.textContent='Generate image';button.setAttribute('aria-label','Generate and download team selection social image');head.appendChild(button)};connect();const observer=new MutationObserver(connect);observer.observe(document.body,{childList:true,subtree:true});return()=>{cancelled=true;observer.disconnect()}},[pathname])
  useEffect(()=>{if(!/^\/team\/[^/]+$/.test(pathname)||new URLSearchParams(search).get('tab')!=='team-selection')return;let observer:MutationObserver|null=null;let timeout=0;const open=()=>{const stack=document.querySelector<HTMLElement>('.club-team-selection-stack');if(!stack||stack.getAttribute('aria-hidden')==='true')return false;window.setTimeout(()=>stack.scrollIntoView({behavior:'smooth',block:'start'}),120);return true};if(!open()){observer=new MutationObserver(()=>{if(open())observer?.disconnect()});observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-hidden','style']});timeout=window.setTimeout(()=>observer?.disconnect(),10000)}return()=>{observer?.disconnect();window.clearTimeout(timeout)}},[pathname,search])
  return null
}
