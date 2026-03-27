import type { NodeCategory, EdgeType } from '@synapse/shared'

export const NODE_CATEGORY_COLORS: Record<NodeCategory, { border: string; bg: string; icon: string }> = {
  feature:    { border: '#2E75B6', bg: '#EBF5FB', icon: '⬡' },
  risk:       { border: '#E65100', bg: '#FFF3E0', icon: '⚠' },
  blocker:    { border: '#C62828', bg: '#FFEBEE', icon: '⛔' },
  dependency: { border: '#7B1FA2', bg: '#F3E5F5', icon: '⬡' },
  question:   { border: '#F9A825', bg: '#FFFDE7', icon: '?' },
  assumption: { border: '#00897B', bg: '#E0F2F1', icon: '~' },
  milestone:  { border: '#1B5E20', bg: '#E8F5E9', icon: '◆' },
  note:       { border: '#757575', bg: '#FAFAFA', icon: '✎' },
}

export const EDGE_TYPE_STYLES: Record<
  EdgeType,
  { color: string; strokeWidth: number; strokeDasharray?: string; markerEnd: boolean }
> = {
  dependency: { color: '#7B1FA2', strokeWidth: 2, strokeDasharray: undefined,  markerEnd: true },
  related:    { color: '#999999', strokeWidth: 2, strokeDasharray: '6 3',      markerEnd: false },
  blocks:     { color: '#C62828', strokeWidth: 3, strokeDasharray: undefined,  markerEnd: true },
  triggers:   { color: '#1E7D34', strokeWidth: 2, strokeDasharray: undefined,  markerEnd: true },
  informs:    { color: '#999999', strokeWidth: 2, strokeDasharray: '2 3',      markerEnd: false },
}
