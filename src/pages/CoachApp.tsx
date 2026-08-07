import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, ClipboardCheck, Dumbbell, FileText, Gamepad2, LogIn, RefreshCw, ShieldCheck, Sparkles, Trophy } from 'lucide-react'
import CoachAppAvailability from './CoachAppAvailability'
import CoachAppSelectSide from './CoachAppSelectSide'
import CoachAppMatchDay from './CoachAppMatchDay'
import CoachAppTrainingPlan from './CoachAppTrainingPlan'
import CoachAppTrainingReport from './CoachAppTrainingReport'
import CoachAppFixturesResults from './CoachAppFixturesResults'
import CoachAppLeagueLadder from './CoachAppLeagueLadder'
import CoachAppGamePlan from './CoachAppGamePlan'

type Session = { access_token: string }
type ClubChoice = { id: string; name: string; logoUrl: string | null; role: string }
type ContextPayload = {
  club: { id: string; name: string; logoUrl: string | null }
  fixture: { id: string; leagueId: string; season: string; grade: string; round: string | null; homeClubId: string | null; awayClubId: string | null; homeName: string; awayName: string; matchDate: string | null; venue: string | null } | null
  teamSheet: { id: string; playerCount: number } | null
  matchDay: { started: boolean }
  nextStep: 'SELECT_SIDE' | 'MATCH_DAY'
}
type Screen = 'DASHBOARD' | 'TRAINING_PLAN' | 'TRAINING_REPORT' | 'AVAILABILITY' | 'SELECT_SIDE' | 'MATCH_DAY' | 'FIXTURES_RESULTS' | 'LEAGUE_LADDER' | 'GAME_PLAN'
type ToolKey = 'training-plan' | 'training-summary' | 'availability' | 'select-team' | 'game-plan' | 'match-day' | 'fixtures-results' | 'league-ladder'

const SESSION_KEY = 'playfooty.clubPortal.session.v1'
const CLUB_KEY = 'playfooty.coachApp.club.v1'
function readSession(): Session | null { try { const raw=localStorage.getItem(SESSION_KEY); return raw?JSON.parse(raw) as Session:null } catch { return null } }
function readClubId() { try { return localStorage.getItem(CLUB_KEY) ?? '' } catch { return '' } }

const flow: Array<{key:ToolKey;label:string;eyebrow:string}> = [
  {key:'training-plan',label:'Training Plan',eyebrow:'Session 1'},
  {key:'training-summary',label:'Training Report',eyebrow:'Session 1'},
  {key:'availability',label:'This Week Availability',eyebrow:'Players'},
  {key:'training-plan',label:'Training Plan',eyebrow:'Session 2'},
  {key:'training-summary',label:'Training Report',eyebrow:'Session 2'},
  {key:'select-team',label:'Select Team',eyebrow:'Selection'},
  {key:'game-plan',label:'Game Plan',eyebrow:'Prepare'},
  {key:'match-day',label:'Match Day',eyebrow:'Game Day'},
]

export default function CoachApp(){
  const navigate=useNavigate()
  const[session,setSession]=useState<Session|null>(()=>readSession())
  const[clubId,setClubId]=useState(()=>readClubId())
  const[clubs,setClubs]=useState<ClubChoice[]>([])
  const[context,setContext]=useState<ContextPayload|null>(null)
  const[screen,setScreen]=useState<Screen>('DASHBOARD')
  const[trainingSession,setTrainingSession]=useState<1|2>(1)
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
      setClubs([]);setContext(next);setScreen('DASHBOARD')
      setClubId(next.club.id);localStorage.setItem(CLUB_KEY,next.club.id)
    }catch(value){setError(value instanceof Error?value.message:'Unable to open the coach app')}
    finally{setLoading(false)}
  }

  useEffect(()=>{void loadContext()},[session])
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);const visibility=()=>{if(!document.hidden)setSession(readSession())};document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);document.removeEventListener('visibilitychange',visibility)}},[])

  function chooseClub(id:string){setClubId(id);localStorage.setItem(CLUB_KEY,id);void loadContext(id)}
  function changeClub(){localStorage.removeItem(CLUB_KEY);setClubId('');setContext(null);setClubs([]);void loadContext('')}
  function logout(){localStorage.removeItem(SESSION_KEY);localStorage.removeItem(CLUB_KEY);setSession(null);setContext(null);setClubs([]);setClubId('')}
  function openTool(key:ToolKey,sessionNumber?:number){
    if(!context)return
    const id=encodeURIComponent(context.club.id)
    if(key==='training-plan'){setTrainingSession(sessionNumber===2?2:1);setScreen('TRAINING_PLAN');return}
    if(key==='training-summary'){setTrainingSession(sessionNumber===2?2:1);setScreen('TRAINING_REPORT');return}
    if(key==='match-day'){setScreen(context.nextStep==='MATCH_DAY'?'MATCH_DAY':'SELECT_SIDE');return}
    if(key==='select-team'){setScreen('SELECT_SIDE');return}
    if(key==='availability'){setScreen('AVAILABILITY');return}
    if(key==='fixtures-results'){setScreen('FIXTURES_RESULTS');return}
    if(key==='league-ladder'){setScreen('LEAGUE_LADDER');return}
    if(key==='game-plan'){setScreen('GAME_PLAN');return}
    navigate(`/club-portal/${id}/coaching?source=coach-app&section=${key}${sessionNumber?`&session=${sessionNumber}`:''}`)
  }

  if(!session)return <main className="coach-login"><style>{styles}</style><section><div className="coach-mark">PF</div><span>PlayFooty Coach</span><h1>Coach Dashboard</h1><p>Sign in with your existing PlayFooty Club Portal account.</p><a href="/club-portal?returnTo=%2Fcoach-app"><LogIn size={19}/> Sign in</a><small>Your existing club permissions are used.</small></section></main>
  if(loading)return <main className="coach-loading"><style>{styles}</style><RefreshCw className="spin"/><strong>Opening your team…</strong></main>
  if(clubs.length)return <main className="coach-club-picker"><style>{styles}</style><section><span>PlayFooty Coach</span><h1>Choose a club</h1><p>Open any club you are authorised to manage.</p><div>{clubs.map(club=><button key={club.id} onClick={()=>chooseClub(club.id)}>{club.logoUrl?<img src={club.logoUrl} alt=""/>:<b>PF</b>}<i><strong>{club.name}</strong><small>{club.role.replaceAll('_',' ')}</small></i></button>)}</div><button className="logout" onClick={logout}>Log out</button></section></main>
  if(error&&!context)return <main className="coach-loading"><style>{styles}</style><ShieldCheck/><strong>{error}</strong><button onClick={()=>void loadContext()}>Try again</button><button onClick={logout}>Log out</button></main>
  if(!context)return null

  const fixtureLabel=context.fixture?`${context.fixture.round||'Upcoming match'} · ${context.fixture.homeName} v ${context.fixture.awayName}`:'No active fixture found'
  const pageLabel=screen==='DASHBOARD'?'Dashboard':screen==='TRAINING_PLAN'?`Training Plan ${trainingSession}`:screen==='TRAINING_REPORT'?`Training Report ${trainingSession}`:screen==='AVAILABILITY'?'Player Availability':screen==='FIXTURES_RESULTS'?'Fixtures & Results':screen==='LEAGUE_LADDER'?'League Ladder':screen==='GAME_PLAN'?'Game Plan':screen==='SELECT_SIDE'?'Select Side':'Match Day'
  return <main className="coach-app-root"><style>{styles}</style>
    {!online&&<div className="coach-offline">Internet connection lost. Changes cannot sync until you reconnect.</div>}
    <header className="coach-shell"><button className="coach-club" onClick={()=>setScreen('DASHBOARD')}>{context.club.logoUrl?<img src={context.club.logoUrl} alt=""/>:<div>PF</div>}<span><b>{context.club.name}</b><small>{fixtureLabel}</small></span></button><div className="coach-step"><b>PlayFooty Coach</b><span>{pageLabel}</span></div><div className="coach-menu"><button onClick={changeClub}>Change club</button><button onClick={logout}>Log out</button></div></header>
    {screen==='DASHBOARD'&&<section className="coach-dashboard">
      <div className="coach-dashboard-intro"><span>Weekly coaching hub</span><h1>Follow the week through to match day.</h1><p>Everything for the current fixture is kept together, while every tool can still be opened on its own.</p></div>
      <section className="match-flow"><div className="section-heading"><div><span>Current week</span><h2>Match Flow</h2></div><small>{fixtureLabel}</small></div><div className="flow-track">{flow.map((item,index)=>{const sessionNumber=item.eyebrow==='Session 1'?1:item.eyebrow==='Session 2'?2:undefined;return <button key={`${item.key}-${index}`} className={`flow-card ${item.key}`} onClick={()=>openTool(item.key,sessionNumber)}><i>{index+1}</i><span>{item.eyebrow}</span><strong>{item.label}</strong><em>{index<flow.length-1?'Open step':'Start match day'}</em></button>})}</div></section>
      <section className="coach-tools"><div className="section-heading"><div><span>Open directly</span><h2>Coach Tools</h2></div><small>One card for each tool</small></div><div className="tool-grid">
        <button onClick={()=>openTool('training-plan')}><Dumbbell/><span><b>Training Plan</b><small>Build or open either weekly session.</small></span></button>
        <button onClick={()=>openTool('training-summary')}><ClipboardCheck/><span><b>Training Report</b><small>Complete the report after training.</small></span></button>
        <button onClick={()=>openTool('availability')}><CalendarCheck/><span><b>This Week Availability</b><small>See who is available for selection.</small></span></button>
        <button onClick={()=>openTool('select-team')}><Gamepad2/><span><b>Select Team</b><small>Open the current team selection.</small></span></button>
        <button onClick={()=>openTool('game-plan')}><FileText/><span><b>Game Plan</b><small>Prepare the plan for this fixture.</small></span></button>
        <button onClick={()=>openTool('fixtures-results')}><CalendarCheck/><span><b>Fixtures & Results</b><small>View upcoming matches, recent results and Match Centre.</small></span></button>
        <button onClick={()=>openTool('league-ladder')}><Sparkles/><span><b>League Ladder</b><small>View the current published ladder for your league.</small></span></button>
        <button className="match" onClick={()=>openTool('match-day')}><Trophy/><span><b>Match Day</b><small>Select the side and run the live game.</small></span></button>
      </div></section>
    </section>}
    {screen==='GAME_PLAN'?<CoachAppGamePlan clubId={context.club.id} clubName={context.club.name} token={session.access_token} fixture={context.fixture} onExit={()=>setScreen('DASHBOARD')} onContinue={()=>setScreen('MATCH_DAY')}/>:screen==='LEAGUE_LADDER'?<CoachAppLeagueLadder clubId={context.club.id} onExit={()=>setScreen('DASHBOARD')}/>:screen==='FIXTURES_RESULTS'?<CoachAppFixturesResults clubId={context.club.id} clubName={context.club.name} onExit={()=>setScreen('DASHBOARD')}/>:screen==='TRAINING_PLAN'?<CoachAppTrainingPlan clubId={context.club.id} token={session.access_token} sessionNumber={trainingSession} fixtureDate={context.fixture?.matchDate} onExit={()=>setScreen('DASHBOARD')} onContinue={()=>setScreen('TRAINING_REPORT')}/>:
      screen==='TRAINING_REPORT'?<CoachAppTrainingReport clubId={context.club.id} token={session.access_token} sessionNumber={trainingSession} fixtureDate={context.fixture?.matchDate} onExit={()=>setScreen('DASHBOARD')} onContinue={()=>setScreen(trainingSession===1?'AVAILABILITY':'SELECT_SIDE')}/>:
      screen==='AVAILABILITY'&&context.teamSheet?<CoachAppAvailability clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onContinue={()=>{setTrainingSession(2);setScreen('TRAINING_PLAN')}} onExit={()=>setScreen('DASHBOARD')}/>:screen==='SELECT_SIDE'&&context.teamSheet?<CoachAppSelectSide clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onContinue={()=>setScreen('GAME_PLAN')} onExit={()=>setScreen('DASHBOARD')}/>:
      screen==='MATCH_DAY'&&context.teamSheet?<CoachAppMatchDay clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onBack={()=>setScreen('SELECT_SIDE')}/>:screen!=='DASHBOARD'?<section className="coach-loading"><strong>No active team sheet is available.</strong><button onClick={()=>setScreen('DASHBOARD')}>Back to dashboard</button></section>:null}
  </main>
}

const styles=`
.coach-login,.coach-loading,.coach-club-picker{min-height:100vh;display:grid;place-items:center;padding:24px;background:#07121b;color:#fff;font-family:Barlow,Inter,Arial,sans-serif}.coach-login section,.coach-club-picker section{width:min(520px,100%);box-sizing:border-box;padding:38px;border:1px solid #21313e;border-radius:24px;background:#0d1b26;box-shadow:0 24px 70px rgba(0,0,0,.35)}.coach-mark{width:58px;height:58px;display:grid;place-items:center;border-radius:16px;background:#39b8ff;color:#051019;font-weight:1000}.coach-login span,.coach-club-picker>section>span{display:block;margin-top:22px;color:#39b8ff;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.coach-login h1,.coach-club-picker h1{margin:7px 0 14px;font-family:'Bebas Neue',Impact,sans-serif;font-size:64px;line-height:.9;text-transform:uppercase}.coach-login p,.coach-club-picker p{color:#bdc9d2;line-height:1.55}.coach-login a,.coach-loading button{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:22px;padding:15px;border:0;border-radius:12px;background:#39b8ff;color:#051019;text-decoration:none;font-weight:950;text-transform:uppercase}.coach-login small{display:block;margin-top:14px;color:#7f909c}.coach-loading{align-content:center;gap:14px;text-align:center}.coach-loading svg{width:38px;height:38px;color:#39b8ff}.spin{animation:coach-spin 1s linear infinite}@keyframes coach-spin{to{transform:rotate(360deg)}}
.coach-club-picker section>div{display:grid;gap:10px;margin-top:20px}.coach-club-picker section>div>button{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:13px;width:100%;padding:14px;border:1px solid #29404f;border-radius:14px;background:#132633;color:#fff;text-align:left}.coach-club-picker img,.coach-club-picker section>div>button>b{width:48px;height:48px;display:grid;place-items:center;object-fit:contain;border-radius:11px;background:#fff;color:#07121b}.coach-club-picker i,.coach-club-picker strong,.coach-club-picker small{display:block;font-style:normal}.coach-club-picker small{margin-top:3px;color:#8fb0c4;text-transform:uppercase}.coach-club-picker .logout{margin-top:18px;border:0;background:none;color:#9fb0bc;font-weight:900}
.coach-app-root{min-height:100vh;background:#eef3f7;color:#111318;font-family:Barlow,Inter,Arial,sans-serif}.coach-shell{position:sticky;z-index:1300;top:0;display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:18px;padding:max(12px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) 12px max(18px,env(safe-area-inset-left));background:#07121b;color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.22)}.coach-club{display:flex;align-items:center;gap:11px;min-width:0;border:0;background:none;color:#fff;padding:0;text-align:left}.coach-club>img,.coach-club>div{width:42px;height:42px;object-fit:contain;display:grid;place-items:center;border-radius:11px;background:#fff;color:#07121b;font-weight:1000}.coach-club span{min-width:0}.coach-club b,.coach-club small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.coach-club small{margin-top:2px;color:#9fb0bc}.coach-step{text-align:center}.coach-step b{display:block;color:#39b8ff;font-size:11px;text-transform:uppercase}.coach-step span{font-family:'Bebas Neue',Impact,sans-serif;font-size:28px;text-transform:uppercase}.coach-menu{display:flex;gap:8px}.coach-menu button{border:1px solid #314451;border-radius:9px;background:transparent;padding:10px 13px;color:#fff;font-weight:900}.coach-offline{position:fixed;z-index:1500;right:12px;bottom:90px;left:12px;padding:12px;border-radius:10px;background:#a82920;color:#fff;text-align:center;font-weight:900}
.coach-dashboard{width:min(1380px,100%);margin:0 auto;padding:34px 24px 70px;box-sizing:border-box}.coach-dashboard-intro{padding:28px 30px;border-radius:22px;background:linear-gradient(125deg,#07121b,#123147);color:#fff;box-shadow:0 18px 45px rgba(7,18,27,.18)}.coach-dashboard-intro>span,.section-heading span{color:#39b8ff;font-size:11px;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.coach-dashboard-intro h1{max-width:760px;margin:7px 0 9px;font-family:'Bebas Neue',Impact,sans-serif;font-size:48px;line-height:.95;text-transform:uppercase}.coach-dashboard-intro p{max-width:720px;margin:0;color:#bdc9d2;line-height:1.5}.match-flow,.coach-tools{margin-top:24px;padding:22px;border:1px solid #d9e2e8;border-radius:20px;background:#fff;box-shadow:0 10px 28px rgba(29,50,65,.07)}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:16px}.section-heading h2{margin:3px 0 0;font-family:'Bebas Neue',Impact,sans-serif;font-size:34px;line-height:1;text-transform:uppercase}.section-heading small{color:#6f7f8b;text-align:right}.flow-track{display:grid;grid-template-columns:repeat(8,minmax(125px,1fr));gap:10px}.flow-card{position:relative;min-height:158px;padding:16px 13px 14px;border:1px solid #d7e1e7;border-radius:15px;background:#f5f8fa;color:#101820;text-align:left;box-shadow:0 5px 0 #d8e1e7;transition:transform .1s ease,box-shadow .1s ease}.flow-card:active{transform:translateY(4px);box-shadow:0 1px 0 #d8e1e7}.flow-card i{width:27px;height:27px;display:grid;place-items:center;border-radius:50%;background:#dfe8ee;color:#536672;font-size:11px;font-style:normal;font-weight:950}.flow-card span,.flow-card strong,.flow-card em{display:block}.flow-card span{margin-top:22px;color:#73838e;font-size:9px;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.flow-card strong{margin-top:4px;font-size:17px;line-height:1.05}.flow-card em{position:absolute;right:13px;bottom:13px;left:13px;color:#82919b;font-size:10px;font-style:normal;font-weight:900}.flow-card.match-day{background:#07121b;color:#fff;border-color:#07121b;box-shadow:0 5px 0 #39b8ff}.flow-card.match-day i{background:#39b8ff;color:#07121b}.flow-card.match-day span,.flow-card.match-day em{color:#9fb5c3}.tool-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.tool-grid button{min-height:110px;display:grid;grid-template-columns:42px 1fr;align-items:center;gap:12px;padding:17px;border:1px solid #d7e1e7;border-radius:15px;background:#f8fafb;color:#111820;text-align:left}.tool-grid button>svg{width:38px;height:38px;padding:9px;border-radius:12px;background:#e1f3fc;color:#087cac}.tool-grid button span,.tool-grid button b,.tool-grid button small{display:block}.tool-grid button b{font-size:16px}.tool-grid button small{margin-top:5px;color:#73828d;line-height:1.3}.tool-grid button.match{background:#0c2535;color:#fff;border-color:#0c2535}.tool-grid button.match>svg{background:#39b8ff;color:#07121b}.tool-grid button.match small{color:#afc1cc}
@media(max-width:1100px){.flow-track{grid-template-columns:repeat(4,minmax(150px,1fr))}.tool-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.coach-shell{grid-template-columns:1fr auto}.coach-step{grid-column:1/-1;grid-row:2}.coach-menu{grid-column:2;grid-row:1}.coach-menu button:first-child{display:none}.coach-dashboard{padding:18px 12px 50px}.coach-dashboard-intro{padding:23px 20px}.coach-dashboard-intro h1{font-size:39px}.match-flow,.coach-tools{padding:15px}.section-heading{align-items:start}.section-heading small{max-width:140px}.flow-track{grid-template-columns:1fr}.flow-card{min-height:100px;padding-left:54px}.flow-card i{position:absolute;left:14px;top:16px}.flow-card span{margin-top:0}.tool-grid{grid-template-columns:1fr}.tool-grid button{min-height:90px}}@media(orientation:landscape) and (max-height:700px){.coach-shell{position:relative}.coach-step span{font-size:23px}}
`
