import { memo, useCallback } from 'react'
import { useCanvasStore } from '../../store/canvas.store'
import { useUIStore } from '../../store/ui.store'
import { useMutation } from '@tanstack/react-query'
import { nodesApi } from '../../services/api.client'

interface NodeToolbarProps {
  nodeId: string
  mapId: string
  onConnect: () => void
}

function NodeToolbar({ nodeId, mapId, onConnect }: NodeToolbarProps) {
  const deleteNode = useCanvasStore(s => s.deleteNode)
  const addNode = useCanvasStore(s => s.addNode)
  const selectNode = useCanvasStore(s => s.selectNode)
  const setConflicts = useCanvasStore(s => s.setConflicts)
  const nodes = useCanvasStore(s => s.nodes)
  const addToast = useUIStore(s => s.addToast)
  const setActivePanel = useUIStore(s => s.setActivePanel)

  const node = nodes.find(n => n.id === nodeId)

  const { mutate: deleteRemote } = useMutation({
    mutationFn: () => nodesApi.delete(mapId, nodeId),
    onSuccess: ({ conflicts, critical_path }) => {
      deleteNode(nodeId)
      setConflicts(conflicts, critical_path)
    },
    onError: (err: Error) => addToast({ type: 'error', message: err.message }),
  })

  const { mutate: duplicateRemote } = useMutation({
    mutationFn: () => nodesApi.create(mapId, {
      label: `${node?.label ?? 'Node'} (copy)`,
      category: node?.category ?? 'feature',
      status: node?.status ?? 'todo',
      priority: node?.priority ?? 'medium',
      position_x: (node?.position_x ?? 0) + 220,
      position_y: node?.position_y ?? 0,
      effort_value: node?.effort_value ?? undefined,
      effort_unit: node?.effort_unit ?? undefined,
    }),
    onSuccess: ({ node: newNode }) => {
      addNode(newNode as any)
      selectNode(newNode.id)
    },
    onError: (err: Error) => addToast({ type: 'error', message: err.message }),
  })

  const handleDelete = useCallback(() => {
    const connectedEdges = useCanvasStore.getState().edges.filter(
      e => e.source_node_id === nodeId || e.target_node_id === nodeId
    )
    const hasChildren = useCanvasStore.getState().nodes.some(n => n.parent_id === nodeId)

    if (hasChildren || connectedEdges.length >= 3) {
      const msg = hasChildren
        ? `This node has children and ${connectedEdges.length} connection(s). Delete anyway?`
        : `This node has ${connectedEdges.length} connections. Delete anyway?`
      if (!confirm(msg)) return
    }
    deleteRemote()
  }, [nodeId, deleteRemote])

  const handleEdit = useCallback(() => {
    selectNode(nodeId)
    setActivePanel('node-detail')
  }, [nodeId, selectNode, setActivePanel])

  return (
    <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-lg px-1 py-1">
      <ToolbarButton onClick={handleEdit} title="Edit details">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </ToolbarButton>

      <ToolbarButton onClick={onConnect} title="Connect to…">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </ToolbarButton>

      <ToolbarButton onClick={() => duplicateRemote()} title="Duplicate">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </ToolbarButton>

      <div className="w-px h-4 bg-gray-200 mx-0.5" />

      <ToolbarButton onClick={handleDelete} title="Delete" danger>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </ToolbarButton>
    </div>
  )
}

function ToolbarButton({
  onClick, title, danger = false, children
}: {
  onClick: () => void
  title: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        danger
          ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

export default memo(NodeToolbar)
