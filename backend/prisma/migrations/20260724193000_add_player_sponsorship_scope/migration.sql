-- Additive player sponsorship support on the existing commercial sponsorship table.
ALTER TABLE "sponsorships"
  ADD COLUMN IF NOT EXISTS "playerId" TEXT;

CREATE INDEX IF NOT EXISTS "sponsorships_playerId_idx"
  ON "sponsorships" ("playerId");
