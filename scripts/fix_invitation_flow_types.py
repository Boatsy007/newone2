from pathlib import Path

path = Path('src/pages/ClubPortal.tsx')
text = path.read_text()
old = "onClick={()=>chooseClub(account.clubId)}"
new = "onClick={()=>chooseClub(account)}"
if old not in text:
    raise SystemExit('Expected ClubPortal chooseClub call was not found')
path.write_text(text.replace(old, new, 1))
print('invitation flow type fix applied')
