from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()

start = "    {selectedMagnetId&&!presenting&&state.magnets.some(item=>item.id===selectedMagnetId)&&<aside className=\"magnet-inspector\">"
end = "</aside>}\n"

start_index = text.find(start)
if start_index == -1:
    raise SystemExit('Legacy magnet inspector block not found')

end_index = text.find(end, start_index)
if end_index == -1:
    raise SystemExit('Legacy magnet inspector closing tag not found')

text = text[:start_index] + text[end_index + len(end):]

# Keep a final defensive rule so stale legacy markup can never reappear visually.
closing = "`\n"
rule = "\n/* Selected players use the bottom context bar only */\n.magnet-inspector{display:none!important}\n"
last_tick = text.rfind(closing)
if last_tick == -1:
    raise SystemExit('Styles closing marker not found')
if rule.strip() not in text:
    text = text[:last_tick] + rule + text[last_tick:]

path.write_text(text)
