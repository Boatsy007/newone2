-- Phase B3 — Intelligent News & Content Engine. Fully additive + idempotent.
-- New tables + nullable columns on generated_articles only. No ranking table is
-- altered; no column renamed or dropped. Safe to run repeatedly.

-- ── Editorial reasoning columns on existing generated_articles (nullable) ─────
ALTER TABLE "generated_articles" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;
ALTER TABLE "generated_articles" ADD COLUMN IF NOT EXISTS "reasoning"  TEXT;
ALTER TABLE "generated_articles" ADD COLUMN IF NOT EXISTS "triggers"   TEXT;
ALTER TABLE "generated_articles" ADD COLUMN IF NOT EXISTS "sourceData" TEXT;
ALTER TABLE "generated_articles" ADD COLUMN IF NOT EXISTS "dedupeKey"  TEXT;

-- ── News signals (trigger-engine output + editorial reasoning) ───────────────
CREATE TABLE IF NOT EXISTS "news_signals" (
  "id"            TEXT PRIMARY KEY,
  "weekLabel"     TEXT NOT NULL,
  "season"        TEXT,
  "kind"          TEXT NOT NULL,
  "scope"         TEXT NOT NULL,
  "headline"      TEXT NOT NULL,
  "clubId"        TEXT,
  "clubName"      TEXT,
  "leagueId"      TEXT,
  "leagueName"    TEXT,
  "state"         TEXT,
  "metrics"       TEXT,
  "triggerRule"   TEXT NOT NULL,
  "sourceData"    TEXT,
  "confidence"    DOUBLE PRECISION NOT NULL DEFAULT 0.8,
  "priority"      INTEGER NOT NULL DEFAULT 0,
  "dedupeKey"     TEXT NOT NULL,
  "usedInArticle" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "news_signals_dedupeKey_key" ON "news_signals" ("dedupeKey");
CREATE INDEX IF NOT EXISTS "news_signals_weekLabel_idx" ON "news_signals" ("weekLabel");
CREATE INDEX IF NOT EXISTS "news_signals_kind_idx" ON "news_signals" ("kind");
CREATE INDEX IF NOT EXISTS "news_signals_scope_idx" ON "news_signals" ("scope");

-- ── League strength history ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "league_strength_snapshots" (
  "id"            TEXT PRIMARY KEY,
  "leagueId"      TEXT NOT NULL,
  "leagueName"    TEXT NOT NULL,
  "weekLabel"     TEXT NOT NULL,
  "season"        TEXT,
  "strengthScore" DOUBLE PRECISION NOT NULL,
  "strengthTier"  INTEGER NOT NULL,
  "rankedClubs"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "league_strength_snapshots_leagueId_weekLabel_key" ON "league_strength_snapshots" ("leagueId", "weekLabel");
CREATE INDEX IF NOT EXISTS "league_strength_snapshots_leagueId_idx" ON "league_strength_snapshots" ("leagueId");
CREATE INDEX IF NOT EXISTS "league_strength_snapshots_weekLabel_idx" ON "league_strength_snapshots" ("weekLabel");

-- ── Club trends ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "club_trends" (
  "id"            TEXT PRIMARY KEY,
  "clubId"        TEXT NOT NULL,
  "clubName"      TEXT NOT NULL,
  "leagueName"    TEXT,
  "state"         TEXT,
  "currentRank"   INTEGER,
  "bestRankEver"  INTEGER,
  "worstRankEver" INTEGER,
  "rank4wkDelta"  INTEGER,
  "ratingTrend"   DOUBLE PRECISION,
  "consistency"   DOUBLE PRECISION,
  "volatility"    DOUBLE PRECISION,
  "momentum"      DOUBLE PRECISION,
  "weeksTracked"  INTEGER NOT NULL DEFAULT 0,
  "isRising"      BOOLEAN NOT NULL DEFAULT false,
  "isFalling"     BOOLEAN NOT NULL DEFAULT false,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "club_trends_clubId_key" ON "club_trends" ("clubId");
CREATE INDEX IF NOT EXISTS "club_trends_isRising_idx" ON "club_trends" ("isRising");
CREATE INDEX IF NOT EXISTS "club_trends_isFalling_idx" ON "club_trends" ("isFalling");

-- ── Editorial calendar ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "editorial_calendar_slots" (
  "id"          TEXT PRIMARY KEY,
  "dayOfWeek"   INTEGER NOT NULL,
  "slotKey"     TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "articleKind" TEXT NOT NULL,
  "enabled"     BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "editorial_calendar_slots_slotKey_key" ON "editorial_calendar_slots" ("slotKey");

-- ── Article links (interconnect) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "article_links" (
  "id"         TEXT PRIMARY KEY,
  "articleId"  TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT,
  "label"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "article_links_articleId_idx" ON "article_links" ("articleId");
CREATE INDEX IF NOT EXISTS "article_links_entity_idx" ON "article_links" ("entityType", "entityId");

-- ── Search index ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "search_docs" (
  "id"         TEXT PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "tags"       TEXT,
  "state"      TEXT,
  "weight"     DOUBLE PRECISION NOT NULL DEFAULT 1,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "search_docs_entityType_entityId_key" ON "search_docs" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "search_docs_entityType_idx" ON "search_docs" ("entityType");
