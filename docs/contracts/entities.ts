/**
 * Synapse Entity Contracts
 * Source of truth for all data shapes.
 * Update this file BEFORE implementing features that change the data model.
 * Shared across frontend and backend via packages/shared.
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type NodeCategory =
  | 'feature'
  | 'risk'
  | 'blocker'
  | 'dependency'
  | 'question'
  | 'assumption'
  | 'milestone'
  | 'note';

export type NodeStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled';

export type NodePriority = 'critical' | 'high' | 'medium' | 'low';

export type EffortUnit = 'hours' | 'days' | 'story_points';

export type EdgeType = 'dependency' | 'related' | 'blocks' | 'triggers' | 'informs';

export type ConflictSeverity = 'warning' | 'critical';

export type SnapshotTrigger =
  | 'manual'
  | 'share_link_created'
  | 'bulk_add'
  | 'milestone_marked';

// ─── Core Entities ────────────────────────────────────────────────────────────

/** Authenticated user account */
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string; // ISO 8601
  updated_at: string;
}

/** Container grouping related maps */
export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color: string; // hex color for sidebar
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

/** A single mind map canvas */
export interface Map {
  id: string;
  project_id?: string;
  user_id: string;
  name: string;
  description?: string;
  share_token?: string; // null = not shared
  share_config?: ShareConfig; // visibility toggles for shared view
  viewport_state?: ViewportState; // last known pan/zoom + filter state
  thumbnail_svg?: string; // auto-generated SVG miniature
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

/** Per-map share visibility settings */
export interface ShareConfig {
  hide_categories?: NodeCategory[]; // categories to exclude from shared view
  hide_effort?: boolean;
  hide_conflicts?: boolean;
  hide_ai_suggestions?: boolean;
}

/** Canvas viewport + filter persistence */
export interface ViewportState {
  x: number;
  y: number;
  zoom: number; // 0.1 to 4.0
  filters?: NodeFilterState;
}

export interface NodeFilterState {
  categories?: NodeCategory[];
  statuses?: NodeStatus[];
  priorities?: NodePriority[];
  has_deadline?: boolean;
  has_effort?: boolean;
  has_conflicts?: boolean;
}

/**
 * Core building block of a mind map.
 * Supports nesting (parent_id), timeline (effort + deadline), and AI metadata.
 */
export interface Node {
  id: string;
  map_id: string;
  parent_id?: string; // null = root node
  label: string;
  description?: string; // markdown content
  category: NodeCategory;
  status: NodeStatus;
  priority: NodePriority;
  position_x: number;
  position_y: number;
  width?: number; // default 200
  height?: number; // default 80
  color_override?: string; // hex, overrides category color
  effort_value?: number;
  effort_unit?: EffortUnit;
  deadline?: string; // ISO 8601 date
  metadata?: Record<string, string>; // key-value pairs
  ai_category_confidence?: number; // 0.0 to 1.0
  created_at: string;
  updated_at: string;
}

/** Relationship between two nodes */
export interface Edge {
  id: string;
  map_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: EdgeType;
  label?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Immutable point-in-time copy of a map.
 * Stored as a full JSONB snapshot — not normalized rows.
 */
export interface Snapshot {
  id: string;
  map_id: string;
  name: string;
  description?: string;
  trigger: SnapshotTrigger;
  snapshot_data: SnapshotData; // full map state
  node_count: number;
  thumbnail_svg?: string;
  created_at: string;
}

/** Full map state stored in a snapshot */
export interface SnapshotData {
  nodes: Node[];
  edges: Edge[];
  viewport_state?: ViewportState;
}

/** Audit trail entry for every map modification after baseline */
export interface ChangeLog {
  id: string;
  map_id: string;
  node_id?: string;
  edge_id?: string;
  user_id: string;
  action: 'create' | 'update' | 'delete';
  entity_type: 'node' | 'edge' | 'map';
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  created_at: string;
}

// ─── Computed/Runtime Types ───────────────────────────────────────────────────

/** A detected timeline conflict */
export interface Conflict {
  id: string; // computed, not stored — `${deadline_node_id}-${chain_hash}`
  deadline_node_id: string;
  deadline_node_label: string;
  deadline: string;
  chain: ConflictChainNode[]; // ordered from deadline node backwards
  overrun_amount: number; // in days (normalized)
  overrun_unit: EffortUnit;
  severity: ConflictSeverity;
}

export interface ConflictChainNode {
  node_id: string;
  label: string;
  effort_value?: number;
  effort_unit?: EffortUnit;
}

/** Result of critical path calculation */
export interface CriticalPathResult {
  critical_path_node_ids: string[];
  cycle?: string[]; // node IDs forming a cycle, if detected
  earliest_starts: Record<string, number>; // nodeId → days from today
  latest_starts: Record<string, number>; // nodeId → days from today
}

/** AI node suggestion */
export interface NodeSuggestion {
  id: string; // temporary client-side ID
  label: string;
  description: string;
  suggested_category: NodeCategory;
  reasoning: string;
  suggested_connections: string[]; // existing node IDs to connect to
  position_x: number; // suggested position near cluster
  position_y: number;
}

/** AI conflict resolution strategy */
export interface ResolutionStrategy {
  name: string;
  description: string;
  estimated_impact: string; // e.g., "Saves 3 days, resolves conflict"
  trade_off: string;
  operations: ResolutionOperation[];
}

export interface ResolutionOperation {
  type: 'remove_edge' | 'update_node' | 'remove_node' | 'add_edge';
  target_id: string;
  field?: string; // for update_node
  value?: unknown; // for update_node
}
