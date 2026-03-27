import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import app from '../../index'
import { generateToken } from '../../middleware/auth'

vi.mock('../../db/client', () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { prisma } from '../../db/client'

const mockPrisma = vi.mocked(prisma)

const USER_ID = 'user_test_001'
const OTHER_USER_ID = 'user_other_999'
const PROJECT_ID = 'project_test_001'

function authToken(userId = USER_ID) {
  return `Bearer ${generateToken(userId)}`
}

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    user_id: USER_ID,
    name: 'Test Project',
    description: 'A test project',
    color: '#6366F1',
    archived_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

describe('GET /api/projects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of projects for authenticated user', async () => {
    const projects = [makeProject(), makeProject({ id: 'project_2', name: 'Second' })]
    mockPrisma.project.findMany.mockResolvedValue(projects as any)

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', authToken())

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.pagination.total).toBe(2)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/projects')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_REQUIRED')
  })
})

describe('POST /api/projects', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a project with valid data', async () => {
    const project = makeProject()
    mockPrisma.project.create.mockResolvedValue(project as any)

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', authToken())
      .send({ name: 'Test Project', description: 'A test project', color: '#6366F1' })

    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Test Project')
    expect(res.body.data.id).toBe(PROJECT_ID)
  })

  it('returns 422 for missing name', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', authToken())
      .send({ description: 'No name here' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.name).toBeDefined()
  })

  it('returns 422 for empty string name', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', authToken())
      .send({ name: '' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Test' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/projects/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns project for owner', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(makeProject() as any)

    const res = await request(app)
      .get(`/api/projects/${PROJECT_ID}`)
      .set('Authorization', authToken())

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(PROJECT_ID)
  })

  it('returns 403 for non-owner (not 404)', async () => {
    // findFirst returns null when user_id doesn't match
    mockPrisma.project.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .get(`/api/projects/${PROJECT_ID}`)
      .set('Authorization', authToken(OTHER_USER_ID))

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get(`/api/projects/${PROJECT_ID}`)
    expect(res.status).toBe(401)
  })
})

describe('PATCH /api/projects/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates project for owner', async () => {
    const existing = makeProject()
    const updated = makeProject({ name: 'Updated Name' })
    mockPrisma.project.findFirst.mockResolvedValue(existing as any)
    mockPrisma.project.update.mockResolvedValue(updated as any)

    const res = await request(app)
      .patch(`/api/projects/${PROJECT_ID}`)
      .set('Authorization', authToken())
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Updated Name')
  })

  it('returns 403 for non-owner', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .patch(`/api/projects/${PROJECT_ID}`)
      .set('Authorization', authToken(OTHER_USER_ID))
      .send({ name: 'Hack' })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch(`/api/projects/${PROJECT_ID}`)
      .send({ name: 'Updated' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/projects/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes project and returns 204', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(makeProject() as any)
    mockPrisma.project.delete.mockResolvedValue(makeProject() as any)

    const res = await request(app)
      .delete(`/api/projects/${PROJECT_ID}`)
      .set('Authorization', authToken())

    expect(res.status).toBe(204)
    expect(mockPrisma.project.delete).toHaveBeenCalledWith({
      where: { id: PROJECT_ID },
    })
  })

  it('returns 403 for non-owner', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .delete(`/api/projects/${PROJECT_ID}`)
      .set('Authorization', authToken(OTHER_USER_ID))

    expect(res.status).toBe(403)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete(`/api/projects/${PROJECT_ID}`)
    expect(res.status).toBe(401)
  })
})

describe('POST /api/projects/:id/archive', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets archived_at on the project', async () => {
    const existing = makeProject()
    const archived = makeProject({ archived_at: new Date() })
    mockPrisma.project.findFirst.mockResolvedValue(existing as any)
    mockPrisma.project.update.mockResolvedValue(archived as any)

    const res = await request(app)
      .post(`/api/projects/${PROJECT_ID}/archive`)
      .set('Authorization', authToken())

    expect(res.status).toBe(200)
    expect(res.body.data.archived_at).toBeTruthy()
    expect(mockPrisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PROJECT_ID },
        data: expect.objectContaining({ archived_at: expect.any(Date) }),
      })
    )
  })

  it('returns 403 for non-owner', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post(`/api/projects/${PROJECT_ID}/archive`)
      .set('Authorization', authToken(OTHER_USER_ID))

    expect(res.status).toBe(403)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`/api/projects/${PROJECT_ID}/archive`)
    expect(res.status).toBe(401)
  })
})
