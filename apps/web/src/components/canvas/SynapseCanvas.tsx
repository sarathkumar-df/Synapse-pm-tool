import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  NodeToolbar,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  Position,
  ConnectionMode,
  type Connection,
  type NodeChange,
  type Node as RFNode,
  type Edge as RFEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMutation } from '@tanstack/react-query'

import { useCanvasStore } from '../../store/canvas.store'
import { useUIStore } from '../../store/ui.store'
import { nodesApi, edgesApi } from '../../services/api.client'
import type { EdgeType } from '@synapse/shared'

import SynapseNodeComponent from './SynapseNode'
import SynapseEdgeComponent from './SynapseEdge'
import NodeToolbarContent from './NodeToolbar'
import EdgeTypePicker from './EdgeTypePicker'
import NodeContextMenu from './NodeContextMenu'
import CommandPalette from './CommandPalette'
import type { SynapseNodeData, SynapseEdgeData } from '../../types/canvas.types'
import { EDGE_TYPE_STYLES } from '../../constants/node-categories'

const NODE_TYPES = { synapse: SynapseNodeComponent }
const EDGE_TYPES = { synapse: SynapseEdgeComponent }

// ── Inner canvas — must be inside ReactFlowProvider ────────────────────────

function SynapseCanvasInner({ mapId }: { mapId: string }) {
  const reactFlow = useReactFlow()
  const addToast              = useUIStore(s => s.addToast)
  const setActivePanel        = useUIStore(s => s.setActivePanel)
  const commandPaletteOpen    = useUIStore(s => s.commandPaletteOpen)
  const setCommandPaletteOpen = useUIStore(s => s.setCommandPaletteOpen)

  // Zustand subscriptions
  const nodes        = useCanvasStore(s => s.nodes)
  const edges        = useCanvasStore(s => s.edges)
  const conflicts    = useCanvasStore(s => s.conflicts)
  const criticalPath = useCanvasStore(s => s.criticalPath)
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)
  const rippleNodeId   = useCanvasStore(s => s.rippleNodeId)
  const selectNode  = useCanvasStore(s => s.selectNode)
  const addNode     = useCanvasStore(s => s.addNode)
  const addEdge     = useCanvasStore(s => s.addEdge)
  const updateNode  = useCanvasStore(s => s.updateNode)
  const setConflicts = useCanvasStore(s => s.setConflicts)
  const undo = useCanvasStore(s => s.undo)
  const redo = useCanvasStore(s => s.redo)

  // Local RF state — owns visual positions during drag
  const [rfNodes, setRfNodes, handleNodesChange] = useNodesState<RFNode<SynapseNodeData>>([])
  const [rfEdges, setRfEdges, handleEdgesChange] = useEdgesState<RFEdge<SynapseEdgeData>>([])

  const hasFitView = useRef(false)

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)

  // Pending edge connection
  const [pendingConnection, setPendingConnection] = useState<{
    connection: Connection; mouseX: number; mouseY: number
  } | null>(null)
  const pendingConnRef = useRef<Connection | null>(null)

  // Position auto-save
  const positionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPositionUpdates = useRef<Map<string, { x: number; y: number }>>(new Map())

  // ── Zustand → RF node shape ────────────────────────────────────────────────
  // Does NOT include selectedNodeId — React Flow manages selection state internally.
  // selectedNodeId is only used for the NodeToolbar overlay.

  const conflictSets = useMemo(() => {
    const critical = new Set<string>()
    const warning  = new Set<string>()
    conflicts.forEach(c =>
      c.chain.forEach((ch: { node_id: string }) => {
        if (c.severity === 'critical') critical.add(ch.node_id)
        else warning.add(ch.node_id)
      })
    )
    return { critical, warning }
  }, [conflicts])

  const rfNodesFromStore = useMemo(() => {
    const critSet = new Set(criticalPath?.critical_path_node_ids ?? [])
    return nodes.map(n => ({
      id: n.id,
      type: 'synapse',
      position: { x: n.position_x, y: n.position_y },
      data: {
        label: n.label,
        category: n.category,
        status: n.status,
        priority: n.priority,
        effort_value: n.effort_value ?? undefined,
        effort_unit: n.effort_unit ?? undefined,
        deadline: n.deadline ?? undefined,
        color_override: n.color_override ?? undefined,
        ai_category_confidence: n.ai_category_confidence ?? undefined,
        isConflictCritical: conflictSets.critical.has(n.id),
        isConflictWarning: conflictSets.warning.has(n.id),
        isOnCriticalPath: critSet.has(n.id),
        isRippleDimmed: rippleNodeId !== null && rippleNodeId !== n.id,
      } as SynapseNodeData,
    } as RFNode<SynapseNodeData>))
  }, [nodes, conflictSets, criticalPath, rippleNodeId])

  const rfEdgesFromStore = useMemo(() =>
    edges.map(e => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      type: 'synapse',
      data: { edge_type: e.edge_type, label: e.label ?? undefined } as SynapseEdgeData,
      markerEnd: EDGE_TYPE_STYLES[e.edge_type].markerEnd
        ? { type: MarkerType.ArrowClosed, color: EDGE_TYPE_STYLES[e.edge_type].color }
        : undefined,
    } as RFEdge<SynapseEdgeData>))
  , [edges])

  // ── Sync Zustand → local RF state ─────────────────────────────────────────
  // useLayoutEffect fires synchronously before the browser paints.
  // State updates inside it are flushed in the same paint frame.
  // This ensures create/delete/undo appear instantly without a refresh.
  //
  // During drag: rfNodesFromStore doesn't change (we only write to Zustand on dragStop),
  // so these effects don't fire during drag → no position snap.

  useLayoutEffect(() => {
    setRfNodes(rfNodesFromStore)
  }, [rfNodesFromStore]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    setRfEdges(rfEdgesFromStore)
  }, [rfEdgesFromStore]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fit view after initial nodes load
  useEffect(() => {
    if (!hasFitView.current && rfNodes.length > 0) {
      hasFitView.current = true
      reactFlow.fitView({ padding: 0.3, maxZoom: 1 })
    }
  }, [rfNodes.length, reactFlow])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const { mutate: createNode } = useMutation({
    mutationFn: (pos: { x: number; y: number }) =>
      nodesApi.create(mapId, {
        label: 'New node',
        category: 'feature',
        status: 'todo',
        priority: 'medium',
        position_x: Math.round(pos.x),
        position_y: Math.round(pos.y),
      }),
    onSuccess: ({ node, conflicts: c, critical_path }) => {
      addNode(node as any)
      setConflicts(c, critical_path)
    },
    onError: (err: Error) => addToast({ type: 'error', message: err.message }),
  })

  const { mutate: createEdgeMutation } = useMutation({
    mutationFn: ({ connection, edgeType }: { connection: Connection; edgeType: EdgeType }) =>
      edgesApi.create(mapId, {
        source_node_id: connection.source!,
        target_node_id: connection.target!,
        edge_type: edgeType,
      }),
    onSuccess: ({ edge, conflicts: c, critical_path }) => {
      addEdge(edge as any)
      setPendingConnection(null)
      setConflicts(c, critical_path)
    },
    onError: (err: Error) => {
      addToast({ type: 'error', message: err.message })
      setPendingConnection(null)
    },
  })

  const { mutate: bulkSavePositions } = useMutation({
    mutationFn: (updates: Array<{ id: string; position_x: number; position_y: number }>) =>
      nodesApi.bulkUpdate(mapId, updates),
    onError: (err: Error) => addToast({ type: 'error', message: err.message }),
  })

  // ── Canvas event handlers ──────────────────────────────────────────────────

  const onNodesChange = useCallback(
    (changes: NodeChange<RFNode<SynapseNodeData>>[]) => {
      handleNodesChange(changes)
      changes.forEach(c => {
        if (c.type === 'select') {
          selectNode(c.selected ? c.id : null)
          if (c.selected) setActivePanel('node-detail')
        }
      })
    },
    [handleNodesChange, selectNode, setActivePanel]
  )

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: RFNode<SynapseNodeData>) => {
      const pos = { x: Math.round(node.position.x), y: Math.round(node.position.y) }
      // Commit position to Zustand (triggers rfNodesFromStore recompute → setRfNodes)
      updateNode(node.id, { position_x: pos.x, position_y: pos.y })
      // Batch API saves with 500ms debounce
      pendingPositionUpdates.current.set(node.id, pos)
      if (positionSaveTimer.current) clearTimeout(positionSaveTimer.current)
      positionSaveTimer.current = setTimeout(() => {
        const updates = Array.from(pendingPositionUpdates.current.entries()).map(
          ([id, p]) => ({ id, position_x: p.x, position_y: p.y })
        )
        pendingPositionUpdates.current.clear()
        if (updates.length) bulkSavePositions(updates)
      }, 500)
    },
    [updateNode, bulkSavePositions]
  )

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: RFNode<SynapseNodeData>) => {
      e.preventDefault()
      setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY })
    },
    []
  )

  const onPaneClick = useCallback(() => {
    selectNode(null)
    setActivePanel(null)
    setContextMenu(null)
  }, [selectNode, setActivePanel])

  const onContainerDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      if (target.closest('.react-flow__node') || target.closest('.react-flow__edge')) return
      createNode(reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY }))
    },
    [reactFlow, createNode]
  )

  const onConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) pendingConnRef.current = connection
  }, [])

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    if (!pendingConnRef.current) return
    const mouseX = 'clientX' in event ? event.clientX : (event as TouchEvent).touches[0]?.clientX ?? 0
    const mouseY = 'clientY' in event ? event.clientY : (event as TouchEvent).touches[0]?.clientY ?? 0
    setPendingConnection({ connection: pendingConnRef.current, mouseX, mouseY })
    pendingConnRef.current = null
  }, [])

  const onEdgeTypeSelect = useCallback(
    (edgeType: EdgeType) => {
      if (!pendingConnection) return
      createEdgeMutation({ connection: pendingConnection.connection, edgeType })
    },
    [pendingConnection, createEdgeMutation]
  )

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  const handlePaletteSelect = useCallback(
    (node: { position_x: number; position_y: number; id: string }) => {
      selectNode(node.id)
      setActivePanel('node-detail')
      // Center viewport on the node with a smooth zoom
      reactFlow.setCenter(
        node.position_x + 100,
        node.position_y + 40,
        { zoom: 1.2, duration: 400 }
      )
    },
    [reactFlow, selectNode, setActivePanel]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        createNode(reactFlow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && ((e.shiftKey && e.key === 'z') || e.key === 'y')) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [reactFlow, createNode, undo, redo, setCommandPaletteOpen])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full" onDoubleClick={onContainerDoubleClick}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd as any}
        onNodeDragStop={onNodeDragStop as any}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu as any}
        connectionMode={ConnectionMode.Loose}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} color="#E5E7EB" />
        <MiniMap
          nodeStrokeWidth={3}
          style={{ borderRadius: 12, border: '1px solid #E5E7EB', bottom: 16, right: 16 }}
          pannable
          zoomable
        />
        {selectedNodeId && (
          <NodeToolbar nodeId={selectedNodeId} isVisible position={Position.Top} offset={8}>
            <NodeToolbarContent nodeId={selectedNodeId} mapId={mapId} onConnect={() => {}} />
          </NodeToolbar>
        )}
      </ReactFlow>

      {pendingConnection && (
        <EdgeTypePicker
          x={pendingConnection.mouseX}
          y={pendingConnection.mouseY}
          onSelect={onEdgeTypeSelect}
          onDismiss={() => { setPendingConnection(null); pendingConnRef.current = null }}
        />
      )}

      {contextMenu && (
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          mapId={mapId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      {commandPaletteOpen && (
        <CommandPalette onSelectNode={handlePaletteSelect} />
      )}
    </div>
  )
}

// ── Public component — wraps with ReactFlowProvider ────────────────────────

function SynapseCanvas({ mapId }: { mapId: string }) {
  return (
    <ReactFlowProvider>
      <SynapseCanvasInner mapId={mapId} />
    </ReactFlowProvider>
  )
}

export default memo(SynapseCanvas)
