from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()

anchor = "/* Whiteboard horizontal AFL workspace */"
css = r'''
/* Compact selected drawing and player profiles above bottom tools */
.stroke-inspector,
.magnet-inspector{
  position:fixed!important;
  left:86px!important;
  right:auto!important;
  top:auto!important;
  bottom:96px!important;
  z-index:96!important;
  width:auto!important;
  max-width:calc(100vw - 104px)!important;
  min-height:58px!important;
  padding:8px 10px!important;
  border-radius:14px!important;
  display:flex!important;
  flex-direction:row!important;
  align-items:center!important;
  gap:8px!important;
  overflow-x:auto!important;
  overflow-y:hidden!important;
  background:rgba(7,25,35,.98)!important;
  box-shadow:0 12px 32px rgba(0,0,0,.42)!important;
}
.stroke-inspector header,
.magnet-inspector header{
  min-width:max-content!important;
  display:flex!important;
  align-items:center!important;
  gap:8px!important;
  padding-right:8px!important;
  border-right:1px solid #294553!important;
}
.stroke-inspector header div,
.magnet-inspector header div{display:flex!important;align-items:center!important;gap:7px!important}
.stroke-inspector header span,
.magnet-inspector header span{font-size:8px!important;white-space:nowrap!important}
.stroke-inspector header b,
.magnet-inspector header b{font-size:13px!important;white-space:nowrap!important}
.stroke-inspector header button,
.magnet-inspector header button{width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important}
.stroke-inspector label,
.magnet-inspector label{
  min-width:150px!important;
  display:grid!important;
  grid-template-columns:auto 86px 34px!important;
  align-items:center!important;
  gap:6px!important;
  font-size:9px!important;
  white-space:nowrap!important;
}
.magnet-inspector label{min-width:165px!important;grid-template-columns:auto 108px!important}
.magnet-inspector input{min-height:36px!important;height:36px!important}
.inspector-team{display:flex!important;grid-template-columns:none!important;gap:5px!important;min-width:max-content!important}
.inspector-team button,
.stroke-nudge button,
.stroke-inspector>.danger,
.magnet-inspector>.danger,
.magnet-inspector>button{
  min-height:36px!important;
  height:36px!important;
  padding:0 10px!important;
  white-space:nowrap!important;
}
.stroke-nudge{display:flex!important;grid-template-columns:none!important;gap:5px!important;min-width:max-content!important}
.stroke-nudge button{width:36px!important;min-width:36px!important;padding:0!important}
.cawb2:has(.draw-bottom-tray) .stroke-inspector{bottom:96px!important}
.cawb2:has(.player-bottom-tray) .magnet-inspector{bottom:196px!important}
@media(max-width:900px) and (orientation:landscape){
  .stroke-inspector,.magnet-inspector{
    left:74px!important;
    bottom:88px!important;
    max-width:calc(100vw - 84px)!important;
    min-height:52px!important;
    padding:6px 8px!important;
  }
  .stroke-inspector label{min-width:130px!important;grid-template-columns:auto 68px 28px!important}
  .magnet-inspector label{min-width:145px!important;grid-template-columns:auto 92px!important}
  .cawb2:has(.draw-bottom-tray) .stroke-inspector{bottom:88px!important}
  .cawb2:has(.player-bottom-tray) .magnet-inspector{bottom:188px!important}
}
'''

if css.strip() not in text:
    if anchor not in text:
        raise SystemExit('CSS anchor missing')
    text = text.replace(anchor, css + "\n" + anchor, 1)

path.write_text(text)
