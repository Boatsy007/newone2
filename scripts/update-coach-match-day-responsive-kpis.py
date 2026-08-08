from pathlib import Path

match_path = Path('src/pages/CoachAppMatchDay.tsx')
coach_path = Path('src/pages/CoachApp.tsx')
source = match_path.read_text()
coach = coach_path.read_text()

old_types = "type MatchState = { sheetId:string; quarter:number; elapsed:number; runningSince:number|null; homeGoals:number; homeBehinds:number; awayGoals:number; awayBehinds:number; slots:Slot[]; events:MatchEvent[]; totalTrackedSeconds:number; trackingUpdatedAt:number|null }\ntype Props = { clubId:string; sheetId:string; token:string; onBack:()=>void }"
new_types = "type StatKey='inside50s'|'clearances'|'tackles'|'marks'|'rebound50s'|'onePercenters'|'freesAgainst'\ntype TeamStats=Record<StatKey,number>\ntype MatchState = { sheetId:string; quarter:number; elapsed:number; runningSince:number|null; homeGoals:number; homeBehinds:number; awayGoals:number; awayBehinds:number; slots:Slot[]; events:MatchEvent[]; totalTrackedSeconds:number; trackingUpdatedAt:number|null; teamStats?:Partial<TeamStats> }\ntype Props = { clubId:string; sheetId:string; token:string; onBack:()=>void; onGamePlan?:()=>void; onWhiteboard?:()=>void; onFullStats?:()=>void }"
if old_types not in source:
    raise SystemExit('MatchState/Props marker not found')
source = source.replace(old_types, new_types, 1)

marker = "const DOUBLE_TAP_MS=330\n"
insert = """const DOUBLE_TAP_MS=330
const EMPTY_STATS:TeamStats={inside50s:0,clearances:0,tackles:0,marks:0,rebound50s:0,onePercenters:0,freesAgainst:0}
const KPI_DEFS:Array<{key:StatKey;short:string;label:string;target:number;lowerIsBetter?:boolean}>=[
  {key:'inside50s',short:'I50',label:'Inside 50s',target:12},
  {key:'clearances',short:'CLR',label:'Clearances',target:10},
  {key:'tackles',short:'TKL',label:'Tackles',target:16},
  {key:'marks',short:'MARKS',label:'Marks',target:10},
  {key:'rebound50s',short:'R50',label:'Rebound 50s',target:8},
  {key:'onePercenters',short:'1%',label:'1 Percenters',target:12},
  {key:'freesAgainst',short:'FA',label:'Frees Against',target:5,lowerIsBetter:true},
]
"""
if marker not in source:
    raise SystemExit('constant marker not found')
source = source.replace(marker, insert, 1)

old_signature = "export default function CoachAppMatchDay({clubId,sheetId,token,onBack}:Props){"
new_signature = "export default function CoachAppMatchDay({clubId,sheetId,token,onBack,onGamePlan,onWhiteboard,onFullStats}:Props){"
if old_signature not in source:
    raise SystemExit('component signature marker not found')
source = source.replace(old_signature, new_signature, 1)

old_normalise = "function normalise(state:MatchState):MatchState{return {...state,totalTrackedSeconds:Number(state.totalTrackedSeconds)||0,trackingUpdatedAt:state.runningSince?(Number(state.trackingUpdatedAt)||Date.now()):null,slots:state.slots.map(slot=>({...slot,onGround:isOnGround(slot.positionCode),goals:Number(slot.goals)||0,behinds:Number(slot.behinds)||0,plusMinus:Number(slot.plusMinus)||0,onGroundSeconds:Number(slot.onGroundSeconds)||0,benchEnteredAt:typeof slot.benchEnteredAt==='number'?slot.benchEnteredAt:null,injured:Boolean(slot.injured)}))}}"
new_normalise = "function normalise(state:MatchState):MatchState{return {...state,teamStats:{...EMPTY_STATS,...(state.teamStats||{})},totalTrackedSeconds:Number(state.totalTrackedSeconds)||0,trackingUpdatedAt:state.runningSince?(Number(state.trackingUpdatedAt)||Date.now()):null,slots:state.slots.map(slot=>({...slot,onGround:isOnGround(slot.positionCode),goals:Number(slot.goals)||0,behinds:Number(slot.behinds)||0,plusMinus:Number(slot.plusMinus)||0,onGroundSeconds:Number(slot.onGroundSeconds)||0,benchEnteredAt:typeof slot.benchEnteredAt==='number'?slot.benchEnteredAt:null,injured:Boolean(slot.injured)}))}}"
if old_normalise not in source:
    raise SystemExit('normalise marker not found')
source = source.replace(old_normalise, new_normalise, 1)

old_initial = "slots,events:[],totalTrackedSeconds:0,trackingUpdatedAt:null}"
new_initial = "slots,events:[],totalTrackedSeconds:0,trackingUpdatedAt:null,teamStats:{...EMPTY_STATS}}"
if old_initial not in source:
    raise SystemExit('initial state marker not found')
source = source.replace(old_initial, new_initial, 1)

old_seconds = "  const seconds=now(state)\n  return <section className=\"camd\"><style>{styles}</style>"
new_seconds = "  const seconds=now(state)\n  const teamStats:TeamStats={...EMPTY_STATS,...(state.teamStats||{})}\n  const scoreMargin=total(state.homeGoals,state.homeBehinds)-total(state.awayGoals,state.awayBehinds)\n  return <section className=\"camd\"><style>{styles}</style>"
if old_seconds not in source:
    raise SystemExit('seconds marker not found')
source = source.replace(old_seconds, new_seconds, 1)

old_main = '''    <main className="camd-ground">
      <div className="camd-ground-head"><p>Forward line to backline. Tap two players to interchange. Double tap or hold an interchange player to mark injured.</p>{selected&&<b>Choose replacement</b>}</div>
      <div className="camd-oval"><div className="camd-field-markings" aria-hidden="true"><span className="centre-circle"/><span className="centre-line"/><span className="forward-arc top"/><span className="forward-arc bottom"/><span className="goal-square top"/><span className="goal-square bottom"/></div>{FIELD_ROWS.map((row,index)=><div className={`camd-row ${index===0||index===FIELD_ROWS.length-1?'edge-row':''}`} key={index}>{row.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}</div>)}</div>
      <section className="camd-interchange"><b>Interchange</b><div className="camd-bench">{BENCH.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}</div><small><i className="red"/> 0–2:30 <i className="orange"/> 2:30–5:00 <i className="green"/> 5:00+</small></section>
    </main>'''
new_main = '''    <main className="camd-ground">
      <div className="camd-ground-head"><p>Forward line to backline. Tap two players to interchange. Double tap or hold an interchange player to mark injured.</p>{selected&&<b>Choose replacement</b>}</div>
      <div className="camd-match-layout">
        <section className="camd-interchange"><b>Interchange</b><div className="camd-bench">{BENCH.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}</div><small><i className="red"/> 0–2:30 <i className="orange"/> 2:30–5:00 <i className="green"/> 5:00+</small></section>
        <div className="camd-oval"><div className="camd-field-markings" aria-hidden="true"><span className="centre-circle"/><span className="centre-line"/><span className="forward-arc top"/><span className="forward-arc bottom"/><span className="goal-square top"/><span className="goal-square bottom"/></div>{FIELD_ROWS.map((row,index)=><div className={`camd-row ${index===0||index===FIELD_ROWS.length-1?'edge-row':''}`} key={index}>{row.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}</div>)}</div>
        <KpiPanel stats={teamStats} scoreMargin={scoreMargin} onOpen={onFullStats}/>
      </div>
      <nav className="camd-tools" aria-label="Match Day tools"><button onClick={onGamePlan} disabled={!onGamePlan}>Game Plan</button><button onClick={onWhiteboard} disabled={!onWhiteboard}>Whiteboard</button><button onClick={onFullStats} disabled={!onFullStats}>Full Stats</button></nav>
    </main>'''
if old_main not in source:
    raise SystemExit('main layout marker not found')
source = source.replace(old_main, new_main, 1)

component_marker = "function ScoreTeam({label,goals,behinds,side,onAdd,onRemove}"
kpi_component = '''function kpiStatus(value:number,target:number,lowerIsBetter=false){if(lowerIsBetter){if(value<=Math.max(0,target*.7))return 'green';if(value<=target)return 'orange';return 'red'}const ratio=target>0?value/target:0;return ratio>=1?'green':ratio>=.7?'orange':'red'}
function KpiPanel({stats,scoreMargin,onOpen}:{stats:TeamStats;scoreMargin:number;onOpen?:()=>void}){return <section className="camd-kpis"><header><span>Live KPIs</span>{onOpen&&<button onClick={onOpen}>Full stats</button>}</header><div>{KPI_DEFS.map(item=><article className={kpiStatus(stats[item.key],item.target,item.lowerIsBetter)} key={item.key}><small className="wide-label">{item.label}</small><small className="short-label">{item.short}</small><strong>{stats[item.key]}</strong></article>)}<article className={scoreMargin>0?'green':scoreMargin===0?'orange':'red'}><small>Score</small><strong>{scoreMargin>0?'+':''}{scoreMargin}</strong></article></div></section>}

'''
if component_marker not in source:
    raise SystemExit('ScoreTeam component marker not found')
source = source.replace(component_marker, kpi_component + component_marker, 1)

css_marker = "const styles=`\n"
css = r'''const styles=`
.camd-match-layout{display:grid;grid-template-areas:"oval" "bench" "kpis";gap:9px;align-items:start}.camd-match-layout>.camd-oval{grid-area:oval}.camd-match-layout>.camd-interchange{grid-area:bench}.camd-match-layout>.camd-kpis{grid-area:kpis}.camd-kpis{padding:10px;border:1px solid #263d4b;border-radius:12px;background:#091822}.camd-kpis header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.camd-kpis header span{color:#39bfff;font-family:'Bebas Neue',Impact,sans-serif;font-size:23px;text-transform:uppercase}.camd-kpis header button{border:1px solid #345063;border-radius:7px;background:#102633;padding:6px 8px;color:#fff;font-size:9px;font-weight:900;text-transform:uppercase}.camd-kpis>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.camd-kpis article{display:flex;align-items:center;justify-content:space-between;gap:5px;min-width:0;padding:9px 10px;border:2px solid transparent;border-radius:9px;color:#fff}.camd-kpis article.red{border-color:#ff3348;background:#611522}.camd-kpis article.orange{border-color:#ff9f1c;background:#664009}.camd-kpis article.green{border-color:#20d98b;background:#0d593d}.camd-kpis article small{overflow:hidden;font-size:8px;font-weight:950;letter-spacing:.02em;text-overflow:ellipsis;text-transform:uppercase;white-space:nowrap}.camd-kpis article strong{font-family:'Bebas Neue',Impact,sans-serif;font-size:25px;line-height:1}.camd-kpis .short-label{display:none}.camd-tools{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:9px auto 0;width:min(100%,1000px)}.camd-tools button{min-height:42px;border:1px solid #314b5c;border-radius:9px;background:#102633;color:#fff;font-weight:950;text-transform:uppercase}.camd-tools button:active{transform:scale(.96)}.camd-tools button:disabled{opacity:.4}
@media (orientation:landscape) and (min-width:760px){.camd{padding:7px 8px calc(58px + env(safe-area-inset-bottom))}.camd-scoreboard{top:0}.camd-ground{padding:6px 7px}.camd-ground-head{min-height:16px}.camd-match-layout{grid-template-columns:minmax(155px,18%) minmax(0,1fr) minmax(180px,22%);grid-template-areas:"bench oval kpis";gap:8px;align-items:stretch;min-height:calc(100vh - 250px)}.camd-oval{width:100%;min-height:calc(100vh - 266px);margin:0;padding:20px 34px}.camd-row{gap:7px}.camd-row.edge-row{width:104%;margin-left:-2%}.camd-player{min-height:63px}.camd-player>span{min-height:18px;padding-top:3px}.player-score button{min-height:18px}.camd-interchange{display:flex;flex-direction:column;align-items:stretch;width:auto;margin:0;padding:8px;border:1px solid #263d4b;border-radius:12px;background:#091822}.camd-interchange>b{font-size:25px}.camd-bench{grid-template-columns:1fr;gap:9px}.camd-interchange>small{margin-top:auto;display:grid;grid-template-columns:auto 1fr;white-space:normal}.camd-kpis{display:flex;flex-direction:column}.camd-kpis>div{grid-template-columns:1fr;flex:1}.camd-kpis article{min-height:45px}.camd-kpis .wide-label{display:block}.camd-kpis .short-label{display:none}.camd-tools{width:100%;margin-top:7px}}
@media(max-width:900px) and (orientation:portrait){.camd-match-layout{grid-template-areas:"oval" "bench" "kpis"}.camd-kpis>div{grid-template-columns:repeat(4,minmax(0,1fr))}.camd-kpis article{display:grid;justify-items:center;padding:7px 4px}.camd-kpis article strong{font-size:23px}.camd-kpis .wide-label{display:none}.camd-kpis .short-label{display:block}.camd-interchange{grid-template-columns:1fr}.camd-interchange>b{text-align:center}.camd-interchange>small{justify-content:center}.camd-bench{grid-template-columns:repeat(4,minmax(0,1fr))}.camd-tools{position:relative;margin-bottom:2px}}
'''
if css_marker not in source:
    raise SystemExit('styles marker not found')
source = source.replace(css_marker, css, 1)

old_match_render = "<CoachAppMatchDay clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onBack={()=>setScreen('SELECT_SIDE')}/>"
new_match_render = "<CoachAppMatchDay clubId={context.club.id} sheetId={context.teamSheet.id} token={session.access_token} onBack={()=>setScreen('SELECT_SIDE')} onGamePlan={()=>setScreen('GAME_PLAN')} onWhiteboard={()=>navigate(`/club-portal/${encodeURIComponent(context.club.id)}/coaching?source=coach-app&section=whiteboard`)} onFullStats={()=>navigate(`/club-portal/${encodeURIComponent(context.club.id)}/coaching?source=coach-app&section=match-day`)}/>"
if old_match_render not in coach:
    raise SystemExit('CoachApp MatchDay render marker not found')
coach = coach.replace(old_match_render, new_match_render, 1)

match_path.write_text(source)
coach_path.write_text(coach)
print('Responsive Match Day layout and KPI panels connected')
