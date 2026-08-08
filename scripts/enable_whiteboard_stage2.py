from pathlib import Path

path=Path('src/pages/CoachApp.tsx')
text=path.read_text()
old="import CoachAppWhiteboard from './CoachAppWhiteboard'"
new="import CoachAppWhiteboard from './CoachAppWhiteboardStage2'"
if old not in text:
    if new in text:
        print('Stage 2 already enabled')
        raise SystemExit(0)
    raise SystemExit('whiteboard import not found')
path.write_text(text.replace(old,new,1))
print('Stage 2 whiteboard enabled')
