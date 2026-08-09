from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()

import_anchor = "import { ArrowLeft,"
if "import CoachAppLoading from '../components/CoachAppLoading'" not in text:
    if import_anchor not in text:
        raise SystemExit('Whiteboard import anchor missing')
    text = text.replace(import_anchor, "import CoachAppLoading from '../components/CoachAppLoading'\n" + import_anchor, 1)

old_loading = "if(loading)return <main className=\"cawb2-loading\"><div className=\"wb-loader-mark\"><span/><span/><span/><span/></div><b>PLAYFOOTY WHITEBOARD</b><p>Loading your selected team and tactics…</p></main>"
new_loading = "if(loading)return <CoachAppLoading message=\"Loading your selected team and tactics…\"/>"
if old_loading in text:
    text = text.replace(old_loading, new_loading, 1)
elif new_loading not in text:
    raise SystemExit('Whiteboard loading return missing')

css_anchor = "/* Whiteboard horizontal AFL workspace */"
compact_css = r'''
/* Compact iPad drawing tray */
@media (min-width:701px){
  .draw-bottom-tray{
    min-height:88px!important;
    height:88px!important;
    padding:7px 9px!important;
    grid-template-columns:minmax(0,1fr) 270px 36px!important;
    gap:8px!important;
  }
  .draw-tool-list{
    gap:5px!important;
    overflow:visible!important;
    min-width:0!important;
    justify-content:space-between!important;
  }
  .draw-tool-list button{
    min-width:0!important;
    width:clamp(48px,6.2vw,62px)!important;
    height:58px!important;
    padding:4px!important;
    border-radius:10px!important;
    gap:2px!important;
    flex:0 1 62px!important;
  }
  .draw-tool-list button svg{width:18px!important;height:18px!important}
  .draw-tool-list button span{font-size:8px!important;line-height:1!important}
  .draw-settings{
    grid-template-columns:94px 1fr!important;
    grid-template-rows:34px 34px!important;
    gap:4px 7px!important;
    min-width:0!important;
  }
  .draw-settings .zoom-controls{
    grid-row:1/3!important;
    display:grid!important;
    grid-template-columns:repeat(3,29px)!important;
    gap:3px!important;
  }
  .draw-settings .zoom-controls button{
    min-width:29px!important;
    width:29px!important;
    height:31px!important;
    min-height:31px!important;
    padding:0!important;
    border-radius:8px!important;
    font-size:11px!important;
  }
  .draw-settings label{
    grid-template-columns:48px minmax(54px,1fr) 25px!important;
    gap:4px!important;
    font-size:7px!important;
    white-space:nowrap!important;
  }
  .draw-settings label input{width:100%!important;min-width:0!important}
  .draw-settings label b{font-size:8px!important}
  .draw-close{
    width:36px!important;
    height:36px!important;
    min-width:36px!important;
    min-height:36px!important;
  }
  .cawb2:has(.draw-bottom-tray) .legend{bottom:94px!important}
}
@media (min-width:701px) and (max-width:980px){
  .draw-bottom-tray{
    left:64px!important;
    grid-template-columns:minmax(0,1fr) 240px 34px!important;
  }
  .draw-settings{
    grid-column:auto!important;
    grid-row:auto!important;
    grid-template-columns:88px 1fr!important;
  }
  .draw-close{grid-column:auto!important;grid-row:auto!important}
  .draw-tool-list{grid-column:auto!important;grid-row:auto!important}
  .draw-tool-list button{width:clamp(43px,5.9vw,56px)!important;flex-basis:56px!important}
}
'''
if compact_css.strip() not in text:
    if css_anchor not in text:
        raise SystemExit('Whiteboard CSS anchor missing')
    text = text.replace(css_anchor, compact_css + "\n" + css_anchor, 1)

path.write_text(text)
