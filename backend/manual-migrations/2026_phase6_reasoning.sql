-- Phase 6: ranking explainability — additive, idempotent.
-- Every league stores WHY it holds its strength rating and WHEN it was last
-- calculated. Applied via apply-migration.ts ($executeRawUnsafe per statement).

ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "strengthReasoning" TEXT;
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "strengthCalculatedAt" TIMESTAMP(3);
