-- Phase B10.5 — Full Season Ingestion Engine (ADDITIVE, IDEMPOTENT)
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds season-import batch tracking, per-row provenance/fingerprints, per-club
-- season timelines, and extended standings metrics on ladder_rows. Nothing is
-- renamed or dropped; safe to re-run.

-- ── Extended standings metrics on ladder_rows ────────────────────────────────
ALTER TABLE "ladder_rows" ADD COLUMN IF NOT EXISTS "homeWins"          INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ladder_rows" ADD COLUMN IF NOT EXISTS "homeLosses"        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ladder_rows" ADD COLUMN IF NOT EXISTS "homeDraws"         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ladder_rows" ADD COLUMN IF NOT EXISTS "awayWins"          INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ladder_rows" ADD COLUMN IF NOT EXISTS "awayLosses"        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ladder_rows" ADD COLUMN IF NOT EXISTS "awayDraws"         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ladder_rows" ADD COLUMN IF NOT EXISTS "avgMargin"         DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ladder_rows" ADD COLUMN IF NOT EXISTS "largestWin"        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ladder_rows" ADD COLUMN IF NOT EXISTS "largestLoss"       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ladder_rows" ADD COLUMN IF NOT EXISTS "longestWinStreak"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ladder_rows" ADD COLUMN IF NOT EXISTS "longestLossStreak" INTEGER NOT NULL DEFAULT 0;

-- ── Season import batches ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "season_imports" (
  "id"                  TEXT PRIMARY KEY,
  "leagueId"            TEXT,
  "leagueName"          TEXT,
  "season"              TEXT,
  "grade"               TEXT,
  "source"              TEXT NOT NULL DEFAULT 'MIXED',
  "status"              TEXT NOT NULL DEFAULT 'STAGED',
  "fileName"            TEXT,
  "batchLabel"          TEXT,
  "totalRows"           INTEGER NOT NULL DEFAULT 0,
  "committed"           INTEGER NOT NULL DEFAULT 0,
  "skipped"             INTEGER NOT NULL DEFAULT 0,
  "reviewRaised"        INTEGER NOT NULL DEFAULT 0,
  "laddersGenerated"    INTEGER NOT NULL DEFAULT 0,
  "roundsReconstructed" INTEGER NOT NULL DEFAULT 0,
  "warnings"            TEXT,
  "stagedRows"          TEXT,
  "report"              TEXT,
  "createdBy"           TEXT,
  "deletedAt"           TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "season_imports_leagueId_season_idx" ON "season_imports" ("leagueId", "season");
CREATE INDEX IF NOT EXISTS "season_imports_status_idx"          ON "season_imports" ("status");

-- ── Per-row provenance / fingerprints ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "season_import_rows" (
  "id"           TEXT PRIMARY KEY,
  "importId"     TEXT NOT NULL,
  "rowIndex"     INTEGER NOT NULL,
  "sourceFile"   TEXT,
  "fingerprint"  TEXT NOT NULL,
  "dedupeKey"    TEXT,
  "leagueId"     TEXT,
  "season"       TEXT,
  "grade"        TEXT,
  "round"        INTEGER,
  "homeClubName" TEXT,
  "awayClubName" TEXT,
  "homeScore"    INTEGER,
  "awayScore"    INTEGER,
  "status"       TEXT NOT NULL DEFAULT 'VALID',
  "issues"       TEXT,
  "resultId"     TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "season_import_rows_importId_idx"    ON "season_import_rows" ("importId");
CREATE INDEX IF NOT EXISTS "season_import_rows_fingerprint_idx" ON "season_import_rows" ("fingerprint");
CREATE INDEX IF NOT EXISTS "season_import_rows_dedupeKey_idx"   ON "season_import_rows" ("dedupeKey");

-- ── Per-club season timeline (ladder position / form / GF-GA by round) ───────
CREATE TABLE IF NOT EXISTS "club_season_timeline" (
  "id"             TEXT PRIMARY KEY,
  "clubId"         TEXT NOT NULL,
  "clubName"       TEXT NOT NULL,
  "leagueId"       TEXT NOT NULL,
  "leagueName"     TEXT,
  "season"         TEXT NOT NULL,
  "grade"          TEXT NOT NULL DEFAULT 'A Grade',
  "round"          INTEGER NOT NULL,
  "position"       INTEGER,
  "played"         INTEGER NOT NULL DEFAULT 0,
  "wins"           INTEGER NOT NULL DEFAULT 0,
  "losses"         INTEGER NOT NULL DEFAULT 0,
  "draws"          INTEGER NOT NULL DEFAULT 0,
  "goalsFor"       INTEGER NOT NULL DEFAULT 0,
  "goalsAgainst"   INTEGER NOT NULL DEFAULT 0,
  "goalDiff"       INTEGER NOT NULL DEFAULT 0,
  "percentage"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "points"         INTEGER NOT NULL DEFAULT 0,
  "form"           TEXT,
  "currentStreak"  INTEGER NOT NULL DEFAULT 0,
  "rankingAtRound" INTEGER,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "club_season_timeline_unique"
  ON "club_season_timeline" ("clubId", "leagueId", "season", "grade", "round");
CREATE INDEX IF NOT EXISTS "club_season_timeline_clubId_season_idx"
  ON "club_season_timeline" ("clubId", "season");
CREATE INDEX IF NOT EXISTS "club_season_timeline_league_idx"
  ON "club_season_timeline" ("leagueId", "season", "grade", "round");
