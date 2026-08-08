from pathlib import Path
import re

path = Path('src/pages/CoachAppMatchDay.tsx')
text = path.read_text()
original = text

# Remove any remaining legacy three-button toolbar from older Match Day layouts.
text = re.sub(
    r'\s*<nav className="camd-tools"[^>]*>.*?</nav>',
    '',
    text,
    flags=re.S,
)

# Keep a defensive rule so stale/legacy toolbar markup can never display again.
marker = '.camd-tools{display:none!important}'
if marker not in text:
    text = text.replace('const styles=`', 'const styles=`\n' + marker)

if text == original:
    raise SystemExit('No Match Day toolbar change was required')

path.write_text(text)
print('Removed legacy Whiteboard / Game Plan / KPIs toolbar')
