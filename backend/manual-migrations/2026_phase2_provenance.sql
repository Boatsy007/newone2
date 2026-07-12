-- Phase 2: multi-source provenance + admin/status fields (additive, idempotent)

-- League provenance / status
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "primarySource"      TEXT;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "importType"         TEXT DEFAULT 'AUTO';
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "sourceUrl"          TEXT;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "status"             TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "lastSuccessAt"      TIMESTAMP(3);
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "lastManualUpdateAt" TIMESTAMP(3);
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "dataConfidence"     DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "failureCount"       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "retryCount"         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "manualOverride"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "hidden"             BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "regionName"         TEXT;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "websiteUrl"         TEXT;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "facebookUrl"        TEXT;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "logoUrl"            TEXT;

-- Club manual provenance
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "manualOverride" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "source"         TEXT;
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "bestRank"       INTEGER;

-- Seed primarySource for existing leagues from their active source (best-effort).
UPDATE "leagues" l SET "primarySource" = s."sourceType"
  FROM "league_sources" s
  WHERE s."leagueId" = l."id" AND s."isActive" = true AND l."primarySource" IS NULL;

-- Global settings (rankingsLocked, etc.)
CREATE TABLE IF NOT EXISTS "settings" (
  "key"       TEXT PRIMARY KEY,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "settings" ("key", "value") VALUES ('rankingsLocked', 'false')
  ON CONFLICT ("key") DO NOTHING;
