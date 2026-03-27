/**
 * Canvas-specific frontend types.
 * These extend the API entity contracts with runtime UI state.
 */
import type { NodeCategory, NodeStatus, NodePriority, EffortUnit, EdgeType } from '@synapse/shared'

/** Data attached to every React Flow node — what SynapseNode receives as `data` */
export interface SynapseNodeData extends Record<string, unknown> {
  // Persisted fields
  label: string
  category: NodeCategory
  status: NodeStatus
  priority: NodePriority
  effort_value?: number | null
  effort_unit?: EffortUnit | null
  deadline?: string | null
  color_override?: string | null
  ai_category_confidence?: number | null

  // Runtime conflict/path state (derived from API response, not persisted)
  isConflictCritical?: boolean
  isConflictWarning?: boolean
  isOnCriticalPath?: boolean
  isRippleDimmed?: boolean
}

/** Data attached to every React Flow edge */
export interface SynapseEdgeData extends Record<string, unknown> {
  edge_type: EdgeType
  label?: string | null
}

/** State for the inline label edit on a node */
export interface InlineLabelEdit {
  nodeId: string
  value: string
}
