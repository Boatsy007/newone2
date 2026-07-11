-- Phase B6 — Historical Rankings & Records Engine. Fully additive + idempotent.
-- New append-only tables + derived caches. No ranking table altered; no column
-- renamed or dropped. Safe to run repeatedly.

-- ── Immutable per-club weekly archive ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ranking_history" (
  "id"             TEXT PRIMARY KEY,
  "runId"          TEXT NOT NULL,
  "weekLabel"      TEXT NOT NULL,
  "season"         TEXT NOT NULL,
  "snapshotDate"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clubId"         TEXT NOT NULL,
  "clubName"       TEXT NOT NULL,
  "leagueId"       TEXT,
  "leagueName"     TEXT,
  "state"          TEXT,
  "rank"           INTEGER NOT NULL,
  "previousRank"   INTEGER,
  "rankMovement"   INTEGER NOT NULL DEFAULT 0,
  "powerRating"    DOUBLE PRECISION NOT NULL,
  "leagueStrength" DOUBLE PRECISION,
  "reasoning"      TEXT,
  "engineVersion"  TEXT NOT NULL DEFAULT 'v2',
  "calcVersion"    TEXT NOT NULL DEFAULT 'default',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ranking_history_weekLabel_clubId_key" ON "ranking_history" ("weekLabel", "clubId");
CREATE INDEX IF NOT EXISTS "ranking_history_clubId_idx" ON "ranking_history" ("clubId");
CREATE INDEX IF NOT EXISTS "ranking_history_weekLabel_idx" ON "ranking_history" ("weekLabel");
CREATE INDEX IF NOT EXISTS "ranking_history_season_idx" ON "ranking_history" ("season");
CREATE INDEX IF NOT EXISTS "ranking_history_clubId_weekLabel_idx" ON "ranking_history" ("clubId", "weekLabel");

-- ── Immutable per-league weekly archive ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "league_ranking_history" (
  "id"            TEXT PRIMARY KEY,
  "runId"         TEXT,
  "weekLabel"     TEXT NOT NULL,
  "season"        TEXT NOT NULL,
  "snapshotDate"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leagueId"      TEXT NOT NULL,
  "leagueName"    TEXT NOT NULL,
  "state"         TEXT,
  "leagueRank"    INTEGER,
  "strengthScore" DOUBLE PRECISION NOT NULL,
  "strengthTier"  INTEGER NOT NULL,
  "rankedClubs"   INTEGER NOT NULL DEFAULT 0,
  "top25Clubs"    INTEGER NOT NULL DEFAULT 0,
  "top100Clubs"   INTEGER NOT NULL DEFAULT 0,
  "reasoning"     TEXT,
  "engineVersion" TEXT NOT NULL DEFAULT 'v2',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "league_ranking_history_weekLabel_leagueId_key" ON "league_ranking_history" ("weekLabel", "leagueId");
CREATE INDEX IF NOT EXISTS "league_ranking_history_leagueId_idx" ON "league_ranking_history" ("leagueId");
CREATE INDEX IF NOT EXISTS "league_ranking_history_weekLabel_idx" ON "league_ranking_history" ("weekLabel");
CREATE INDEX IF NOT EXISTS "league_ranking_history_season_idx" ON "league_ranking_history" ("season");

-- ── Derived club history ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "club_history" (
  "id"                      TEXT PRIMARY KEY,
  "clubId"                  TEXT NOT NULL,
  "clubName"                TEXT NOT NULL,
  "highestRank"             INTEGER,
  "lowestRank"              INTEGER,
  "avgRank"                 DOUBLE PRECISION,
  "weeksRanked"             INTEGER NOT NULL DEFAULT 0,
  "weeksTop10"              INTEGER NOT NULL DEFAULT 0,
  "weeksTop25"              INTEGER NOT NULL DEFAULT 0,
  "weeksTop50"              INTEGER NOT NULL DEFAULT 0,
  "weeksTop100"             INTEGER NOT NULL DEFAULT 0,
  "longestConsecutiveWeeks" INTEGER NOT NULL DEFAULT 0,
  "longestTop10Run"         INTEGER NOT NULL DEFAULT 0,
  "largestWeeklyRise"       INTEGER,
  "largestWeeklyFall"       INTEGER,
  "highestRating"           DOUBLE PRECISION,
  "avgRating"               DOUBLE PRECISION,
  "firstWeek"               TEXT,
  "lastWeek"                TEXT,
  "timeline"                TEXT,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "club_history_clubId_key" ON "club_history" ("clubId");

-- ── Derived league history ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "league_history" (
  "id"             TEXT PRIMARY KEY,
  "leagueId"       TEXT NOT NULL,
  "leagueName"     TEXT NOT NULL,
  "highestRank"    INTEGER,
  "lowestRank"     INTEGER,
  "avgStrength"    DOUBLE PRECISION,
  "highestStrength" DOUBLE PRECISION,
  "weeksRanked"    INTEGER NOT NULL DEFAULT 0,
  "maxRankedClubs" INTEGER NOT NULL DEFAULT 0,
  "maxTop25"       INTEGER NOT NULL DEFAULT 0,
  "maxTop100"      INTEGER NOT NULL DEFAULT 0,
  "timeline"       TEXT,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "league_history_leagueId_key" ON "league_history" ("leagueId");

-- ── Record book ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "record_book_entries" (
  "id"         TEXT PRIMARY KEY,
  "kind"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT,
  "entityName" TEXT,
  "value"      DOUBLE PRECISION,
  "valueLabel" TEXT,
  "weekLabel"  TEXT,
  "season"     TEXT,
  "metrics"    TEXT,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "record_book_entries_kind_key" ON "record_book_entries" ("kind");

-- ── Correction ledger (immutability: corrections are new records) ────────────
CREATE TABLE IF NOT EXISTS "history_corrections" (
  "id"          TEXT PRIMARY KEY,
  "weekLabel"   TEXT NOT NULL,
  "entityType"  TEXT NOT NULL,
  "entityId"    TEXT NOT NULL,
  "field"       TEXT NOT NULL,
  "oldValue"    TEXT,
  "newValue"    TEXT,
  "reason"      TEXT,
  "performedBy" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "history_corrections_entity_idx" ON "history_corrections" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "history_corrections_weekLabel_idx" ON "history_corrections" ("weekLabel");
