from pathlib import Path
import re

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
    text = path.read_text()

    if IMPORT not in text:
        lines = text.splitlines()
        insert_at = 0
        while insert_at < len(lines) and lines[insert_at].startswith('import '):
            insert_at += 1
        lines.insert(insert_at, IMPORT)
        text = '\n'.join(lines) + ('\n' if text.endswith('\n') else '')

    replacement = f" if(loading)return <CoachAppLoading message=\"{message}\"/>"
    pattern = re.compile(r'^\s*if\([^\n]*loading[^\n]*\)return\s+<[^\n]+$', re.MULTILINE)
    updated, count = pattern.subn(replacement, text, count=1)

    if count == 0:
        # Some pages use a compact early return without parentheses around a compound condition.
        pattern = re.compile(r'^\s*if[^\n]*loading[^\n]*return\s+<[^\n]+$', re.MULTILINE)
        updated, count = pattern.subn(replacement, text, count=1)

    if count == 0:
        raise SystemExit(f'No loading early return found in {filename}')

    path.write_text(updated)
    print(f'Updated {filename}')
