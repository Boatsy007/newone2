from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()
old = """    {!presenting&&<header className=\"wb-topbar\"><button className=\"back\" aria-label={returnToMatch?'Return to live match':'Back to Coach Tools'} onClick={onExit}><ArrowLeft/> {returnToMatch?'Return to Match':'Back'}</button><div className=\"wb-title\"><span>PLAYFOOTY WHITEBOARD</span><b>{fixtureLabel}</b><small className={`save-state ${saveStatus.toLowerCase()}`}><i/>{saveStatus==='SAVING'?'Saving…':saveStatus==='OFFLINE'?'Saved on this iPad':'Saved'}</small></div><div className=\"wb-primary-actions\"><button aria-label=\"Open presentation mode\" onClick={()=>setPresenting(true)}><Presentation/>Present</button><button aria-label=\"Open more Whiteboard actions\" className=\"wb-more-button\" onClick={()=>setMoreOpen(v=>!v)} aria-expanded={moreOpen}><span>•••</span>More</button></div></header>}"""
new = """    {!presenting&&<header className=\"wb-topbar\"><div className=\"wb-title\"><span>PLAYFOOTY WHITEBOARD</span><b>{fixtureLabel}</b><small className={`save-state ${saveStatus.toLowerCase()}`}><i/>{saveStatus==='SAVING'?'Saving…':saveStatus==='OFFLINE'?'Saved on this iPad':'Saved'}</small></div><div className=\"wb-primary-actions\"><button className=\"back\" aria-label={returnToMatch?'Return to live match':'Back to Coach Tools'} onClick={onExit}><ArrowLeft/> {returnToMatch?'Return to Match':'Back'}</button><button aria-label=\"Open presentation mode\" onClick={()=>setPresenting(true)}><Presentation/>Present</button><button aria-label=\"Open more Whiteboard actions\" className=\"wb-more-button\" onClick={()=>setMoreOpen(v=>!v)} aria-expanded={moreOpen}><span>•••</span>More</button></div></header>}"""
if old not in text:
    raise SystemExit('Expected Whiteboard header markup not found')
text = text.replace(old, new, 1)
text = text.replace("grid-template-columns:auto minmax(0,1fr) auto!important;", "grid-template-columns:minmax(0,1fr) auto!important;", 1)
for block in [
"""\n\n/* Whiteboard back button position */\n@media (orientation:landscape){\n  .wb-topbar .back{\n    position:relative!important;\n    left:14px!important;\n    top:-4px!important;\n  }\n}\n""",
"""\n\n/* Whiteboard back button position v2 */\n@media (orientation:landscape){\n  .cawb2 .wb-topbar > .back{\n    transform:translate(28px,-8px)!important;\n  }\n}\n"""
]:
    text = text.replace(block, '')
path.write_text(text)
