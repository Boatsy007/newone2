from pathlib import Path
p=Path('src/pages/CoachApp.tsx')
s=p.read_text()
old=" onFullStats={()=>navigate(`/club-portal/${encodeURIComponent(context.club.id)}/coaching?source=coach-app&section=match-day`)}"
if old not in s: raise SystemExit('Missing Match Day Full Stats prop')
p.write_text(s.replace(old,'',1))
print('Removed obsolete Full Stats prop from Coach App')
