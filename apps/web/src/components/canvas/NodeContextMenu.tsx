import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useCanvasStore } from '../../store/canvas.store'
import { useUIStore } from '../../store/ui.store'
import { nodesApi } from '../../services/api.client'
import { NODE_CATEGORY_COLORS } from '../../constants/node-categories'
import type { NodeCategory, EffortUnit } from '@synapse/shared'

interface Props {
  nodeId: string
  mapId: string
  x: number
  y: number
  onClose: () => void
}

// ── Sub-panel types ─────────────────────────────────────────────────────────
type SubPanel = 'category' | 'effort' | 'deadline' | null

// ── Small helpers ───────────────────────────────────────────────────────────

function Divider() {
  return <div className="my-1 border-t border-gray-100" />
}

function MenuItem({
  onClick,
  label,
  danger = false,
  hasArrow = false,
  icon,
}: {
  onClick: () => void
  label: string
  danger?: boolean
  hasArrow?: boolean
  icon: React.ReactNode
}) {
  return (
    <button
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClick() }}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors text-left ${
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {hasArrow && (
        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  )
}

function SubPanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <button
        onClick={onBack}
        className="p-0.5 rounded hover:bg-gray-100 transition-colors text-gray-500"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</span>
    </div>
  )
}

// ── Icons ───────────────────────────────────────────────────────────────────

const EditIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const DuplicateIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const CategoryIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
  </svg>
)

const EffortIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const DeadlineIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const AddChildIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ConnectIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
)

const LinkIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M8 8h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2v-8a2 2 0 012-2z" />
  </svg>
)

const DeleteIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

// ── Main component ──────────────────────────────────────────────────────────

const CATEGORIES: NodeCategory[] = [
  'feature', 'risk', 'blocker', 'dependency',
  'question', 'assumption', 'milestone', 'note',
]

const EFFORT_UNITS: { value: EffortUnit; label: string }[] = [
  { value: 'hours', label: 'hours' },
  { value: 'days', label: 'days' },
  { value: 'story_points', label: 'pts' },
]

function NodeContextMenu({ nodeId, mapId, x, y, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [subPanel, setSubPanel] = useState<SubPanel>(null)

  // Store selectors
  const nodes       = useCanvasStore(s => s.nodes)
  const addNode     = useCanvasStore(s => s.addNode)
  const deleteNode  = useCanvasStore(s => s.deleteNode)
  const updateNode  = useCanvasStore(s => s.updateNode)
  const selectNode  = useCanvasStore(s => s.selectNode)
  const setConflicts = useCanvasStore(s => s.setConflicts)
  const addToast    = useUIStore(s => s.addToast)
  const setActivePanel = useUIStore(s => s.setActivePanel)

  const node = nodes.find(n => n.id === nodeId)

  // Effort local state (pre-filled from current node)
  const [effortValue, setEffortValue] = useState<string>(
    node?.effort_value?.toString() ?? ''
  )
  const [effortUnit, setEffortUnit] = useState<EffortUnit>(
    node?.effort_unit ?? 'hours'
  )

  // ── Dismiss on Escape / click outside ──────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('mousedown', handleMouseDown)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [onClose])

  // ── Mutations ───────────────────────────────────────────────────────────────

  const { mutate: deleteRemote, isPending: isDeleting } = useMutation({
    mutationFn: () => nodesApi.delete(mapId, nodeId),
    onSuccess: ({ conflicts, critical_path }) => {
      deleteNode(nodeId)
      setConflicts(conflicts, critical_path)
      onClose()
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
    }),
    onSuccess: ({ node: newNode, conflicts: c, critical_path }) => {
      addNode(newNode as any)
      setConflicts(c, critical_path)
      selectNode(newNode.id)
      onClose()
    },
    onError: (err: Error) => addToast({ type: 'error', message: err.message }),
  })

  const { mutate: addChildRemote } = useMutation({
    mutationFn: () => nodesApi.create(mapId, {
      label: 'Child node',
      category: node?.category ?? 'feature',
      status: 'todo',
      priority: 'medium',
      parent_id: nodeId,
      position_x: (node?.position_x ?? 0) + 240,
      position_y: (node?.position_y ?? 0) + 120,
    }),
    onSuccess: ({ node: newNode, conflicts: c, critical_path }) => {
      addNode(newNode as any)
      setConflicts(c, critical_path)
      selectNode(newNode.id)
      setActivePanel('node-detail')
      onClose()
    },
    onError: (err: Error) => addToast({ type: 'error', message: err.message }),
  })

  const { mutate: updateRemote, isPending: isUpdating } = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      nodesApi.update(mapId, nodeId, updates as any),
    onSuccess: ({ node: updated, conflicts: c, critical_path }) => {
      updateNode(nodeId, updated as any)
      setConflicts(c, critical_path)
      onClose()
    },
    onError: (err: Error) => addToast({ type: 'error', message: err.message }),
  })

  // ── Action handlers ─────────────────────────────────────────────────────────

  const handleEdit = useCallback(() => {
    selectNode(nodeId)
    setActivePanel('node-detail')
    onClose()
  }, [nodeId, selectNode, setActivePanel, onClose])

  const handleDelete = useCallback(() => {
    const { edges, nodes: allNodes } = useCanvasStore.getState()
    const connectedEdges = edges.filter(
      e => e.source_node_id === nodeId || e.target_node_id === nodeId
    )
    const hasChildren = allNodes.some(n => n.parent_id === nodeId)

    if (hasChildren || connectedEdges.length >= 3) {
      const msg = hasChildren
        ? `This node has children and ${connectedEdges.length} connection(s). Delete anyway?`
        : `This node has ${connectedEdges.length} connections. Delete anyway?`
      if (!confirm(msg)) return
    }
    deleteRemote()
  }, [nodeId, deleteRemote])

  const handleConnectTo = useCallback(() => {
    selectNode(nodeId)
    addToast({ type: 'info', message: 'Drag a handle from this node to connect' })
    onClose()
  }, [nodeId, selectNode, addToast, onClose])

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.href.split('#')[0]}#node-${nodeId}`
    navigator.clipboard.writeText(url).then(() => {
      addToast({ type: 'success', message: 'Link copied to clipboard' })
      onClose()
    }).catch(() => {
      addToast({ type: 'error', message: 'Could not copy link' })
    })
  }, [nodeId, addToast, onClose])

  const handleSaveEffort = useCallback(() => {
    const val = parseFloat(effortValue)
    if (isNaN(val) || val < 0) {
      addToast({ type: 'error', message: 'Enter a valid effort value' })
      return
    }
    updateRemote({ effort_value: val, effort_unit: effortUnit })
  }, [effortValue, effortUnit, updateRemote, addToast])

  // ── Position — clamp to viewport ────────────────────────────────────────────
  const menuWidth  = 208
  const menuHeight = 320 // approximate, avoids overflow
  const left = Math.min(x, window.innerWidth  - menuWidth  - 8)
  const top  = Math.min(y, window.innerHeight - menuHeight - 8)

  if (!node) return null

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left, top, zIndex: 1000, minWidth: menuWidth }}
      className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 select-none"
      onContextMenu={e => e.preventDefault()}
    >
      {/* ── Main menu ────────────────────────────────────────────────────── */}
      {subPanel === null && (
        <>
          <MenuItem onClick={handleEdit}            label="Edit details"     icon={<EditIcon />} />
          <MenuItem onClick={() => duplicateRemote()} label="Duplicate"      icon={<DuplicateIcon />} />
          <Divider />
          <MenuItem onClick={() => setSubPanel('category')} label="Change category" icon={<CategoryIcon />} hasArrow />
          <MenuItem onClick={() => setSubPanel('effort')}   label="Set effort"      icon={<EffortIcon />}   hasArrow />
          <MenuItem onClick={() => setSubPanel('deadline')} label="Set deadline"    icon={<DeadlineIcon />} hasArrow />
          <Divider />
          <MenuItem onClick={() => addChildRemote()} label="Add child"   icon={<AddChildIcon />} />
          <MenuItem onClick={handleConnectTo}        label="Connect to…" icon={<ConnectIcon />} />
          <MenuItem onClick={handleCopyLink}         label="Copy link"   icon={<LinkIcon />} />
          <Divider />
          <MenuItem onClick={handleDelete} label={isDeleting ? 'Deleting…' : 'Delete'} icon={<DeleteIcon />} danger />
        </>
      )}

      {/* ── Category sub-panel ───────────────────────────────────────────── */}
      {subPanel === 'category' && (
        <div className="px-3 py-2">
          <SubPanelHeader title="Category" onBack={() => setSubPanel(null)} />
          <div className="grid grid-cols-2 gap-1">
            {CATEGORIES.map(cat => {
              const { border, bg } = NODE_CATEGORY_COLORS[cat]
              const isActive = node.category === cat
              return (
                <button
                  key={cat}
                  onClick={() => updateRemote({ category: cat })}
                  disabled={isUpdating}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${isActive ? 'ring-2 ring-offset-1 ring-current' : 'hover:opacity-90'}`}
                  style={{
                    background: bg,
                    borderLeft: `3px solid ${border}`,
                    color: border,
                  }}
                >
                  <span className="capitalize truncate">{cat}</span>
                  {isActive && (
                    <svg className="w-2.5 h-2.5 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Effort sub-panel ─────────────────────────────────────────────── */}
      {subPanel === 'effort' && (
        <div className="px-3 py-2">
          <SubPanelHeader title="Set effort" onBack={() => setSubPanel(null)} />
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              step={0.5}
              value={effortValue}
              onChange={e => setEffortValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveEffort() }}
              placeholder="0"
              autoFocus
              className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={effortUnit}
              onChange={e => setEffortUnit(e.target.value as EffortUnit)}
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EFFORT_UNITS.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSaveEffort}
            disabled={isUpdating}
            className="mt-2 w-full bg-blue-600 text-white text-sm rounded-lg py-1.5 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isUpdating ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {/* ── Deadline sub-panel ───────────────────────────────────────────── */}
      {subPanel === 'deadline' && (
        <div className="px-3 py-2">
          <SubPanelHeader title="Set deadline" onBack={() => setSubPanel(null)} />
          <input
            type="date"
            defaultValue={node.deadline ? node.deadline.split('T')[0] : ''}
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={e => {
              if (e.target.value) updateRemote({ deadline: new Date(e.target.value).toISOString() })
            }}
          />
          {node.deadline && (
            <button
              onClick={() => updateRemote({ deadline: null })}
              className="mt-1.5 w-full text-xs text-gray-500 hover:text-red-500 transition-colors py-1"
            >
              Clear deadline
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(NodeContextMenu)
