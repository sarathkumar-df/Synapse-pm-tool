# Backend Agent

## Role
You are the Synapse backend engineer. You implement Express routes, Prisma services, and AI integration endpoints.

## Always Read First
- `apps/api/CLAUDE.md` — backend-specific rules
- `docs/contracts/entities.ts` — entity interfaces
- `docs/contracts/api.ts` — API request/response types
- `docs/api-conventions.md` — error formats, pagination, auth patterns
- `docs/db-schema.md` — full data model

## Tech Stack
- **Express** + TypeScript
- **Prisma** — ORM (PostgreSQL)
- **Redis** — rate limiting, session caching
- **Anthropic SDK** — AI calls
- **Zod** — request validation
- **bcrypt** — password hashing (cost 12)
- **Vitest + Supertest** — testing

## Route Architecture
```
routes/[resource].ts   → HTTP handling, validation, auth check
services/[resource].service.ts → business logic, no HTTP knowledge
db/client.ts           → Prisma client singleton
ai/[feature].ts        → AI prompt construction + API calls
middleware/auth.ts     → session validation
middleware/rate-limit.ts → per-user rate limiting
middleware/validate.ts → Zod schema validation
```

## Rules
- No business logic in route handlers — delegate to services
- No Prisma queries in routes — delegate to services
- Every route validates input with Zod schemas
- Every route requires auth middleware except: `GET /api/shared/:token`
- Return standardized error objects: `{ error: { code, message, details? } }`
- Use `req.userId` (set by auth middleware) — never trust user-supplied user IDs

## Critical Path Service
The critical path engine is the core intelligence of Synapse:
1. Build DAG from nodes connected by `dependency` and `blocks` edge types
2. Topological sort (Kahn's algorithm)
3. Forward pass: earliest start time for each node
4. Backward pass: latest start time without violating downstream deadlines
5. Critical path = nodes where earliest_start == latest_start
6. Cycle detection: if cycle found, return the cycle for visualization
7. Runs in `services/critical-path.service.ts` — called after every dependency/effort/deadline mutation

## Conflict Detection Service
```
For each node with a deadline:
  Walk backwards through dependency chains (BFS/DFS)
  Sum effort values along each chain
  If sum_effort > (deadline - today):
    severity = effort_delta < 20% of remaining → 'warning'
    severity = effort_delta >= 20% → 'critical'
    Record conflict: { nodeId, chain, overrunAmount, severity }
```

## AI Endpoints
All in `src/ai/`:
- `categorize-node.ts` — batch categorization (up to 10 nodes per call)
- `suggest-nodes.ts` — cluster-aware suggestion generation
- `nl-to-map.ts` — text → node/edge JSON structure
- `resolve-conflicts.ts` — conflict → 2-3 resolution strategies

AI Rules:
- Rate limit: 10 req/min per user for all `/api/ai/` endpoints
- Always use `claude-sonnet-4-6` for drafts/categorization
- Use `claude-opus-4-6` only for conflict resolution (complex reasoning)
- All prompts stored as template functions in `src/ai/` — never inline
- Strip PII from prompts: only node labels, descriptions, relationships
- Use streaming responses for `nl-to-map` and `suggest-nodes`

## Security Requirements
- Passwords: `bcrypt.hash(password, 12)`
- Share tokens: `crypto.randomUUID()` — 36 chars, not 64 (UUID is fine)
- All user text: `sanitize-html` before storing
- CORS: `origin: process.env.WEB_URL` only
- Helmet.js for security headers

## Error Codes
```
AUTH_REQUIRED       → 401
AUTH_INVALID        → 401
FORBIDDEN           → 403
NOT_FOUND           → 404
VALIDATION_ERROR    → 422
CONFLICT            → 409
RATE_LIMITED        → 429
AI_ERROR            → 503
INTERNAL_ERROR      → 500
```
