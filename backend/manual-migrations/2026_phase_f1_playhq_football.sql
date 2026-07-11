-- Phase F1 — PlayHQ Football API ingestion (ADDITIVE, IDEMPOTENT, MULTI-SPORT)
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds sport abstraction + PlayHQ API provenance columns to shared entities and
-- two additive tables (entity mapping + sync logs). Netball is untouched: every
-- new column defaults to NETBALL / NULL so existing rows keep working. Nothing
-- is renamed or dropped. Safe to re-run.

-- ── Sport + PlayHQ refs on shared entities ───────────────────────────────────
ALTER TABLE "leagues"           ADD COLUMN IF NOT EXISTS "sport"                TEXT DEFAULT 'NETBALL';
ALTER TABLE "leagues"           ADD COLUMN IF NOT EXISTS "playhqOrganisationId" TEXT;
ALTER TABLE "leagues"           ADD COLUMN IF NOT EXISTS "playhqCompetitionId"  TEXT;
ALTER TABLE "leagues"           ADD COLUMN IF NOT EXISTS "playhqSeasonId"       TEXT;

ALTER TABLE "clubs"             ADD COLUMN IF NOT EXISTS "sport"        TEXT DEFAULT 'NETBALL';
ALTER TABLE "clubs"             ADD COLUMN IF NOT EXISTS "playhqClubId" TEXT;

ALTER TABLE "club_league_seasons" ADD COLUMN IF NOT EXISTS "sport" TEXT DEFAULT 'NETBALL';

ALTER TABLE "ladders"           ADD COLUMN IF NOT EXISTS "sport" TEXT DEFAULT 'NETBALL';

ALTER TABLE "match_results"     ADD COLUMN IF NOT EXISTS "sport"           TEXT DEFAULT 'NETBALL';
ALTER TABLE "match_results"     ADD COLUMN IF NOT EXISTS "homeGoals"       INTEGER;
ALTER TABLE "match_results"     ADD COLUMN IF NOT EXISTS "homeBehinds"     INTEGER;
ALTER TABLE "match_results"     ADD COLUMN IF NOT EXISTS "awayGoals"       INTEGER;
ALTER TABLE "match_results"     ADD COLUMN IF NOT EXISTS "awayBehinds"     INTEGER;
ALTER TABLE "match_results"     ADD COLUMN IF NOT EXISTS "ground"          TEXT;
ALTER TABLE "match_results"     ADD COLUMN IF NOT EXISTS "umpires"         TEXT;
ALTER TABLE "match_results"     ADD COLUMN IF NOT EXISTS "matchStatus"     TEXT;
ALTER TABLE "match_results"     ADD COLUMN IF NOT EXISTS "playhqGameId"    TEXT;
ALTER TABLE "match_results"     ADD COLUMN IF NOT EXISTS "sourceUpdatedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "match_results_playhqGameId_idx" ON "match_results" ("playhqGameId");
CREATE INDEX IF NOT EXISTS "match_results_sport_season_idx"  ON "match_results" ("sport", "season");

ALTER TABLE "fixtures"          ADD COLUMN IF NOT EXISTS "sport"           TEXT DEFAULT 'NETBALL';
ALTER TABLE "fixtures"          ADD COLUMN IF NOT EXISTS "ground"          TEXT;
ALTER TABLE "fixtures"          ADD COLUMN IF NOT EXISTS "umpires"         TEXT;
ALTER TABLE "fixtures"          ADD COLUMN IF NOT EXISTS "playhqGameId"    TEXT;
ALTER TABLE "fixtures"          ADD COLUMN IF NOT EXISTS "sourceUpdatedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "fixtures_playhqGameId_idx" ON "fixtures" ("playhqGameId");
CREATE INDEX IF NOT EXISTS "fixtures_sport_season_idx"  ON "fixtures" ("sport", "season");

-- ── PlayHQ entity mapping (idempotency + multi-org) ──────────────────────────
CREATE TABLE IF NOT EXISTS "playhq_entity_maps" (
  "id"              TEXT PRIMARY KEY,
  "entityType"      TEXT NOT NULL,
  "playhqId"        TEXT NOT NULL,
  "tenant"          TEXT,
  "organisationId"  TEXT,
  "internalId"      TEXT,
  "internalType"    TEXT,
  "name"            TEXT,
  "parentPlayhqId"  TEXT,
  "sport"           TEXT DEFAULT 'FOOTBALL',
  "payload"         TEXT,
  "sourceUpdatedAt" TIMESTAMP(3),
  "lastSyncedAt"    TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "playhq_entity_maps_type_playhqId" ON "playhq_entity_maps" ("entityType", "playhqId");
CREATE INDEX IF NOT EXISTS "playhq_entity_maps_org_idx"      ON "playhq_entity_maps" ("organisationId");
CREATE INDEX IF NOT EXISTS "playhq_entity_maps_internal_idx" ON "playhq_entity_maps" ("internalType", "internalId");
CREATE INDEX IF NOT EXISTS "playhq_entity_maps_parent_idx"   ON "playhq_entity_maps" ("parentPlayhqId");

-- ── PlayHQ sync logs (admin status/logs endpoints) ───────────────────────────
CREATE TABLE IF NOT EXISTS "playhq_sync_logs" (
  "id"             TEXT PRIMARY KEY,
  "operation"      TEXT NOT NULL,
  "status"         TEXT NOT NULL,
  "tenant"         TEXT,
  "organisationId" TEXT,
  "playhqId"       TEXT,
  "message"        TEXT,
  "counts"         TEXT,
  "warnings"       TEXT,
  "durationMs"     INTEGER,
  "createdBy"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "playhq_sync_logs_operation_idx" ON "playhq_sync_logs" ("operation");
CREATE INDEX IF NOT EXISTS "playhq_sync_logs_status_idx"    ON "playhq_sync_logs" ("status");
CREATE INDEX IF NOT EXISTS "playhq_sync_logs_createdAt_idx" ON "playhq_sync_logs" ("createdAt");
