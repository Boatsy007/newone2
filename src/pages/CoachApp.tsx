import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, RefreshCw, ShieldCheck } from 'lucide-react'
import CoachAppSelectSide from './CoachAppSelectSide'
import CoachAppMatchDay from './CoachAppMatchDay'

type Session = { access_token: string }
type ClubChoice = { id: string; name: string; logoUrl: string | null; role: string }
type ContextPayload = {
  club: { id: string; name: string; logoUrl: string | null }
  fixture: { id: string; round: string | null; homeName: string; awayName: string; matchDate: string | null } | null
  teamSheet: { id: string; playerCount: number } | null
  matchDay: { started: boolean }
  nextStep: 'SELECT_SIDE' | 'MATCH_DAY'
}

const SESSION_KEY = 'playfooty.clubPortal.session.v1'
const CLUB_KEY = 'playfooty.coachApp.club.v1'
function readSession(): Session | null { try { const raw=localStorage.getItem(SESSION_KEY); return raw?JSON.parse(raw) as Session:null } catch { return null } }
function readClubId() { try { return localStorage.getItem(CLUB_KEY) ?? '' } catch { return '' } }

export default function CoachApp(){
  const navigate=useNavigate()
  const[session,setSession]=useState<Session|null>(()=>readSession())
  const[clubId,setClubId]=useState(()=>readClubId())
  const[clubs,setClubs]=useState<ClubChoice[]>([])
  const[context,setContext]=useState<ContextPayload|null>(null)
  const[step,setStep]=useState<'SELECT_SIDE'|'MATCH_DAY'>('SELECT_SIDE')
  const[loading,setLoading]=useState(Boolean(session))
  const[error,setError]=useState('')
  const[online,setOnline]=useState(navigator.onLine)
  const headers=useMemo<Record<string,string>>(()=>{const next:Record<string,string>={};if(session)next.authorization=`Bearer ${session.access_token}`;return next},[session])

  async function fetchContext(selectedClubId = clubId){
    const query=selectedClubId?`?clubId=${encodeURIComponent(selectedClubId)}`:''
    const response=await fetch(`/api/club-portal/coach-app/context${query}`,{headers})
    const payload=await response.json().catch(()=>({}))
    if(response.status===409&&payload.code==='CLUB_SELECTION_REQUIRED'){
      setClubs(Array.isArray(payload.data?.clubs)?payload.data.clubs:[])
      setContext(null)
      return null
    }
    if(!response.ok)throw new Error(payload.error||'Unable to open the coach app')
    return payload.data as ContextPayload
  }

  async function loadContext(selectedClubId = clubId){
    if(!session)return
    setLoading(true);setError('')
    try{
      let next=await fetchContext(selectedClubId)
      if(!next)return
      if(next.fixture&&!next.teamSheet){
        const sheetResponse=await fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(next.club.id)}/sheets`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({fixtureId:next.fixture.id})})
        const sheetPayload=await sheetResponse.json().catch(()=>({}))
        if(!sheetResponse.ok)throw new Error(sheetPayload.error||'Unable to open team selection')
        next=await fetchContext(next.club.id)
        if(!next)return
      }
      setClubs([]);setContext(next);setStep(next.nextStep)
      setClubId(next.club.id);localStorage.setItem(CLUB_KEY,next.club.id)
    }catch(value){setError(value instanceof Error?value.message:'Unable to open the coach app')}
    finally{setLoading(false)}
  }

  useEffect(()=>{void loadContext()},[session])
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);const visibility=()=>{if(!document.hidden)setSession(readSession())};document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);document.removeEventListener('visibilitychange',visibility)}},[])

  function chooseClub(id:string){setClubId(id);localStorage.setItem(CLUB_KEY,id);void loadContext(id)}
  function changeClub(){localStorage.removeItem(CLUB_KEY);setClubId('');setContext(null);setClubs([]);void loadContext('')}
  function logout(){localStorage.removeItem(SESSION_KEY);localStorage.removeItem(CLUB_KEY);setSession(null);setContext(null);setClubs([]);setClubId('')}

  if(!session)return <main className="coach-login"><style>{styles}</style><section><div className="coach-mark">PF</div><span>PlayFooty Coach</span><h1>Match Day</h1><p>Sign in with your existing PlayFooty Club Portal account.</p><a href="/club-portal?returnTo=%2Fcoach-app"><LogIn size={19}/> Sign in</a><small>Your existing club permissions are used.</small></section></main>
  if(loading)return <main className="coach-loading"><style>{styles}</style><RefreshCw className="spin"/><strong>Opening your team…</strong></main>
  if(clubs.length)return <main className="coach-club-picker"><style>{styles}</style><section><span>PlayFooty Coach</span><h1>Choose a club</h1><p>Open any club you are authorised to manage.</p><div>{clubs.map(club=><button key={club.id} onClick={()=>chooseClub(club.id)}>{club.logoUrl?<img src={club.logoUrl} alt=""/>:<b>PF</b>}<i><strong>{club.name}</strong><small>{club.role.replaceAll('_',' ')}</small></i></button>)}</div><button className="logout" onClick={logout}>Log out</button></section></main>
  if(error&&!context)return <main className="coach-loading"><style>{styles}</style><ShieldCheck/><strong>{error}</strong><button onClick={()=>void loadContext()}>Try again</button><button onClick={logout}>Log out</button></main>
  if(!context)return null

  const fixtureLabel=context.fixture?`${context.fixture.round||'Upcoming match'} · ${context.fixture.homeName} v ${context.fixture.awayName}`:'No active fixture found'
  return <main className="coach-app-root"><style>{styles}</style>
    {!online&&<div className="coach-offline">Internet connection lost. Changes cannot sync until you reconnect.</div>}
    <header className="coach-shell"><div className="coach-club">{context.club.logoUrl?<img src={context.club.logoUrl} alt=""/>:<div>PF</div>}<span><b>{context.club.name}</b><small>{fixtureLabel}</small></span></div><div className="coach-step"><b>Step {step==='SELECT_SIDE'?'1':'2'} of 2</b><span>{step==='SELECT_SIDE'?'Select Side':'Match Day'}</span></div><div className="coach-menu"> <button onClick={changeClub}>Change club</button><button onClick={logout}>Log out</button></div></header>
    {step==='SELECT_SIDE'&&context.teamSheet?<CoachAppSelectSide clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onContinue={()=>setStep('MATCH_DAY')} onExit={()=>navigate(`/club-portal/${encodeURIComponent(context.club.id)}`)}/>:
      context.teamSheet?<CoachAppMatchDay clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onBack={()=>setStep('SELECT_SIDE')}/>:<section className="coach-loading"><strong>No active team sheet is available.</strong></section>}
  </main>
}

const styles=`
.coach-login,.coach-loading,.coach-club-picker{min-height:100vh;display:grid;place-items:center;padding:24px;background:#07121b;color:#fff;font-family:Barlow,Inter,Arial,sans-serif}.coach-login section,.coach-club-picker section{width:min(520px,100%);box-sizing:border-box;padding:38px;border:1px solid #21313e;border-radius:24px;background:#0d1b26;box-shadow:0 24px 70px rgba(0,0,0,.35)}.coach-mark{width:58px;height:58px;display:grid;place-items:center;border-radius:16px;background:#39b8ff;color:#051019;font-weight:1000}.coach-login span,.coach-club-picker>section>span{display:block;margin-top:22px;color:#39b8ff;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.coach-login h1,.coach-club-picker h1{margin:7px 0 14px;font-family:'Bebas Neue',Impact,sans-serif;font-size:64px;line-height:.9;text-transform:uppercase}.coach-login p,.coach-club-picker p{color:#bdc9d2;line-height:1.55}.coach-login a,.coach-loading button{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:22px;padding:15px;border:0;border-radius:12px;background:#39b8ff;color:#051019;text-decoration:none;font-weight:950;text-transform:uppercase}.coach-login small{display:block;margin-top:14px;color:#7f909c}.coach-loading{align-content:center;gap:14px;text-align:center}.coach-loading svg{width:38px;height:38px;color:#39b8ff}.spin{animation:coach-spin 1s linear infinite}@keyframes coach-spin{to{transform:rotate(360deg)}}
.coach-club-picker section>div{display:grid;gap:10px;margin-top:20px}.coach-club-picker section>div>button{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:13px;width:100%;padding:14px;border:1px solid #29404f;border-radius:14px;background:#132633;color:#fff;text-align:left}.coach-club-picker img,.coach-club-picker section>div>button>b{width:48px;height:48px;display:grid;place-items:center;object-fit:contain;border-radius:11px;background:#fff;color:#07121b}.coach-club-picker i,.coach-club-picker strong,.coach-club-picker small{display:block;font-style:normal}.coach-club-picker small{margin-top:3px;color:#8fb0c4;text-transform:uppercase}.coach-club-picker .logout{margin-top:18px;border:0;background:none;color:#9fb0bc;font-weight:900}
.coach-app-root{min-height:100vh;background:#eef3f7;color:#111318}.coach-shell{position:sticky;z-index:1300;top:0;display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:18px;padding:max(12px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) 12px max(18px,env(safe-area-inset-left));background:#07121b;color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.22)}.coach-club{display:flex;align-items:center;gap:11px;min-width:0}.coach-club>img,.coach-club>div{width:42px;height:42px;object-fit:contain;display:grid;place-items:center;border-radius:11px;background:#fff;color:#07121b;font-weight:1000}.coach-club span{min-width:0}.coach-club b,.coach-club small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.coach-club small{margin-top:2px;color:#9fb0bc}.coach-step{text-align:center}.coach-step b{display:block;color:#39b8ff;font-size:11px;text-transform:uppercase}.coach-step span{font-family:'Bebas Neue',Impact,sans-serif;font-size:28px;text-transform:uppercase}.coach-menu{display:flex;gap:8px}.coach-menu button{border:1px solid #314451;border-radius:9px;background:transparent;padding:10px 13px;color:#fff;font-weight:900}.coach-offline{position:fixed;z-index:1500;right:12px;bottom:90px;left:12px;padding:12px;border-radius:10px;background:#a82920;color:#fff;text-align:center;font-weight:900}
@media(max-width:760px){.coach-shell{grid-template-columns:1fr auto}.coach-step{grid-column:1/-1;grid-row:2}.coach-menu{grid-column:2;grid-row:1}.coach-menu button:first-child{display:none}}@media(orientation:landscape) and (max-height:700px){.coach-shell{position:relative}.coach-step span{font-size:23px}}
`
