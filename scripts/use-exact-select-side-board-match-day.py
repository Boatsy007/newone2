from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
text = path.read_text()
old = '''        <div className="camd-oval"><div className="camd-field-markings" aria-hidden="true"><span className="centre-circle"/><span className="centre-line"/><span className="forward-arc top"/><span className="forward-arc bottom"/><span className="goal-square top"/><span className="goal-square bottom"/></div>{FIELD_ROWS.map((row,index)=><div className={`camd-row ${index===0||index===FIELD_ROWS.length-1?'edge-row':''}`} key={index}>{row.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}</div>)}</div>'''
new = '''        <div className="camd-select-board"><div className="camd-select-markings" aria-hidden="true"><div className="camd-select-centre-square"/><div className="camd-select-centre-circle"/><div className="camd-select-arc top"/><div className="camd-select-arc bottom"/><div className="camd-select-goals top"/><div className="camd-select-goals bottom"/></div><div className="camd-select-field">{FIELD_ROWS.map((row,index)=><div className={`camd-select-row row-${index}`} key={index}>{row.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}</div>)}</div></div>'''
if old not in text:
    raise SystemExit('Match Day oval markup not found')
text = text.replace(old, new, 1)
text = text.replace('.camd-match-layout>.camd-oval{grid-area:oval}', '.camd-match-layout>.camd-select-board{grid-area:oval}', 1)
text = text.replace('.camd-match-layout>.camd-oval{grid-area:oval;width:100%;min-height:650px;margin:0;padding:27px 12px;border-radius:48% / 38%}', '.camd-match-layout>.camd-select-board{grid-area:oval}', 1)

insert = r'''
/* Exact Select Side field board shared geometry */
.camd-select-board{position:relative;width:min(850px,100%);height:min(650px,calc(100vh - 255px));min-height:540px;margin:auto;overflow:visible;padding:18px 36px;box-sizing:border-box;border:1px solid #253b49;border-radius:15px;background:#091720;box-shadow:0 9px 25px rgba(0,0,0,.24)}
.camd-select-markings{position:absolute;inset:12px 6%;overflow:hidden;border:3px solid #2cf18f;border-radius:50% / 46%;background:repeating-linear-gradient(90deg,#067b39 0 10%,#078b40 10% 20%);box-shadow:inset 0 0 30px rgba(0,0,0,.18),0 0 20px rgba(44,241,143,.14)}
.camd-select-centre-square{position:absolute;width:25%;height:22%;left:37.5%;top:39%;border:2px solid rgba(255,255,255,.55)}
.camd-select-centre-circle{position:absolute;width:8%;aspect-ratio:1;left:46%;top:46%;border:2px solid rgba(255,255,255,.55);border-radius:50%}
.camd-select-arc{position:absolute;left:25%;width:50%;height:26%;border:2px solid rgba(255,255,255,.55);border-radius:50%}
.camd-select-arc.top{top:-9%}.camd-select-arc.bottom{bottom:-9%}
.camd-select-goals{position:absolute;left:44%;width:12%;height:7%;border:2px solid rgba(255,255,255,.55)}
.camd-select-goals.top{top:-1%;border-top:0}.camd-select-goals.bottom{bottom:-1%;border-bottom:0}
.camd-select-field{position:relative;z-index:2;height:100%;display:grid;grid-template-rows:repeat(6,1fr);align-items:center}
.camd-select-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:center}
.camd-select-row.row-0 .camd-player:nth-child(2){transform:translateY(-14px)}
.camd-select-row.row-5 .camd-player:nth-child(2){transform:translateY(14px)}
.camd-select-board .camd-player{height:62px;min-height:62px;border-radius:8px;box-shadow:0 4px 0 rgba(0,0,0,.24)}
.camd-select-board .camd-player>span{min-height:20px;padding-top:4px}
.camd-select-board .player-score button{min-height:18px}
@media(max-width:900px){.camd-select-board{height:min(610px,calc(100vh - 255px));padding-left:22px;padding-right:22px}.camd-select-board .camd-player{height:57px;min-height:57px}}
@media(orientation:portrait) and (max-width:800px){.camd-match-layout{grid-template-columns:180px minmax(0,1fr);gap:7px}.camd-select-board{min-height:600px;height:min(650px,calc(100vh - 255px));padding:14px 17px}.camd-select-markings{inset:8px 2%}.camd-select-row{gap:4px}.camd-select-board .camd-player{height:58px;min-height:58px}.camd-select-row.row-0 .camd-player:nth-child(2){transform:translateY(-14px)}.camd-select-row.row-5 .camd-player:nth-child(2){transform:translateY(14px)}.camd-match-layout>.camd-interchange{width:100%}.camd-interchange{padding:9px 11px;border:1px solid #253b49;border-radius:15px;background:#0d1b26;box-shadow:0 9px 25px rgba(0,0,0,.24)}.camd-interchange>b{font-size:21px}.camd-bench{grid-template-columns:repeat(2,1fr);gap:7px;margin-top:6px}.camd-bench .camd-player{height:54px;min-height:54px}}
@media(max-width:620px){.camd-match-layout{grid-template-columns:150px minmax(0,1fr)}.camd-select-board{padding:10px 8px;min-height:570px}.camd-select-board .camd-player{height:54px;min-height:54px}.camd-tools{margin-left:157px;width:calc(100% - 157px)}}
@media(orientation:landscape) and (min-width:760px){.camd-select-board{width:100%;height:calc(100vh - 205px);min-height:410px;max-height:540px;padding:12px 32px}.camd-select-board .camd-player{height:47px;min-height:47px}.camd-select-row.row-0 .camd-player:nth-child(2){transform:translateY(-9px)}.camd-select-row.row-5 .camd-player:nth-child(2){transform:translateY(9px)}}
'''
marker = '\n.camd{min-height:'
if marker not in text:
    raise SystemExit('CSS insertion point not found')
text = text.replace(marker, insert + marker, 1)
path.write_text(text)
