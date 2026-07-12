-- PlayFooty football data source control centre (additive only).
-- Production status: apply with `psql`/Supabase SQL editor before enabling the admin workflow.

ALTER TABLE "leagues"
  ADD COLUMN IF NOT EXISTS "sport" TEXT NOT NULL DEFAULT 'NETBALL',
  ADD COLUMN IF NOT EXISTS "primaryDataSource" TEXT,
  ADD COLUMN IF NOT EXISTS "fallbackDataSources" TEXT,
  ADD COLUMN IF NOT EXISTS "playhqOrganisationId" TEXT,
  ADD COLUMN IF NOT EXISTS "playhqCompetitionId" TEXT,
  ADD COLUMN IF NOT EXISTS "playhqSeasonId" TEXT,
  ADD COLUMN IF NOT EXISTS "scrapeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "apiEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "manualEntryEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSuccessfulSyncAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "syncStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN IF NOT EXISTS "dataSourceSyncError" TEXT;

CREATE TABLE IF NOT EXISTS "football_data_imports" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "dataType" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "payloadHash" TEXT NOT NULL,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "recordsFound" INTEGER NOT NULL DEFAULT 0,
  "recordsImported" INTEGER NOT NULL DEFAULT 0,
  "conflictsFound" INTEGER NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "error" TEXT,
  "payload" TEXT,
  "scrapedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL DEFAULT 'admin',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "football_data_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "football_data_conflicts" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityKey" TEXT NOT NULL,
  "existing" TEXT,
  "incoming" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  CONSTRAINT "football_data_conflicts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "football_fixtures" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "season" TEXT NOT NULL,
  "grade" TEXT NOT NULL DEFAULT 'Senior Football',
  "round" TEXT,
  "homeClubId" TEXT,
  "awayClubId" TEXT,
  "homeName" TEXT NOT NULL,
  "awayName" TEXT NOT NULL,
  "matchDate" TIMESTAMP(3),
  "venue" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "football_fixtures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "football_results" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "season" TEXT NOT NULL,
  "grade" TEXT NOT NULL DEFAULT 'Senior Football',
  "round" TEXT,
  "homeClubId" TEXT,
  "awayClubId" TEXT,
  "homeName" TEXT NOT NULL,
  "awayName" TEXT NOT NULL,
  "homeGoals" INTEGER NOT NULL DEFAULT 0,
  "homeBehinds" INTEGER NOT NULL DEFAULT 0,
  "homePoints" INTEGER NOT NULL DEFAULT 0,
  "awayGoals" INTEGER NOT NULL DEFAULT 0,
  "awayBehinds" INTEGER NOT NULL DEFAULT 0,
  "awayPoints" INTEGER NOT NULL DEFAULT 0,
  "matchDate" TIMESTAMP(3),
  "venue" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "football_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "football_ladder_entries" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "season" TEXT NOT NULL,
  "grade" TEXT NOT NULL DEFAULT 'Senior Football',
  "position" INTEGER NOT NULL,
  "clubId" TEXT,
  "clubName" TEXT NOT NULL,
  "played" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "draws" INTEGER NOT NULL DEFAULT 0,
  "pointsFor" INTEGER NOT NULL DEFAULT 0,
  "pointsAgainst" INTEGER NOT NULL DEFAULT 0,
  "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "premiershipPoints" INTEGER NOT NULL DEFAULT 0,
  "sourceType" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "football_ladder_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "football_data_imports_leagueId_sourceType_dataType_payloadHash_key" ON "football_data_imports"("leagueId", "sourceType", "dataType", "payloadHash");
CREATE INDEX IF NOT EXISTS "football_data_imports_leagueId_dataType_status_idx" ON "football_data_imports"("leagueId", "dataType", "status");
CREATE INDEX IF NOT EXISTS "football_data_conflicts_leagueId_status_idx" ON "football_data_conflicts"("leagueId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "football_fixtures_leagueId_season_grade_round_homeName_awayName_key" ON "football_fixtures"("leagueId", "season", "grade", "round", "homeName", "awayName");
CREATE INDEX IF NOT EXISTS "football_fixtures_leagueId_season_grade_idx" ON "football_fixtures"("leagueId", "season", "grade");
CREATE UNIQUE INDEX IF NOT EXISTS "football_results_leagueId_season_grade_round_homeName_awayName_key" ON "football_results"("leagueId", "season", "grade", "round", "homeName", "awayName");
CREATE INDEX IF NOT EXISTS "football_results_leagueId_season_grade_published_idx" ON "football_results"("leagueId", "season", "grade", "published");
CREATE UNIQUE INDEX IF NOT EXISTS "football_ladder_entries_leagueId_season_grade_clubName_key" ON "football_ladder_entries"("leagueId", "season", "grade", "clubName");
CREATE INDEX IF NOT EXISTS "football_ladder_entries_leagueId_season_grade_published_idx" ON "football_ladder_entries"("leagueId", "season", "grade", "published");

DO $$ BEGIN
  ALTER TABLE "football_data_imports" ADD CONSTRAINT "football_data_imports_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "football_data_conflicts" ADD CONSTRAINT "football_data_conflicts_importId_fkey" FOREIGN KEY ("importId") REFERENCES "football_data_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "football_fixtures" ADD CONSTRAINT "football_fixtures_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "football_results" ADD CONSTRAINT "football_results_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "football_ladder_entries" ADD CONSTRAINT "football_ladder_entries_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
