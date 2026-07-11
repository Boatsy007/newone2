-- Safe additive guard for the PlayFooty country goal-kicking ladder.
-- This migration is intentionally idempotent: it creates the table/columns/indexes
-- needed by the Goal Kickers feature without dropping or rewriting existing data.

CREATE TABLE IF NOT EXISTS "football_goal_kickers" (
  "id" TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  "playerName" TEXT NOT NULL,
  "goals" INTEGER NOT NULL DEFAULT 0,
  "clubName" TEXT NOT NULL,
  "leagueName" TEXT NOT NULL,
  "clubId" TEXT NULL,
  "leagueId" TEXT NULL,
  "season" TEXT NOT NULL,
  "grade" TEXT NULL,
  "matches" INTEGER NULL,
  "sourceUrl" TEXT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'PLAYHQ',
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "playerName" TEXT;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "goals" INTEGER DEFAULT 0;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "clubName" TEXT;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "leagueName" TEXT;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "clubId" TEXT NULL;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "leagueId" TEXT NULL;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "season" TEXT;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "grade" TEXT NULL;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "matches" INTEGER NULL;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT NULL;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "sourceType" TEXT DEFAULT 'PLAYHQ';
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "importedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "football_goal_kickers" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "football_goal_kickers" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "football_goal_kickers" ALTER COLUMN "goals" SET DEFAULT 0;
ALTER TABLE "football_goal_kickers" ALTER COLUMN "sourceType" SET DEFAULT 'PLAYHQ';
ALTER TABLE "football_goal_kickers" ALTER COLUMN "importedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "football_goal_kickers" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "football_goal_kickers" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "football_goal_kickers_season_grade_player_club_league_key"
  ON "football_goal_kickers"("season", "grade", "playerName", "clubName", "leagueName");

CREATE INDEX IF NOT EXISTS "football_goal_kickers_season_goals_idx" ON "football_goal_kickers"("season", "goals");
CREATE INDEX IF NOT EXISTS "football_goal_kickers_league_idx" ON "football_goal_kickers"("leagueId");
CREATE INDEX IF NOT EXISTS "football_goal_kickers_club_idx" ON "football_goal_kickers"("clubId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'football_goal_kickers_leagueId_fkey') THEN
    ALTER TABLE "football_goal_kickers" ADD CONSTRAINT "football_goal_kickers_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'football_goal_kickers_clubId_fkey') THEN
    ALTER TABLE "football_goal_kickers" ADD CONSTRAINT "football_goal_kickers_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
