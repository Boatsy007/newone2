from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
source = path.read_text()

# Keep Match Day logic and card contents, but use the exact Select Side field
# structure/classes so the geometry is no longer separately approximated.
source = source.replace('className="camd-oval"', 'className="cas-field-wrap camd-oval"')
source = source.replace('className="camd-field-markings"', 'className="cas-field-markings camd-field-markings"')
source = source.replace('className="camd-centre-square"', 'className="cas-centre-square camd-centre-square"')
source = source.replace('className="camd-centre-circle"', 'className="cas-centre-circle camd-centre-circle"')
source = source.replace('className="camd-arc top"', 'className="cas-arc camd-arc top"')
source = source.replace('className="camd-arc bottom"', 'className="cas-arc camd-arc bottom"')
source = source.replace('className="camd-goals top"', 'className="cas-goals camd-goals top"')
source = source.replace('className="camd-goals bottom"', 'className="cas-goals camd-goals bottom"')
source = source.replace('className="camd-field"', 'className="cas-field camd-field"')
source = source.replace('className={`camd-row row-${index}`}', 'className={`cas-row camd-row row-${index}`}')
source = source.replace('className={`camd-player ${', 'className={`cas-position-card camd-player ${')

# Remove every earlier generated override block before appending one exact copy.
for tag in ('/* Match Day exact Select Side wrapper */', '/* Match Day exact Select Side layout */', '/* Exact Select Side field classes */'):
    while tag in source:
        start = source.index(tag)
        end = source.index('\n`', start)
        source = source[:start] + source[end:]

css = '''/* Exact Select Side field classes */
.camd-ground{display:block!important}
.camd-ground-head{display:flex!important}
.cas-field-wrap.camd-oval{position:relative!important;width:min(850px,100%)!important;height:min(650px,calc(100vh - 255px))!important;min-height:540px!important;margin:5px auto 0!important;overflow:visible!important;padding:18px 36px!important;box-sizing:border-box!important;border:1px solid #253b49!important;border-radius:15px!important;background:#091720!important;box-shadow:0 9px 25px rgba(0,0,0,.24)!important;display:block!important}
.cas-field-markings.camd-field-markings{position:absolute!important;z-index:0!important;inset:12px 6%!important;overflow:hidden!important;border:3px solid #2cf18f!important;border-radius:50% / 46%!important;background:repeating-linear-gradient(90deg,#067b39 0 10%,#078b40 10% 20%)!important;box-shadow:inset 0 0 30px rgba(0,0,0,.18),0 0 20px rgba(44,241,143,.14)!important;pointer-events:none!important}
.cas-centre-square.camd-centre-square{position:absolute!important;width:25%!important;height:22%!important;left:37.5%!important;top:39%!important;border:2px solid rgba(255,255,255,.55)!important}
.cas-centre-circle.camd-centre-circle{position:absolute!important;width:8%!important;aspect-ratio:1!important;left:46%!important;top:46%!important;border:2px solid rgba(255,255,255,.55)!important;border-radius:50%!important}
.cas-arc.camd-arc{position:absolute!important;left:25%!important;width:50%!important;height:26%!important;border:2px solid rgba(255,255,255,.55)!important;border-radius:50%!important}
.cas-arc.camd-arc.top{top:-9%!important}.cas-arc.camd-arc.bottom{bottom:-9%!important}
.cas-goals.camd-goals{position:absolute!important;left:44%!important;width:12%!important;height:7%!important;border:2px solid rgba(255,255,255,.55)!important}
.cas-goals.camd-goals.top{top:-1%!important;border-top:0!important}.cas-goals.camd-goals.bottom{bottom:-1%!important;border-bottom:0!important}
.cas-field.camd-field{position:relative!important;z-index:2!important;height:100%!important;display:grid!important;grid-template-rows:repeat(6,1fr)!important;align-items:center!important}
.cas-row.camd-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;align-items:center!important;width:auto!important;margin:0!important;position:relative!important;z-index:2!important}
.cas-row.camd-row.row-0 .cas-position-card:nth-child(2){transform:translateY(-14px)!important}
.cas-row.camd-row.row-5 .cas-position-card:nth-child(2){transform:translateY(14px)!important}
.cas-position-card.camd-player{position:relative!important;min-width:0!important;height:62px!important;min-height:62px!important;padding:6px 8px!important;border-radius:8px!important;box-sizing:border-box!important;box-shadow:0 4px 0 rgba(0,0,0,.24)!important;transition:transform .08s ease,box-shadow .08s ease,border-color .08s ease!important}
.cas-position-card.camd-player:active,.cas-position-card.camd-player.selected{transform:translateY(3px)!important;box-shadow:0 1px 0 rgba(0,0,0,.25)!important}
.camd-interchange{width:min(850px,100%)!important;margin:8px auto 0!important}
.camd-bench{grid-template-columns:repeat(4,minmax(0,1fr))!important;width:100%!important}
@media(max-width:900px){.cas-field-wrap.camd-oval{height:min(610px,calc(100vh - 255px))!important;padding-left:22px!important;padding-right:22px!important}.cas-position-card.camd-player{height:57px!important;min-height:57px!important;padding-left:6px!important;padding-right:6px!important}}
@media(orientation:portrait) and (max-width:800px){.cas-field-wrap.camd-oval{min-height:600px!important;padding:14px 17px!important}.cas-field-markings.camd-field-markings{inset:8px 2%!important}.cas-row.camd-row{gap:4px!important}.cas-position-card.camd-player{height:58px!important;min-height:58px!important;padding:5px!important}.camd-bench{grid-template-columns:repeat(2,1fr)!important}}
@media(max-width:620px){.cas-field-wrap.camd-oval{padding:10px 8px!important;min-height:570px!important}.cas-position-card.camd-player{height:54px!important;min-height:54px!important}}
@media(orientation:landscape) and (max-height:760px){.cas-field-wrap.camd-oval{height:calc(100vh - 205px)!important;min-height:410px!important;max-height:540px!important;padding:12px 32px!important}.cas-position-card.camd-player{height:47px!important;min-height:47px!important}.cas-row.camd-row.row-0 .cas-position-card:nth-child(2){transform:translateY(-9px)!important}.cas-row.camd-row.row-5 .cas-position-card:nth-child(2){transform:translateY(9px)!important}.camd-bench{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
'''

end = source.rfind('\n`')
if end < 0:
    raise SystemExit('style template end not found')
source = source[:end] + '\n' + css + source[end:]
path.write_text(source)
