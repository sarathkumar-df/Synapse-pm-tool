/**
 * Synapse AI Prompt Contracts
 * Defines the exact JSON structures the AI must return for each feature.
 * These are the contracts between the AI and the application.
 * Update here first if changing AI behavior.
 */

import type { NodeCategory, EdgeType } from './entities';

// ─── Node Suggestion ──────────────────────────────────────────────────────────

/** What the AI must return for /api/ai/suggest */
export interface AISuggestionOutput {
  suggestions: Array<{
    label: string;
    description: string;
    suggested_category: NodeCategory;
    reasoning: string; // why this node might be missing
    suggested_connections: string[]; // existing node IDs to connect to
  }>;
}

// ─── NL to Map ────────────────────────────────────────────────────────────────

/** What the AI must return for /api/ai/nl-to-map */
export interface AINlToMapOutput {
  nodes: Array<{
    id: string; // temp ID like "n1", "n2" — used for edge references
    label: string;
    description: string;
    category: NodeCategory;
    effort_value?: number;
    effort_unit?: 'hours' | 'days' | 'story_points';
    deadline?: string; // ISO 8601 date
    parent_id?: string; // temp ID reference
  }>;
  edges: Array<{
    source_id: string; // temp node ID
    target_id: string; // temp node ID
    edge_type: EdgeType;
    label?: string;
  }>;
}

// ─── Auto-Categorization ─────────────────────────────────────────────────────

/** What the AI must return for /api/ai/categorize */
export interface AICategorizeOutput {
  results: Array<{
    node_id: string;
    category: NodeCategory;
    confidence: number; // 0.0 to 1.0
    reasoning: string; // brief explanation (not shown to user, for debugging)
  }>;
}

// ─── Conflict Resolution ─────────────────────────────────────────────────────

/** What the AI must return for /api/ai/resolve-conflict */
export interface AIConflictResolutionOutput {
  strategies: Array<{
    name: string; // e.g., "Descope Feature B"
    description: string;
    estimated_impact: string; // e.g., "Saves 3 days, resolves conflict"
    trade_off: string; // e.g., "Feature B deferred to Phase 2"
    operations: Array<
      | { type: 'remove_edge'; edge_id: string }
      | { type: 'update_node'; node_id: string; field: string; value: unknown }
      | { type: 'remove_node'; node_id: string }
      | { type: 'add_edge'; source_node_id: string; target_node_id: string; edge_type: EdgeType }
    >;
  }>;
}

// ─── System Prompt Templates ──────────────────────────────────────────────────

/**
 * These are used in apps/api/src/ai/ to construct prompts.
 * The actual prompt strings live in the implementation files.
 * This contract defines the data shape passed to each prompt builder.
 */

export interface SuggestionPromptContext {
  project_name: string;
  project_description?: string;
  cluster_nodes: Array<{
    id: string;
    label: string;
    description?: string;
    category: NodeCategory;
    connected_to: string[]; // node IDs
  }>;
  max_suggestions: number; // default 5
}

export interface CategorizationPromptContext {
  nodes: Array<{
    id: string;
    label: string;
    description?: string;
    connected_node_categories?: NodeCategory[]; // context from neighbors
  }>;
}

export interface NlToMapPromptContext {
  raw_text: string;
  context_type: 'client_email' | 'meeting_notes' | 'requirements_doc' | 'other';
  project_name?: string;
}

export interface ConflictResolutionPromptContext {
  deadline_node: { id: string; label: string; deadline: string };
  dependency_chain: Array<{
    id: string;
    label: string;
    effort_value?: number;
    effort_unit?: string;
    category: NodeCategory;
  }>;
  overrun_days: number;
  project_context?: string;
}
