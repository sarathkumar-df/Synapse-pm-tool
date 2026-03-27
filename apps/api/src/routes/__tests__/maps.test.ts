import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import app from '../../index'
import { generateToken } from '../../middleware/auth'

vi.mock('../../db/client', () => ({
  prisma: {
    map: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('../../services/conflict.service', () => ({
  detectConflicts: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../services/critical-path.service', () => ({
  calculateCriticalPath: vi.fn().mockResolvedValue({
    critical_path_node_ids: [],
    earliest_starts: {},
    latest_starts: {},
  }),
}))

import { prisma } from '../../db/client'

const mockPrisma = vi.mocked(prisma)

const USER_ID = 'user_maps_001'
const OTHER_USER_ID = 'user_maps_other'
const MAP_ID = 'map_test_001'
const PROJECT_ID = 'project_maps_001'

function authToken(userId = USER_ID) {
  return `Bearer ${generateToken(userId)}`
}

function makeMap(overrides: Record<string, unknown> = {}) {
  return {
    id: MAP_ID,
    user_id: USER_ID,
    project_id: null,
    name: 'Test Map',
    description: null,
    share_token: null,
    share_config: null,
    viewport_state: null,
    archived_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

function makeMapWithRelations(overrides: Record<string, unknown> = {}) {
  return {
    ...makeMap(overrides),
    nodes: [],
    edges: [],
  }
}

describe('GET /api/maps', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of maps for authenticated user', async () => {
    const maps = [makeMap(), makeMap({ id: 'map_2', name: 'Second Map' })]
    mockPrisma.map.findMany.mockResolvedValue(maps as any)

    const res = await request(app)
      .get('/api/maps')
      .set('Authorization', authToken())

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.pagination.total).toBe(2)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/maps')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/maps', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a map with valid data', async () => {
    const map = makeMap()
    mockPrisma.map.create.mockResolvedValue(map as any)

    const res = await request(app)
      .post('/api/maps')
      .set('Authorization', authToken())
      .send({ name: 'Test Map' })

    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Test Map')
    expect(res.body.data.id).toBe(MAP_ID)
  })

  it('verifies project ownership when project_id provided', async () => {
    // project belongs to another user — findFirst returns null
    mockPrisma.project.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/maps')
      .set('Authorization', authToken())
      .send({ name: 'Test Map', project_id: PROJECT_ID })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('creates map linked to project when user owns the project', async () => {
    const project = { id: PROJECT_ID, user_id: USER_ID }
    const map = makeMap({ project_id: PROJECT_ID })
    mockPrisma.project.findFirst.mockResolvedValue(project as any)
    mockPrisma.map.create.mockResolvedValue(map as any)

    const res = await request(app)
      .post('/api/maps')
      .set('Authorization', authToken())
      .send({ name: 'Test Map', project_id: PROJECT_ID })

    expect(res.status).toBe(201)
    expect(res.body.data.project_id).toBe(PROJECT_ID)
  })

  it('returns 422 for missing name', async () => {
    const res = await request(app)
      .post('/api/maps')
      .set('Authorization', authToken())
      .send({})

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/maps').send({ name: 'Test' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/maps/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns map with nodes, edges, conflicts, critical_path for owner', async () => {
    const mapWithRelations = makeMapWithRelations()
    mockPrisma.map.findFirst.mockResolvedValue(mapWithRelations as any)

    const res = await request(app)
      .get(`/api/maps/${MAP_ID}`)
      .set('Authorization', authToken())

    expect(res.status).toBe(200)
    expect(res.body.data.map).toBeDefined()
    expect(res.body.data.nodes).toBeDefined()
    expect(res.body.data.edges).toBeDefined()
    expect(res.body.data.conflicts).toBeDefined()
    expect(res.body.data.critical_path).toBeDefined()
    expect(res.body.data.map.id).toBe(MAP_ID)
  })

  it('returns 403 for non-owner', async () => {
    mockPrisma.map.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .get(`/api/maps/${MAP_ID}`)
      .set('Authorization', authToken(OTHER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/maps/${MAP_ID}`)
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/maps/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates map for owner', async () => {
    const existing = makeMap()
    const updated = makeMap({ name: 'New Name' })
    mockPrisma.map.findFirst.mockResolvedValue(existing as any)
    mockPrisma.map.update.mockResolvedValue(updated as any)

    const res = await request(app)
      .patch(`/api/maps/${MAP_ID}`)
      .set('Authorization', authToken())
      .send({ name: 'New Name' })

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('New Name')
  })

  it('returns 403 for non-owner', async () => {
    mockPrisma.map.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .patch(`/api/maps/${MAP_ID}`)
      .set('Authorization', authToken(OTHER_USER_ID))
      .send({ name: 'Hack' })

    expect(res.status).toBe(403)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch(`/api/maps/${MAP_ID}`)
      .send({ name: 'Updated' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/maps/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes map and returns 204', async () => {
    mockPrisma.map.findFirst.mockResolvedValue(makeMap() as any)
    mockPrisma.map.delete.mockResolvedValue(makeMap() as any)

    const res = await request(app)
      .delete(`/api/maps/${MAP_ID}`)
      .set('Authorization', authToken())

    expect(res.status).toBe(204)
    expect(mockPrisma.map.delete).toHaveBeenCalledWith({ where: { id: MAP_ID } })
  })

  it('returns 403 for non-owner', async () => {
    mockPrisma.map.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .delete(`/api/maps/${MAP_ID}`)
      .set('Authorization', authToken(OTHER_USER_ID))

    expect(res.status).toBe(403)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete(`/api/maps/${MAP_ID}`)
    expect(res.status).toBe(401)
  })
})

describe('POST /api/maps/:id/share', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets share_token and returns share_url', async () => {
    const map = makeMap()
    const updatedMap = makeMap({ share_token: 'generated-uuid-token' })
    mockPrisma.map.findFirst.mockResolvedValue(map as any)
    mockPrisma.map.update.mockResolvedValue(updatedMap as any)

    const res = await request(app)
      .post(`/api/maps/${MAP_ID}/share`)
      .set('Authorization', authToken())

    expect(res.status).toBe(200)
    expect(res.body.data.share_url).toBeTruthy()
    expect(res.body.data.share_token).toBeTruthy()
    expect(mockPrisma.map.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MAP_ID },
        data: expect.objectContaining({ share_token: expect.any(String) }),
      })
    )
  })

  it('returns 403 for non-owner', async () => {
    mockPrisma.map.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post(`/api/maps/${MAP_ID}/share`)
      .set('Authorization', authToken(OTHER_USER_ID))

    expect(res.status).toBe(403)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`/api/maps/${MAP_ID}/share`)
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/maps/:id/share', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clears share_token and returns 204', async () => {
    const map = makeMap({ share_token: 'existing-token' })
    mockPrisma.map.findFirst.mockResolvedValue(map as any)
    mockPrisma.map.update.mockResolvedValue(makeMap() as any)

    const res = await request(app)
      .delete(`/api/maps/${MAP_ID}/share`)
      .set('Authorization', authToken())

    expect(res.status).toBe(204)
    expect(mockPrisma.map.update).toHaveBeenCalledWith({
      where: { id: MAP_ID },
      data: { share_token: null },
    })
  })

  it('returns 403 for non-owner', async () => {
    mockPrisma.map.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .delete(`/api/maps/${MAP_ID}/share`)
      .set('Authorization', authToken(OTHER_USER_ID))

    expect(res.status).toBe(403)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete(`/api/maps/${MAP_ID}/share`)
    expect(res.status).toBe(401)
  })
})
