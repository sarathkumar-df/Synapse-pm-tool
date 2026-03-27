import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import app from '../../index'

vi.mock('../../db/client', () => ({
  prisma: {
    map: {
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '../../db/client'

const mockPrisma = vi.mocked(prisma)

const SHARE_TOKEN = 'valid-share-token-abc123'
const MAP_ID = 'map_shared_001'

function makeNode(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    map_id: MAP_ID,
    label: `Node ${id}`,
    category: 'feature',
    status: 'todo',
    priority: 'medium',
    position_x: 0,
    position_y: 0,
    effort_value: null,
    effort_unit: null,
    deadline: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

function makeEdge(id: string, sourceId: string, targetId: string) {
  return {
    id,
    map_id: MAP_ID,
    source_node_id: sourceId,
    target_node_id: targetId,
    edge_type: 'dependency',
    created_at: new Date(),
    updated_at: new Date(),
  }
}

function makeSharedMap(overrides: Record<string, unknown> = {}) {
  return {
    id: MAP_ID,
    user_id: 'owner_user',
    name: 'Shared Map',
    share_token: SHARE_TOKEN,
    share_config: null,
    nodes: [makeNode('n1'), makeNode('n2')],
    edges: [makeEdge('e1', 'n1', 'n2')],
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

describe('GET /api/shared/:token', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns map data for valid token without requiring auth', async () => {
    mockPrisma.map.findFirst.mockResolvedValue(makeSharedMap() as any)

    // No Authorization header — public endpoint
    const res = await request(app).get(`/api/shared/${SHARE_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.data.map).toBeDefined()
    expect(res.body.data.map.id).toBe(MAP_ID)
    expect(res.body.data.nodes).toBeDefined()
    expect(res.body.data.edges).toBeDefined()
  })

  it('returns 404 for invalid token', async () => {
    mockPrisma.map.findFirst.mockResolvedValue(null)

    const res = await request(app).get('/api/shared/invalid-token-that-does-not-exist')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns all nodes and edges when share_config is null', async () => {
    const nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3')]
    const edges = [makeEdge('e1', 'n1', 'n2'), makeEdge('e2', 'n2', 'n3')]
    mockPrisma.map.findFirst.mockResolvedValue(
      makeSharedMap({ share_config: null, nodes, edges }) as any
    )

    const res = await request(app).get(`/api/shared/${SHARE_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.data.nodes).toHaveLength(3)
    expect(res.body.data.edges).toHaveLength(2)
  })

  it('filters out nodes in hidden categories from share_config', async () => {
    const nodes = [
      makeNode('n1', { category: 'feature' }),
      makeNode('n2', { category: 'risk' }),
      makeNode('n3', { category: 'risk' }),
    ]
    const edges = [makeEdge('e1', 'n1', 'n2')]
    const shareConfig = { hide_categories: ['risk'] }

    mockPrisma.map.findFirst.mockResolvedValue(
      makeSharedMap({ share_config: shareConfig, nodes, edges }) as any
    )

    const res = await request(app).get(`/api/shared/${SHARE_TOKEN}`)

    expect(res.status).toBe(200)
    // n2 and n3 are 'risk' — both should be hidden
    expect(res.body.data.nodes).toHaveLength(1)
    expect(res.body.data.nodes[0].id).toBe('n1')
  })

  it('removes effort_value and effort_unit when share_config.hide_effort is true', async () => {
    const nodes = [
      makeNode('n1', { effort_value: 5, effort_unit: 'days' }),
      makeNode('n2', { effort_value: 3, effort_unit: 'hours' }),
    ]
    const shareConfig = { hide_effort: true }

    mockPrisma.map.findFirst.mockResolvedValue(
      makeSharedMap({ share_config: shareConfig, nodes, edges: [] }) as any
    )

    const res = await request(app).get(`/api/shared/${SHARE_TOKEN}`)

    expect(res.status).toBe(200)
    res.body.data.nodes.forEach((node: any) => {
      expect(node.effort_value).toBeNull()
      expect(node.effort_unit).toBeNull()
    })
  })

  it('filters edges where either endpoint node is hidden due to hidden categories', async () => {
    const nodes = [
      makeNode('n1', { category: 'feature' }),
      makeNode('n2', { category: 'risk' }),   // hidden
      makeNode('n3', { category: 'feature' }),
    ]
    const edges = [
      makeEdge('e1', 'n1', 'n2'), // n2 is hidden → edge should be filtered
      makeEdge('e2', 'n1', 'n3'), // both visible → keep
    ]
    const shareConfig = { hide_categories: ['risk'] }

    mockPrisma.map.findFirst.mockResolvedValue(
      makeSharedMap({ share_config: shareConfig, nodes, edges }) as any
    )

    const res = await request(app).get(`/api/shared/${SHARE_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.data.edges).toHaveLength(1)
    expect(res.body.data.edges[0].id).toBe('e2')
  })

  it('does not strip effort when hide_effort is false', async () => {
    const nodes = [makeNode('n1', { effort_value: 5, effort_unit: 'days' })]
    const shareConfig = { hide_effort: false }

    mockPrisma.map.findFirst.mockResolvedValue(
      makeSharedMap({ share_config: shareConfig, nodes, edges: [] }) as any
    )

    const res = await request(app).get(`/api/shared/${SHARE_TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.data.nodes[0].effort_value).toBe(5)
    expect(res.body.data.nodes[0].effort_unit).toBe('days')
  })
})
