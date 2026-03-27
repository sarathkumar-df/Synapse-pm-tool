# Synapse API Conventions

All routes follow these patterns. Read this before implementing any backend route.

## Base URL
- Development: `http://localhost:3001/api`
- Production: `https://api.synapse.dev/api`

## Authentication
All endpoints require `Authorization: Bearer <token>` header except:
- `GET /api/shared/:token` — public shared map view
- `POST /api/auth/register`
- `POST /api/auth/login`

Auth middleware sets `req.userId: string` on every authenticated request.

## Request Format
- Content-Type: `application/json`
- All timestamps: ISO 8601 strings
- All IDs: cuid strings (not UUIDs in request bodies)

## Response Format

### Success
```json
{ "data": { ... } }
```

### Paginated List
```json
{
  "data": [...],
  "pagination": {
    "total": 42,
    "page": 1,
    "per_page": 20,
    "total_pages": 3
  }
}
```

### Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "label": ["Label is required"],
      "deadline": ["Must be a valid ISO 8601 date"]
    }
  }
}
```

## HTTP Status Codes
| Code | When |
|------|------|
| 200 | Successful GET, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE |
| 400 | Bad request (malformed JSON) |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized (wrong owner) |
| 404 | Resource not found |
| 409 | Conflict (duplicate, unique constraint) |
| 422 | Validation error (valid JSON, invalid data) |
| 429 | Rate limited |
| 503 | AI service unavailable |
| 500 | Internal server error |

## Error Codes
```
AUTH_REQUIRED       → 401
AUTH_INVALID        → 401
AUTH_EXPIRED        → 401
FORBIDDEN           → 403 (use this, not 404, when user doesn't own resource)
NOT_FOUND           → 404
DUPLICATE           → 409
VALIDATION_ERROR    → 422
RATE_LIMITED        → 429
AI_ERROR            → 503
INTERNAL_ERROR      → 500
```

## Pagination
- Query params: `?page=1&per_page=20`
- Default: page=1, per_page=20
- Max per_page: 100

## Sorting
- Query params: `?sort=updated_at&order=desc`
- Default sort: `updated_at desc` for most resources

## Filtering
- Query params for lists: `?status=active&category=feature`
- Multiple values: `?category=feature&category=risk` (repeated params)

## Ownership Pattern
Every resource belongs to a user. Always check ownership:

```typescript
// CORRECT — filters by user_id in the query itself
const map = await prisma.map.findFirst({
  where: { id: mapId, user_id: req.userId }
})
if (!map) throw new ApiError('FORBIDDEN', 403)

// WRONG — fetches then checks (allows timing attacks)
const map = await prisma.map.findUnique({ where: { id: mapId } })
if (map?.user_id !== req.userId) throw new ApiError('FORBIDDEN', 403)
```

## Route Naming
- Collections: `GET /api/maps` (plural noun)
- Single resource: `GET /api/maps/:mapId`
- Sub-resources: `GET /api/maps/:mapId/nodes`
- Actions: `POST /api/maps/:mapId/share` (verb on resource)

## Node Mutations Return Recalculated State
Any mutation that can affect conflicts or critical path returns:
```json
{
  "data": {
    "node": { ... },
    "conflicts": [...],
    "critical_path": { ... }
  }
}
```

This avoids a separate fetch after every change.

## AI Endpoints
- All under `/api/ai/`
- Rate limit: 10 req/min per user (separate from standard 100/min limit)
- Streaming responses: `Content-Type: text/event-stream`
- Non-streaming: standard JSON response
- Always return a structured error if AI call fails (don't expose raw Anthropic errors)

## Rate Limiting Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1711449600
```
