-- Phase B9b — Notifications enhancement (preferences scoping + digests).
-- Fully additive + idempotent. New columns on notification_preferences + a new
-- notification_digests table. Nothing existing is altered destructively.

-- Preference scoping + frequency (nullable / defaulted → safe on existing rows)
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "clubId"    TEXT;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "leagueId"  TEXT;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "state"     TEXT;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "frequency" TEXT NOT NULL DEFAULT 'INSTANT';
CREATE INDEX IF NOT EXISTS "notification_preferences_clubId_idx"   ON "notification_preferences" ("clubId");
CREATE INDEX IF NOT EXISTS "notification_preferences_leagueId_idx" ON "notification_preferences" ("leagueId");

-- Digests
CREATE TABLE IF NOT EXISTS "notification_digests" (
  "id"             TEXT PRIMARY KEY,
  "kind"           TEXT NOT NULL,
  "recipientScope" TEXT NOT NULL DEFAULT 'ADMIN',
  "recipientId"    TEXT,
  "periodStart"    TIMESTAMP(3) NOT NULL,
  "periodEnd"      TIMESTAMP(3) NOT NULL,
  "itemCount"      INTEGER NOT NULL DEFAULT 0,
  "content"        TEXT NOT NULL,
  "channel"        TEXT NOT NULL DEFAULT 'EMAIL',
  "status"         TEXT NOT NULL DEFAULT 'DRY_RUN',
  "dryRun"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "notification_digests_kind_idx" ON "notification_digests" ("kind");
CREATE INDEX IF NOT EXISTS "notification_digests_createdAt_idx" ON "notification_digests" ("createdAt");
