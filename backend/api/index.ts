/**
 * Vercel serverless entry point.
 * Vercel looks for an exported default handler in /api/*.
 */

import express from 'express'
import baseApp from '../src/server.js'
import { augmentLiveMatchStream, liveStreamRouter } from '../src/api/routes/live-stream.js'
import { liveRealtimeRouter } from '../src/api/routes/live-realtime.js'
import { aiAssistantCoachRouter } from '../src/api/routes/ai-assistant-coach.js'

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use('/api/live-stream/realtime', liveRealtimeRouter)
app.use('/api/live-stream', liveStreamRouter)
app.use('/api/live-match/clubs/:clubId', augmentLiveMatchStream)
app.use('/api/ai-assistant-coach', aiAssistantCoachRouter)
app.use(baseApp)

export default app
