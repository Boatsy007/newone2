from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()
marker = "/* Whiteboard back button position v2 */"
if marker in text:
    raise SystemExit('Whiteboard back button v2 patch already present')
css = """

/* Whiteboard back button position v2 */
@media (orientation:landscape){
  .cawb2 .wb-topbar > .back{
    transform:translate(28px,-8px)!important;
  }
}
"""
text = text.replace("\n`\n", css + "\n`\n", 1)
path.write_text(text)
# Triggered after the workflow existed so the source patch actually runs.
