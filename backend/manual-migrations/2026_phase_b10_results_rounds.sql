-- Phase B10 — Results & Fixtures Engine (round history). Additive + idempotent.
-- Adds grade/source/importedAt/fixture-link columns to the B5 fixtures +
-- match_results tables and a new round_summaries table. Nothing destructive.

-- ── match_results: link to fixture + grade/source/importedAt ─────────────────
ALTER TABLE "match_results" ADD COLUMN IF NOT EXISTS "fixtureId"  TEXT;
ALTER TABLE "match_results" ADD COLUMN IF NOT EXISTS "grade"      TEXT NOT NULL DEFAULT 'A Grade';
ALTER TABLE "match_results" ADD COLUMN IF NOT EXISTS "sourceUrl"  TEXT;
ALTER TABLE "match_results" ADD COLUMN IF NOT EXISTS "importedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "match_results_league_season_grade_round_idx" ON "match_results" ("leagueId", "season", "grade", "round");
CREATE INDEX IF NOT EXISTS "match_results_fixtureId_idx" ON "match_results" ("fixtureId");
CREATE INDEX IF NOT EXISTS "match_results_matchDate_idx" ON "match_results" ("matchDate");

-- ── fixtures: grade/source/importedAt ────────────────────────────────────────
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "grade"      TEXT NOT NULL DEFAULT 'A Grade';
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "sourceUrl"  TEXT;
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "importedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "fixtures_league_season_grade_round_idx" ON "fixtures" ("leagueId", "season", "grade", "round");
CREATE INDEX IF NOT EXISTS "fixtures_matchDate_idx" ON "fixtures" ("matchDate");

-- ── round_summaries ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "round_summaries" (
  "id"            TEXT PRIMARY KEY,
  "leagueId"      TEXT NOT NULL,
  "leagueName"    TEXT,
  "season"        TEXT NOT NULL,
  "grade"         TEXT NOT NULL DEFAULT 'A Grade',
  "round"         INTEGER NOT NULL,
  "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
  "highestScore"  INTEGER NOT NULL DEFAULT 0,
  "lowestScore"   INTEGER NOT NULL DEFAULT 0,
  "closestMargin" INTEGER NOT NULL DEFAULT 0,
  "biggestMargin" INTEGER NOT NULL DEFAULT 0,
  "averageMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "upsetDetected" BOOLEAN NOT NULL DEFAULT false,
  "ladderImpact"  TEXT,
  "rankingImpact" TEXT,
  "articleData"   TEXT,
  "generatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "round_summaries_league_season_grade_round_key" ON "round_summaries" ("leagueId", "season", "grade", "round");
CREATE INDEX IF NOT EXISTS "round_summaries_league_season_idx" ON "round_summaries" ("leagueId", "season");
CREATE INDEX IF NOT EXISTS "round_summaries_round_idx" ON "round_summaries" ("round");
