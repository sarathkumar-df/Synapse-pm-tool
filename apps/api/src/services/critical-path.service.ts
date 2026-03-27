/**
 * Critical Path Service
 * Core intelligence engine for Synapse.
 *
 * Computes the critical path and earliest/latest start times
 * for all nodes in a map's dependency graph.
 *
 * Called after every mutation to: effort, deadlines, dependency/blocks edges.
 */

import { prisma } from '../db/client'
import type { CriticalPathResult } from '../../../../docs/contracts/entities'

const DAYS_PER_HOUR = 1 / 8
const HOURS_PER_DAY = 8

/** Normalize any effort to days for comparison */
function toDays(value: number, unit: 'hours' | 'days' | 'story_points'): number {
  switch (unit) {
    case 'hours': return value * DAYS_PER_HOUR
    case 'days': return value
    case 'story_points': return value // treat 1 SP = 1 day as default
  }
}

export async function calculateCriticalPath(mapId: string): Promise<CriticalPathResult> {
  // Load all nodes and dependency/blocks edges for this map
  const [nodes, edges] = await Promise.all([
    prisma.node.findMany({ where: { map_id: mapId } }),
    prisma.edge.findMany({
      where: { map_id: mapId, edge_type: { in: ['dependency', 'blocks'] } }
    }),
  ])

  if (!nodes.length) {
    return { critical_path_node_ids: [], earliest_starts: {}, latest_starts: {} }
  }

  // Build adjacency lists
  const nodeIds = new Set(nodes.map(n => n.id))
  const outgoing = new Map<string, string[]>() // node → nodes that depend on it
  const incoming = new Map<string, string[]>() // node → its dependencies

  nodes.forEach(n => {
    outgoing.set(n.id, [])
    incoming.set(n.id, [])
  })

  edges.forEach(e => {
    if (nodeIds.has(e.source_node_id) && nodeIds.has(e.target_node_id)) {
      outgoing.get(e.source_node_id)!.push(e.target_node_id)
      incoming.get(e.target_node_id)!.push(e.source_node_id)
    }
  })

  // Cycle detection via DFS
  const cycle = detectCycle(nodeIds, outgoing)
  if (cycle) {
    return { critical_path_node_ids: [], earliest_starts: {}, latest_starts: {}, cycle }
  }

  // Topological sort (Kahn's algorithm)
  const topoOrder = topologicalSort(nodeIds, incoming, outgoing)

  // Build effort map (in days)
  const effortDays = new Map<string, number>()
  nodes.forEach(n => {
    if (n.effort_value && n.effort_unit) {
      effortDays.set(n.id, toDays(n.effort_value, n.effort_unit as 'hours' | 'days' | 'story_points'))
    }
  })

  // Forward pass — earliest start time (in days from today)
  const earliest: Record<string, number> = {}
  topoOrder.forEach(id => {
    const deps = incoming.get(id) ?? []
    if (!deps.length) {
      earliest[id] = 0
    } else {
      earliest[id] = Math.max(...deps.map(dep => earliest[dep] + (effortDays.get(dep) ?? 0)))
    }
  })

  // Build deadline map (days from today)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadlineDays = new Map<string, number>()
  nodes.forEach(n => {
    if (n.deadline) {
      const deadline = new Date(n.deadline)
      deadlineDays.set(n.id, Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    }
  })

  // Backward pass — latest start time (constrained by deadlines)
  const latest: Record<string, number> = {}
  const reversedTopo = [...topoOrder].reverse()

  reversedTopo.forEach(id => {
    const successors = outgoing.get(id) ?? []
    const ownDeadline = deadlineDays.has(id)
      ? (deadlineDays.get(id)! - (effortDays.get(id) ?? 0))
      : Infinity

    if (!successors.length) {
      latest[id] = ownDeadline === Infinity ? earliest[id] : ownDeadline
    } else {
      const fromSuccessors = Math.min(...successors.map(s => latest[s] - (effortDays.get(id) ?? 0)))
      latest[id] = Math.min(fromSuccessors, ownDeadline)
    }
  })

  // Critical path = nodes where slack (latest - earliest) ≈ 0
  const criticalPathNodeIds = topoOrder.filter(id => {
    const slack = (latest[id] ?? 0) - (earliest[id] ?? 0)
    return Math.abs(slack) < 0.01 // float tolerance
  })

  return {
    critical_path_node_ids: criticalPathNodeIds,
    earliest_starts: earliest,
    latest_starts: latest,
  }
}

function detectCycle(
  nodeIds: Set<string>,
  outgoing: Map<string, string[]>
): string[] | null {
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  nodeIds.forEach(id => color.set(id, WHITE))
  const path: string[] = []

  function dfs(id: string): string[] | null {
    color.set(id, GRAY)
    path.push(id)
    for (const neighbor of outgoing.get(id) ?? []) {
      if (color.get(neighbor) === GRAY) {
        const cycleStart = path.indexOf(neighbor)
        return path.slice(cycleStart)
      }
      if (color.get(neighbor) === WHITE) {
        const cycle = dfs(neighbor)
        if (cycle) return cycle
      }
    }
    path.pop()
    color.set(id, BLACK)
    return null
  }

  for (const id of nodeIds) {
    if (color.get(id) === WHITE) {
      const cycle = dfs(id)
      if (cycle) return cycle
    }
  }
  return null
}

function topologicalSort(
  nodeIds: Set<string>,
  incoming: Map<string, string[]>,
  outgoing: Map<string, string[]>
): string[] {
  const inDegree = new Map<string, number>()
  nodeIds.forEach(id => inDegree.set(id, (incoming.get(id) ?? []).length))

  const queue: string[] = []
  nodeIds.forEach(id => { if (inDegree.get(id) === 0) queue.push(id) })

  const result: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    result.push(id)
    for (const neighbor of outgoing.get(id) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, deg)
      if (deg === 0) queue.push(neighbor)
    }
  }
  return result
}
