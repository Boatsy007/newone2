import express from 'express'
import cors from 'cors'
import { portalAuthRouter } from './api/routes/portal-auth.js'
import { leaguePortalRouter } from './api/routes/league-portal.js'
import { leaguePortalContactsRouter } from './api/routes/league-portal-contacts.js'
import { adminPortalRolloutRouter } from './admin/portal-rollout.js'

const app = express()
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }))
app.use(express.json({ limit: '8mb' }))

app.use('/api/portal-auth', portalAuthRouter)
app.use('/api/league-portal', leaguePortalRouter)
app.use('/api/league-portal', leaguePortalContactsRouter)
app.use('/admin/portal-rollout', adminPortalRolloutRouter)

app.get('/portal-health', (_req, res) => res.json({ status: 'ok' }))
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

export default app
