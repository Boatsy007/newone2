-- Phase 3: OCR import history — additive, idempotent.
-- Every ladder image ever uploaded is kept with its extraction, confidence,
-- what was committed, when and by whom. Applied via apply-migration.ts.

CREATE TABLE IF NOT EXISTS "ocr_imports" (
  "id"             TEXT NOT NULL,
  "leagueId"       TEXT,
  "leagueName"     TEXT,
  "image"          TEXT NOT NULL,
  "detectedLeague" TEXT,
  "detectedGrade"  TEXT,
  "rowCount"       INTEGER NOT NULL DEFAULT 0,
  "uncertainCount" INTEGER NOT NULL DEFAULT 0,
  "confidence"     DOUBLE PRECISION,
  "rows"           TEXT,
  "committedRows"  TEXT,
  "status"         TEXT NOT NULL DEFAULT 'PREVIEWED',
  "notes"          TEXT,
  "createdBy"      TEXT NOT NULL DEFAULT 'admin',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "committedAt"    TIMESTAMP(3),
  CONSTRAINT "ocr_imports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ocr_imports_leagueId_idx" ON "ocr_imports"("leagueId");
CREATE INDEX IF NOT EXISTS "ocr_imports_createdAt_idx" ON "ocr_imports"("createdAt");
