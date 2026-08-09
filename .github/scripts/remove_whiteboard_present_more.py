from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()
old = '''<div className="wb-primary-actions"><button className="back" aria-label={returnToMatch?'Return to live match':'Back to Coach Tools'} onClick={onExit}><ArrowLeft/> {returnToMatch?'Return to Match':'Back'}</button><button aria-label="Open presentation mode" onClick={()=>setPresenting(true)}><Presentation/>Present</button><button aria-label="Open more Whiteboard actions" className="wb-more-button" onClick={()=>setMoreOpen(v=>!v)} aria-expanded={moreOpen}><span>•••</span>More</button></div>'''
new = '''<div className="wb-primary-actions"><button className="back" aria-label={returnToMatch?'Return to live match':'Back to Coach Tools'} onClick={onExit}><ArrowLeft/> {returnToMatch?'Return to Match':'Back'}</button></div>'''
if old not in text:
    raise SystemExit('Expected Whiteboard header action block not found')
path.write_text(text.replace(old, new, 1))
