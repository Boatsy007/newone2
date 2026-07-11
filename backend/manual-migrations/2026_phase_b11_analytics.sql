-- Phase B11 — Analytics & Insights Engine. Additive + idempotent.
-- Privacy-conscious: no PII stored. New tables only; nothing existing altered.

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id"         TEXT PRIMARY KEY,
  "eventType"  TEXT NOT NULL,
  "entityType" TEXT,
  "entityId"   TEXT,
  "sessionId"  TEXT,
  "visitorId"  TEXT,
  "referrer"   TEXT,
  "path"       TEXT,
  "deviceType" TEXT,
  "browser"    TEXT,
  "country"    TEXT,
  "state"      TEXT,
  "meta"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "analytics_events_eventType_idx" ON "analytics_events" ("eventType");
CREATE INDEX IF NOT EXISTS "analytics_events_entity_idx" ON "analytics_events" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "analytics_events_createdAt_idx" ON "analytics_events" ("createdAt");
CREATE INDEX IF NOT EXISTS "analytics_events_visitorId_idx" ON "analytics_events" ("visitorId");
CREATE INDEX IF NOT EXISTS "analytics_events_sessionId_idx" ON "analytics_events" ("sessionId");

CREATE TABLE IF NOT EXISTS "search_queries" (
  "id"             TEXT PRIMARY KEY,
  "term"           TEXT NOT NULL,
  "normalizedTerm" TEXT NOT NULL,
  "scope"          TEXT,
  "resultCount"    INTEGER NOT NULL DEFAULT 0,
  "zeroResult"     BOOLEAN NOT NULL DEFAULT false,
  "sessionId"      TEXT,
  "visitorId"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "search_queries_normalizedTerm_idx" ON "search_queries" ("normalizedTerm");
CREATE INDEX IF NOT EXISTS "search_queries_createdAt_idx" ON "search_queries" ("createdAt");
CREATE INDEX IF NOT EXISTS "search_queries_zeroResult_idx" ON "search_queries" ("zeroResult");

CREATE TABLE IF NOT EXISTS "entity_popularity" (
  "id"             TEXT PRIMARY KEY,
  "entityType"     TEXT NOT NULL,
  "entityId"       TEXT NOT NULL,
  "entityName"     TEXT,
  "windowKey"      TEXT NOT NULL,
  "views"          INTEGER NOT NULL DEFAULT 0,
  "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
  "searches"       INTEGER NOT NULL DEFAULT 0,
  "sponsorClicks"  INTEGER NOT NULL DEFAULT 0,
  "score"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trendScore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "entity_popularity_type_id_window_key" ON "entity_popularity" ("entityType", "entityId", "windowKey");
CREATE INDEX IF NOT EXISTS "entity_popularity_type_window_idx" ON "entity_popularity" ("entityType", "windowKey");

CREATE TABLE IF NOT EXISTS "search_term_stats" (
  "id"             TEXT PRIMARY KEY,
  "normalizedTerm" TEXT NOT NULL,
  "term"           TEXT NOT NULL,
  "windowKey"      TEXT NOT NULL,
  "searches"       INTEGER NOT NULL DEFAULT 0,
  "zeroResults"    INTEGER NOT NULL DEFAULT 0,
  "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
  "trendScore"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "search_term_stats_term_window_key" ON "search_term_stats" ("normalizedTerm", "windowKey");
CREATE INDEX IF NOT EXISTS "search_term_stats_window_idx" ON "search_term_stats" ("windowKey");

CREATE TABLE IF NOT EXISTS "analytics_daily" (
  "id"                TEXT PRIMARY KEY,
  "day"               TEXT NOT NULL,
  "visitors"          INTEGER NOT NULL DEFAULT 0,
  "sessions"          INTEGER NOT NULL DEFAULT 0,
  "events"            INTEGER NOT NULL DEFAULT 0,
  "searches"          INTEGER NOT NULL DEFAULT 0,
  "returningVisitors" INTEGER NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_daily_day_key" ON "analytics_daily" ("day");

CREATE TABLE IF NOT EXISTS "analytics_runs" (
  "id"       TEXT PRIMARY KEY,
  "kind"     TEXT NOT NULL DEFAULT 'AGGREGATE',
  "events"   INTEGER NOT NULL DEFAULT 0,
  "entities" INTEGER NOT NULL DEFAULT 0,
  "terms"    INTEGER NOT NULL DEFAULT 0,
  "days"     INTEGER NOT NULL DEFAULT 0,
  "detail"   TEXT,
  "ranAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "analytics_runs_ranAt_idx" ON "analytics_runs" ("ranAt");
