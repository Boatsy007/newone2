from pathlib import Path
import re

path = Path('src/pages/CoachAppMatchDay.tsx')
source = path.read_text()

# Replace the complete Match Day ground with the same page grid, board, field and
# bench structure used by Select Side. Only the live Match Day card renderer is
# retained so scoring, time-on-ground, plus/minus, swapping and injuries continue.
pattern = re.compile(r'''    <main className="camd-ground">.*?    </main>''', re.S)
replacement = '''    <main className="camd-ground">
      <div className="camd-ground-head"><p>Forward line to backline. Tap two players to interchange. Double tap or hold an interchange player to mark injured.</p>{selected&&<b>Choose replacement</b>}</div>
      <div className="camd-page-grid">
        <aside className="camd-squad-spacer" aria-hidden="true" />
        <div className="cas-board camd-board">
          <div className="cas-field-wrap">
            <div className="cas-field-markings" aria-hidden="true"><div className="cas-centre-square"/><div className="cas-centre-circle"/><div className="cas-arc top"/><div className="cas-arc bottom"/><div className="cas-goals top"/><div className="cas-goals bottom"/></div>
            <div className="cas-field">{FIELD_ROWS.map((row,index)=><div className={`cas-row row-${index}`} key={index}>{row.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}</div>)}</div>
          </div>
          <section className="cas-bench camd-interchange"><h2>Interchange</h2><div>{BENCH.map(code=><PlayerTile key={code} code={code} slot={state.slots.find(item=>item.positionCode===code)} selected={selected} totalTrackedSeconds={state.totalTrackedSeconds} onChoose={choosePlayer} onScore={addScore} onToggleInjury={toggleInjury}/>)}</div><small><i className="red"/> 0–2:30 <i className="orange"/> 2:30–5:00 <i className="green"/> 5:00+</small></section>
        </div>
      </div>
    </main>'''
source, count = pattern.subn(replacement, source, count=1)
if count != 1:
    raise SystemExit('Could not replace Match Day ground markup')

# The exact Select Side card shell is used for every live Match Day tile.
source = source.replace('className={`cas-position-card camd-player ${', 'className={`cas-position-card camd-player ${')
source = source.replace('className={`camd-player ${', 'className={`cas-position-card camd-player ${')

# Remove all earlier generated field overrides.
for tag in ('/* Match Day exact Select Side wrapper */', '/* Match Day exact Select Side layout */', '/* Exact Select Side field classes */', '/* Exact Select Side page and board */'):
    while tag in source:
        start = source.index(tag)
        end = source.index('\n`', start)
        source = source[:start] + source[end:]

css = '''/* Exact Select Side page and board */
.camd-ground{margin-top:8px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
.camd-ground-head{max-width:1380px!important;margin:0 auto 10px!important;display:flex!important;justify-content:space-between!important;gap:10px!important;min-height:20px!important;padding:0 2px!important}
.camd-page-grid{max-width:1380px!important;margin:auto!important;display:grid!important;grid-template-columns:250px minmax(0,1fr)!important;gap:13px!important;align-items:start!important}
.camd-squad-spacer{width:250px!important;min-height:1px!important}
.camd-board{min-width:0!important;display:grid!important;gap:8px!important}
.camd-board .cas-field-wrap,.camd-board .cas-bench{border:1px solid #253b49!important;border-radius:15px!important;background:#0d1b26!important;box-shadow:0 9px 25px rgba(0,0,0,.24)!important}
.camd-board .cas-field-wrap{position:relative!important;width:min(850px,100%)!important;height:min(650px,calc(100vh - 255px))!important;min-height:540px!important;margin:auto!important;overflow:visible!important;padding:18px 36px!important;box-sizing:border-box!important;background:#091720!important}
.camd-board .cas-field-markings{position:absolute!important;inset:12px 6%!important;overflow:hidden!important;border:3px solid #2cf18f!important;border-radius:50% / 46%!important;background:repeating-linear-gradient(90deg,#067b39 0 10%,#078b40 10% 20%)!important;box-shadow:inset 0 0 30px rgba(0,0,0,.18),0 0 20px rgba(44,241,143,.14)!important;pointer-events:none!important}
.camd-board .cas-centre-square{position:absolute!important;width:25%!important;height:22%!important;left:37.5%!important;top:39%!important;border:2px solid rgba(255,255,255,.55)!important}
.camd-board .cas-centre-circle{position:absolute!important;width:8%!important;aspect-ratio:1!important;left:46%!important;top:46%!important;border:2px solid rgba(255,255,255,.55)!important;border-radius:50%!important}
.camd-board .cas-arc{position:absolute!important;left:25%!important;width:50%!important;height:26%!important;border:2px solid rgba(255,255,255,.55)!important;border-radius:50%!important}
.camd-board .cas-arc.top{top:-9%!important}.camd-board .cas-arc.bottom{bottom:-9%!important}
.camd-board .cas-goals{position:absolute!important;left:44%!important;width:12%!important;height:7%!important;border:2px solid rgba(255,255,255,.55)!important}
.camd-board .cas-goals.top{top:-1%!important;border-top:0!important}.camd-board .cas-goals.bottom{bottom:-1%!important;border-bottom:0!important}
.camd-board .cas-field{position:relative!important;z-index:2!important;height:100%!important;display:grid!important;grid-template-rows:repeat(6,1fr)!important;align-items:center!important}
.camd-board .cas-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;align-items:center!important}
.camd-board .cas-row.row-0 .cas-position-card:nth-child(2){transform:translateY(-14px)!important}
.camd-board .cas-row.row-5 .cas-position-card:nth-child(2){transform:translateY(14px)!important}
.camd-board .cas-position-card.camd-player{position:relative!important;min-width:0!important;width:100%!important;height:62px!important;min-height:62px!important;padding:6px 8px!important;border:2px solid rgba(255,255,255,.8)!important;border-radius:8px!important;background:#f7f6f1!important;color:#111820!important;text-align:left!important;box-shadow:0 4px 0 rgba(0,0,0,.24)!important;transition:transform .08s ease,box-shadow .08s ease,border-color .08s ease!important;overflow:hidden!important}
.camd-board .cas-position-card.camd-player:active,.camd-board .cas-position-card.camd-player.selected{transform:translateY(3px)!important;box-shadow:0 1px 0 rgba(0,0,0,.25)!important}
.camd-board .cas-bench{padding:9px 11px!important;margin:0!important;width:auto!important;display:block!important}
.camd-board .cas-bench h2{margin:2px 0 0!important;color:#39b8ff!important;font-family:'Bebas Neue',Impact,sans-serif!important;font-size:21px!important;line-height:1!important;text-transform:uppercase!important}
.camd-board .cas-bench>div{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important;margin-top:6px!important}
.camd-board .cas-bench .cas-position-card{height:54px!important;min-height:54px!important}
.camd-board .cas-bench>small{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:4px!important;margin-top:6px!important;color:#a7b7c1!important;font-size:9px!important;white-space:nowrap!important}
.camd-board .cas-bench>small i{width:8px!important;height:8px!important;border-radius:50%!important}.camd-board .cas-bench i.red{background:#ef233c!important}.camd-board .cas-bench i.orange{background:#ff9f1c!important}.camd-board .cas-bench i.green{background:#16c784!important}
@media(max-width:900px){.camd-page-grid{grid-template-columns:210px minmax(0,1fr)!important}.camd-squad-spacer{width:210px!important}.camd-board .cas-field-wrap{height:min(610px,calc(100vh - 255px))!important;padding-left:22px!important;padding-right:22px!important}.camd-board .cas-position-card.camd-player{height:57px!important;min-height:57px!important;padding-left:6px!important;padding-right:6px!important}}
@media(orientation:portrait) and (max-width:800px){.camd-page-grid{grid-template-columns:180px minmax(0,1fr)!important;gap:7px!important}.camd-squad-spacer{width:180px!important}.camd-board .cas-field-wrap{min-height:600px!important;padding:14px 17px!important}.camd-board .cas-field-markings{inset:8px 2%!important}.camd-board .cas-row{gap:4px!important}.camd-board .cas-position-card.camd-player{height:58px!important;min-height:58px!important;padding:5px!important}.camd-board .cas-bench>div{grid-template-columns:repeat(2,1fr)!important}}
@media(max-width:620px){.camd-page-grid{grid-template-columns:150px minmax(0,1fr)!important}.camd-squad-spacer{width:150px!important}.camd-board .cas-field-wrap{padding:10px 8px!important;min-height:570px!important}.camd-board .cas-position-card.camd-player{height:54px!important;min-height:54px!important}}
@media(orientation:landscape) and (max-height:760px){.camd-page-grid{grid-template-columns:210px minmax(0,1fr)!important}.camd-squad-spacer{width:210px!important}.camd-board .cas-field-wrap{height:calc(100vh - 205px)!important;min-height:410px!important;max-height:540px!important;padding:12px 32px!important}.camd-board .cas-position-card.camd-player{height:47px!important;min-height:47px!important}.camd-board .cas-row.row-0 .cas-position-card:nth-child(2){transform:translateY(-9px)!important}.camd-board .cas-row.row-5 .cas-position-card:nth-child(2){transform:translateY(9px)!important}.camd-board .cas-bench>div{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
'''

end = source.rfind('\n`')
if end < 0:
    raise SystemExit('style template end not found')
source = source[:end] + '\n' + css + source[end:]
path.write_text(source)
