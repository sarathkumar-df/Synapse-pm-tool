# Synapse Testing Strategy

## Stack
- **Vitest** — all tests (frontend + backend)
- **React Testing Library** — component tests
- **Supertest** — HTTP integration tests
- **msw** — mock API in frontend tests
- **@faker-js/faker** — test fixture generation
- **testcontainers** — real PostgreSQL for integration tests

## Test Types

### Unit Tests (fastest, most of them)
- Services: critical path, conflict detection, snapshot diff
- AI prompt builders and output parsers
- Utility functions
- Zustand store actions

### Component Tests (React Testing Library)
- Canvas node rendering
- Panel interactions
- Form submissions
- Error and loading states

### Integration Tests (slower, fewer)
- API routes: full request → DB → response cycle
- Uses a real test PostgreSQL database (testcontainers)
- Run against actual Prisma migrations

### E2E Tests (Phase 4 only — Playwright)
- Critical user journeys: create map, add nodes, detect conflict, export

## Coverage Targets
| Layer | Target |
|-------|--------|
| Critical path service | 95% |
| Conflict detection service | 95% |
| AI output parsers | 90% |
| API routes | 85% |
| Canvas components | 70% |
| Store actions | 80% |
| Utility functions | 95% |

## Test File Location
```
apps/api/src/services/__tests__/critical-path.service.test.ts
apps/api/src/services/__tests__/conflict.service.test.ts
apps/api/src/routes/__tests__/maps.test.ts
apps/api/src/routes/__tests__/nodes.test.ts
apps/api/src/ai/__tests__/categorize-node.test.ts
apps/web/src/components/canvas/__tests__/SynapseNode.test.tsx
apps/web/src/hooks/__tests__/useConflictDetection.test.ts
apps/web/src/store/__tests__/canvas.store.test.ts
```

## Test Fixtures
```typescript
// packages/shared/src/test-fixtures/index.ts
export const makeNode = (overrides?: Partial<Node>): Node => ({
  id: faker.string.cuid(),
  map_id: faker.string.cuid(),
  label: faker.commerce.productName(),
  category: 'feature',
  status: 'todo',
  priority: 'medium',
  position_x: faker.number.float({ min: 0, max: 1000 }),
  position_y: faker.number.float({ min: 0, max: 1000 }),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})
```

## Critical Path Test Scenarios (must have all)
```typescript
describe('CriticalPathService', () => {
  it('empty map returns empty result')
  it('single node with effort, no edges')
  it('linear chain A→B→C calculates correct critical path')
  it('diamond dependency resolves correctly')
  it('parallel branches - longer branch is critical path')
  it('detects cycle and returns cycle node IDs')
  it('nodes without effort are excluded from calculations')
  it('mixed effort units (hours + days) normalized to days')
  it('critical path highlighted when chain fits in deadline')
  it('conflict flagged when chain exceeds deadline')
})
```

## API Route Test Pattern
```typescript
describe('POST /api/maps/:mapId/nodes', () => {
  let app: Express
  let authToken: string
  let mapId: string

  beforeAll(async () => {
    app = createApp()
    // setup test user + map in test DB
    const user = await createTestUser()
    authToken = generateToken(user.id)
    const map = await createTestMap(user.id)
    mapId = map.id
  })

  it('creates node and returns recalculated conflicts', async () => {
    const res = await request(app)
      .post(`/api/maps/${mapId}/nodes`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ label: 'Test Node', position_x: 100, position_y: 100, category: 'feature' })

    expect(res.status).toBe(201)
    expect(res.body.data.node.label).toBe('Test Node')
    expect(res.body.data.conflicts).toBeInstanceOf(Array)
  })

  it('returns 401 without auth token')
  it('returns 403 when map belongs to different user')
  it('returns 422 for missing required fields')
  it('returns 422 for invalid category value')
})
```

## What NOT to Test
- Prisma internals (trust the ORM)
- React Flow internals (trust the library)
- Third-party library behavior
- TypeScript types (compiler handles this)
- Code that can't fail (simple getters, constants)
