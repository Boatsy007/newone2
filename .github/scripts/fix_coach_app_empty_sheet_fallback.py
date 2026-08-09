from pathlib import Path
p=Path('backend/src/api/routes/coach-app.ts')
s=p.read_text()
old='''    WHERE s.club_id=$1 AND s.league_id=$2 AND s.season=$3 AND s.fixture_id IS NULL
    GROUP BY s.id
    HAVING COUNT(tsp.id) > 0
    ORDER BY (s.grade=$4) DESC,s.updated_at DESC
    LIMIT 1
  `, clubId, fixture.leagueId, fixture.season, fixture.grade)'''
new='''    WHERE s.club_id=$1 AND s.season=$2 AND s.fixture_id IS NULL
    GROUP BY s.id
    ORDER BY (s.league_id=$3) DESC,(s.grade=$4) DESC,s.updated_at DESC
    LIMIT 1
  `, clubId, fixture.season, fixture.leagueId, fixture.grade)'''
if old not in s:
    raise SystemExit('fallback query not found')
s=s.replace(old,new,1)
p.write_text(s)
