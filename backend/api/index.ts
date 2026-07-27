/**
 * Vercel serverless entry point.
 * Loads the Express application lazily so startup failures return a useful
 * health response instead of taking every API route down without context.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

let appPromise: Promise<any> | null = null

function loadApp() {
  if (!appPromise) appPromise = import('../src/server.js').then(module => module.default)
  return appPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await loadApp()
    return app(req, res)
  } catch (reason) {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    console.error('PlayFooty API startup failed', error)
    const url = req.url || ''
    res.statusCode = 503
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    const body: Record<string, unknown> = {
      status: 'error',
      error: 'PlayFooty API failed to start',
      code: 'API_STARTUP_FAILED',
    }
    if (url === '/health' || url.startsWith('/api/debug')) {
      body.detail = error.message.slice(0, 300)
      body.name = error.name
    }
    res.end(JSON.stringify(body))
  }
}
