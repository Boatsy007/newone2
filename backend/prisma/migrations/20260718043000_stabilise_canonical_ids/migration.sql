-- Step 2: stabilise canonical IDs and data ownership.
-- Additive only. Existing league and club UUIDs remain the source of truth.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "canonical_players" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "canonicalName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "currentClubId" UUID,
  "currentLeagueId" UUID,
  "photoUrl" TEXT,
  "bio" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "canonical_players_name_club_key"
  ON "canonical_players" ("normalizedName", COALESCE("currentClubId"::text, ''));
CREATE INDEX IF NOT EXISTS "canonical_players_club_idx" ON "canonical_players" ("currentClubId");
CREATE INDEX IF NOT EXISTS "canonical_players_league_idx" ON "canonical_players" ("currentLeagueId");

ALTER TABLE "football_goal_kickers"
  ADD COLUMN IF NOT EXISTS "playerId" UUID;

-- Create one stable player per normalised name + club. Names remain display snapshots,
-- while playerId becomes the relationship key used across seasons and grades.
INSERT INTO "canonical_players" (
  "canonicalName", "normalizedName", "currentClubId", "currentLeagueId"
)
SELECT DISTINCT ON (
  lower(regexp_replace(trim(g."playerName"), '[^a-zA-Z0-9]+', '', 'g')),
  COALESCE(g."clubId"::text, '')
)
  trim(g."playerName"),
  lower(regexp_replace(trim(g."playerName"), '[^a-zA-Z0-9]+', '', 'g')),
  g."clubId"::uuid,
  g."leagueId"::uuid
FROM "football_goal_kickers" g
WHERE trim(g."playerName") <> ''
ON CONFLICT DO NOTHING;

UPDATE "football_goal_kickers" g
SET "playerId" = p."id"
FROM "canonical_players" p
WHERE g."playerId" IS NULL
  AND p."normalizedName" = lower(regexp_replace(trim(g."playerName"), '[^a-zA-Z0-9]+', '', 'g'))
  AND COALESCE(p."currentClubId"::text, '') = COALESCE(g."clubId"::text, '');

CREATE INDEX IF NOT EXISTS "football_goal_kickers_player_idx"
  ON "football_goal_kickers" ("playerId");
CREATE INDEX IF NOT EXISTS "football_goal_kickers_player_season_idx"
  ON "football_goal_kickers" ("playerId", "season", "grade");

-- ID-first indexes for all imported football data. Display names remain snapshots only.
CREATE INDEX IF NOT EXISTS "football_fixtures_home_club_idx" ON "football_fixtures" ("homeClubId");
CREATE INDEX IF NOT EXISTS "football_fixtures_away_club_idx" ON "football_fixtures" ("awayClubId");
CREATE INDEX IF NOT EXISTS "football_results_home_club_idx" ON "football_results" ("homeClubId");
CREATE INDEX IF NOT EXISTS "football_results_away_club_idx" ON "football_results" ("awayClubId");
CREATE INDEX IF NOT EXISTS "football_ladder_entries_club_idx" ON "football_ladder_entries" ("clubId");

-- Constraints are NOT VALID so existing imperfect historical rows do not block deployment.
-- New verified/published rows must have canonical IDs.
DO $$ BEGIN
  ALTER TABLE "football_ladder_entries"
    ADD CONSTRAINT "football_ladder_verified_requires_club_id"
    CHECK (NOT "verified" OR "clubId" IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "football_results"
    ADD CONSTRAINT "football_result_published_requires_club_ids"
    CHECK (NOT "published" OR ("homeClubId" IS NOT NULL AND "awayClubId" IS NOT NULL)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "football_goal_kickers"
    ADD CONSTRAINT "football_goal_kicker_requires_player_id_for_ocr"
    CHECK ("sourceType" <> 'OCR_UPLOAD' OR "playerId" IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE "canonical_players" IS 'Canonical player identity. Seasonal goal-kicker rows reference this stable UUID.';
COMMENT ON COLUMN "football_goal_kickers"."playerId" IS 'Stable canonical player UUID; playerName remains a display snapshot.';
