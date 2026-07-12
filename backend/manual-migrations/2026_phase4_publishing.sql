-- Phase 4: AI Publishing — generated article drafts. Additive, idempotent.

CREATE TABLE IF NOT EXISTS "generated_articles" (
  "id"             TEXT NOT NULL,
  "slug"           TEXT NOT NULL,
  "kind"           TEXT NOT NULL,
  "category"       TEXT NOT NULL DEFAULT 'rankings',
  "title"          TEXT NOT NULL,
  "subtitle"       TEXT,
  "summary"        TEXT NOT NULL,
  "body"           TEXT NOT NULL,
  "heroSeed"       TEXT NOT NULL DEFAULT 'rankings',
  "tags"           TEXT,
  "status"         TEXT NOT NULL DEFAULT 'DRAFT',
  "runId"          TEXT,
  "weekLabel"      TEXT,
  "seoTitle"       TEXT,
  "seoDescription" TEXT,
  "author"         TEXT NOT NULL DEFAULT 'Got Netty',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt"    TIMESTAMP(3),
  CONSTRAINT "generated_articles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "generated_articles_slug_key" ON "generated_articles"("slug");
CREATE INDEX IF NOT EXISTS "generated_articles_status_publishedAt_idx" ON "generated_articles"("status", "publishedAt");
CREATE INDEX IF NOT EXISTS "generated_articles_kind_idx" ON "generated_articles"("kind");
