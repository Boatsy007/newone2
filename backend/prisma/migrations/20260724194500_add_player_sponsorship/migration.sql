ALTER TABLE "sponsorships"
ADD COLUMN IF NOT EXISTS "playerId" TEXT;

CREATE INDEX IF NOT EXISTS "sponsorships_playerId_idx"
ON "sponsorships"("playerId");
