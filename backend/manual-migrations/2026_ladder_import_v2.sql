-- Ladder Import V2 — stored ladders + editable rows. Additive + idempotent.
-- New tables only; nothing existing altered. Soft-delete only.

CREATE TABLE IF NOT EXISTS "ladders" (
  "id"              TEXT PRIMARY KEY,
  "leagueId"        TEXT NOT NULL,
  "leagueName"      TEXT,
  "season"          TEXT NOT NULL,
  "grade"           TEXT NOT NULL DEFAULT 'A Grade',
  "source"          TEXT NOT NULL DEFAULT 'MANUAL',
  "status"          TEXT NOT NULL DEFAULT 'DRAFT',
  "isCurrent"       BOOLEAN NOT NULL DEFAULT false,
  "manualOverride"  BOOLEAN NOT NULL DEFAULT false,
  "roundFrom"       INTEGER,
  "roundTo"         INTEGER,
  "resultsIncluded" INTEGER NOT NULL DEFAULT 0,
  "winPoints"       INTEGER NOT NULL DEFAULT 4,
  "drawPoints"      INTEGER NOT NULL DEFAULT 2,
  "confidence"      DOUBLE PRECISION,
  "warnings"        TEXT,
  "notes"           TEXT,
  "generatedAt"     TIMESTAMP(3),
  "createdBy"       TEXT,
  "deletedAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ladders_league_season_grade_idx" ON "ladders" ("leagueId", "season", "grade");
CREATE INDEX IF NOT EXISTS "ladders_league_current_idx" ON "ladders" ("leagueId", "isCurrent");
CREATE INDEX IF NOT EXISTS "ladders_source_idx" ON "ladders" ("source");

CREATE TABLE IF NOT EXISTS "ladder_rows" (
  "id"            TEXT PRIMARY KEY,
  "ladderId"      TEXT NOT NULL,
  "position"      INTEGER,
  "clubId"        TEXT,
  "clubName"      TEXT NOT NULL,
  "played"        INTEGER NOT NULL DEFAULT 0,
  "wins"          INTEGER NOT NULL DEFAULT 0,
  "losses"        INTEGER NOT NULL DEFAULT 0,
  "draws"         INTEGER NOT NULL DEFAULT 0,
  "goalsFor"      INTEGER NOT NULL DEFAULT 0,
  "goalsAgainst"  INTEGER NOT NULL DEFAULT 0,
  "goalDiff"      INTEGER NOT NULL DEFAULT 0,
  "percentage"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "points"        INTEGER NOT NULL DEFAULT 0,
  "last5"         TEXT,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "sourceNotes"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ladder_rows_ladderId_idx" ON "ladder_rows" ("ladderId");
CREATE INDEX IF NOT EXISTS "ladder_rows_clubId_idx" ON "ladder_rows" ("clubId");
