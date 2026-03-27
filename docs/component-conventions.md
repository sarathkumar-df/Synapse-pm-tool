# Synapse Frontend Component Conventions

Read before building any React component.

## Component Structure
```
src/components/
├── canvas/           → React Flow canvas components (nodes, edges, overlays)
│   ├── SynapseCanvas.tsx        → Main React Flow wrapper
│   ├── SynapseNode.tsx          → Custom node renderer
│   ├── SynapseEdge.tsx          → Custom edge renderer
│   ├── NodeToolbar.tsx          → Floating toolbar above selected node
│   ├── Minimap.tsx              → Bottom-right minimap
│   ├── RippleOverlay.tsx        → Ripple mode dimming overlay
│   └── WhatIfBanner.tsx         → What-If mode top banner
├── panels/           → Slide-out side panels
│   ├── NodeDetailPanel.tsx      → Right panel: node properties
│   ├── ConflictsPanel.tsx       → Left panel: conflict list
│   └── SnapshotsPanel.tsx       → Right panel: snapshot list
├── toolbar/          → Top toolbar
│   ├── Toolbar.tsx              → Main toolbar container
│   └── FilterBar.tsx            → Collapsible filter bar
├── modals/           → Modal dialogs
│   ├── NlToMapModal.tsx         → Natural language import
│   ├── ExportModal.tsx          → PDF/image export options
│   ├── ShareModal.tsx           → Share link generation
│   └── SnapshotModal.tsx        → Create snapshot dialog
└── shared/           → Reusable UI atoms
    ├── Toast.tsx                → Toast notifications
    ├── CommandPalette.tsx       → Cmd+K command palette
    ├── Tooltip.tsx              → Tooltip wrapper
    └── Badge.tsx                → Status/effort/category badges
```

## Component Template
```typescript
import type { FC } from 'react'

interface SynapseNodeProps {
  id: string
  data: NodeData  // from docs/contracts/entities.ts
  selected: boolean
}

const SynapseNode: FC<SynapseNodeProps> = ({ id, data, selected }) => {
  // hooks first
  const updateNode = useCanvasStore(s => s.updateNode)

  // derived values
  const borderColor = NODE_CATEGORY_COLORS[data.category]

  // handlers
  const handleClick = useCallback(() => {
    // ...
  }, [id])

  return (
    <div className="...">
      {/* JSX */}
    </div>
  )
}

export default React.memo(SynapseNode)  // Always memo canvas components
```

## Canvas Performance Rules
- Wrap all custom node/edge components in `React.memo`
- All event handlers in node/edge components: `useCallback`
- Never calculate `NODE_CATEGORY_COLORS[category]` inline — precompute in constants
- Zustand selectors: always select minimum state (`s => s.nodes` not `s => s`)
- Debounce position saves: 500ms after drag end

## Node Category Styling
```typescript
// src/constants/node-categories.ts
export const NODE_CATEGORY_COLORS = {
  feature:    { border: '#2E75B6', bg: '#EBF5FB' },
  risk:       { border: '#E65100', bg: '#FFF3E0' },
  blocker:    { border: '#C62828', bg: '#FFEBEE' },
  dependency: { border: '#7B1FA2', bg: '#F3E5F5' },
  question:   { border: '#F9A825', bg: '#FFFDE7' },
  assumption: { border: '#00897B', bg: '#E0F2F1' },
  milestone:  { border: '#1B5E20', bg: '#E8F5E9' },
  note:       { border: '#757575', bg: '#FAFAFA' },
} as const
```

## Panel Animation
All side panels use Framer Motion slide-in:
```typescript
// Right panel slide-in
<motion.div
  initial={{ x: 400 }}
  animate={{ x: 0 }}
  exit={{ x: 400 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
  className="fixed right-0 top-0 h-full w-[400px] bg-white shadow-xl z-30"
>
```

## Zustand Store Pattern
```typescript
// src/store/canvas.store.ts
interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  // ... actions
  addNode: (node: Node) => void
  updateNode: (id: string, updates: Partial<Node>) => void
}

export const useCanvasStore = create<CanvasState>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  addNode: (node) => set(state => ({ nodes: [...state.nodes, node] })),
  updateNode: (id, updates) => set(state => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
  })),
}))
```

## React Query for Server State
```typescript
// Fetch map data
const { data, isLoading } = useQuery({
  queryKey: ['map', mapId],
  queryFn: () => apiClient.maps.get(mapId),
})

// Mutate with optimistic update
const { mutate } = useMutation({
  mutationFn: (update: UpdateNodeRequest) => apiClient.nodes.update(nodeId, update),
  onMutate: async (update) => {
    // Optimistically update Zustand store
    useCanvasStore.getState().updateNode(nodeId, update)
  },
  onError: () => {
    // Revert optimistic update
    queryClient.invalidateQueries({ queryKey: ['map', mapId] })
  }
})
```

## TailwindCSS Rules
- Use utility classes only — no inline styles except canvas positioning (`style={{ left: x, top: y }}`)
- Dark mode: `dark:` prefix (Phase 3 feature — add `dark:` variants during component build)
- Custom colors: don't extend tailwind.config — use inline hex for dynamic category colors
- Animation: use `animate-` utilities for simple cases, Framer Motion for complex

## Toast Notifications
```typescript
// Use ui.store.ts
const addToast = useUIStore(s => s.addToast)
addToast({ type: 'success', message: 'Node created' })
addToast({ type: 'error', message: 'Failed to save' })
addToast({ type: 'warning', message: 'Maximum nesting depth reached. Consider restructuring.' })
```
