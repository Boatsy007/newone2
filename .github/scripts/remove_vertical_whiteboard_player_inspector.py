from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()
marker = '/* Hide legacy vertical player inspector */'
css = """
/* Hide legacy vertical player inspector */
.magnet-inspector{display:none!important}
"""
if marker not in text:
    anchor = '/* Grouped Whiteboard drawing tools */'
    if anchor in text:
        text = text.replace(anchor, css + '\n' + anchor, 1)
    else:
        text = text.replace('const styles=`', 'const styles=`\n' + css, 1)
    path.write_text(text)
