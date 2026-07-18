import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const scalar = async (sql) => {
  const rows = await prisma.$queryRawUnsafe(sql)
  return Number(rows?.[0]?.count ?? 0)
}

try {
  const checks = {
    leaguesWithoutIds: await scalar('SELECT COUNT(*)::int AS count FROM leagues WHERE id IS NULL'),
    clubsWithoutIds: await scalar('SELECT COUNT(*)::int AS count FROM clubs WHERE id IS NULL'),
    goalKickersWithoutPlayerIds: await scalar('SELECT COUNT(*)::int AS count FROM football_goal_kickers WHERE "playerId" IS NULL'),
    ocrGoalKickersWithoutPlayerIds: await scalar(`SELECT COUNT(*)::int AS count FROM football_goal_kickers WHERE "sourceType" = 'OCR_UPLOAD' AND "playerId" IS NULL`),
    publishedResultsWithoutClubIds: await scalar('SELECT COUNT(*)::int AS count FROM football_results WHERE published = true AND ("homeClubId" IS NULL OR "awayClubId" IS NULL)'),
    verifiedLadderRowsWithoutClubIds: await scalar('SELECT COUNT(*)::int AS count FROM football_ladder_entries WHERE verified = true AND "clubId" IS NULL'),
    duplicateCanonicalPlayers: await scalar(`
      SELECT COUNT(*)::int AS count FROM (
        SELECT "normalizedName", COALESCE("currentClubId"::text, ''), COUNT(*)
        FROM canonical_players
        GROUP BY 1, 2 HAVING COUNT(*) > 1
      ) duplicates
    `),
  }

  console.table(checks)

  const blocking = [
    'leaguesWithoutIds',
    'clubsWithoutIds',
    'ocrGoalKickersWithoutPlayerIds',
    'publishedResultsWithoutClubIds',
    'verifiedLadderRowsWithoutClubIds',
    'duplicateCanonicalPlayers',
  ].filter((key) => checks[key] > 0)

  if (blocking.length) {
    console.error(`Canonical ID verification failed: ${blocking.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log('Canonical ID verification passed.')
  }
} finally {
  await prisma.$disconnect()
}
