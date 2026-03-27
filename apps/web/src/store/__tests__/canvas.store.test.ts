import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useCanvasStore } from '../canvas.store'

// Inline the minimal types we need to avoid @synapse/shared alias resolution issues
type NodeCategory = 'feature' | 'risk' | 'blocker' | 'dependency' | 'question' | 'assumption' | 'milestone' | 'note'
type NodeStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled'
type NodePriority = 'critical' | 'high' | 'medium' | 'low'

interface TestNode {
  id: string
  map_id: string
  label: string
  category: NodeCategory
  status: NodeStatus
  priority: NodePriority
  position_x: number
  position_y: number
  created_at: string
  updated_at: string
}

interface TestEdge {
  id: string
  map_id: string
  source_node_id: string
  target_node_id: string
  edge_type: string
  created_at: string
  updated_at: string
}

const EMPTY_CRITICAL_PATH = {
  critical_path_node_ids: [] as string[],
  earliest_starts: {} as Record<string, number>,
  latest_starts: {} as Record<string, number>,
}

function makeNode(id: string, overrides: Partial<TestNode> = {}): TestNode {
  return {
    id,
    map_id: 'map_1',
    label: `Node ${id}`,
    category: 'feature',
    status: 'todo',
    priority: 'medium',
    position_x: 0,
    position_y: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeEdge(id: string, sourceId: string, targetId: string): TestEdge {
  return {
    id,
    map_id: 'map_1',
    source_node_id: sourceId,
    target_node_id: targetId,
    edge_type: 'dependency',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

const initialState = {
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
}

beforeEach(() => {
  act(() => {
    useCanvasStore.setState(initialState)
  })
})

describe('initCanvas', () => {
  it('sets nodes and edges from arguments', () => {
    const nodes = [makeNode('n1'), makeNode('n2')]
    const edges = [makeEdge('e1', 'n1', 'n2')]

    act(() => {
      useCanvasStore.getState().initCanvas(nodes as any, edges as any, [], EMPTY_CRITICAL_PATH)
    })

    const state = useCanvasStore.getState()
    expect(state.nodes).toHaveLength(2)
    expect(state.edges).toHaveLength(1)
  })

  it('clears undoStack and redoStack on init', () => {
    // Seed stacks first via addNode
    act(() => {
      useCanvasStore.getState().addNode(makeNode('pre') as any)
    })
    expect(useCanvasStore.getState().undoStack).toHaveLength(1)

    act(() => {
      useCanvasStore.getState().initCanvas([], [], [], EMPTY_CRITICAL_PATH)
    })

    const state = useCanvasStore.getState()
    expect(state.undoStack).toHaveLength(0)
    expect(state.redoStack).toHaveLength(0)
  })

  it('sets conflicts and criticalPath', () => {
    const mockConflict = { id: 'c1', severity: 'critical' } as any
    const mockPath = { critical_path_node_ids: ['n1'], earliest_starts: {}, latest_starts: {} }

    act(() => {
      useCanvasStore.getState().initCanvas([], [], [mockConflict], mockPath)
    })

    const state = useCanvasStore.getState()
    expect(state.conflicts).toHaveLength(1)
    expect(state.criticalPath?.critical_path_node_ids).toContain('n1')
  })
})

describe('addNode', () => {
  it('adds node to nodes array', () => {
    act(() => {
      useCanvasStore.getState().addNode(makeNode('n1') as any)
    })

    expect(useCanvasStore.getState().nodes).toHaveLength(1)
    expect(useCanvasStore.getState().nodes[0].id).toBe('n1')
  })

  it('pushes ADD_NODE operation onto undoStack', () => {
    act(() => {
      useCanvasStore.getState().addNode(makeNode('n1') as any)
    })

    const { undoStack } = useCanvasStore.getState()
    expect(undoStack).toHaveLength(1)
    expect(undoStack[0].type).toBe('ADD_NODE')
  })

  it('clears the redoStack when a new node is added', () => {
    // Put something in the redo stack by doing add → undo
    act(() => {
      useCanvasStore.getState().addNode(makeNode('n1') as any)
    })
    act(() => {
      useCanvasStore.getState().undo()
    })
    expect(useCanvasStore.getState().redoStack).toHaveLength(1)

    // Now add another node — redo stack should be cleared
    act(() => {
      useCanvasStore.getState().addNode(makeNode('n2') as any)
    })
    expect(useCanvasStore.getState().redoStack).toHaveLength(0)
  })
})

describe('updateNode', () => {
  it('updates only the matching node, leaving others intact', () => {
    act(() => {
      useCanvasStore.getState().initCanvas(
        [makeNode('n1'), makeNode('n2')] as any,
        [],
        [],
        EMPTY_CRITICAL_PATH
      )
    })

    act(() => {
      useCanvasStore.getState().updateNode('n1', { label: 'Updated Label' })
    })

    const { nodes } = useCanvasStore.getState()
    expect(nodes.find(n => n.id === 'n1')!.label).toBe('Updated Label')
    expect(nodes.find(n => n.id === 'n2')!.label).toBe('Node n2')
  })

  it('pushes UPDATE_NODE operation onto undoStack', () => {
    act(() => {
      useCanvasStore.getState().initCanvas([makeNode('n1')] as any, [], [], EMPTY_CRITICAL_PATH)
    })

    act(() => {
      useCanvasStore.getState().updateNode('n1', { label: 'New' })
    })

    const { undoStack } = useCanvasStore.getState()
    expect(undoStack).toHaveLength(1)
    expect(undoStack[0].type).toBe('UPDATE_NODE')
  })

  it('does nothing when the node id does not exist', () => {
    act(() => {
      useCanvasStore.getState().initCanvas([makeNode('n1')] as any, [], [], EMPTY_CRITICAL_PATH)
    })

    act(() => {
      useCanvasStore.getState().updateNode('nonexistent', { label: 'Ghost' })
    })

    expect(useCanvasStore.getState().undoStack).toHaveLength(0)
    expect(useCanvasStore.getState().nodes[0].label).toBe('Node n1')
  })
})

describe('deleteNode', () => {
  it('removes the node from nodes array', () => {
    act(() => {
      useCanvasStore.getState().initCanvas([makeNode('n1'), makeNode('n2')] as any, [], [], EMPTY_CRITICAL_PATH)
    })

    act(() => {
      useCanvasStore.getState().deleteNode('n1')
    })

    const { nodes } = useCanvasStore.getState()
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('n2')
  })

  it('removes connected edges where node is source', () => {
    act(() => {
      useCanvasStore.getState().initCanvas(
        [makeNode('n1'), makeNode('n2'), makeNode('n3')] as any,
        [makeEdge('e1', 'n1', 'n2'), makeEdge('e2', 'n2', 'n3')] as any,
        [],
        EMPTY_CRITICAL_PATH
      )
    })

    act(() => {
      useCanvasStore.getState().deleteNode('n1')
    })

    const { edges } = useCanvasStore.getState()
    expect(edges).toHaveLength(1)
    expect(edges[0].id).toBe('e2')
  })

  it('removes connected edges where node is target', () => {
    act(() => {
      useCanvasStore.getState().initCanvas(
        [makeNode('n1'), makeNode('n2')] as any,
        [makeEdge('e1', 'n1', 'n2')] as any,
        [],
        EMPTY_CRITICAL_PATH
      )
    })

    act(() => {
      useCanvasStore.getState().deleteNode('n2')
    })

    expect(useCanvasStore.getState().edges).toHaveLength(0)
  })

  it('pushes DELETE_NODE operation onto undoStack', () => {
    act(() => {
      useCanvasStore.getState().initCanvas([makeNode('n1')] as any, [], [], EMPTY_CRITICAL_PATH)
    })

    act(() => {
      useCanvasStore.getState().deleteNode('n1')
    })

    const { undoStack } = useCanvasStore.getState()
    expect(undoStack).toHaveLength(1)
    expect(undoStack[0].type).toBe('DELETE_NODE')
  })
})

describe('selectNode', () => {
  it('sets selectedNodeId to the given id', () => {
    act(() => {
      useCanvasStore.getState().selectNode('n1')
    })
    expect(useCanvasStore.getState().selectedNodeId).toBe('n1')
  })

  it('sets selectedNodeId to null when called with null', () => {
    act(() => {
      useCanvasStore.getState().selectNode('n1')
    })
    act(() => {
      useCanvasStore.getState().selectNode(null)
    })
    expect(useCanvasStore.getState().selectedNodeId).toBeNull()
  })
})

describe('undo', () => {
  it('removes a node added by addNode', () => {
    act(() => {
      useCanvasStore.getState().addNode(makeNode('n1') as any)
    })
    expect(useCanvasStore.getState().nodes).toHaveLength(1)

    act(() => {
      useCanvasStore.getState().undo()
    })

    expect(useCanvasStore.getState().nodes).toHaveLength(0)
  })

  it('restores a node removed by deleteNode', () => {
    act(() => {
      useCanvasStore.getState().initCanvas([makeNode('n1')] as any, [], [], EMPTY_CRITICAL_PATH)
    })
    act(() => {
      useCanvasStore.getState().deleteNode('n1')
    })
    expect(useCanvasStore.getState().nodes).toHaveLength(0)

    act(() => {
      useCanvasStore.getState().undo()
    })

    expect(useCanvasStore.getState().nodes).toHaveLength(1)
    expect(useCanvasStore.getState().nodes[0].id).toBe('n1')
  })

  it('moves the undone operation to the redoStack', () => {
    act(() => {
      useCanvasStore.getState().addNode(makeNode('n1') as any)
    })
    act(() => {
      useCanvasStore.getState().undo()
    })

    expect(useCanvasStore.getState().undoStack).toHaveLength(0)
    expect(useCanvasStore.getState().redoStack).toHaveLength(1)
  })

  it('does nothing when undoStack is empty', () => {
    act(() => {
      useCanvasStore.getState().initCanvas([makeNode('n1')] as any, [], [], EMPTY_CRITICAL_PATH)
    })
    expect(useCanvasStore.getState().undoStack).toHaveLength(0)

    act(() => {
      useCanvasStore.getState().undo()
    })

    // Node should still be there — nothing happened
    expect(useCanvasStore.getState().nodes).toHaveLength(1)
  })
})

describe('redo', () => {
  it('re-applies an addNode after undo', () => {
    act(() => {
      useCanvasStore.getState().addNode(makeNode('n1') as any)
    })
    act(() => {
      useCanvasStore.getState().undo()
    })
    expect(useCanvasStore.getState().nodes).toHaveLength(0)

    act(() => {
      useCanvasStore.getState().redo()
    })

    expect(useCanvasStore.getState().nodes).toHaveLength(1)
    expect(useCanvasStore.getState().nodes[0].id).toBe('n1')
  })

  it('re-applies a deleteNode after undo', () => {
    act(() => {
      useCanvasStore.getState().initCanvas([makeNode('n1')] as any, [], [], EMPTY_CRITICAL_PATH)
    })
    act(() => {
      useCanvasStore.getState().deleteNode('n1')
    })
    act(() => {
      useCanvasStore.getState().undo()
    })
    expect(useCanvasStore.getState().nodes).toHaveLength(1)

    act(() => {
      useCanvasStore.getState().redo()
    })

    expect(useCanvasStore.getState().nodes).toHaveLength(0)
  })

  it('moves the re-done operation back to undoStack', () => {
    act(() => {
      useCanvasStore.getState().addNode(makeNode('n1') as any)
    })
    act(() => {
      useCanvasStore.getState().undo()
    })
    act(() => {
      useCanvasStore.getState().redo()
    })

    expect(useCanvasStore.getState().redoStack).toHaveLength(0)
    expect(useCanvasStore.getState().undoStack).toHaveLength(1)
  })

  it('does nothing when redoStack is empty', () => {
    act(() => {
      useCanvasStore.getState().initCanvas([makeNode('n1')] as any, [], [], EMPTY_CRITICAL_PATH)
    })

    act(() => {
      useCanvasStore.getState().redo()
    })

    // State unchanged
    expect(useCanvasStore.getState().nodes).toHaveLength(1)
    expect(useCanvasStore.getState().redoStack).toHaveLength(0)
  })
})

describe('enterWhatIfMode', () => {
  it('sets isWhatIfMode to true', () => {
    act(() => {
      useCanvasStore.getState().initCanvas([makeNode('n1')] as any, [], [], EMPTY_CRITICAL_PATH)
      useCanvasStore.getState().enterWhatIfMode()
    })

    expect(useCanvasStore.getState().isWhatIfMode).toBe(true)
  })

  it('saves current nodes and edges to whatIfBuffer', () => {
    const nodes = [makeNode('n1'), makeNode('n2')]
    const edges = [makeEdge('e1', 'n1', 'n2')]

    act(() => {
      useCanvasStore.getState().initCanvas(nodes as any, edges as any, [], EMPTY_CRITICAL_PATH)
      useCanvasStore.getState().enterWhatIfMode()
    })

    const { whatIfBuffer } = useCanvasStore.getState()
    expect(whatIfBuffer).not.toBeNull()
    expect(whatIfBuffer!.nodes).toHaveLength(2)
    expect(whatIfBuffer!.edges).toHaveLength(1)
  })
})

describe('exitWhatIfMode', () => {
  it('with apply=false restores nodes and edges from whatIfBuffer', () => {
    const originalNodes = [makeNode('n1')]

    act(() => {
      useCanvasStore.getState().initCanvas(originalNodes as any, [], [], EMPTY_CRITICAL_PATH)
      useCanvasStore.getState().enterWhatIfMode()
      // Mutate state while in what-if mode
      useCanvasStore.getState().addNode(makeNode('n2') as any)
    })
    expect(useCanvasStore.getState().nodes).toHaveLength(2)

    act(() => {
      useCanvasStore.getState().exitWhatIfMode(false)
    })

    expect(useCanvasStore.getState().nodes).toHaveLength(1)
    expect(useCanvasStore.getState().nodes[0].id).toBe('n1')
  })

  it('with apply=true keeps current state (does not restore buffer)', () => {
    act(() => {
      useCanvasStore.getState().initCanvas([makeNode('n1')] as any, [], [], EMPTY_CRITICAL_PATH)
      useCanvasStore.getState().enterWhatIfMode()
      useCanvasStore.getState().addNode(makeNode('n2') as any)
    })
    expect(useCanvasStore.getState().nodes).toHaveLength(2)

    act(() => {
      useCanvasStore.getState().exitWhatIfMode(true)
    })

    expect(useCanvasStore.getState().nodes).toHaveLength(2)
  })

  it('sets isWhatIfMode to false regardless of apply flag', () => {
    act(() => {
      useCanvasStore.getState().enterWhatIfMode()
    })
    expect(useCanvasStore.getState().isWhatIfMode).toBe(true)

    act(() => {
      useCanvasStore.getState().exitWhatIfMode(false)
    })

    expect(useCanvasStore.getState().isWhatIfMode).toBe(false)
  })

  it('clears whatIfBuffer on exit', () => {
    act(() => {
      useCanvasStore.getState().enterWhatIfMode()
      useCanvasStore.getState().exitWhatIfMode(false)
    })

    expect(useCanvasStore.getState().whatIfBuffer).toBeNull()
  })
})
