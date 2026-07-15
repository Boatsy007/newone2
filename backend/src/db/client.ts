/**
 * Prisma client singleton — safe for serverless (one instance per cold start).
 */

import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger.js'

declare global {
  // Prevent multiple instances in dev hot-reload
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

/**
 * Supabase's connection poolers (PgBouncer) reuse Postgres connections across
 * serverless invocations. Prisma names its prepared statements (s0, s1, …) and,
 * when a pooled connection is reused, those names collide — Postgres throws
 * `42P05: prepared statement "s0" already exists`.
 *
 * The fix is to append `?pgbouncer=true`, which tells Prisma to stop using
 * named prepared statements. We apply it automatically for any pooler URL
 * (host contains "pooler" or port 6543) so the deployment doesn't depend on
 * the env var being hand-edited correctly. Direct connections are left alone.
 */
function resolveDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    const isPooler = url.hostname.includes('pooler') || url.port === '6543'
    if (isPooler && !url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true')
    }
    return url.toString()
  } catch {
    return raw
  }
}

function createClient(): PrismaClient {
  const datasourceUrl = resolveDatasourceUrl()
  const client = new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : ['warn', 'error'],
  })

  if (process.env.NODE_ENV === 'development') {
    // @ts-expect-error — prisma event typing
    client.$on('query', (e: { query: string; duration: number }) => {
      logger.debug('Prisma query', { query: e.query, durationMs: e.duration })
    })
  }

  return client
}

// Lazy singleton — not instantiated at import time so missing DATABASE_URL
// doesn't crash the whole serverless function before the request even starts.
let _prisma: PrismaClient | undefined

function getPrisma(): PrismaClient {
  if (!_prisma) {
    if (process.env.NODE_ENV === 'production') {
      _prisma = createClient()
    } else {
      globalThis.__prisma ??= createClient()
      _prisma = globalThis.__prisma
    }
  }
  return _prisma
}

function sanitiseRankingEntryArgs(args: unknown): unknown {
  if (!args || typeof args !== 'object') return args
  const next = { ...(args as Record<string, unknown>) }
  if (next.select && typeof next.select === 'object') {
    const select = { ...(next.select as Record<string, unknown>) }
    delete select.weekLabel
    delete select.season
    next.select = select
  }
  return next
}

function sanitiseClubArgs(args: unknown): unknown {
  if (!args || typeof args !== 'object') return args
  const next = { ...(args as Record<string, unknown>) }
  if (next.select && typeof next.select === 'object') {
    const select = { ...(next.select as Record<string, unknown>) }
    const rankingEntries = select.rankingEntries
    if (rankingEntries && typeof rankingEntries === 'object') {
      const rankingArgs = { ...(rankingEntries as Record<string, unknown>) }
      if (rankingArgs.select && typeof rankingArgs.select === 'object') {
        const rankingSelect = { ...(rankingArgs.select as Record<string, unknown>) }
        delete rankingSelect.weekLabel
        delete rankingSelect.season
        rankingArgs.select = rankingSelect
      }
      select.rankingEntries = rankingArgs
    }
    next.select = select
  }
  return next
}

function proxiedDelegate(delegate: Record<string | symbol, unknown>, sanitise: (args: unknown) => unknown): unknown {
  return new Proxy(delegate, {
    get(target, prop) {
      const value = target[prop]
      if (typeof value !== 'function') return value
      if (prop === 'findFirst' || prop === 'findMany' || prop === 'findUnique') {
        return (args: unknown) => (value as (args: unknown) => unknown).call(target, sanitise(args))
      }
      return (value as Function).bind(target)
    },
  })
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma()
    if (prop === 'rankingEntry') return proxiedDelegate(client.rankingEntry as unknown as Record<string | symbol, unknown>, sanitiseRankingEntryArgs)
    if (prop === 'club') return proxiedDelegate(client.club as unknown as Record<string | symbol, unknown>, sanitiseClubArgs)
    return (client as unknown as Record<string | symbol, unknown>)[prop]
  },
})