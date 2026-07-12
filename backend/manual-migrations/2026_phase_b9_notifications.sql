-- Phase B9 — Notifications & Automation Engine. Additive + idempotent.
-- New tables only; distinct from the B2 "platform_notifications" table. Safe to
-- run repeatedly. Nothing existing is altered.

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"             TEXT PRIMARY KEY,
  "recipientScope" TEXT NOT NULL DEFAULT 'ADMIN',
  "recipientId"    TEXT,
  "type"           TEXT NOT NULL,
  "category"       TEXT,
  "severity"       TEXT NOT NULL DEFAULT 'INFO',
  "title"          TEXT NOT NULL,
  "body"           TEXT,
  "entityType"     TEXT,
  "entityId"       TEXT,
  "data"           TEXT,
  "channel"        TEXT NOT NULL DEFAULT 'IN_APP',
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "dedupeKey"      TEXT NOT NULL,
  "readAt"         TIMESTAMP(3),
  "sentAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupeKey_key" ON "notifications" ("dedupeKey");
CREATE INDEX IF NOT EXISTS "notifications_recipient_idx" ON "notifications" ("recipientScope", "recipientId");
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications" ("type");
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notifications" ("status");
CREATE INDEX IF NOT EXISTS "notifications_category_idx" ON "notifications" ("category");

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id"             TEXT PRIMARY KEY,
  "recipientScope" TEXT NOT NULL,
  "recipientId"    TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "channel"        TEXT NOT NULL DEFAULT 'IN_APP',
  "enabled"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_unique" ON "notification_preferences" ("recipientScope", "recipientId", "type", "channel");
CREATE INDEX IF NOT EXISTS "notification_preferences_recipient_idx" ON "notification_preferences" ("recipientScope", "recipientId");

CREATE TABLE IF NOT EXISTS "notification_rules" (
  "id"              TEXT PRIMARY KEY,
  "type"            TEXT NOT NULL,
  "label"           TEXT NOT NULL,
  "category"        TEXT,
  "severity"        TEXT NOT NULL DEFAULT 'INFO',
  "recipientScope"  TEXT NOT NULL DEFAULT 'ADMIN',
  "defaultChannels" TEXT NOT NULL DEFAULT '["IN_APP"]',
  "subjectTemplate" TEXT,
  "bodyTemplate"    TEXT,
  "enabled"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_rules_type_key" ON "notification_rules" ("type");

CREATE TABLE IF NOT EXISTS "automation_runs" (
  "id"      TEXT PRIMARY KEY,
  "scanKey" TEXT NOT NULL,
  "status"  TEXT NOT NULL DEFAULT 'SUCCESS',
  "created" INTEGER NOT NULL DEFAULT 0,
  "deduped" INTEGER NOT NULL DEFAULT 0,
  "detail"  TEXT,
  "ranAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "automation_runs_scanKey_idx" ON "automation_runs" ("scanKey");
CREATE INDEX IF NOT EXISTS "automation_runs_ranAt_idx" ON "automation_runs" ("ranAt");
