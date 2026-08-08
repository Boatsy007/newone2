from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
text = path.read_text()
old = '''function KpiPanel({stats,scoreMargin,onOpen,onGamePlan,onWhiteboard}:{stats:TeamStats;scoreMargin:number;onOpen?:()=>void;onGamePlan?:()=>void;onWhiteboard?:()=>void}){return <section className="camd-kpis"><header><span>Live KPIs</span>{onOpen&&<button onClick={onOpen}>Match report</button>}</header><div>{KPI_DEFS.map(item=><article className={kpiStatus(stats[item.key],item.target,item.lowerIsBetter)} key={item.key}><small className="wide-label">{item.label}</small><small className="short-label">{item.short}</small><strong>{stats[item.key]}</strong></article>)}<article className={scoreMargin>0?'green':scoreMargin===0?'orange':'red'}><small>Score</small><strong>{scoreMargin>0?'+':''}{scoreMargin}</strong></article></div><nav className="camd-kpi-tools" aria-label="Match Day tools"><button onClick={onGamePlan} disabled={!onGamePlan}>Game Plan</button><button onClick={onWhiteboard} disabled={!onWhiteboard}>Whiteboard</button></nav></section>}'''
new = '''function KpiPanel({stats,scoreMargin,onOpen,onGamePlan,onWhiteboard}:{stats:TeamStats;scoreMargin:number;onOpen?:()=>void;onGamePlan?:()=>void;onWhiteboard?:()=>void}){return <section className="camd-kpis"><header><span>Live KPIs</span>{onOpen&&<button onClick={onOpen}>Match report</button>}</header><div>{KPI_DEFS.map(item=><article className={kpiStatus(stats[item.key],item.target,item.lowerIsBetter)} key={item.key}><small className="wide-label">{item.label}</small><small className="short-label">{item.short}</small><strong>{stats[item.key]}</strong></article>)}<article className={scoreMargin>0?'green':scoreMargin===0?'orange':'red'}><small>Score</small><strong>{scoreMargin>0?'+':''}{scoreMargin}</strong></article></div><nav className="camd-kpi-tools" aria-label="Match Day tools"><button onClick={onGamePlan} disabled={!onGamePlan}>Game Plan</button><button onClick={onWhiteboard} disabled={!onWhiteboard}>Whiteboard</button><button onClick={onGamePlan} disabled={!onGamePlan}>Set KPIs</button><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('playfooty:assistant-coach'))}>Assistant Coach</button></nav></section>}'''
if old not in text:
    if 'Set KPIs' in text and 'Assistant Coach' in text:
        print('Buttons already present')
    else:
        raise SystemExit('KpiPanel block not found')
else:
    path.write_text(text.replace(old, new, 1))
    print('Added Set KPIs and Assistant Coach buttons')
