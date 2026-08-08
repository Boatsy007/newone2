from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
text = path.read_text()
old = "const timer=window.setInterval(()=>void refresh(),1500)"
new = "const timer=window.setInterval(()=>void refresh(),300)"
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('Match Day live stats polling interval was not found')
path.write_text(text)
