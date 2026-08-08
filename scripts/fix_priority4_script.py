from pathlib import Path
p=Path('scripts/polish_whiteboard_priority4.py')
s=p.read_text()
s=s.replace("stroke.tool==='HIGHLIGHT'?.55:1","stroke.tool==='HIGHLIGHT'?0.55:1")
s=s.replace("strokeLinejoin=\"round\"/>}</g>})}\"\nif old_render", "strokeLinejoin=\"round\"/>}</g>})}\"\"\"\nif old_render")
p.write_text(s)
