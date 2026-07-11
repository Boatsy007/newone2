-- Phase F2 — PlayHQ venue/surface/round/pool id columns (ADDITIVE, IDEMPOTENT)
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds the remaining PlayHQ external id columns exposed by the official API to
-- fixtures and match_results so games map cleanly to venues, playing surfaces,
-- rounds and pools. Netball untouched (all nullable). Safe to re-run.

ALTER TABLE "match_results" ADD COLUMN IF NOT EXISTS "playhqVenueId"   TEXT;
ALTER TABLE "match_results" ADD COLUMN IF NOT EXISTS "playhqSurfaceId" TEXT;
ALTER TABLE "match_results" ADD COLUMN IF NOT EXISTS "playhqRoundId"   TEXT;
ALTER TABLE "match_results" ADD COLUMN IF NOT EXISTS "playhqPoolId"    TEXT;

ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "playhqVenueId"   TEXT;
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "playhqSurfaceId" TEXT;
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "playhqRoundId"   TEXT;
ALTER TABLE "fixtures" ADD COLUMN IF NOT EXISTS "playhqPoolId"    TEXT;
