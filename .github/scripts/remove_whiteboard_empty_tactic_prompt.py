from pathlib import Path
p=Path('src/pages/CoachAppWhiteboardStage2.tsx')
s=p.read_text()
old='''{!presenting&&state.magnets.length===0&&state.strokes.length===0&&<div className="wb-empty-board"><div><Users/><b>Build your tactic</b><p>Add individual players, use a quick setup, or start drawing on the oval.</p><button onClick={()=>{setPlayerDrawerOpen(true);setHasOpenedBoard(true)}}>Add players</button></div></div>}'''
if old not in s:
    raise SystemExit('empty tactic prompt not found')
s=s.replace(old,'',1)
p.write_text(s)
