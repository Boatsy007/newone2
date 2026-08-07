from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
source = path.read_text()
tag = '/* Match Day exact Select Side wrapper */'
css = '''/* Match Day exact Select Side wrapper */
.camd-oval{position:relative!important;isolation:isolate!important;display:grid!important;grid-template-rows:repeat(6,1fr)!important;align-items:center!important;width:min(850px,100%)!important;height:min(650px,calc(100vh - 255px))!important;min-height:600px!important;margin:5px auto 0!important;padding:14px 17px!important;overflow:visible!important;border:1px solid #253b49!important;border-radius:15px!important;background:#091720!important;box-shadow:0 9px 25px rgba(0,0,0,.24)!important}
.camd-field-markings{position:absolute!important;z-index:0!important;inset:8px 2%!important;overflow:hidden!important;border:3px solid #2cf18f!important;border-radius:50% / 46%!important;background:repeating-linear-gradient(90deg,#067b39 0 10%,#078b40 10% 20%)!important;box-shadow:inset 0 0 30px rgba(0,0,0,.18),0 0 20px rgba(44,241,143,.14)!important;pointer-events:none!important}
.camd-row{position:relative!important;z-index:2!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important;align-items:center!important;width:100%!important;margin-left:0!important}
.camd-row.edge-row{width:100%!important;margin-left:0!important}
.camd-row:first-of-type .camd-player:nth-child(2){transform:translateY(-14px)!important}
.camd-row:last-of-type .camd-player:nth-child(2){transform:translateY(14px)!important}
@media(orientation:landscape) and (min-width:900px){.camd-oval{height:calc(100vh - 205px)!important;min-height:410px!important;max-height:540px!important;padding:12px 32px!important}.camd-row{gap:8px!important}.camd-row:first-of-type .camd-player:nth-child(2){transform:translateY(-9px)!important}.camd-row:last-of-type .camd-player:nth-child(2){transform:translateY(9px)!important}}
'''

if tag in source:
    start = source.index(tag)
    end = source.index('\n`', start)
    source = source[:start] + css + source[end:]
else:
    end = source.rfind('\n`')
    if end < 0:
        raise SystemExit('style template end not found')
    source = source[:end] + '\n' + css + source[end:]

path.write_text(source)
