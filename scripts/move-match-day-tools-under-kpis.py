from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
text = path.read_text()
original = text

replacements = [
    (
        "import { Download, FileText, Minus, Pause, Play, Plus, RefreshCw, SkipForward, Wifi, WifiOff, X } from 'lucide-react'",
        "import { Download, Minus, Pause, Play, Plus, RefreshCw, SkipForward, Wifi, WifiOff, X } from 'lucide-react'",
        'unused Match Report icon import',
    ),
    (
        '<KpiPanel stats={teamStats} scoreMargin={scoreMargin} onOpen={()=>void generateReport()}/>',
        '<KpiPanel stats={teamStats} scoreMargin={scoreMargin} onOpen={()=>void generateReport()} onGamePlan={onGamePlan} onWhiteboard={onWhiteboard}/>',
        'KPI panel actions',
    ),
    (
        '      <nav className="camd-tools" aria-label="Match Day tools"><button onClick={onGamePlan} disabled={!onGamePlan}>Game Plan</button><button onClick={onWhiteboard} disabled={!onWhiteboard}>Whiteboard</button><button onClick={()=>void generateReport()}><FileText/> Match Report</button></nav>\n',
        '',
        'duplicate Match Day tools row',
    ),
    (
        'function KpiPanel({stats,scoreMargin,onOpen}:{stats:TeamStats;scoreMargin:number;onOpen?:()=>void}){return <section className="camd-kpis"><header><span>Live KPIs</span>{onOpen&&<button onClick={onOpen}>Match report</button>}</header><div>{KPI_DEFS.map(item=><article className={kpiStatus(stats[item.key],item.target,item.lowerIsBetter)} key={item.key}><small className="wide-label">{item.label}</small><small className="short-label">{item.short}</small><strong>{stats[item.key]}</strong></article>)}<article className={scoreMargin>0?\'green\':scoreMargin===0?\'orange\':\'red\'}><small>Score</small><strong>{scoreMargin>0?\'+\':\'\'}{scoreMargin}</strong></article></div></section>}',
        'function KpiPanel({stats,scoreMargin,onOpen,onGamePlan,onWhiteboard}:{stats:TeamStats;scoreMargin:number;onOpen?:()=>void;onGamePlan?:()=>void;onWhiteboard?:()=>void}){return <section className="camd-kpis"><header><span>Live KPIs</span>{onOpen&&<button onClick={onOpen}>Match report</button>}</header><div>{KPI_DEFS.map(item=><article className={kpiStatus(stats[item.key],item.target,item.lowerIsBetter)} key={item.key}><small className="wide-label">{item.label}</small><small className="short-label">{item.short}</small><strong>{stats[item.key]}</strong></article>)}<article className={scoreMargin>0?\'green\':scoreMargin===0?\'orange\':\'red\'}><small>Score</small><strong>{scoreMargin>0?\'+\':\'\'}{scoreMargin}</strong></article></div><nav className="camd-kpi-tools" aria-label="Match Day tools"><button onClick={onGamePlan} disabled={!onGamePlan}>Game Plan</button><button onClick={onWhiteboard} disabled={!onWhiteboard}>Whiteboard</button></nav></section>}',
        'KPI panel component',
    ),
    (
        ".camd-kpis .short-label{display:none}.camd-tools{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:9px auto 0;width:min(100%,1000px)}.camd-tools button{min-height:42px;border:1px solid #314b5c;border-radius:9px;background:#102633;color:#fff;font-weight:950;text-transform:uppercase}.camd-tools button:active{transform:scale(.96)}.camd-tools button:disabled{opacity:.4}",
        ".camd-kpis .short-label{display:none}.camd-kpi-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:9px}.camd-kpi-tools button{min-height:42px;border:1px solid #314b5c;border-radius:9px;background:#102633;color:#fff;font-weight:950;text-transform:uppercase}.camd-kpi-tools button:active{transform:scale(.96)}.camd-kpi-tools button:disabled{opacity:.4}",
        'KPI tools styling',
    ),
    (
        ".camd-kpis .wide-label{display:block}.camd-kpis .short-label{display:none}.camd-tools{width:100%;margin-top:7px}}",
        ".camd-kpis .wide-label{display:block}.camd-kpis .short-label{display:none}.camd-kpi-tools{grid-template-columns:1fr;margin-top:8px}}",
        'landscape KPI tools styling',
    ),
    (
        ".camd-interchange>small{justify-content:flex-start}.camd-bench{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.camd-tools{position:relative;margin:9px 0 2px 189px;width:calc(100% - 189px)}}",
        ".camd-interchange>small{justify-content:flex-start}.camd-bench{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.camd-kpi-tools{grid-template-columns:1fr}}",
        'portrait KPI tools styling',
    ),
    (
        ".camd-select-board .camd-player{height:54px;min-height:54px}.camd-tools{margin-left:157px;width:calc(100% - 157px)}}",
        ".camd-select-board .camd-player{height:54px;min-height:54px}}",
        'small-screen obsolete tools styling',
    ),
]

for old, new, label in replacements:
    if old not in text:
        raise SystemExit(f'Missing {label}')
    text = text.replace(old, new, 1)

if text == original:
    raise SystemExit('Match Day KPI tools patch made no changes')

path.write_text(text)
print('Moved Game Plan and Whiteboard under Live KPIs and removed duplicate Match Report button')
