import { memo, useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { useCanvasStore } from '../../store/canvas.store'
import { useUIStore } from '../../store/ui.store'
import { nodesApi } from '../../services/api.client'
import { NODE_CATEGORY_COLORS, EDGE_TYPE_STYLES } from '../../constants/node-categories'
import type { Node } from '../../../../docs/contracts/entities'
import type { NodeCategory, NodeStatus, NodePriority, EffortUnit, EdgeType } from '@synapse/shared'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: NodeCategory[] = [
  'feature', 'risk', 'blocker', 'dependency', 'question', 'assumption', 'milestone', 'note',
]

const STATUSES: { value: NodeStatus; label: string }[] = [
  { value: 'todo',        label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
  { value: 'blocked',     label: 'Blocked' },
  { value: 'cancelled',   label: 'Cancelled' },
]

const PRIORITIES: { value: NodePriority; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: '#C62828' },
  { value: 'high',     label: 'High',     color: '#E65100' },
  { value: 'medium',   label: 'Medium',   color: '#F9A825' },
  { value: 'low',      label: 'Low',      color: '#757575' },
]

const EFFORT_UNITS: { value: EffortUnit; label: string }[] = [
  { value: 'hours',        label: 'Hours' },
  { value: 'days',         label: 'Days' },
  { value: 'story_points', label: 'Points' },
]

const PRESET_COLORS = [
  '#2E75B6', '#E65100', '#C62828', '#7B1FA2',
  '#F9A825', '#00897B', '#1B5E20', '#757575',
]

const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  dependency: 'Dependency',
  related:    'Related',
  blocks:     'Blocks',
  triggers:   'Triggers',
  informs:    'Informs',
}

type SaveState = 'idle' | 'saving' | 'saved'
type PanelTab  = 'details' | 'connections'

// ─── Main panel ───────────────────────────────────────────────────────────────

function NodeDetailPanel({ mapId }: { mapId: string }) {
  const activePanel    = useUIStore(s => s.activePanel)
  const setActivePanel = useUIStore(s => s.setActivePanel)
  const addToast       = useUIStore(s => s.addToast)
  const selectedNodeId = useCanvasStore(s => s.selectedNodeId)
  const nodes          = useCanvasStore(s => s.nodes)
  const edges          = useCanvasStore(s => s.edges)
  const updateNode     = useCanvasStore(s => s.updateNode)
  const setConflicts   = useCanvasStore(s => s.setConflicts)

  const node   = nodes.find(n => n.id === selectedNodeId) ?? null
  const isOpen = activePanel === 'node-detail' && !!node

  const [activeTab, setActiveTab] = useState<PanelTab>('details')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const savedTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUpdates = useRef<Partial<Node>>({})
  const currentNodeId  = useRef<string | null>(null)

  const { mutate: saveMutation } = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Node> }) =>
      nodesApi.update(mapId, id, updates as any),
    onSuccess: ({ conflicts, critical_path }) => {
      setConflicts(conflicts, critical_path)
      setSaveState('saved')
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2000)
    },
    onError: (err: Error) => {
      setSaveState('idle')
      addToast({ type: 'error', message: err.message })
    },
  })

  // Flush pending save immediately when the selected node changes
  useEffect(() => {
    const prevId = currentNodeId.current
    currentNodeId.current = selectedNodeId

    return () => {
      if (saveTimerRef.current && prevId) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
        const toSave = { ...pendingUpdates.current }
        pendingUpdates.current = {}
        if (Object.keys(toSave).length > 0) {
          nodesApi.update(mapId, prevId, toSave as any).catch(() => {})
        }
      }
    }
  }, [selectedNodeId, mapId])

  const scheduleFieldSave = useCallback((updates: Partial<Node>) => {
    if (!node) return
    updateNode(node.id, updates as any)
    pendingUpdates.current = { ...pendingUpdates.current, ...updates }
    setSaveState('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const toSave = { ...pendingUpdates.current }
      pendingUpdates.current = {}
      saveMutation({ id: node.id, updates: toSave })
    }, 500)
  }, [node, updateNode, saveMutation])

  // Compute connections
  const parent   = node?.parent_id ? (nodes.find(n => n.id === node.parent_id) ?? null) : null
  const children = node ? nodes.filter(n => n.parent_id === node.id) : []
  const edgesByType = node
    ? edges
        .filter(e => e.source_node_id === node.id || e.target_node_id === node.id)
        .reduce<Record<string, { node: Node; direction: 'out' | 'in' }[]>>((acc, e) => {
          const isSource = e.source_node_id === node.id
          const otherId  = isSource ? e.target_node_id : e.source_node_id
          const other    = nodes.find(n => n.id === otherId)
          if (!other) return acc
          if (!acc[e.edge_type]) acc[e.edge_type] = []
          acc[e.edge_type].push({ node: other, direction: isSource ? 'out' : 'in' })
          return acc
        }, {})
    : {}

  return (
    <AnimatePresence>
      {isOpen && node && (
        <motion.aside
          key="node-detail-panel"
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-[400px] shrink-0 h-full bg-white border-l border-gray-200 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: NODE_CATEGORY_COLORS[node.category].border }}
            />
            <span className="text-sm font-medium text-gray-800 truncate flex-1">{node.label}</span>
            {saveState === 'saving' && (
              <span className="text-[11px] text-gray-400 shrink-0">Saving…</span>
            )}
            {saveState === 'saved' && (
              <span className="text-[11px] text-green-500 shrink-0">Saved ✓</span>
            )}
            <button
              onClick={() => setActivePanel(null)}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              title="Close panel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 shrink-0">
            {(['details', 'connections'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
                {tab === 'connections' && (
                  Object.keys(edgesByType).length + (parent ? 1 : 0) + children.length > 0
                    ? ` (${Object.values(edgesByType).flat().length + (parent ? 1 : 0) + children.length})`
                    : ''
                )}
              </button>
            ))}
          </div>

          {/* Scrollable content — key forces remount when node changes, resetting uncontrolled inputs */}
          <div key={node.id} className="flex-1 overflow-y-auto">
            {activeTab === 'details' ? (
              <DetailsTab node={node} onSave={scheduleFieldSave} />
            ) : (
              <ConnectionsTab
                node={node}
                parent={parent}
                children={children}
                edgesByType={edgesByType}
              />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

// ─── Details tab ──────────────────────────────────────────────────────────────

function DetailsTab({ node, onSave }: {
  node: Node
  onSave: (updates: Partial<Node>) => void
}) {
  return (
    <div className="p-4 space-y-5">

      {/* Label */}
      <Field label="Label">
        <input
          type="text"
          defaultValue={node.label}
          onBlur={e => {
            const v = e.target.value.trim()
            if (v && v !== node.label) onSave({ label: v })
          }}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </Field>

      {/* Description */}
      <Field label="Description">
        <textarea
          defaultValue={node.description ?? ''}
          onBlur={e => {
            const v = e.target.value.trim() || undefined
            if (v !== (node.description ?? undefined)) onSave({ description: v })
          }}
          rows={4}
          placeholder="Add a description… (markdown supported)"
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none leading-snug"
        />
      </Field>

      {/* Category */}
      <Field label="Category">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => {
            const active = node.category === cat
            return (
              <button
                key={cat}
                onClick={() => onSave({ category: cat })}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors capitalize ${
                  active
                    ? 'border-transparent text-white'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
                style={active ? { backgroundColor: NODE_CATEGORY_COLORS[cat].border } : {}}
              >
                {NODE_CATEGORY_COLORS[cat].icon} {cat}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Status */}
      <Field label="Status">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map(s => {
            const active = node.status === s.value
            return (
              <button
                key={s.value}
                onClick={() => onSave({ status: s.value })}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  active
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Priority */}
      <Field label="Priority">
        <div className="flex gap-1.5">
          {PRIORITIES.map(p => {
            const active = node.priority === p.value
            return (
              <button
                key={p.value}
                onClick={() => onSave({ priority: p.value })}
                className={`flex-1 py-1.5 rounded text-[11px] font-medium border transition-colors ${
                  active
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
                style={active ? { backgroundColor: p.color, borderColor: p.color } : {}}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Effort */}
      <Field label="Effort">
        <div className="flex gap-2">
          <input
            type="number"
            defaultValue={node.effort_value ?? ''}
            min={0}
            step={0.5}
            placeholder="—"
            onBlur={e => {
              const raw = e.target.value
              const v   = raw === '' ? undefined : parseFloat(raw)
              if (v !== node.effort_value) onSave({ effort_value: v })
            }}
            className="w-20 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <select
            value={node.effort_unit ?? 'hours'}
            onChange={e => onSave({ effort_unit: e.target.value as EffortUnit })}
            className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          >
            {EFFORT_UNITS.map(u => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
      </Field>

      {/* Deadline */}
      <Field label="Deadline">
        <div className="flex gap-2 items-center">
          <input
            type="date"
            defaultValue={node.deadline ? node.deadline.slice(0, 10) : ''}
            onChange={e => {
              const v = e.target.value
              onSave({ deadline: v ? new Date(v + 'T00:00:00Z').toISOString() : undefined })
            }}
            className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {node.deadline && (
            <button
              onClick={() => onSave({ deadline: undefined })}
              className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
              title="Clear deadline"
            >
              Clear
            </button>
          )}
        </div>
      </Field>

      {/* Color override */}
      <Field label="Color">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() =>
                  onSave({ color_override: node.color_override === color ? undefined : color })
                }
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: color,
                  borderColor: node.color_override === color ? '#1a1a1a' : 'transparent',
                }}
                title={color}
              />
            ))}
          </div>
          {node.color_override && (
            <button
              onClick={() => onSave({ color_override: undefined })}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </Field>

    </div>
  )
}

// ─── Connections tab ──────────────────────────────────────────────────────────

function ConnectionsTab({ parent, children, edgesByType }: {
  node?: Node
  parent: Node | null
  children: Node[]
  edgesByType: Record<string, { node: Node; direction: 'out' | 'in' }[]>
}) {
  const isEmpty = !parent && children.length === 0 && Object.keys(edgesByType).length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400">
        <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <p className="text-sm">No connections yet</p>
        <p className="text-xs mt-1">Drag from a handle to connect nodes</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">

      {/* Parent */}
      {parent && (
        <section>
          <SectionHeader label="Parent" count={1} />
          <NodeChip node={parent} />
        </section>
      )}

      {/* Children */}
      {children.length > 0 && (
        <section>
          <SectionHeader label="Children" count={children.length} />
          <div className="space-y-1">
            {children.map(child => <NodeChip key={child.id} node={child} />)}
          </div>
        </section>
      )}

      {/* Edges by type */}
      {Object.entries(edgesByType).map(([type, conns]) => (
        <section key={type}>
          <SectionHeader
            label={EDGE_TYPE_LABELS[type as EdgeType] ?? type}
            count={conns.length}
            color={EDGE_TYPE_STYLES[type as EdgeType]?.color}
          />
          <div className="space-y-1">
            {conns.map(({ node: other, direction }, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-5 text-right shrink-0">
                  {direction === 'out' ? '→' : '←'}
                </span>
                <NodeChip node={other} />
              </div>
            ))}
          </div>
        </section>
      ))}

    </div>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
        {label}
      </p>
      {children}
    </div>
  )
}

function SectionHeader({ label, count, color }: { label: string; count: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      {color && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-[11px] text-gray-400">({count})</span>
    </div>
  )
}

function NodeChip({ node }: { node: Node }) {
  const colors = NODE_CATEGORY_COLORS[node.category]
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-100">
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colors.border }} />
      <span className="text-xs text-gray-700 truncate">{node.label}</span>
      <span className="text-[10px] text-gray-400 ml-auto shrink-0 capitalize">{node.status.replace('_', ' ')}</span>
    </div>
  )
}

export default memo(NodeDetailPanel)
