import { prisma } from '../db/client.js'

let ready: Promise<void> | null = null

export function ensureHighlightTables() {
  if (!ready) ready = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "highlight_submissions" (
      "id" TEXT PRIMARY KEY, "category" TEXT NOT NULL, "player_name" TEXT NOT NULL,
      "club_id" TEXT, "club_name" TEXT NOT NULL, "league_id" TEXT, "league_name" TEXT,
      "match_date" TIMESTAMPTZ, "round_label" TEXT, "video_url" TEXT NOT NULL,
      "thumbnail_url" TEXT, "description" TEXT, "submitter_name" TEXT NOT NULL,
      "submitter_email" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
      "week_key" TEXT NOT NULL, "voting_opens_at" TIMESTAMPTZ, "voting_closes_at" TIMESTAMPTZ,
      "published_at" TIMESTAMPTZ, "winner" BOOLEAN NOT NULL DEFAULT FALSE,
      "moderation_note" TEXT, "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "highlight_votes" (
      "id" TEXT PRIMARY KEY, "submission_id" TEXT NOT NULL REFERENCES "highlight_submissions"("id") ON DELETE CASCADE,
      "category" TEXT NOT NULL, "week_key" TEXT NOT NULL, "voter_key" TEXT NOT NULL,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "highlight_submissions_public_idx" ON "highlight_submissions" ("status", "week_key", "category")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "highlight_submissions_archive_idx" ON "highlight_submissions" ("winner", "week_key")`)
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "highlight_votes_one_per_category_week" ON "highlight_votes" ("category", "week_key", "voter_key")`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "highlight_votes_submission_idx" ON "highlight_votes" ("submission_id")`)
  })().catch(error => { ready = null; throw error })
  return ready
}
