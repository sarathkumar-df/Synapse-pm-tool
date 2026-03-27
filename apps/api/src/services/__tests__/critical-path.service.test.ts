import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateCriticalPath } from '../critical-path.service'

vi.mock('../../db/client', () => ({
  prisma: {
    node: { findMany: vi.fn() },
    edge: { findMany: vi.fn() },
  },
}))

import { prisma } from '../../db/client'

const mockPrisma = vi.mocked(prisma)

function makeNode(id: string, overrides: Partial<{ effort_value: number; effort_unit: string; deadline: string }> = {}) {
  return {
    id,
    map_id: 'map_1',
    label: id,
    category: 'feature',
    status: 'todo',
    priority: 'medium',
    position_x: 0,
    position_y: 0,
    created_at: new Date(),
    updated_at: new Date(),
    effort_value: null,
    effort_unit: null,
    deadline: null,
    ...overrides,
  }
}

function makeEdge(source: string, target: string, type = 'dependency') {
  return { id: `${source}->${target}`, map_id: 'map_1', source_node_id: source, target_node_id: target, edge_type: type }
}

describe('calculateCriticalPath', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty result for empty map', async () => {
    mockPrisma.node.findMany.mockResolvedValue([])
    mockPrisma.edge.findMany.mockResolvedValue([])

    const result = await calculateCriticalPath('map_1')
    expect(result.critical_path_node_ids).toHaveLength(0)
    expect(result.cycle).toBeUndefined()
  })

  it('returns single disconnected node', async () => {
    mockPrisma.node.findMany.mockResolvedValue([makeNode('A', { effort_value: 3, effort_unit: 'days' })] as any)
    mockPrisma.edge.findMany.mockResolvedValue([])

    const result = await calculateCriticalPath('map_1')
    expect(result.earliest_starts['A']).toBe(0)
  })

  it('calculates earliest start for linear chain A→B→C', async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode('A', { effort_value: 2, effort_unit: 'days' }),
      makeNode('B', { effort_value: 3, effort_unit: 'days' }),
      makeNode('C', { effort_value: 1, effort_unit: 'days' }),
    ] as any)
    mockPrisma.edge.findMany.mockResolvedValue([
      makeEdge('A', 'B'),
      makeEdge('B', 'C'),
    ] as any)

    const result = await calculateCriticalPath('map_1')
    expect(result.earliest_starts['A']).toBe(0)
    expect(result.earliest_starts['B']).toBe(2) // after A's 2 days
    expect(result.earliest_starts['C']).toBe(5) // after A(2) + B(3)
  })

  it('detects cycle and returns cycle node IDs', async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode('A'), makeNode('B'), makeNode('C'),
    ] as any)
    mockPrisma.edge.findMany.mockResolvedValue([
      makeEdge('A', 'B'),
      makeEdge('B', 'C'),
      makeEdge('C', 'A'), // cycle!
    ] as any)

    const result = await calculateCriticalPath('map_1')
    expect(result.cycle).toBeDefined()
    expect(result.cycle!.length).toBeGreaterThan(0)
    expect(result.critical_path_node_ids).toHaveLength(0)
  })

  it('nodes without effort are included but not counted in timing', async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode('A', { effort_value: 2, effort_unit: 'days' }),
      makeNode('B'), // no effort
      makeNode('C', { effort_value: 1, effort_unit: 'days' }),
    ] as any)
    mockPrisma.edge.findMany.mockResolvedValue([
      makeEdge('A', 'B'),
      makeEdge('B', 'C'),
    ] as any)

    const result = await calculateCriticalPath('map_1')
    // B has no effort so adds 0 days
    expect(result.earliest_starts['C']).toBe(2) // A(2) + B(0)
  })

  it('normalizes hours to days (8h = 1 day)', async () => {
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode('A', { effort_value: 16, effort_unit: 'hours' }), // = 2 days
      makeNode('B', { effort_value: 1, effort_unit: 'days' }),
    ] as any)
    mockPrisma.edge.findMany.mockResolvedValue([makeEdge('A', 'B')] as any)

    const result = await calculateCriticalPath('map_1')
    expect(result.earliest_starts['B']).toBe(2) // 16h = 2 days
  })

  it('chooses longer branch as critical path for parallel chains', async () => {
    // A → B → D (2+3=5 days)
    // A → C → D (2+1=3 days)
    // Critical path: A→B→D
    mockPrisma.node.findMany.mockResolvedValue([
      makeNode('A', { effort_value: 2, effort_unit: 'days' }),
      makeNode('B', { effort_value: 3, effort_unit: 'days' }),
      makeNode('C', { effort_value: 1, effort_unit: 'days' }),
      makeNode('D', { effort_value: 1, effort_unit: 'days' }),
    ] as any)
    mockPrisma.edge.findMany.mockResolvedValue([
      makeEdge('A', 'B'),
      makeEdge('A', 'C'),
      makeEdge('B', 'D'),
      makeEdge('C', 'D'),
    ] as any)

    const result = await calculateCriticalPath('map_1')
    // D's earliest start = max(A+B, A+C) = max(5, 3) = 5
    expect(result.earliest_starts['D']).toBe(5)
  })
})
