/**
 * Additive migration applier (pooler-safe).
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs manual-migrations/2026_discovery_fields.sql over the SAME
 * connection the app uses (Prisma Client in pgbouncer/transaction-pool mode).
 *
 * We deliberately DON'T use `prisma db execute` / the schema engine: it needs a
 * session-level connection (advisory locks) that a transaction-mode pooler does
 * not support, so it hangs. Prisma Client's $executeRawUnsafe runs one DDL
 * statement per round-trip, which the pooler handles fine.
 *
 * All statements are idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT
 * EXISTS / guarded UPDATE), so this is safe to run repeatedly.
 *
 * Usage: tsx src/jobs/apply-migration.ts [path-to-sql]
 */

import { readFileSync } from 'fs'
import { prisma } from '../db/client.js'

const file = process.argv[2] ?? 'manual-migrations/2026_discovery_fields.sql'

/** Strip line comments (-- …) and split into individual SQL statements. */
function statements(sql: string): string[] {
  const noComments = sql
    .split('\n')
    .map(l => { const i = l.indexOf('--'); return i >= 0 ? l.slice(0, i) : l })
    .join('\n')
  return noComments.split(';').map(s => s.trim()).filter(s => s.length > 0)
}

async function main() {
  const sql = readFileSync(file, 'utf8')
  const stmts = statements(sql)
  console.log(`Applying migration: ${file} (${stmts.length} statements)`)

  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i]
    const preview = s.replace(/\s+/g, ' ').slice(0, 70)
    process.stdout.write(`  [${i + 1}/${stmts.length}] ${preview}… `)
    await prisma.$executeRawUnsafe(s)
    console.log('ok')
  }

  console.log('✅ Migration applied.')
  await prisma.$disconnect()
  process.exit(0)
}

main().catch(async err => {
  console.error('❌ Migration failed:', err instanceof Error ? err.message : err)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
