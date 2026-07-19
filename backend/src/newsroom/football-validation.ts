import { prisma } from '../db/client.js'

const LEGACY_PATTERN = /(country netball|a grade netball|got netty|go netty|cnca)/i
const replacements: Array<[RegExp, string]> = [
  [/Australian country netball/gi, 'Australian community football'],
  [/country netball/gi, 'community football'],
  [/A Grade clubs/gi, 'Senior football clubs'],
  [/A Grade netball/gi, 'Senior football'],
  [/Got Netty/gi, 'PlayFooty'],
  [/Go Netty/gi, 'PlayFooty'],
  [/CNCA/gi, 'PlayFooty'],
]

function footballise(value: string | null): string | null {
  if (!value) return value
  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
}

function footballiseJson(value: string | null): string | null {
  if (!value) return value
  try {
    const parsed = JSON.parse(value)
    const walk = (entry: unknown): unknown => {
      if (typeof entry === 'string') return footballise(entry)
      if (Array.isArray(entry)) return entry.map(walk)
      if (entry && typeof entry === 'object') return Object.fromEntries(Object.entries(entry).map(([key, item]) => [key, walk(item)]))
      return entry
    }
    return JSON.stringify(walk(parsed))
  } catch {
    return footballise(value)
  }
}

function normaliseCategory(value: string): string {
  if (value === 'clubs') return 'club-news'
  if (value === 'leagues') return 'league-news'
  return value
}

export async function validateFootballDrafts(runId?: string) {
  const rows = await prisma.generatedArticle.findMany({
    where: { status: 'DRAFT', ...(runId ? { runId } : {}) },
    select: { id: true, title: true, subtitle: true, summary: true, body: true, tags: true, seoTitle: true, seoDescription: true, reasoning: true, sourceData: true, category: true },
  })

  let corrected = 0
  let blocked = 0
  for (const row of rows) {
    const next = {
      title: footballise(row.title) ?? row.title,
      subtitle: footballise(row.subtitle),
      summary: footballise(row.summary) ?? row.summary,
      body: footballiseJson(row.body) ?? row.body,
      tags: footballiseJson(row.tags),
      seoTitle: footballise(row.seoTitle),
      seoDescription: footballise(row.seoDescription),
      reasoning: footballise(row.reasoning),
      sourceData: footballiseJson(row.sourceData),
      category: normaliseCategory(row.category),
    }
    const combined = [next.title, next.subtitle, next.summary, next.body, next.tags, next.seoTitle, next.seoDescription].filter(Boolean).join(' ')
    const hasSourceData = !!next.sourceData && next.sourceData !== '{}' && next.sourceData !== 'null'
    const invalid = LEGACY_PATTERN.test(combined) || !hasSourceData
    await prisma.generatedArticle.update({
      where: { id: row.id },
      data: {
        ...next,
        ...(invalid ? { confidence: 0, reasoning: `${next.reasoning ?? ''}${next.reasoning ? ' ' : ''}Publication blocked: ${LEGACY_PATTERN.test(combined) ? 'legacy non-football wording remains' : 'source data is missing'}.` } : {}),
      },
    })
    if (invalid) blocked++
    else corrected++
  }
  return { checked: rows.length, corrected, blocked }
}

export function articlePassesFootballValidation(article: { title: string; subtitle: string | null; summary: string; body: string; tags: string | null; sourceData: string | null; confidence: number | null }) {
  const combined = [article.title, article.subtitle, article.summary, article.body, article.tags].filter(Boolean).join(' ')
  return !LEGACY_PATTERN.test(combined) && !!article.sourceData && article.sourceData !== '{}' && article.sourceData !== 'null' && (article.confidence ?? 0) > 0
}
