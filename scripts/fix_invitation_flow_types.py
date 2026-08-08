from pathlib import Path

path = Path('src/pages/ClubPortal.tsx')
text = path.read_text()
replacements = {
    "openClub(current.club_accounts[0].clubId)": "openClub(current.club_accounts[0])",
    "onClick={()=>chooseClub(account.clubId)}": "onClick={()=>chooseClub(account)}",
}
changed = False
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new)
        changed = True
if not changed:
    raise SystemExit('Expected ClubPortal account redirect calls were not found')
path.write_text(text)
print('invitation flow account redirect types fixed')
