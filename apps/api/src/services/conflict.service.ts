/**
 * Conflict Detection Service
 * Detects timeline conflicts: when cumulative effort in a dependency chain
 * exceeds a node's deadline.
 *
 * Returns all active conflicts sorted by severity (critical first).
 */

import { prisma } from '../db/client'
import type { Conflict, ConflictChainNode } from '../../../../docs/contracts/entities'

const DAYS_PER_HOUR = 1 / 8
const WARNING_THRESHOLD = 0.2 // within 20% of deadline = warning

function toDays(value: number, unit: string): number {
  switch (unit) {
    case 'hours': return value * DAYS_PER_HOUR
    case 'days': return value
    case 'story_points': return value
    default: return value
  }
}

export async function detectConflicts(mapId: string): Promise<Conflict[]> {
  const [nodes, edges] = await Promise.all([
    prisma.node.findMany({ where: { map_id: mapId } }),
    prisma.edge.findMany({
      where: { map_id: mapId, edge_type: { in: ['dependency', 'blocks'] } }
    }),
  ])

  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const conflicts: Conflict[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build reverse dependency graph (target → sources)
  const dependencyPredecessors = new Map<string, string[]>()
  nodes.forEach(n => dependencyPredecessors.set(n.id, []))
  edges.forEach(e => {
    dependencyPredecessors.get(e.target_node_id)?.push(e.source_node_id)
  })

  // Check every node with a deadline
  const deadlineNodes = nodes.filter(n => n.deadline && n.status !== 'done')

  for (const deadlineNode of deadlineNodes) {
    const deadlineDate = new Date(deadlineNode.deadline!)
    const daysUntilDeadline = Math.floor(
      (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Walk backwards through dependency chains via BFS
    const chains = findAllChains(deadlineNode.id, dependencyPredecessors, nodeMap)

    for (const chain of chains) {
      const totalEffortDays = chain.reduce((sum, node) => {
        if (node.effort_value && node.effort_unit) {
          return sum + toDays(node.effort_value, node.effort_unit)
        }
        return sum
      }, 0)

      if (totalEffortDays <= 0) continue

      const overrunDays = totalEffortDays - daysUntilDeadline

      if (overrunDays > 0) {
        // Critical: exceeds deadline
        const conflictId = `${deadlineNode.id}-${chain.map(n => n.id).join('-')}`
        conflicts.push({
          id: conflictId,
          deadline_node_id: deadlineNode.id,
          deadline_node_label: deadlineNode.label,
          deadline: deadlineNode.deadline!.toString(),
          chain: chain.map(n => ({
            node_id: n.id,
            label: n.label,
            effort_value: n.effort_value ?? undefined,
            effort_unit: n.effort_unit as 'hours' | 'days' | 'story_points' | undefined,
          })),
          overrun_amount: overrunDays,
          overrun_unit: 'days',
          severity: 'critical',
        })
      } else if (daysUntilDeadline > 0) {
        const pctUsed = totalEffortDays / daysUntilDeadline
        if (pctUsed >= (1 - WARNING_THRESHOLD)) {
          // Warning: within 20% of deadline
          const conflictId = `warn-${deadlineNode.id}-${chain.map(n => n.id).join('-')}`
          conflicts.push({
            id: conflictId,
            deadline_node_id: deadlineNode.id,
            deadline_node_label: deadlineNode.label,
            deadline: deadlineNode.deadline!.toString(),
            chain: chain.map(n => ({
              node_id: n.id,
              label: n.label,
              effort_value: n.effort_value ?? undefined,
              effort_unit: n.effort_unit as 'hours' | 'days' | 'story_points' | undefined,
            })),
            overrun_amount: -(daysUntilDeadline - totalEffortDays), // negative = days remaining
            overrun_unit: 'days',
            severity: 'warning',
          })
        }
      }
    }
  }

  // Sort: critical first, then by overrun amount descending
  return conflicts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1
    if (b.severity === 'critical' && a.severity !== 'critical') return 1
    return b.overrun_amount - a.overrun_amount
  })
}

/** Find all chains leading to a node (BFS, max depth 50 to prevent runaway) */
function findAllChains(
  targetId: string,
  predecessors: Map<string, string[]>,
  nodeMap: Map<string, { id: string; label: string; effort_value: number | null; effort_unit: string | null }>
): Array<typeof nodeMap extends Map<string, infer V> ? V[] : never> {
  const chains: any[][] = []
  const queue: { nodeId: string; path: any[] }[] = [{ nodeId: targetId, path: [] }]

  while (queue.length) {
    const { nodeId, path } = queue.shift()!
    const node = nodeMap.get(nodeId)
    if (!node || path.length > 50) continue

    const newPath = [node, ...path]
    const preds = predecessors.get(nodeId) ?? []

    if (!preds.length) {
      if (newPath.length > 1) chains.push(newPath)
    } else {
      preds.forEach(predId => queue.push({ nodeId: predId, path: newPath }))
    }
  }

  return chains
}
