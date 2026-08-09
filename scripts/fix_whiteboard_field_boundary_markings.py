from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()

old = '''<path d="M6 18 Q43 50 6 82M154 18 Q117 50 154 82" fill="none" stroke="rgba(255,255,255,.58)" strokeWidth=".45"/><path d="M6 38h8M6 46h11M6 54h11M6 62h8M154 38h-8M154 46h-11M154 54h-11M154 62h-8" stroke="#fff" strokeWidth=".55" strokeLinecap="round"/><path d="M6 38v24M154 38v24" stroke="rgba(255,255,255,.5)" strokeWidth=".35"/>'''

new = '''<path d="M31.5 16 Q58 50 31.5 84M128.5 16 Q102 50 128.5 84" fill="none" stroke="rgba(255,255,255,.58)" strokeWidth=".45"/><path d="M8.7 38H14M6.3 46H17.3M6.3 54H17.3M8.7 62H14M151.3 38H146M153.7 46H142.7M153.7 54H142.7M151.3 62H146" stroke="#fff" strokeWidth=".55" strokeLinecap="round"/><path d="M8.7 38C6.9 43 6.3 47 6.3 50C6.3 53 6.9 57 8.7 62M151.3 38C153.1 43 153.7 47 153.7 50C153.7 53 153.1 57 151.3 62" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".35"/>'''

if old not in text:
    raise SystemExit('Current AFL marking block was not found; no file changed.')

text = text.replace(old, new, 1)
path.write_text(text)
