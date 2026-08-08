from pathlib import Path
import re

# Applies one full-screen loading experience across every current Coach App page.
FILES = {
    'src/pages/CoachApp.tsx': 'Opening your team…',
    'src/pages/CoachAppTrainingPlan.tsx': 'Opening training plans…',
    'src/pages/CoachAppTrainingReport.tsx': 'Opening training report…',
    'src/pages/CoachAppAvailability.tsx': 'Opening player availability…',
    'src/pages/CoachAppSelectSide.tsx': 'Opening team selection…',
    'src/pages/CoachAppGamePlan.tsx': 'Opening game plan…',
    'src/pages/CoachAppMatchDay.tsx': 'Opening Match Day…',
    'src/pages/CoachAppStats.tsx': 'Opening live stats…',
    'src/pages/CoachAppFixturesResults.tsx': 'Opening fixtures and results…',
    'src/pages/CoachAppLeagueLadder.tsx': 'Opening league ladder…',
}

IMPORT = "import CoachAppLoading from '../components/CoachAppLoading'"

for filename, message in FILES.items():
    path = Path(filename)
    if not path.exists():
        raise SystemExit(f'Missing expected Coach App page: {filename}')
    original = path.read_text()
    replacement = f" if(loading)return <CoachAppLoading message=\"{message}\"/>"

    pattern = re.compile(r'^\s*if\([^\n]*loading[^\n]*\)return\s+<[^\n]+$', re.MULTILINE)
    updated, count = pattern.subn(replacement, original, count=1)
    if count == 0:
        pattern = re.compile(r'^\s*if[^\n]*loading[^\n]*return\s+<[^\n]+$', re.MULTILINE)
        updated, count = pattern.subn(replacement, original, count=1)

    if count == 0:
        print(f'Skipped {filename}: no standalone loading screen')
        continue

    if IMPORT not in updated:
        lines = updated.splitlines()
        insert_at = 0
        while insert_at < len(lines) and lines[insert_at].startswith('import '):
            insert_at += 1
        lines.insert(insert_at, IMPORT)
        updated = '\n'.join(lines) + ('\n' if updated.endswith('\n') else '')

    path.write_text(updated)
    print(f'Updated {filename}')
