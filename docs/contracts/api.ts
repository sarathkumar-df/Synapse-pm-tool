/**
 * Synapse API Contracts
 * Request and response types for all API endpoints.
 * Update this file before implementing new routes.
 */

import type {
  User, Project, Map, Node, Edge, Snapshot, ChangeLog,
  NodeCategory, NodeStatus, NodePriority, EffortUnit, EdgeType,
  ShareConfig, ViewportState, Conflict, CriticalPathResult,
  NodeSuggestion, ResolutionStrategy, SnapshotData
} from './entities';

// ─── Standard Response Wrappers ───────────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>; // field-level validation errors
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string; // min 8 chars
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  color?: string;
}

// GET /api/projects → PaginatedResponse<Project>
// POST /api/projects → ApiSuccess<Project>
// GET /api/projects/:id → ApiSuccess<Project>
// PATCH /api/projects/:id → ApiSuccess<Project>
// DELETE /api/projects/:id → 204 No Content
// POST /api/projects/:id/archive → ApiSuccess<Project>

// ─── Maps ─────────────────────────────────────────────────────────────────────

export interface CreateMapRequest {
  name: string;
  description?: string;
  project_id?: string;
}

export interface UpdateMapRequest {
  name?: string;
  description?: string;
  project_id?: string | null;
  viewport_state?: ViewportState;
}

/** Full map with all nodes, edges, and conflicts — used for canvas loading */
export interface MapDetailResponse {
  map: Map;
  nodes: Node[];
  edges: Edge[];
  conflicts: Conflict[];
  critical_path: CriticalPathResult;
}

// GET /api/maps → PaginatedResponse<Map>
// POST /api/maps → ApiSuccess<Map>
// GET /api/maps/:id → ApiSuccess<MapDetailResponse>
// PATCH /api/maps/:id → ApiSuccess<Map>
// DELETE /api/maps/:id → 204
// POST /api/maps/:id/archive → ApiSuccess<Map>
// POST /api/maps/:id/share → ApiSuccess<{ share_url: string, share_token: string }>
// DELETE /api/maps/:id/share → 204
// GET /api/shared/:token → ApiSuccess<SharedMapResponse>

export interface SharedMapResponse {
  map: Pick<Map, 'id' | 'name' | 'share_config'>;
  nodes: Node[];
  edges: Edge[];
}

// ─── Nodes ────────────────────────────────────────────────────────────────────

export interface CreateNodeRequest {
  map_id: string;
  parent_id?: string;
  label: string;
  description?: string;
  category?: NodeCategory;
  status?: NodeStatus;
  priority?: NodePriority;
  position_x: number;
  position_y: number;
  effort_value?: number;
  effort_unit?: EffortUnit;
  deadline?: string;
  color_override?: string;
  metadata?: Record<string, string>;
}

export interface UpdateNodeRequest {
  label?: string;
  description?: string;
  category?: NodeCategory;
  status?: NodeStatus;
  priority?: NodePriority;
  position_x?: number;
  position_y?: number;
  effort_value?: number | null;
  effort_unit?: EffortUnit | null;
  deadline?: string | null;
  color_override?: string | null;
  metadata?: Record<string, string>;
}

export interface BulkUpdateNodesRequest {
  updates: Array<{ id: string } & UpdateNodeRequest>;
}

/** Recalculated timeline state after a node mutation */
export interface NodeMutationResponse {
  node: Node;
  conflicts: Conflict[];
  critical_path: CriticalPathResult;
}

// POST /api/maps/:mapId/nodes → ApiSuccess<NodeMutationResponse>
// PATCH /api/maps/:mapId/nodes/:nodeId → ApiSuccess<NodeMutationResponse>
// PATCH /api/maps/:mapId/nodes/bulk → ApiSuccess<{ nodes: Node[], conflicts: Conflict[], critical_path: CriticalPathResult }>
// DELETE /api/maps/:mapId/nodes/:nodeId → ApiSuccess<{ conflicts: Conflict[], critical_path: CriticalPathResult }>

// ─── Edges ────────────────────────────────────────────────────────────────────

export interface CreateEdgeRequest {
  source_node_id: string;
  target_node_id: string;
  edge_type: EdgeType;
  label?: string;
}

export interface UpdateEdgeRequest {
  edge_type?: EdgeType;
  label?: string | null;
}

// POST /api/maps/:mapId/edges → ApiSuccess<{ edge: Edge, conflicts: Conflict[], critical_path: CriticalPathResult }>
// PATCH /api/maps/:mapId/edges/:edgeId → ApiSuccess<Edge>
// DELETE /api/maps/:mapId/edges/:edgeId → ApiSuccess<{ conflicts: Conflict[], critical_path: CriticalPathResult }>

// ─── Snapshots ────────────────────────────────────────────────────────────────

export interface CreateSnapshotRequest {
  name: string;
  description?: string;
}

// GET /api/maps/:mapId/snapshots → ApiSuccess<Snapshot[]>
// POST /api/maps/:mapId/snapshots → ApiSuccess<Snapshot>
// DELETE /api/maps/:mapId/snapshots/:snapshotId → 204
// PATCH /api/maps/:mapId/snapshots/:snapshotId → ApiSuccess<Snapshot> (rename)
// GET /api/maps/:mapId/snapshots/diff?a=:snapshotId&b=:snapshotId → ApiSuccess<SnapshotDiff>

export interface SnapshotDiff {
  added_nodes: Node[];
  removed_nodes: Node[];
  modified_nodes: Array<{ before: Node; after: Node; changed_fields: string[] }>;
  moved_nodes: Array<{ node: Node; old_position: { x: number; y: number } }>;
  added_edges: Edge[];
  removed_edges: Edge[];
  summary: {
    nodes_added: number;
    nodes_removed: number;
    nodes_modified: number;
    effort_delta_days: number; // positive = more work, negative = less work
  };
}

// ─── AI Endpoints ─────────────────────────────────────────────────────────────

// POST /api/ai/categorize → ApiSuccess<CategorizationResponse>
export interface CategorizationRequest {
  map_id: string;
  nodes: Array<{ id: string; label: string; description?: string }>;
}

export interface CategorizationResponse {
  results: Array<{
    node_id: string;
    category: NodeCategory;
    confidence: number;
  }>;
}

// POST /api/ai/suggest → ApiSuccess<SuggestionResponse> (streaming)
export interface SuggestionRequest {
  map_id: string;
  cluster_node_ids: string[]; // nodes in the cluster to analyze
  project_context?: string;
}

export interface SuggestionResponse {
  suggestions: NodeSuggestion[];
}

// POST /api/ai/nl-to-map → ApiSuccess<NlToMapResponse> (streaming)
export interface NlToMapRequest {
  map_id: string;
  text: string;
  context_type?: 'client_email' | 'meeting_notes' | 'requirements_doc' | 'other';
}

export interface NlToMapResponse {
  nodes: Array<{
    id: string; // temp ID for building edges
    label: string;
    description?: string;
    category: NodeCategory;
    effort_value?: number;
    effort_unit?: EffortUnit;
    deadline?: string;
    parent_id?: string;
  }>;
  edges: Array<{
    source_id: string;
    target_id: string;
    edge_type: EdgeType;
    label?: string;
  }>;
}

// POST /api/ai/resolve-conflict → ApiSuccess<ConflictResolutionResponse>
export interface ConflictResolutionRequest {
  map_id: string;
  conflict_id: string; // the specific conflict to resolve
}

export interface ConflictResolutionResponse {
  strategies: ResolutionStrategy[];
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportPdfRequest {
  map_id: string;
  page_size: 'A4' | 'Letter';
  orientation: 'landscape' | 'portrait';
  include_legend: boolean;
  include_conflict_summary: boolean;
  quality: 'standard' | 'high';
  export_all: boolean; // false = viewport only
}

export interface ExportImageRequest {
  map_id: string;
  format: 'png' | 'svg';
  transparent_background: boolean;
  export_all: boolean;
}

// POST /api/maps/:mapId/export/pdf → binary PDF stream
// POST /api/maps/:mapId/export/image → binary image stream
