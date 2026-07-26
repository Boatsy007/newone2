import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { ArrowLeft, Check, ExternalLink, RefreshCw, Star, Trash2, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { admin, getKey, setKey, type AdminClub, type FootballLeague } from '../lib/admin'

type Row = {
  id:string;category:string;playerId?:string|null;playerName:string;clubId?:string|null;clubName:string;leagueId?:string|null;leagueName?:string|null;matchId?:string|null
  videoUrl:string;thumbnailUrl?:string|null;description?:string|null;headline?:string|null;articleBody?:string|null;mediaSource?:string|null
  submitterName:string;submitterEmail:string;status:string;weekKey:string;votingOpensAt?:string|null;votingClosesAt?:string|null;winner:boolean;featured:boolean;featuredOrder?:number|null;votes:number;createdAt:string;moderationNote?:string|null
}

type CreateForm = {
  category:string;headline:string;playerName:string;clubName:string;clubId:string;leagueName:string;leagueId:string;matchId:string
  thumbnailUrl:string;description:string;articleBody:string;featured:boolean;featuredOrder:string;status:string
}

const emptyForm = (): CreateForm => ({ category:'goal',headline:'',playerName:'',clubName:'',clubId:'',leagueName:'',leagueId:'',matchId:'',thumbnailUrl:'',description:'',articleBody:'',featured:false,featuredOrder:'1',status:'PENDING' })
const req=async<T,>(method:string,path:string,body?:unknown):Promise<T>=>{const response=await fetch(path,{method,headers:{'content-type':'application/json',authorization:`Bearer ${getKey()}`},body:body==null?undefined:JSON.stringify(body)});const json=await response.json().catch(()=>({}));if(!response.ok)throw new Error((json as{error?:string}).error??`HTTP ${response.status}`);return json as T}

export default function AdminHighlights(){
  const[authed,setAuthed]=useState(!!getKey()),[key,setLocalKey]=useState(''),[rows,setRows]=useState<Row[]>([]),[filter,setFilter]=useState('ALL'),[message,setMessage]=useState('')
  const load=()=>req<{data:Row[]}>('GET',`/admin/highlights${filter==='ALL'?'':`?status=${filter}`}`).then(r=>setRows(r.data)).catch(e=>setMessage(e.message))
  useEffect(()=>{if(authed)load()},[authed,filter])
  if(!authed)return <main className="hm-login"><section><h1>Highlights</h1><p>Enter the existing PlayFooty admin key.</p><input type="password" value={key} onChange={e=>setLocalKey(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&key.trim()){setKey(key.trim());setAuthed(true)}}}/><button onClick={()=>{if(key.trim()){setKey(key.trim());setAuthed(true)}}}>Open highlights</button></section><Styles/></main>
  const update=async(id:string,body:Record<string,unknown>)=>{try{await req('PATCH',`/admin/highlights/${id}`,body);setMessage('Saved');load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}}
  const winner=async(id:string)=>{try{await req('POST',`/admin/highlights/${id}/winner`);setMessage('Winner selected and published to linked feeds');load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}}
  const remove=async(id:string)=>{if(!confirm('Delete this pending or rejected highlight?'))return;try{await req('DELETE',`/admin/highlights/${id}`);load()}catch(e){setMessage(e instanceof Error?e.message:String(e))}}
  return <main className="hm-page"><header><div><span>PLAYFOOTY CONTENT</span><h1>Featured Highlights</h1></div><div><Link to="/admin"><ArrowLeft size={17}/> Admin home</Link><button onClick={load}><RefreshCw size={17}/> Refresh</button></div></header>
    <NewHighlight created={()=>{setMessage('Highlight created');setFilter('ALL');load()}} error={setMessage}/>
    <nav>{['ALL','PENDING','APPROVED','REJECTED'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)}>{x}</button>)}</nav>{message&&<p className="hm-message">{message}</p>}
    <section className="hm-list">{rows.map(row=><HighlightEditor key={row.id} row={row} update={update} winner={winner} remove={remove}/>)}{rows.length===0&&<div className="hm-empty">No {filter.toLowerCase()} highlights.</div>}</section><Styles/></main>
}

function NewHighlight({created,error}:{created:()=>void;error:(value:string)=>void}){
  const[mode,setMode]=useState<'URL'|'UPLOAD'>('URL'),[busy,setBusy]=useState(false),[videoUrl,setVideoUrl]=useState(''),[file,setFile]=useState<File|null>(null)
  const[form,setForm]=useState<CreateForm>(emptyForm),[leagues,setLeagues]=useState<FootballLeague[]>([]),[clubs,setClubs]=useState<AdminClub[]>([]),[loadingClubs,setLoadingClubs]=useState(false)
  const set=(key:keyof CreateForm,value:string|boolean)=>setForm(current=>({...current,[key]:value}))

  useEffect(()=>{admin.listFootballLeagues().then(rows=>setLeagues(rows.filter(row=>!row.archivedAt))).catch(e=>error(e instanceof Error?e.message:String(e)))},[])
  useEffect(()=>{
    if(!form.leagueId){setClubs([]);return}
    let active=true;setLoadingClubs(true)
    admin.listClubs(form.leagueId).then(rows=>{if(active)setClubs(rows.filter(row=>!row.archivedAt))}).catch(e=>{if(active)error(e instanceof Error?e.message:String(e))}).finally(()=>{if(active)setLoadingClubs(false)})
    return()=>{active=false}
  },[form.leagueId])

  const sortedLeagues=useMemo(()=>[...leagues].sort((a,b)=>a.name.localeCompare(b.name)),[leagues])
  const sortedClubs=useMemo(()=>[...clubs].sort((a,b)=>a.name.localeCompare(b.name)),[clubs])
  const chooseLeague=(id:string)=>{
    const league=leagues.find(row=>row.id===id)
    setForm(current=>({...current,leagueId:id,leagueName:league?.name??'',clubId:'',clubName:''}))
  }
  const chooseClub=(id:string)=>{
    const club=clubs.find(row=>row.id===id)
    setForm(current=>({...current,clubId:id,clubName:club?.name??''}))
  }
  const uploadVideo=async()=>{
    if(!file)throw new Error('Choose a video file.')
    const prepared=await req<{data:{uploadUrl:string;publicUrl:string}}>('POST','/admin/highlights/upload-url',{fileName:file.name,contentType:file.type||'video/mp4'})
    const response=await fetch(prepared.data.uploadUrl,{method:'PUT',headers:{'content-type':file.type||'video/mp4','x-upsert':'true'},body:file})
    if(!response.ok){const payload=await response.text().catch(()=>'');throw new Error(payload||`Video upload failed: HTTP ${response.status}`)}
    return prepared.data.publicUrl
  }
  const submit=async()=>{
    if(busy)return
    if(!form.leagueId)return error('Choose a league.')
    if(!form.clubId)return error('Choose a club.')
    if(!form.playerName.trim())return error('Enter the player name.')
    setBusy(true)
    try{
      const finalUrl=mode==='UPLOAD'?await uploadVideo():videoUrl.trim()
      if(!finalUrl)throw new Error('Choose a video file or enter a video URL.')
      await req('POST','/admin/highlights',{...form,videoUrl:finalUrl,mediaSource:mode,featured:form.featured&&form.status==='APPROVED',featuredOrder:Number(form.featuredOrder)})
      setVideoUrl('');setFile(null);setForm(emptyForm());setClubs([]);created()
    }catch(e){error(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }
  return <section className="hm-create"><div className="hm-create-head"><div><span>CREATE CONTENT</span><h2>New highlight</h2></div><div className="hm-mode"><button className={mode==='URL'?'active':''} onClick={()=>setMode('URL')}>Video URL</button><button className={mode==='UPLOAD'?'active':''} onClick={()=>setMode('UPLOAD')}><Upload size={16}/> Upload video</button></div></div>
    <div className="hm-create-grid">
      <label>Category<select value={form.category} onChange={e=>set('category',e.target.value)}><option value="goal">Goal of the week</option><option value="mark">Mark of the week</option><option value="play">Play of the week</option><option value="performance">Performance</option></select></label>
      <label>Player name<input value={form.playerName} onChange={e=>set('playerName',e.target.value)}/></label>
      <label>League<select value={form.leagueId} onChange={e=>chooseLeague(e.target.value)}><option value="">Choose league</option>{sortedLeagues.map(league=><option key={league.id} value={league.id}>{league.name}{league.state?.code?` · ${league.state.code}`:''}</option>)}</select></label>
      <label>Club<select value={form.clubId} disabled={!form.leagueId||loadingClubs} onChange={e=>chooseClub(e.target.value)}><option value="">{!form.leagueId?'Choose league first':loadingClubs?'Loading clubs…':'Choose club'}</option>{sortedClubs.map(club=><option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
      <label className="wide">Headline<input value={form.headline} onChange={e=>set('headline',e.target.value)} placeholder="The headline shown on the highlight page"/></label>
      {mode==='URL'?<label className="wide">Video URL<input value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} placeholder="https://..."/></label>:<label className="wide hm-file">Video file<input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" onChange={(e:ChangeEvent<HTMLInputElement>)=>setFile(e.target.files?.[0]??null)}/><span>{file?`${file.name} · ${(file.size/1024/1024).toFixed(1)} MB`:'MP4, MOV, M4V or WEBM'}</span></label>}
      <label className="wide">Thumbnail URL<input value={form.thumbnailUrl} onChange={e=>set('thumbnailUrl',e.target.value)} placeholder="Optional image URL"/></label>
      <label className="wide">Short description<textarea rows={3} value={form.description} onChange={e=>set('description',e.target.value)}/></label>
      <label className="wide">Full story<textarea rows={9} value={form.articleBody} onChange={e=>set('articleBody',e.target.value)} placeholder="Write the story behind the highlight..."/></label>
      <label>Match ID<input value={form.matchId} onChange={e=>set('matchId',e.target.value)} placeholder="Optional"/></label>
      <label>Status<select value={form.status} onChange={e=>set('status',e.target.value)}><option value="PENDING">Draft / pending</option><option value="APPROVED">Publish now</option></select></label>
    </div>
    <div className="hm-selected">{form.leagueName&&<span>League: <b>{form.leagueName}</b></span>}{form.clubName&&<span>Club: <b>{form.clubName}</b></span>}</div>
    <div className="hm-create-actions"><label><input type="checkbox" checked={form.featured} onChange={e=>set('featured',e.target.checked)}/> Feature on homepage</label>{form.featured&&<select value={form.featuredOrder} onChange={e=>set('featuredOrder',e.target.value)}><option value="1">Position 1</option><option value="2">Position 2</option><option value="3">Position 3</option></select>}<button className="approve" disabled={busy} onClick={()=>void submit()}>{busy?(mode==='UPLOAD'?'Uploading…':'Creating…'):'Create highlight'}</button></div>
  </section>
}

function HighlightEditor({row,update,winner,remove}:{row:Row;update:(id:string,body:Record<string,unknown>)=>Promise<void>;winner:(id:string)=>Promise<void>;remove:(id:string)=>Promise<void>}){
  const[playerId,setPlayerId]=useState(row.playerId??''),[clubId,setClubId]=useState(row.clubId??''),[leagueId,setLeagueId]=useState(row.leagueId??''),[matchId,setMatchId]=useState(row.matchId??''),[note,setNote]=useState(row.moderationNote??''),[opens,setOpens]=useState(localDate(row.votingOpensAt)),[closes,setCloses]=useState(localDate(row.votingClosesAt)),[featuredOrder,setFeaturedOrder]=useState(String(row.featuredOrder??1)),[headline,setHeadline]=useState(row.headline??''),[description,setDescription]=useState(row.description??''),[articleBody,setArticleBody]=useState(row.articleBody??''),[videoUrl,setVideoUrl]=useState(row.videoUrl),[thumbnailUrl,setThumbnailUrl]=useState(row.thumbnailUrl??'')
  const save=()=>update(row.id,{playerId,clubId,leagueId,matchId,headline,description,articleBody,videoUrl,thumbnailUrl,moderationNote:note})
  const approve=()=>update(row.id,{status:'APPROVED',playerId,clubId,leagueId,matchId,headline,description,articleBody,videoUrl,thumbnailUrl,moderationNote:note,votingOpensAt:opens?new Date(opens).toISOString():null,votingClosesAt:closes?new Date(closes).toISOString():null})
  const setFeatured=()=>update(row.id,{featured:!row.featured,featuredOrder:row.featured?null:Number(featuredOrder)})
  return <article className={row.featured?'is-featured':''}><div className="hm-video">{row.thumbnailUrl&&<img src={row.thumbnailUrl} alt=""/>}<a href={row.videoUrl} target="_blank" rel="noreferrer">Open video <ExternalLink size={17}/></a>{row.status==='APPROVED'&&<Link to={`/highlights/${row.id}`}>Public detail page</Link>}<small>{row.mediaSource==='UPLOAD'?'Uploaded video':'Video URL'}</small></div><div className="hm-copy"><span>{row.category} · {row.weekKey}</span><h2>{row.headline||row.playerName}</h2><strong>{row.playerName} · {row.clubName}{row.leagueName?` · ${row.leagueName}`:''}</strong>
    <div className="hm-edit-story"><label>Headline<input value={headline} onChange={e=>setHeadline(e.target.value)}/></label><label>Video URL<input value={videoUrl} onChange={e=>setVideoUrl(e.target.value)}/></label><label>Thumbnail URL<input value={thumbnailUrl} onChange={e=>setThumbnailUrl(e.target.value)}/></label><label>Short description<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3}/></label><label className="wide">Full story<textarea value={articleBody} onChange={e=>setArticleBody(e.target.value)} rows={7}/></label></div>
    <small>Submitted by {row.submitterName} · {row.submitterEmail} · {new Date(row.createdAt).toLocaleString('en-AU')}</small><div className="hm-ids"><label>Player ID<input value={playerId} onChange={e=>setPlayerId(e.target.value)}/></label><label>Club ID<input value={clubId} onChange={e=>setClubId(e.target.value)}/></label><label>League ID<input value={leagueId} onChange={e=>setLeagueId(e.target.value)}/></label><label>Match ID<input value={matchId} onChange={e=>setMatchId(e.target.value)}/></label></div>
    <div className="hm-dates"><label>Voting opens<input type="datetime-local" value={opens} onChange={e=>setOpens(e.target.value)}/></label><label>Voting closes<input type="datetime-local" value={closes} onChange={e=>setCloses(e.target.value)}/></label></div><label className="hm-note">Moderation note<textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}/></label>
    {row.status==='APPROVED'&&<div className="hm-feature-control"><label>Homepage position<select value={featuredOrder} onChange={e=>setFeaturedOrder(e.target.value)}><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label><button className={row.featured?'featured':''} onClick={()=>void setFeatured()}><Star size={16}/>{row.featured?`Featured #${row.featuredOrder??featuredOrder}`:'Feature on homepage'}</button></div>}
    <div className="hm-actions"><button onClick={()=>void save()}>Save changes</button><button className="approve" onClick={()=>void approve()}><Check size={16}/> Approve</button><button onClick={()=>void update(row.id,{status:'REJECTED',moderationNote:note})}><X size={16}/> Reject</button><button onClick={()=>void winner(row.id)} disabled={row.status!=='APPROVED'}><Star size={16}/> {row.winner?'Winner':'Select winner'}</button><button onClick={()=>void remove(row.id)} disabled={row.status==='APPROVED'}><Trash2 size={16}/></button></div><b className="hm-votes">{row.votes} votes · {row.status}{row.winner?' · WINNER':''}{row.featured?` · FEATURED #${row.featuredOrder}`:''}</b></div></article>
}

const localDate=(value?:string|null)=>value?new Date(new Date(value).getTime()-new Date(value).getTimezoneOffset()*60000).toISOString().slice(0,16):''
function Styles(){return <style>{`
.hm-page,.hm-login{min-height:100vh;background:#f4f6f8;color:#111318;font-family:Inter,Arial,sans-serif;padding:28px}.hm-page>header{max-width:1180px;margin:0 auto 20px;display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}.hm-page h1,.hm-login h1,.hm-copy h2,.hm-create h2{font-family:'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.hm-page h1{font-size:56px;line-height:.9;margin:6px 0}.hm-page header span,.hm-create-head span{color:#2daaf5;font-size:11px;font-weight:900;letter-spacing:.17em}.hm-page header>div:last-child{display:flex;gap:9px}.hm-page a,.hm-page button,.hm-login button{display:inline-flex;align-items:center;gap:7px;border:1px solid #dce2e8;border-radius:8px;background:#fff;color:#111318;padding:11px 14px;font-weight:850;text-decoration:none;cursor:pointer}.hm-page button:disabled,.hm-page select:disabled{opacity:.5;cursor:not-allowed}.hm-page>nav{max-width:1180px;margin:18px auto;display:flex;gap:8px;overflow:auto}.hm-page>nav button.active{background:#050505;color:#fff}.hm-message{max-width:1180px;margin:0 auto 14px;padding:12px;border-radius:8px;background:#e8f6ff}.hm-create{max-width:1180px;margin:0 auto;background:#fff;border:1px solid #dfe5eb;border-radius:16px;padding:22px}.hm-create-head{display:flex;justify-content:space-between;align-items:end;gap:15px;flex-wrap:wrap}.hm-create h2{font-size:44px;margin:5px 0}.hm-mode{display:flex;gap:7px}.hm-mode .active,.hm-create .approve,.hm-actions .approve{background:#2daaf5;border-color:#2daaf5}.hm-create-grid,.hm-edit-story{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.hm-create-grid label,.hm-edit-story label,.hm-ids label,.hm-dates label,.hm-note,.hm-feature-control label{display:grid;gap:6px;font-size:11px;font-weight:850;text-transform:uppercase}.hm-create-grid input,.hm-create-grid select,.hm-create-grid textarea,.hm-edit-story input,.hm-edit-story textarea,.hm-ids input,.hm-dates input,.hm-note textarea,.hm-feature-control select{width:100%;box-sizing:border-box;border:1px solid #dfe5eb;border-radius:9px;padding:11px;background:#fff}.wide{grid-column:1/-1}.hm-file span{color:#687385;text-transform:none}.hm-selected{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.hm-selected span{padding:8px 11px;border-radius:999px;background:#edf8ff;font-size:12px}.hm-create-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px}.hm-create-actions>button{margin-left:auto}.hm-list{max-width:1180px;margin:0 auto;display:grid;gap:14px}.hm-list article{display:grid;grid-template-columns:260px minmax(0,1fr);background:#fff;border:1px solid #dfe5eb;border-radius:12px;overflow:hidden}.hm-list article.is-featured{border:2px solid #2daaf5}.hm-video{display:grid;place-items:center;align-content:center;gap:10px;min-height:250px;background:#0c0d0f;color:#fff;padding:20px;overflow:hidden}.hm-video img{width:100%;max-height:180px;object-fit:cover;border-radius:8px}.hm-video a{background:#2daaf5;border:0}.hm-copy{padding:22px}.hm-copy>span{color:#2daaf5;text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:.14em}.hm-copy h2{font-size:38px;margin:7px 0 2px}.hm-copy p,.hm-copy small{color:#687385}.hm-ids,.hm-dates{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.hm-feature-control{display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin-top:15px;padding:14px;border-radius:10px;background:#edf8ff}.hm-feature-control .featured{background:#2daaf5;border-color:#2daaf5}.hm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.hm-votes{display:block;margin-top:14px}.hm-empty{padding:40px;text-align:center;background:#fff;border:1px solid #dfe5eb;border-radius:12px}.hm-login{display:grid;place-items:center}.hm-login section{width:min(430px,100%);background:#fff;border:1px solid #dfe5eb;border-radius:14px;padding:28px}.hm-login h1{font-size:42px;margin:0}.hm-login input{width:100%;box-sizing:border-box;border:1px solid #dfe5eb;border-radius:8px;padding:13px;margin:10px 0}.hm-login button{width:100%;justify-content:center;background:#2daaf5;border:0}@media(max-width:760px){.hm-page{padding:18px 12px}.hm-page h1{font-size:43px}.hm-create-grid,.hm-edit-story,.hm-ids,.hm-dates{grid-template-columns:1fr}.wide{grid-column:auto}.hm-list article{grid-template-columns:1fr}.hm-video{min-height:150px}.hm-create-actions>button{margin-left:0;width:100%;justify-content:center}}
`}</style>}
