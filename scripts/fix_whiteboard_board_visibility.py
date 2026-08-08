from pathlib import Path

p = Path('src/pages/CoachAppWhiteboardStage2.tsx')
s = p.read_text()
marker = "/* Whiteboard direct-layout visibility repair */"
if marker not in s:
    idx = s.rfind('`')
    if idx < 0:
        raise SystemExit('styles template not found')
    css = r'''
/* Whiteboard direct-layout visibility repair */
.cawb2:not(.presenting){
  display:grid!important;
  grid-template-columns:68px minmax(0,1fr)!important;
  grid-template-rows:64px minmax(0,1fr) 92px!important;
  height:100dvh!important;
  min-height:100dvh!important;
  overflow:hidden!important;
}
.cawb2:not(.presenting)>.wb-topbar{
  grid-column:1 / -1!important;
  grid-row:1!important;
}
.cawb2:not(.presenting)>.tools{
  position:relative!important;
  inset:auto!important;
  grid-column:1!important;
  grid-row:2 / 4!important;
  width:68px!important;
  min-width:68px!important;
  height:auto!important;
  min-height:0!important;
  overflow-y:auto!important;
}
.cawb2:not(.presenting)>.board-wrap{
  grid-column:2!important;
  grid-row:2!important;
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  padding:8px!important;
  overflow:hidden!important;
}
.cawb2:not(.presenting)>.board-wrap>svg{
  display:block!important;
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  visibility:visible!important;
  opacity:1!important;
}
.cawb2:not(.presenting)>.timeline{
  grid-column:2!important;
  grid-row:3!important;
  width:100%!important;
  height:92px!important;
  min-height:92px!important;
  margin:0!important;
  overflow:hidden!important;
}
.cawb2.presenting>.board-wrap{
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
}
@media(max-width:900px) and (orientation:landscape){
  .cawb2:not(.presenting){
    grid-template-columns:64px minmax(0,1fr)!important;
    grid-template-rows:58px minmax(0,1fr) 100px!important;
  }
  .cawb2:not(.presenting)>.tools{width:64px!important;min-width:64px!important}
  .cawb2:not(.presenting)>.timeline{height:100px!important;min-height:100px!important}
}
'''
    s = s[:idx] + css + s[idx:]
p.write_text(s)
