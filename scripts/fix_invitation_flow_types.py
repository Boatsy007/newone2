from pathlib import Path
import re

path = Path('src/pages/ClubPortal.tsx')
text = path.read_text()
text, count = re.subn(r'\b(openClub|chooseClub)\(([^()]*?(?:\([^()]*\)[^()]*)*?)\.clubId\)', r'\1(\2)', text)
path.write_text(text)
print(f'invitation flow account redirect types fixed: {count}')
