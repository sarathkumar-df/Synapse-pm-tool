# Synapse API — Backend Rules

Read `../../CLAUDE.md` first (project constitution). This file adds backend-specific rules.

## Stack
- Node.js + Express + TypeScript
- Prisma ORM → PostgreSQL
- Redis → rate limiting + session caching
- Anthropic SDK → AI features
- Zod → request validation
- Vitest + Supertest → testing

## Key Files
- `src/index.ts` — Express app setup
- `src/db/client.ts` — Prisma singleton
- `src/middleware/auth.ts` — JWT validation, sets req.userId
- `src/middleware/rate-limit.ts` — Redis-backed rate limiter
- `src/services/critical-path.service.ts` — THE core intelligence
- `src/services/conflict.service.ts` — Conflict detection
- `src/ai/` — All AI prompt builders

## Route Registration Order
```typescript
app.use('/api/auth', authRouter)        // no auth middleware
app.use('/api/shared', sharedRouter)    // no auth middleware
app.use('/api', requireAuth)            // auth middleware for all below
app.use('/api/projects', projectsRouter)
app.use('/api/maps', mapsRouter)
app.use('/api/ai', aiRateLimiter, aiRouter)  // extra rate limit
```

## Ownership Check Pattern
Every route touching user resources must include user_id in the query:
```typescript
// Required pattern for all resource fetches
const resource = await prisma.map.findFirst({
  where: { id: req.params.id, user_id: req.userId }
})
if (!resource) throw forbidden()  // 403, not 404 — don't reveal existence
```

## Critical Path Service Interface
```typescript
// apps/api/src/services/critical-path.service.ts
export async function calculateCriticalPath(
  mapId: string
): Promise<CriticalPathResult>

// Called after every mutation to:
// - nodes.effort_value
// - nodes.deadline
// - edges of type 'dependency' or 'blocks'
```

## Conflict Detection Service Interface
```typescript
// apps/api/src/services/conflict.service.ts
export async function detectConflicts(
  mapId: string
): Promise<Conflict[]>

// Returns all active conflicts, sorted by severity (critical first)
```

## After Any Mutation Pattern
```typescript
// Routes that touch nodes/edges return recalculated state
const [updatedNode, conflicts, criticalPath] = await Promise.all([
  nodeService.update(nodeId, data),
  conflictService.detectConflicts(mapId),
  criticalPathService.calculateCriticalPath(mapId),
])
res.json({ data: { node: updatedNode, conflicts, critical_path: criticalPath } })
```

## Snapshot Limits
- Max 50 snapshots per map (enforced in service)
- Auto-purge oldest auto-snapshots when limit reached
- Manual snapshots require explicit user deletion

## AI Service Pattern
```typescript
// Each AI function:
// 1. Build prompt from template
// 2. Call Anthropic SDK
// 3. Parse response with Zod
// 4. Return typed result or throw ApiError('AI_ERROR', 503)

export async function categorizeNodes(
  context: CategorizationPromptContext
): Promise<AICategorizeOutput>
```

## Environment Variables Required
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
ANTHROPIC_API_KEY=...
WEB_URL=https://... (for CORS)
NODE_ENV=development|production
```
