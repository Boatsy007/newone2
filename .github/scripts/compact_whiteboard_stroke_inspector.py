from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()

anchor = "/* Compact selected drawing adjustment bar */"
css = r'''
/* Compact selected drawing adjustment bar */
.stroke-inspector{
  position:fixed!important;
  z-index:95!important;
  left:86px!important;
  right:auto!important;
  top:auto!important;
  bottom:18px!important;
  width:auto!important;
  max-width:calc(100vw - 110px)!important;
  min-height:54px!important;
  padding:7px 9px!important;
  border:1px solid #31505f!important;
  border-radius:14px!important;
  background:rgba(5,22,31,.98)!important;
  box-shadow:0 12px 35px rgba(0,0,0,.42)!important;
  display:flex!important;
  flex-direction:row!important;
  align-items:center!important;
  gap:8px!important;
  overflow-x:auto!important;
  overflow-y:hidden!important;
  white-space:nowrap!important;
}
.cawb2:has(.draw-bottom-tray) .stroke-inspector{bottom:96px!important}
.stroke-inspector header{
  display:flex!important;
  align-items:center!important;
  gap:7px!important;
  min-width:max-content!important;
  margin:0!important;
  padding:0 8px 0 2px!important;
  border-right:1px solid #294553!important;
}
.stroke-inspector header span{font-size:8px!important;margin:0!important}
.stroke-inspector header b{font-size:12px!important;margin:0!important;max-width:86px!important;overflow:hidden!important;text-overflow:ellipsis!important}
.stroke-inspector header button{display:none!important}
.stroke-inspector label{
  display:grid!important;
  grid-template-columns:auto 74px 30px!important;
  align-items:center!important;
  gap:5px!important;
  min-width:145px!important;
  margin:0!important;
  font-size:8px!important;
  line-height:1!important;
}
.stroke-inspector label input{width:74px!important;margin:0!important}
.stroke-inspector label b{font-size:9px!important;text-align:right!important}
.stroke-nudge{
  display:flex!important;
  grid-template-columns:none!important;
  gap:4px!important;
  margin:0!important;
}
.stroke-nudge button{
  width:32px!important;
  min-width:32px!important;
  height:32px!important;
  min-height:32px!important;
  padding:0!important;
  border-radius:8px!important;
  justify-content:center!important;
  font-size:13px!important;
}
.stroke-inspector .danger{
  width:auto!important;
  min-width:82px!important;
  height:34px!important;
  min-height:34px!important;
  padding:0 10px!important;
  border-radius:9px!important;
  font-size:9px!important;
  white-space:nowrap!important;
}
@media(max-width:900px) and (orientation:landscape){
  .stroke-inspector{left:72px!important;max-width:calc(100vw - 84px)!important;min-height:48px!important;padding:5px 7px!important;gap:6px!important}
  .cawb2:has(.draw-bottom-tray) .stroke-inspector{bottom:92px!important}
  .stroke-inspector label{grid-template-columns:auto 58px 25px!important;min-width:122px!important}
  .stroke-inspector label input{width:58px!important}
  .stroke-nudge button{width:29px!important;min-width:29px!important;height:29px!important;min-height:29px!important}
  .stroke-inspector .danger{min-width:72px!important;padding:0 8px!important}
}
'''

if anchor not in text:
    marker = "const styles=`"
    if marker not in text:
        raise SystemExit('styles marker not found')
    # Append at the end of the styles template, before its closing backtick.
    end = text.rfind("`\n")
    if end < 0:
        raise SystemExit('styles end not found')
    text = text[:end] + "\n" + css + text[end:]
else:
    raise SystemExit('compact stroke inspector already applied')

path.write_text(text)
