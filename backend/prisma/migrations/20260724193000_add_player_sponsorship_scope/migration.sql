-- Additive player sponsorship support on the existing commercial sponsorship table.
ALTER TABLE "sponsorships"
  ADD COLUMN IF NOT EXISTS "player_id" TEXT;

CREATE INDEX IF NOT EXISTS "sponsorships_player_id_idx"
  ON "sponsorships" ("player_id");
