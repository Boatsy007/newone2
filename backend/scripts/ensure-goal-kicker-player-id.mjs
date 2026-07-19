import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.resolve(scriptDir, '../prisma/schema.prisma')
const schema = await readFile(schemaPath, 'utf8')

const modelPattern = /model FootballGoalKicker \{([\s\S]*?)\n\}/
const match = schema.match(modelPattern)
if (!match) throw new Error('FootballGoalKicker model is missing from Prisma schema.')

if (/^\s*playerId\s+String\b/m.test(match[1])) {
  console.log('FootballGoalKicker.playerId already exists in Prisma schema.')
  process.exit(0)
}

const updatedModel = match[0].replace(
  /(model FootballGoalKicker \{\s*\n\s*id\s+String[^\n]*\n)/,
  '$1  playerId    String   @db.Uuid\n',
)

if (updatedModel === match[0]) throw new Error('Could not insert FootballGoalKicker.playerId into Prisma schema.')

await writeFile(schemaPath, schema.replace(match[0], updatedModel), 'utf8')
console.log('Added required UUID FootballGoalKicker.playerId to Prisma schema before client generation.')
