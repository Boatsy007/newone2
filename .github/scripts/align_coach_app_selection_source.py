from pathlib import Path

backend = Path('backend/src/api/routes/coach-app.ts')
text = backend.read_text()

old = """    let sheet = await loadSheetForFixture(club.id, fixture)\n    if (!sheet && await reconcileExistingAliasSheet(club, team, fixture)) sheet = await loadSheetForFixture(club.id, fixture)\n"""
new = """    let sheet = await loadSheetForFixture(club.id, fixture)\n    // The Club Portal selection may belong to the authorised club alias while fixtures use a canonical club ID.\n    // Reuse that existing selection read-only rather than creating or moving records during app login.\n    if (!sheet && authorisedClub.id !== club.id) sheet = await loadSheetForFixture(authorisedClub.id, fixture)\n    if (!sheet && await reconcileExistingAliasSheet(club, team, fixture)) sheet = await loadSheetForFixture(club.id, fixture)\n"""
if old not in text:
    raise SystemExit('Coach App sheet lookup anchor not found')
text = text.replace(old, new, 1)
text = text.replace(
    "sheet.id, fixture.id, club.id)\n      sheet.fixtureId = fixture.id",
    "sheet.id, fixture.id, sheet.clubId)\n      sheet.fixtureId = fixture.id",
    1,
)
text = text.replace(
    "`SELECT version,updated_at AS \\\"updatedAt\\\" FROM club_match_day_state WHERE club_id=$1 AND sheet_id=$2 LIMIT 1`, club.id, sheet.id",
    "`SELECT version,updated_at AS \\\"updatedAt\\\" FROM club_match_day_state WHERE club_id=$1 AND sheet_id=$2 LIMIT 1`, sheet.clubId, sheet.id",
    1,
)
backend.write_text(text)

frontend = Path('src/pages/CoachApp.tsx')
text = frontend.read_text()
text = text.replace(
    "teamSheet: { id: string; playerCount: number } | null",
    "teamSheet: { id: string; clubId: string; playerCount: number } | null",
    1,
)
text = text.replace(
    "  const fixtureLabel=context.fixture?",
    "  const teamSheetClubId=context.teamSheet?.clubId||context.club.id\n  const fixtureLabel=context.fixture?",
    1,
)
for component in ('CoachAppAvailability', 'CoachAppSelectSide', 'CoachAppWhiteboard', 'CoachAppMatchDay'):
    text = text.replace(
        f"<{component} clubId={{context.club.id}} sheetId={{context.teamSheet.id}}",
        f"<{component} clubId={{teamSheetClubId}} sheetId={{context.teamSheet.id}}",
    )
text = text.replace(
    "<CoachAppStats clubId={context.club.id} sheetId={context.teamSheet?.id}",
    "<CoachAppStats clubId={teamSheetClubId} sheetId={context.teamSheet?.id}",
)
frontend.write_text(text)
