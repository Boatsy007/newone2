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
.camd-ground{display:block!important}
.camd-ground-head{display:flex!important}
.camd-oval{position:relative!important;width:min(850px,100%)!important;height:min(650px,calc(100vh - 255px))!important;min-height:540px!important;margin:5px auto 0!important;overflow:visible!important;padding:18px 36px!important;box-sizing:border-box!important;border:1px solid #253b49!important;border-radius:15px!important;background:#091720!important;box-shadow:0 9px 25px rgba(0,0,0,.24)!important;display:block!important}
.camd-field-markings{position:absolute!important;z-index:0!important;inset:12px 6%!important;overflow:hidden!important;border:3px solid #2cf18f!important;border-radius:50% / 46%!important;background:repeating-linear-gradient(90deg,#067b39 0 10%,#078b40 10% 20%)!important;box-shadow:inset 0 0 30px rgba(0,0,0,.18),0 0 20px rgba(44,241,143,.14)!important;pointer-events:none!important}
.camd-centre-square{position:absolute!important;width:25%!important;height:22%!important;left:37.5%!important;top:39%!important;border:2px solid rgba(255,255,255,.55)!important}
.camd-centre-circle{position:absolute!important;width:8%!important;aspect-ratio:1!important;left:46%!important;top:46%!important;border:2px solid rgba(255,255,255,.55)!important;border-radius:50%!important}
.camd-arc{position:absolute!important;left:25%!important;width:50%!important;height:26%!important;border:2px solid rgba(255,255,255,.55)!important;border-radius:50%!important}
.camd-arc.top{top:-9%!important}.camd-arc.bottom{bottom:-9%!important}
.camd-goals{position:absolute!important;left:44%!important;width:12%!important;height:7%!important;border:2px solid rgba(255,255,255,.55)!important}
.camd-goals.top{top:-1%!important;border-top:0!important}.camd-goals.bottom{bottom:-1%!important;border-bottom:0!important}
.camd-field{position:relative!important;z-index:2!important;height:100%!important;display:grid!important;grid-template-rows:repeat(6,1fr)!important;align-items:center!important}
.camd-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;align-items:center!important;width:auto!important;margin:0!important;position:relative!important;z-index:2!important}
.camd-row.row-0 .camd-player:nth-child(2){transform:translateY(-14px)!important}
.camd-row.row-5 .camd-player:nth-child(2){transform:translateY(14px)!important}
.camd-interchange{width:min(850px,100%)!important;margin:8px auto 0!important;display:grid!important;grid-template-columns:auto 1fr auto!important;gap:10px!important}
.camd-bench{grid-template-columns:repeat(4,minmax(0,1fr))!important;width:100%!important}
@media(max-width:900px){.camd-oval{height:min(610px,calc(100vh - 255px))!important;padding-left:22px!important;padding-right:22px!important}.camd-interchange{width:min(850px,100%)!important}}
@media(orientation:portrait) and (max-width:800px){.camd-oval{min-height:600px!important;padding:14px 17px!important}.camd-field-markings{inset:8px 2%!important}.camd-row{gap:4px!important}.camd-interchange{grid-template-columns:1fr!important}.camd-bench{grid-template-columns:repeat(2,1fr)!important}}
@media(max-width:620px){.camd-oval{padding:10px 8px!important;min-height:570px!important}}
@media(orientation:landscape) and (max-height:760px){.camd-oval{height:calc(100vh - 205px)!important;min-height:410px!important;max-height:540px!important;padding:12px 32px!important}.camd-row.row-0 .camd-player:nth-child(2){transform:translateY(-9px)!important}.camd-row.row-5 .camd-player:nth-child(2){transform:translateY(9px)!important}.camd-interchange{width:min(850px,100%)!important}.camd-bench{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
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
