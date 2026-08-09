from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()
marker = '/* Whiteboard player area filter layout fix */'
css = r'''
/* Whiteboard player area filter layout fix */
.player-bottom-tray header{
  grid-template-columns:auto auto minmax(220px,1fr) auto!important;
  gap:10px!important;
  min-height:42px!important;
}
.player-area-filters{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  gap:5px!important;
  min-width:0!important;
}
.player-area-filters button{
  min-width:48px!important;
  height:36px!important;
  min-height:36px!important;
  padding:0 9px!important;
  border:1px solid #31505f!important;
  border-radius:9px!important;
  background:#0c2633!important;
  color:#c7d5dc!important;
  font-size:10px!important;
  font-weight:950!important;
}
.player-area-filters button.active{
  background:#109ee8!important;
  border-color:#55c8ff!important;
  color:#fff!important;
}
.player-tray-list{
  min-height:0!important;
  height:100%!important;
  visibility:visible!important;
  opacity:1!important;
}
@media(max-width:900px) and (orientation:landscape){
  .player-bottom-tray header{
    grid-template-columns:auto auto minmax(180px,1fr) auto!important;
    gap:6px!important;
  }
  .player-area-filters{gap:4px!important}
  .player-area-filters button{min-width:42px!important;padding:0 6px!important;font-size:9px!important}
}
'''
if marker not in text:
    anchor = '/* Compact selected drawing adjustment bar */'
    if anchor not in text:
        raise SystemExit('CSS insertion anchor not found')
    text = text.replace(anchor, css + '\n' + anchor, 1)
    path.write_text(text)
