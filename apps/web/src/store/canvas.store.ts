/**
 * Canvas Store — client-side canvas state
 * Handles nodes, edges, selection, undo/redo, and what-if mode.
 * Server state (persisted data) lives in React Query, not here.
 */

import { create } from 'zustand'
import type { Node, Edge, Conflict, CriticalPathResult } from '../../../docs/contracts/entities'

type CanvasOperation =
  | { type: 'ADD_NODE'; node: Node }
  | { type: 'UPDATE_NODE'; id: string; before: Partial<Node>; after: Partial<Node> }
  | { type: 'DELETE_NODE'; node: Node; edges: Edge[] }
  | { type: 'ADD_EDGE'; edge: Edge }
  | { type: 'DELETE_EDGE'; edge: Edge }

interface CanvasState {
  // Data
  nodes: Node[]
  edges: Edge[]
  conflicts: Conflict[]
  criticalPath: CriticalPathResult | null

  // Selection
  selectedNodeId: string | null

  // Modes
  isWhatIfMode: boolean
  whatIfBuffer: { nodes: Node[]; edges: Edge[] } | null // snapshot before what-if
  rippleNodeId: string | null

  // Undo/Redo
  undoStack: CanvasOperation[]
  redoStack: CanvasOperation[]

  // Actions — Data
  initCanvas: (nodes: Node[], edges: Edge[], conflicts: Conflict[], criticalPath: CriticalPathResult) => void
  addNode: (node: Node) => void
  updateNode: (id: string, updates: Partial<Node>) => void
  deleteNode: (id: string) => void
  addEdge: (edge: Edge) => void
  updateEdge: (id: string, updates: Partial<Edge>) => void
  deleteEdge: (id: string) => void
  setConflicts: (conflicts: Conflict[], criticalPath: CriticalPathResult) => void

  // Actions — Selection
  selectNode: (id: string | null) => void

  // Actions — What-If
  enterWhatIfMode: () => void
  exitWhatIfMode: (apply: boolean) => void

  // Actions — Ripple
  setRippleNode: (id: string | null) => void

  // Actions — Undo/Redo
  undo: () => void
  redo: () => void
}

const MAX_UNDO_DEPTH = 50

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  conflicts: [],
  criticalPath: null,
  selectedNodeId: null,
  isWhatIfMode: false,
  whatIfBuffer: null,
  rippleNodeId: null,
  undoStack: [],
  redoStack: [],

  initCanvas: (nodes, edges, conflicts, criticalPath) =>
    set({ nodes, edges, conflicts, criticalPath, undoStack: [], redoStack: [] }),

  addNode: (node) => {
    const op: CanvasOperation = { type: 'ADD_NODE', node }
    set(state => ({
      nodes: [...state.nodes, node],
      undoStack: [...state.undoStack.slice(-MAX_UNDO_DEPTH + 1), op],
      redoStack: [],
    }))
  },

  updateNode: (id, updates) => {
    const before = get().nodes.find(n => n.id === id)
    if (!before) return
    const op: CanvasOperation = { type: 'UPDATE_NODE', id, before, after: updates }
    set(state => ({
      nodes: state.nodes.map(n => n.id === id ? { ...n, ...updates } : n),
      undoStack: [...state.undoStack.slice(-MAX_UNDO_DEPTH + 1), op],
      redoStack: [],
    }))
  },

  deleteNode: (id) => {
    const node = get().nodes.find(n => n.id === id)
    const edges = get().edges.filter(e => e.source_node_id === id || e.target_node_id === id)
    if (!node) return
    const op: CanvasOperation = { type: 'DELETE_NODE', node, edges }
    set(state => ({
      nodes: state.nodes.filter(n => n.id !== id),
      edges: state.edges.filter(e => e.source_node_id !== id && e.target_node_id !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      undoStack: [...state.undoStack.slice(-MAX_UNDO_DEPTH + 1), op],
      redoStack: [],
    }))
  },

  addEdge: (edge) => {
    const op: CanvasOperation = { type: 'ADD_EDGE', edge }
    set(state => ({
      edges: [...state.edges, edge],
      undoStack: [...state.undoStack.slice(-MAX_UNDO_DEPTH + 1), op],
      redoStack: [],
    }))
  },

  updateEdge: (id, updates) =>
    set(state => ({
      edges: state.edges.map(e => e.id === id ? { ...e, ...updates } : e),
    })),

  deleteEdge: (id) => {
    const edge = get().edges.find(e => e.id === id)
    if (!edge) return
    const op: CanvasOperation = { type: 'DELETE_EDGE', edge }
    set(state => ({
      edges: state.edges.filter(e => e.id !== id),
      undoStack: [...state.undoStack.slice(-MAX_UNDO_DEPTH + 1), op],
      redoStack: [],
    }))
  },

  setConflicts: (conflicts, criticalPath) => set({ conflicts, criticalPath }),

  selectNode: (id) => set({ selectedNodeId: id }),

  enterWhatIfMode: () => {
    const { nodes, edges } = get()
    set({ isWhatIfMode: true, whatIfBuffer: { nodes, edges } })
  },

  exitWhatIfMode: (apply) => {
    const { whatIfBuffer } = get()
    if (!apply && whatIfBuffer) {
      set({ nodes: whatIfBuffer.nodes, edges: whatIfBuffer.edges })
    }
    set({ isWhatIfMode: false, whatIfBuffer: null })
  },

  setRippleNode: (id) => set({ rippleNodeId: id }),

  undo: () => {
    const { undoStack, redoStack } = get()
    if (!undoStack.length) return
    const op = undoStack[undoStack.length - 1]
    // Apply inverse of operation
    set(state => {
      const newStack = state.undoStack.slice(0, -1)
      switch (op.type) {
        case 'ADD_NODE':
          return { nodes: state.nodes.filter(n => n.id !== op.node.id), undoStack: newStack, redoStack: [op, ...redoStack] }
        case 'DELETE_NODE':
          return { nodes: [...state.nodes, op.node], edges: [...state.edges, ...op.edges], undoStack: newStack, redoStack: [op, ...redoStack] }
        case 'UPDATE_NODE':
          return { nodes: state.nodes.map(n => n.id === op.id ? { ...n, ...op.before } : n), undoStack: newStack, redoStack: [op, ...redoStack] }
        case 'ADD_EDGE':
          return { edges: state.edges.filter(e => e.id !== op.edge.id), undoStack: newStack, redoStack: [op, ...redoStack] }
        case 'DELETE_EDGE':
          return { edges: [...state.edges, op.edge], undoStack: newStack, redoStack: [op, ...redoStack] }
        default:
          return {}
      }
    })
  },

  redo: () => {
    const { redoStack } = get()
    if (!redoStack.length) return
    const op = redoStack[0]
    set(state => {
      const newRedo = state.redoStack.slice(1)
      switch (op.type) {
        case 'ADD_NODE':
          return { nodes: [...state.nodes, op.node], redoStack: newRedo, undoStack: [...state.undoStack, op] }
        case 'DELETE_NODE':
          return { nodes: state.nodes.filter(n => n.id !== op.node.id), edges: state.edges.filter(e => !op.edges.some(de => de.id === e.id)), redoStack: newRedo, undoStack: [...state.undoStack, op] }
        case 'UPDATE_NODE':
          return { nodes: state.nodes.map(n => n.id === op.id ? { ...n, ...op.after } : n), redoStack: newRedo, undoStack: [...state.undoStack, op] }
        case 'ADD_EDGE':
          return { edges: [...state.edges, op.edge], redoStack: newRedo, undoStack: [...state.undoStack, op] }
        case 'DELETE_EDGE':
          return { edges: state.edges.filter(e => e.id !== op.edge.id), redoStack: newRedo, undoStack: [...state.undoStack, op] }
        default:
          return {}
      }
    })
  },
}))
