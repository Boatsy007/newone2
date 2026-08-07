from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
source = path.read_text()

tag = '/* Match Day full-width proportional field */'
while tag in source:
    start = source.index(tag)
    end = source.index('\n`', start)
    source = source[:start] + source[end:]

css = '''/* Match Day full-width proportional field */
.camd-ground{width:100%!important;padding-bottom:0!important}
.camd-page-grid{display:block!important;width:100%!important;max-width:none!important;margin:0!important}
.camd-squad-spacer{display:none!important}
.camd-board{display:grid!important;width:100%!important;max-width:none!important;margin:0!important;gap:8px!important}
.camd-board .cas-field-wrap{width:100%!important;max-width:none!important;height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:850 / 650!important;margin:0!important;padding:clamp(10px,2.1vw,24px) clamp(12px,4.2vw,44px)!important}
.camd-board .cas-field{height:100%!important}
.camd-board .cas-bench{width:100%!important;margin:0!important}
@media(max-width:900px){
  .camd-page-grid{display:block!important;width:100%!important}
  .camd-squad-spacer{display:none!important}
  .camd-board .cas-field-wrap{width:100%!important;height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:850 / 650!important;padding:clamp(10px,2vw,18px) clamp(10px,3vw,28px)!important}
}
@media(orientation:portrait) and (max-width:800px){
  .camd-page-grid{display:block!important;width:100%!important}
  .camd-board .cas-field-wrap{width:100%!important;height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:850 / 650!important;padding:12px 18px!important}
  .camd-board .cas-field-markings{inset:8px 2%!important}
}
@media(max-width:620px){
  .camd-page-grid{display:block!important;width:100%!important}
  .camd-board .cas-field-wrap{width:100%!important;height:auto!important;min-height:0!important;aspect-ratio:850 / 650!important;padding:9px 10px!important}
}
@media(orientation:landscape) and (max-height:760px){
  .camd-page-grid{display:block!important;width:100%!important}
  .camd-board .cas-field-wrap{width:min(100%,calc((100dvh - 205px) * 850 / 650))!important;height:auto!important;min-height:0!important;max-height:none!important;aspect-ratio:850 / 650!important;margin:0 auto!important;padding:10px 28px!important}
}
'''

end = source.rfind('\n`')
if end < 0:
    raise SystemExit('style template end not found')
source = source[:end] + '\n' + css + source[end:]
path.write_text(source)
