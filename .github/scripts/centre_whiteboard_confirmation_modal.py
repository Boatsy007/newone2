from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()
marker = '/* Centre Whiteboard confirmation modal */'
if marker in text:
    raise SystemExit('Whiteboard confirmation modal centring already applied')
css = r'''

/* Centre Whiteboard confirmation modal */
.cawb2 > .cawb2-modal{
  position:fixed!important;
  inset:0!important;
  width:100vw!important;
  height:100dvh!important;
  z-index:3200!important;
  display:grid!important;
  place-items:center!important;
  padding:24px!important;
  background:rgba(0,0,0,.68)!important;
  backdrop-filter:blur(7px)!important;
}
.cawb2 > .cawb2-modal > .wb-native-dialog,
.cawb2 > .cawb2-modal > .wb-result-panel{
  position:relative!important;
  inset:auto!important;
  margin:0!important;
  width:min(520px,calc(100vw - 48px))!important;
  max-height:calc(100dvh - 48px)!important;
  align-self:center!important;
  justify-self:center!important;
}
'''
needle = '\n`\n'
if needle not in text:
    raise SystemExit('Whiteboard styles terminator not found')
path.write_text(text.replace(needle, css + needle, 1))
