from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()

start_marker = '    {playerDrawerOpen&&<><button className="player-drawer-backdrop"'
end_marker = '    {analysisOpen&&'

start = text.find(start_marker)
if start == -1:
    raise SystemExit('Legacy Build this frame player drawer not found')

end = text.find(end_marker, start)
if end == -1:
    raise SystemExit('Player drawer end marker not found')

legacy_block = text[start:end]
if 'className="player-drawer"' not in legacy_block or 'Build this frame' not in legacy_block:
    raise SystemExit('Refusing to remove unexpected block')

text = text[:start] + text[end:]

# The horizontal player-bottom-tray and horizontal player-selection-bar must remain.
if 'className="player-bottom-tray"' not in text:
    raise SystemExit('Horizontal player bottom tray was unexpectedly removed')
if 'className="player-selection-bar"' not in text:
    raise SystemExit('Horizontal selected-player bar was unexpectedly removed')
if 'className="magnet-inspector"' in text:
    raise SystemExit('Legacy vertical selected-player profile still exists')

path.write_text(text)
