from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
source = path.read_text()

old_markup = '''<div className="camd-oval"><div className="camd-field-markings" aria-hidden="true"><span className="centre-circle"/><span className="centre-line"/><span className="forward-arc top"/><span className="forward-arc bottom"/><span className="goal-square top"/><span className="goal-square bottom"/></div>{FIELD_ROWS.map((row,index)=><div className={`camd-row ${index===0||index===FIELD_ROWS.length-1?'edge-row':''}`} key={index}>{row.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}</div>)}</div>'''
new_markup = '''<div className="camd-oval"><div className="camd-field-markings" aria-hidden="true"><div className="camd-centre-square"/><div className="camd-centre-circle"/><div className="camd-arc top"/><div className="camd-arc bottom"/><div className="camd-goals top"/><div className="camd-goals bottom"/></div><div className="camd-field">{FIELD_ROWS.map((row,index)=><div className={`camd-row row-${index}`} key={index}>{row.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}</div>)}</div></div>'''

if old_markup in source:
    source = source.replace(old_markup, new_markup, 1)
elif 'className="camd-field"' not in source:
    raise SystemExit('Match Day field markup did not match expected source')

tag = '/* Match Day exact Select Side layout */'
css = '''/* Match Day exact Select Side layout */
.camd-ground{display:grid!important;grid-template-columns:180px minmax(0,1fr)!important;column-gap:7px!important;align-items:start!important}
.camd-ground-head{grid-column:1/-1!important}
.camd-oval{grid-column:2!important;position:relative!important;width:min(850px,100%)!important;height:min(650px,calc(100vh - 255px))!important;min-height:600px!important;margin:0!important;justify-self:stretch!important;overflow:visible!important;padding:14px 17px!important;box-sizing:border-box!important;border:1px solid #253b49!important;border-radius:15px!important;background:#091720!important;box-shadow:0 9px 25px rgba(0,0,0,.24)!important;display:block!important}
.camd-field-markings{position:absolute!important;z-index:0!important;inset:8px 2%!important;overflow:hidden!important;border:3px solid #2cf18f!important;border-radius:50% / 46%!important;background:repeating-linear-gradient(90deg,#067b39 0 10%,#078b40 10% 20%)!important;box-shadow:inset 0 0 30px rgba(0,0,0,.18),0 0 20px rgba(44,241,143,.14)!important;pointer-events:none!important}
.camd-centre-square{position:absolute;width:25%;height:22%;left:37.5%;top:39%;border:2px solid rgba(255,255,255,.55)}
.camd-centre-circle{position:absolute;width:8%;aspect-ratio:1;left:46%;top:46%;border:2px solid rgba(255,255,255,.55);border-radius:50%}
.camd-arc{position:absolute;left:25%;width:50%;height:26%;border:2px solid rgba(255,255,255,.55);border-radius:50%}
.camd-arc.top{top:-9%}.camd-arc.bottom{bottom:-9%}
.camd-goals{position:absolute;left:44%;width:12%;height:7%;border:2px solid rgba(255,255,255,.55)}
.camd-goals.top{top:-1%;border-top:0}.camd-goals.bottom{bottom:-1%;border-bottom:0}
.camd-field{position:relative!important;z-index:2!important;height:100%!important;display:grid!important;grid-template-rows:repeat(6,1fr)!important;align-items:center!important}
.camd-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important;align-items:center!important;width:auto!important;margin:0!important;position:relative!important;z-index:2!important}
.camd-row.row-0 .camd-player:nth-child(2){transform:translateY(-14px)!important}
.camd-row.row-5 .camd-player:nth-child(2){transform:translateY(14px)!important}
.camd-interchange{grid-column:2!important;width:100%!important;margin:8px 0 0!important;display:grid!important;grid-template-columns:1fr!important;gap:6px!important}
.camd-interchange>b{justify-self:start!important}.camd-interchange>small{justify-self:start!important}.camd-bench{grid-template-columns:repeat(2,minmax(0,1fr))!important;width:100%!important}
.camd-player{min-height:58px!important}
@media(max-width:900px){.camd-ground{grid-template-columns:180px minmax(0,1fr)!important}.camd-oval{height:min(610px,calc(100vh - 255px))!important;padding:14px 17px!important}.camd-interchange{grid-column:2!important}}
@media(orientation:portrait) and (max-width:800px){.camd-ground{grid-template-columns:180px minmax(0,1fr)!important}.camd-oval{min-height:600px!important;padding:14px 17px!important}.camd-field-markings{inset:8px 2%!important}.camd-row{gap:4px!important}.camd-player{min-height:58px!important}.camd-bench{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:620px){.camd-ground{grid-template-columns:150px minmax(0,1fr)!important}.camd-oval{padding:10px 8px!important;min-height:570px!important}.camd-interchange{grid-column:2!important}}
@media(orientation:landscape) and (max-height:760px){.camd-ground{grid-template-columns:210px minmax(0,1fr)!important}.camd-oval{height:calc(100vh - 205px)!important;min-height:410px!important;max-height:540px!important;padding:12px 32px!important}.camd-row{gap:8px!important}.camd-row.row-0 .camd-player:nth-child(2){transform:translateY(-9px)!important}.camd-row.row-5 .camd-player:nth-child(2){transform:translateY(9px)!important}.camd-player{min-height:47px!important}.camd-interchange{grid-column:2!important}.camd-bench{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
'''

for old_tag in ('/* Match Day exact Select Side wrapper */', tag):
    if old_tag in source:
        start = source.index(old_tag)
        end = source.index('\n`', start)
        source = source[:start] + source[end:]

end = source.rfind('\n`')
if end < 0:
    raise SystemExit('style template end not found')
source = source[:end] + '\n' + css + source[end:]
path.write_text(source)
