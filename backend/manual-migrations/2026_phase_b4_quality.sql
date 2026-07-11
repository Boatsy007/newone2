-- Phase B4 — Data Quality & Integrity Engine. Fully additive + idempotent.
-- New tables only; no ranking table is altered, no column renamed or dropped.

-- ── Merge records (non-destructive merge audit + reversibility) ──────────────
CREATE TABLE IF NOT EXISTS "merge_records" (
  "id"          TEXT PRIMARY KEY,
  "entityType"  TEXT NOT NULL,
  "sourceId"    TEXT NOT NULL,
  "sourceName"  TEXT NOT NULL,
  "targetId"    TEXT NOT NULL,
  "targetName"  TEXT NOT NULL,
  "reason"      TEXT,
  "movedCounts" TEXT,
  "snapshot"    TEXT,
  "performedBy" TEXT,
  "reversedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "merge_records_entityType_idx" ON "merge_records" ("entityType");
CREATE INDEX IF NOT EXISTS "merge_records_sourceId_idx" ON "merge_records" ("sourceId");
CREATE INDEX IF NOT EXISTS "merge_records_targetId_idx" ON "merge_records" ("targetId");

-- ── Club aliases (identity resolver persistence) ─────────────────────────────
CREATE TABLE IF NOT EXISTS "club_aliases" (
  "id"              TEXT PRIMARY KEY,
  "alias"           TEXT NOT NULL,
  "normalizedAlias" TEXT NOT NULL,
  "clubId"          TEXT NOT NULL,
  "source"          TEXT NOT NULL DEFAULT 'MANUAL',
  "confidence"      DOUBLE PRECISION NOT NULL DEFAULT 1,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "club_aliases_normalizedAlias_key" ON "club_aliases" ("normalizedAlias");
CREATE INDEX IF NOT EXISTS "club_aliases_clubId_idx" ON "club_aliases" ("clubId");

-- ── League eligibility ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "league_eligibility" (
  "id"              TEXT PRIMARY KEY,
  "leagueId"        TEXT NOT NULL,
  "leagueName"      TEXT NOT NULL,
  "verdict"         TEXT NOT NULL DEFAULT 'ELIGIBLE',
  "isMetro"         BOOLEAN NOT NULL DEFAULT false,
  "isJunior"        BOOLEAN NOT NULL DEFAULT false,
  "isSocial"        BOOLEAN NOT NULL DEFAULT false,
  "isIndoor"        BOOLEAN NOT NULL DEFAULT false,
  "isLowerDivision" BOOLEAN NOT NULL DEFAULT false,
  "isNonTown"       BOOLEAN NOT NULL DEFAULT false,
  "hasGenericTeams" BOOLEAN NOT NULL DEFAULT false,
  "reasons"         TEXT,
  "confidence"      DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "checkedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "league_eligibility_leagueId_key" ON "league_eligibility" ("leagueId");
CREATE INDEX IF NOT EXISTS "league_eligibility_verdict_idx" ON "league_eligibility" ("verdict");

-- ── Data-health snapshots ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "data_health_snapshots" (
  "id"          TEXT PRIMARY KEY,
  "counts"      TEXT NOT NULL,
  "report"      TEXT NOT NULL,
  "generatedBy" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "data_health_snapshots_createdAt_idx" ON "data_health_snapshots" ("createdAt");
