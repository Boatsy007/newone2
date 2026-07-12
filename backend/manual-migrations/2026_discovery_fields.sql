-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 — PlayHQ discovery schema (ADDITIVE ONLY)
-- Run in Supabase → SQL Editor. Safe on the live DB: only adds columns with
-- defaults, never drops or alters existing data. The ranking tables
-- (ranking_runs / ranking_entries) and the strength fields are untouched.
-- ─────────────────────────────────────────────────────────────────────────────

-- Associations: PlayHQ directory metadata
ALTER TABLE associations
  ADD COLUMN IF NOT EXISTS "playhqOrgSlug"    text,
  ADD COLUMN IF NOT EXISTS "playhqUrl"        text,
  ADD COLUMN IF NOT EXISTS "logoUrl"          text,
  ADD COLUMN IF NOT EXISTS "stateCode"        text,
  ADD COLUMN IF NOT EXISTS "active"           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "lastDiscoveredAt" timestamp(3);

CREATE UNIQUE INDEX IF NOT EXISTS "associations_playhqOrgSlug_key"
  ON associations ("playhqOrgSlug");

-- Leagues: discovery metadata + automatic strength model.
ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS "playhqOrgSlug"       text,
  ADD COLUMN IF NOT EXISTS "playhqGradeId"       text,
  ADD COLUMN IF NOT EXISTS "playhqGradeName"     text,
  ADD COLUMN IF NOT EXISTS "ladderUrl"           text,
  ADD COLUMN IF NOT EXISTS "currentSeason"       text,
  ADD COLUMN IF NOT EXISTS "enabled"             boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "autoDiscovered"      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "needsStrengthReview" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "gradeOverride"       text,
  ADD COLUMN IF NOT EXISTS "ladderUrlOverride"   text,
  ADD COLUMN IF NOT EXISTS "lastSyncedAt"        timestamp(3),
  ADD COLUMN IF NOT EXISTS "syncError"           text,
  -- Automatic strength (0–5) + confidence. Manual override optional.
  ADD COLUMN IF NOT EXISTS "automaticStrengthRating" double precision NOT NULL DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS "manualStrengthOverride"  double precision,
  ADD COLUMN IF NOT EXISTS "finalStrengthRating"     double precision NOT NULL DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS "strengthConfidence"      double precision NOT NULL DEFAULT 0.3;

-- Backfill: existing leagues were manually rated, so preserve those ratings as
-- overrides (keeps current rankings stable). Uses the existing strengthTier
-- (1–5) as the 0–5 rating. New/auto leagues will compute their own from ladder.
UPDATE leagues
SET "manualStrengthOverride"  = COALESCE("manualStrengthOverride", "strengthTier"::double precision),
    "automaticStrengthRating" = "strengthTier"::double precision,
    "finalStrengthRating"     = "strengthTier"::double precision,
    "strengthConfidence"      = 0.5
WHERE "manualStrengthOverride" IS NULL;

-- Club league seasons: advanced-ladder columns from PlayHQ "Show advanced ladder"
ALTER TABLE club_league_seasons
  ADD COLUMN IF NOT EXISTS "position"          integer,
  ADD COLUMN IF NOT EXISTS "byes"              integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "forfeits"          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "disqualifications" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "adjustments"       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "playhqTeamUrl"     text,
  ADD COLUMN IF NOT EXISTS "playhqTeamId"      text;
