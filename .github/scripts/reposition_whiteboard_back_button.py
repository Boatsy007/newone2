from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()
marker = "\n\n/* Whiteboard back button position */\n"
css = """

/* Whiteboard back button position */
@media (orientation:landscape){
  .wb-topbar .back{
    position:relative!important;
    left:14px!important;
    top:-4px!important;
  }
}
"""
if marker in text:
    raise SystemExit('Whiteboard back button position patch already present')
path.write_text(text.replace("\n`\n", css + "\n`\n", 1))
