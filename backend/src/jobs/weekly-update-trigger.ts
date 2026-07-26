/**
 * CLI trigger for the Weekly Update Engine (Backend Phase B1).
 *
 * Runs the Monday data update. News publishing is manual-only, so this trigger
 * never asks the weekly engine to generate article drafts.
 */

import { prisma }          from '../db/client.js'
import { runWeeklyUpdate } from './weekly-update-engine.js'
import { logger }          from '../utils/logger.js'

function has(flag: string): boolean { return process.argv.includes(`--${flag}`) }
function val(name: string): string | undefined {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

async function main() {
  const leagueId = val('league')
  const report = await runWeeklyUpdate({
    leagueId,
    sync:           !has('no-sync'),
    backupFirst:    !has('no-backup'),
    recalculate:    !has('no-recalc'),
    sweep:          !has('no-sweep'),
    generateDrafts: false,
    dryRun:         has('dry-run'),
    source:         'CLI',
  })

  console.log('\n═══ WEEKLY UPDATE ═══')
  console.log(JSON.stringify(report, null, 2))

  await prisma.$disconnect()
  const anyFailed = report.steps.some(s => s.ran && !s.ok)
  if (anyFailed) process.exit(1)
}

main().catch(async e => {
  logger.error('Weekly update trigger failed', { detail: String(e) })
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
