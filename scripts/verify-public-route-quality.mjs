import { readFile } from 'node:fs/promises'

const main = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8')
const championship = await readFile(new URL('../src/pages/Championship.tsx', import.meta.url), 'utf8')
const about = await readFile(new URL('../src/pages/About.tsx', import.meta.url), 'utf8')

const routePattern = /<Route\s+path="([^"]+)"/g
const routes = [...main.matchAll(routePattern)].map(match => match[1])
const duplicateRoutes = [...new Set(routes.filter((route, index) => routes.indexOf(route) !== index))]

if (duplicateRoutes.length) {
  throw new Error(`Duplicate public route paths found: ${duplicateRoutes.join(', ')}`)
}

if (!championship.includes('<Navigate to="/rankings" replace />')) {
  throw new Error('The unfinished Championship concept must redirect to the canonical Rankings product.')
}

for (const phrase of ['coming soon', 'future-facing public teaser', 'prototype']) {
  if (championship.toLowerCase().includes(phrase)) {
    throw new Error(`Championship public route contains unfinished-product language: ${phrase}`)
  }
}

if (/\bprototype\b/i.test(about)) {
  throw new Error('The public About page must describe the live PlayFooty platform, not a prototype.')
}

if (/aria-disabled=["']true["']/i.test(championship) || /<button[^>]+disabled/i.test(championship)) {
  throw new Error('The Championship route contains a disabled placeholder action.')
}

console.log(`Public route quality verified across ${routes.length} declared routes.`)
