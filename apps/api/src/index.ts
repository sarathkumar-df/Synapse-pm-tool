// Startup assertions — fail fast on misconfiguration
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"')
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set')
}

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middleware/errors'
import { requireAuth } from './middleware/auth'
import { standardRateLimiter, aiRateLimiter } from './middleware/rate-limit'

// Routes
import authRouter from './routes/auth'
import projectsRouter from './routes/projects'
import mapsRouter from './routes/maps'
import nodesRouter from './routes/nodes'
import edgesRouter from './routes/edges'
import snapshotsRouter from './routes/snapshots'
import aiRouter from './routes/ai'
import sharedRouter from './routes/shared'

const app = express()
const PORT = parseInt(process.env.PORT ?? '3001', 10)

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.WEB_URL ?? 'http://localhost:5173',
  credentials: true,
}))

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ─── Public routes (no auth) ──────────────────────────────────────────────────
app.use('/api/auth', standardRateLimiter, authRouter)
app.use('/api/shared', sharedRouter)

// ─── Protected routes ─────────────────────────────────────────────────────────
app.use('/api', requireAuth, standardRateLimiter)
app.use('/api/projects', projectsRouter)
app.use('/api/maps', mapsRouter)
app.use('/api/maps', nodesRouter)   // /api/maps/:mapId/nodes
app.use('/api/maps', edgesRouter)   // /api/maps/:mapId/edges
app.use('/api/maps', snapshotsRouter) // /api/maps/:mapId/snapshots
app.use('/api/ai', aiRateLimiter, aiRouter)

// ─── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler)

// Only start the server when run directly (not when imported by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Synapse API running on http://localhost:${PORT}`)
  })
}

export default app
