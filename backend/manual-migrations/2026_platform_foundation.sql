-- Platform foundation: never-destroy (archive/approval), review queue, backups,
-- audit source/reason. Additive + idempotent.

-- League: soft-delete / approval / type
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "archivedAt"     TIMESTAMP(3);
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "leagueType"     TEXT;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "reviewReason"   TEXT;

-- Club: soft-delete / approval / town
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "archivedAt"     TIMESTAMP(3);
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "townName"       TEXT;

-- Audit: provenance + reason
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "reason" TEXT;

-- Review queue
CREATE TABLE IF NOT EXISTS "review_items" (
  "id"         TEXT PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT,
  "kind"       TEXT NOT NULL,
  "reason"     TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "payload"    TEXT,
  "status"     TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT
);
CREATE INDEX IF NOT EXISTS "review_items_status_idx" ON "review_items" ("status");

-- Backups
CREATE TABLE IF NOT EXISTS "backups" (
  "id"        TEXT PRIMARY KEY,
  "label"     TEXT NOT NULL,
  "kind"      TEXT NOT NULL DEFAULT 'MANUAL',
  "counts"    TEXT,
  "data"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
