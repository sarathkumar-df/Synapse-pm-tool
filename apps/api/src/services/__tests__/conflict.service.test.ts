import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectConflicts } from '../conflict.service'

vi.mock('../../db/client', () => ({
  prisma: {
    node: { findMany: vi.fn() },
    edge: { findMany: vi.fn() },
  },
}))

import { prisma } from '../../db/client'

const mockPrisma = vi.mocked(prisma)

const MAP_ID = 'map_conflict_001'

/**
 * Build a node for testing. deadline is an ISO string relative to today.
 * Pass daysFromNow to set a deadline N days in the future.
 */
function makeNode(
  id: string,
  overrides: Partial<{
    effort_value: number | null
    effort_unit: string | null
    deadline: string | null
    status: string
    label: string
  }> = {}
) {
  return {
    id,
    map_id: MAP_ID,
    label: overrides.label ?? `Node ${id}`,
    category: 'feature',
    status: overrides.status ?? 'todo',
    priority: 'medium',
    position_x: 0,
    position_y: 0,
    effort_value: overrides.effort_value ?? null,
    effort_unit: overrides.effort_unit ?? null,
    deadline: overrides.deadline ?? null,
    created_at: new Date(),
    updated_at: new Date(),
  }
}

function futureDateISO(daysFromNow: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}

function makeEdge(sourceId: string, targetId: string, type = 'dependency') {
  return {
    id: `${sourceId}->${targetId}`,
    map_id: MAP_ID,
    source_node_id: sourceId,
    target_node_id: targetId,
    edge_type: type,
  }
}

describe('detectConflicts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array for map with no nodes', async () => {
    mockPrisma.node.findMany.mockResolvedValue([])
    mockPrisma.edge.findMany.mockResolvedValue([])

    const result = await detectConflicts(MAP_ID)
    expect(result).toEqual([])
  })

  it('returns empty array for map with nodes but no deadlines', async () => {
    const nodes = [
      makeNode('A', { effort_value: 5, effort_unit: 'days' }),
      makeNode('B', { effort_value: 3, effort_unit: 'days' }),
    ]
    mockPrisma.node.findMany.mockResolvedValue(nodes as any)
    mockPrisma.edge.findMany.mockResolvedValue([makeEdge('A', 'B')] as any)

    const result = await detectConflicts(MAP_ID)
    expect(result).toEqual([])
  })

  it('returns empty array when all effort fits comfortably within deadline', async () => {
    // Chain: A (2 days) → B (3 days) → Deadline node (deadline = 30 days from now)
    const nodes = [
      makeNode('A', { effort_value: 2, effort_unit: 'days' }),
      makeNode('B', { effort_value: 3, effort_unit: 'days' }),
      makeNode('Deadline', { deadline: futureDateISO(30) }),
    ]
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'Deadline')]
    mockPrisma.node.findMany.mockResolvedValue(nodes as any)
    mockPrisma.edge.findMany.mockResolvedValue(edges as any)

    const result = await detectConflicts(MAP_ID)
    expect(result).toEqual([])
  })

  it('returns critical conflict when effort chain exceeds deadline', async () => {
    // Chain: A (20 days) → B (15 days) → Deadline (deadline = 10 days from now)
    // Total effort = 35 days, deadline = 10 days → overrun = 25 days
    const nodes = [
      makeNode('A', { effort_value: 20, effort_unit: 'days' }),
      makeNode('B', { effort_value: 15, effort_unit: 'days' }),
      makeNode('Deadline', { deadline: futureDateISO(10), label: 'Release' }),
    ]
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'Deadline')]
    mockPrisma.node.findMany.mockResolvedValue(nodes as any)
    mockPrisma.edge.findMany.mockResolvedValue(edges as any)

    const result = await detectConflicts(MAP_ID)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('critical')
    expect(result[0].deadline_node_id).toBe('Deadline')
    expect(result[0].deadline_node_label).toBe('Release')
  })

  it('returns warning conflict when effort chain is within 20% of deadline', async () => {
    // Deadline = 10 days from now
    // 20% threshold: need effort >= 8 days (80% of 10) to trigger warning, but < 10 days for warning (not critical)
    // Chain: A (9 days) → Deadline (10 days). 9/10 = 90% >= 80% → warning, 9 < 10 → not critical
    const nodes = [
      makeNode('A', { effort_value: 9, effort_unit: 'days' }),
      makeNode('Deadline', { deadline: futureDateISO(10), label: 'Milestone' }),
    ]
    const edges = [makeEdge('A', 'Deadline')]
    mockPrisma.node.findMany.mockResolvedValue(nodes as any)
    mockPrisma.edge.findMany.mockResolvedValue(edges as any)

    const result = await detectConflicts(MAP_ID)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('warning')
    expect(result[0].deadline_node_id).toBe('Deadline')
  })

  it('sorts critical conflicts before warnings', async () => {
    // Two deadline nodes: one critical, one warning
    const nodes = [
      makeNode('A', { effort_value: 20, effort_unit: 'days' }),    // feeds critical
      makeNode('B', { effort_value: 9, effort_unit: 'days' }),     // feeds warning
      makeNode('D1', { deadline: futureDateISO(10), label: 'Critical Deadline' }),
      makeNode('D2', { deadline: futureDateISO(10), label: 'Warning Deadline' }),
    ]
    const edges = [
      makeEdge('A', 'D1'), // 20 days > 10 days → critical
      makeEdge('B', 'D2'), // 9 days < 10 days but within 20% → warning
    ]
    mockPrisma.node.findMany.mockResolvedValue(nodes as any)
    mockPrisma.edge.findMany.mockResolvedValue(edges as any)

    const result = await detectConflicts(MAP_ID)
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result[0].severity).toBe('critical')
    // Find the warning conflict
    const warningConflict = result.find(c => c.severity === 'warning')
    const criticalConflict = result.find(c => c.severity === 'critical')
    expect(criticalConflict).toBeDefined()
    expect(warningConflict).toBeDefined()
    expect(result.indexOf(criticalConflict!)).toBeLessThan(result.indexOf(warningConflict!))
  })

  it('ignores nodes with status "done"', async () => {
    // Chain: A (20 days) → Deadline node. But Deadline node has status 'done' → ignored
    const nodes = [
      makeNode('A', { effort_value: 20, effort_unit: 'days' }),
      makeNode('Deadline', { deadline: futureDateISO(5), status: 'done' }),
    ]
    const edges = [makeEdge('A', 'Deadline')]
    mockPrisma.node.findMany.mockResolvedValue(nodes as any)
    mockPrisma.edge.findMany.mockResolvedValue(edges as any)

    const result = await detectConflicts(MAP_ID)
    expect(result).toEqual([])
  })

  it('evaluates multiple chains to the same deadline node independently', async () => {
    // Two chains lead to the same deadline node:
    // Chain 1: A (20 days) → Deadline (5 days from now) → critical
    // Chain 2: B (4 days) → Deadline (5 days from now) → within 20% → warning (4/5 = 80%)
    const nodes = [
      makeNode('A', { effort_value: 20, effort_unit: 'days' }),
      makeNode('B', { effort_value: 4, effort_unit: 'days' }),
      makeNode('Deadline', { deadline: futureDateISO(5), label: 'Shared Deadline' }),
    ]
    const edges = [makeEdge('A', 'Deadline'), makeEdge('B', 'Deadline')]
    mockPrisma.node.findMany.mockResolvedValue(nodes as any)
    mockPrisma.edge.findMany.mockResolvedValue(edges as any)

    const result = await detectConflicts(MAP_ID)
    expect(result.length).toBeGreaterThanOrEqual(1)
    // At least one critical from chain A
    const criticals = result.filter(c => c.severity === 'critical')
    expect(criticals.length).toBeGreaterThanOrEqual(1)
    expect(criticals[0].deadline_node_id).toBe('Deadline')
  })

  it('calculates overrun amount correctly in days', async () => {
    // Chain: A (15 days) → Deadline (5 days from now)
    // overrun = 15 - 5 = 10 days
    const nodes = [
      makeNode('A', { effort_value: 15, effort_unit: 'days' }),
      makeNode('Deadline', { deadline: futureDateISO(5) }),
    ]
    const edges = [makeEdge('A', 'Deadline')]
    mockPrisma.node.findMany.mockResolvedValue(nodes as any)
    mockPrisma.edge.findMany.mockResolvedValue(edges as any)

    const result = await detectConflicts(MAP_ID)
    expect(result).toHaveLength(1)
    expect(result[0].overrun_amount).toBe(10)
    expect(result[0].overrun_unit).toBe('days')
  })

  it('converts hours to days correctly (8 hours = 1 day) for conflict calculation', async () => {
    // Chain: A (80 hours = 10 days) → Deadline (5 days from now)
    // overrun = 10 - 5 = 5 days
    const nodes = [
      makeNode('A', { effort_value: 80, effort_unit: 'hours' }),
      makeNode('Deadline', { deadline: futureDateISO(5) }),
    ]
    const edges = [makeEdge('A', 'Deadline')]
    mockPrisma.node.findMany.mockResolvedValue(nodes as any)
    mockPrisma.edge.findMany.mockResolvedValue(edges as any)

    const result = await detectConflicts(MAP_ID)
    expect(result).toHaveLength(1)
    expect(result[0].severity).toBe('critical')
    expect(result[0].overrun_amount).toBe(5)
  })

  it('returns empty array when nodes have effort but no chains lead to deadline nodes', async () => {
    // Disconnected: A has effort, B has deadline but no edge between them
    const nodes = [
      makeNode('A', { effort_value: 50, effort_unit: 'days' }),
      makeNode('B', { deadline: futureDateISO(5) }),
    ]
    mockPrisma.node.findMany.mockResolvedValue(nodes as any)
    mockPrisma.edge.findMany.mockResolvedValue([])

    const result = await detectConflicts(MAP_ID)
    // B has a deadline but no predecessors → no chains → no conflicts
    expect(result).toEqual([])
  })
})
