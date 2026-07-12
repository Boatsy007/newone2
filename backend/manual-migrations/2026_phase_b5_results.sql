-- Phase B5 — Results & Fixtures Engine. Fully additive + idempotent.
-- New tables only; the existing "matches" table and all ranking tables are
-- untouched. Safe to run repeatedly.

-- ── Match results ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "match_results" (
  "id"             TEXT PRIMARY KEY,
  "sourceMatchId"  TEXT,
  "leagueId"       TEXT NOT NULL,
  "leagueName"     TEXT NOT NULL,
  "season"         TEXT NOT NULL,
  "round"          INTEGER,
  "matchDate"      TIMESTAMP(3),
  "homeClubId"     TEXT NOT NULL,
  "homeClubName"   TEXT NOT NULL,
  "awayClubId"     TEXT NOT NULL,
  "awayClubName"   TEXT NOT NULL,
  "homeScore"      INTEGER NOT NULL,
  "awayScore"      INTEGER NOT NULL,
  "winnerClubId"   TEXT,
  "isDraw"         BOOLEAN NOT NULL DEFAULT false,
  "margin"         INTEGER NOT NULL DEFAULT 0,
  "status"         TEXT NOT NULL DEFAULT 'FINAL',
  "importSource"   TEXT NOT NULL DEFAULT 'MANUAL',
  "verified"       BOOLEAN NOT NULL DEFAULT false,
  "manualOverride" BOOLEAN NOT NULL DEFAULT false,
  "notes"          TEXT,
  "dedupeKey"      TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "match_results_dedupeKey_key" ON "match_results" ("dedupeKey");
CREATE INDEX IF NOT EXISTS "match_results_league_season_idx" ON "match_results" ("leagueId", "season");
CREATE INDEX IF NOT EXISTS "match_results_homeClubId_idx" ON "match_results" ("homeClubId");
CREATE INDEX IF NOT EXISTS "match_results_awayClubId_idx" ON "match_results" ("awayClubId");
CREATE INDEX IF NOT EXISTS "match_results_season_round_idx" ON "match_results" ("season", "round");

-- ── Fixtures ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "fixtures" (
  "id"             TEXT PRIMARY KEY,
  "leagueId"       TEXT NOT NULL,
  "leagueName"     TEXT NOT NULL,
  "season"         TEXT NOT NULL,
  "round"          INTEGER,
  "matchDate"      TIMESTAMP(3),
  "matchTime"      TEXT,
  "venue"          TEXT,
  "homeClubId"     TEXT NOT NULL,
  "homeClubName"   TEXT NOT NULL,
  "awayClubId"     TEXT NOT NULL,
  "awayClubName"   TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'SCHEDULED',
  "homeScore"      INTEGER,
  "awayScore"      INTEGER,
  "resultId"       TEXT,
  "importSource"   TEXT NOT NULL DEFAULT 'MANUAL',
  "manualOverride" BOOLEAN NOT NULL DEFAULT false,
  "dedupeKey"      TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fixtures_dedupeKey_key" ON "fixtures" ("dedupeKey");
CREATE INDEX IF NOT EXISTS "fixtures_league_season_idx" ON "fixtures" ("leagueId", "season");
CREATE INDEX IF NOT EXISTS "fixtures_homeClubId_idx" ON "fixtures" ("homeClubId");
CREATE INDEX IF NOT EXISTS "fixtures_awayClubId_idx" ON "fixtures" ("awayClubId");
CREATE INDEX IF NOT EXISTS "fixtures_status_idx" ON "fixtures" ("status");

-- ── Match insights ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "match_insights" (
  "id"        TEXT PRIMARY KEY,
  "season"    TEXT NOT NULL,
  "leagueId"  TEXT,
  "round"     INTEGER,
  "kind"      TEXT NOT NULL,
  "resultId"  TEXT,
  "headline"  TEXT NOT NULL,
  "metrics"   TEXT,
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "match_insights_dedupeKey_key" ON "match_insights" ("dedupeKey");
CREATE INDEX IF NOT EXISTS "match_insights_season_idx" ON "match_insights" ("season");
CREATE INDEX IF NOT EXISTS "match_insights_kind_idx" ON "match_insights" ("kind");

-- ── Club match stats ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "club_match_stats" (
  "id"                   TEXT PRIMARY KEY,
  "clubId"               TEXT NOT NULL,
  "clubName"             TEXT NOT NULL,
  "season"               TEXT NOT NULL,
  "played"               INTEGER NOT NULL DEFAULT 0,
  "wins"                 INTEGER NOT NULL DEFAULT 0,
  "losses"               INTEGER NOT NULL DEFAULT 0,
  "draws"                INTEGER NOT NULL DEFAULT 0,
  "goalsFor"             INTEGER NOT NULL DEFAULT 0,
  "goalsAgainst"         INTEGER NOT NULL DEFAULT 0,
  "goalDiff"             INTEGER NOT NULL DEFAULT 0,
  "percentage"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgWinningMargin"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "largestWinningMargin" INTEGER NOT NULL DEFAULT 0,
  "homeWins"             INTEGER NOT NULL DEFAULT 0,
  "homeLosses"           INTEGER NOT NULL DEFAULT 0,
  "homeDraws"            INTEGER NOT NULL DEFAULT 0,
  "awayWins"             INTEGER NOT NULL DEFAULT 0,
  "awayLosses"           INTEGER NOT NULL DEFAULT 0,
  "awayDraws"            INTEGER NOT NULL DEFAULT 0,
  "currentStreak"        INTEGER NOT NULL DEFAULT 0,
  "currentStreakType"    TEXT,
  "longestWinStreak"     INTEGER NOT NULL DEFAULT 0,
  "longestLossStreak"    INTEGER NOT NULL DEFAULT 0,
  "last5"                TEXT,
  "last10"               TEXT,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "club_match_stats_clubId_season_key" ON "club_match_stats" ("clubId", "season");
CREATE INDEX IF NOT EXISTS "club_match_stats_season_idx" ON "club_match_stats" ("season");
