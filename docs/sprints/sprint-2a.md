# Sprint 2a — Canvas Engine, Nodes & Edges

**Phase**: 1 — Foundation
**Depends on**: Sprint 1 (auth, map CRUD, canvas store) ✅
**Feeds into**: Sprint 2b (Node Detail Panel, nested nodes)

---

## Goal
A fully interactive mind map canvas. A user can open a map, create nodes by double-clicking, connect them with typed edges, move things around, undo mistakes, and have their work auto-saved. No panels, no nesting — just the core canvas interaction loop.

## Scope

### In
| Ticket | Feature | PRD |
|--------|---------|-----|
| SYN-201 | React Flow canvas setup — pan, zoom 10–400%, dot-grid background | §5.1.1 |
| SYN-202 | Minimap — 200×150px, bottom-right, viewport rect, click to teleport | §5.1.1 |
| SYN-203 | `SynapseNode` renderer — category left-border, icon, effort badge, deadline badge, overdue pulse | §5.1.2 |
| SYN-204 | Node creation — double-click on canvas, `N` key at viewport center | §5.1.2 |
| SYN-205 | Node selection — blue highlight, floating toolbar (Edit, Delete, Connect, Duplicate) | §5.1.3 |
| SYN-206 | Node drag — single + multi-select, snap guides (horizontal/vertical center) | §5.1.3 |
| SYN-207 | Delete node — `Delete` key, confirmation dialog if node has children or 3+ edges | §5.1.3 |
| SYN-208 | Undo/redo — Cmd+Z / Cmd+Shift+Z, 50-operation stack (wired to canvas store) | §5.1.3 |
| SYN-209 | `SynapseEdge` renderer — 5 types with distinct colors/styles, edge label | §5.1.5 |
| SYN-210 | Edge creation — drag from N/S/E/W handles, edge type selector popover after creation | §5.1.5 |
| SYN-211 | Auto-save — debounced 500ms, persists node positions + labels to API | — |

### Out (Sprint 2b)
- Node Detail Panel (right slide-out)
- Nested nodes / parent-child / Tab key
- Right-click context menu
- Multi-select bounding box with shared drag handles
- Snap-to-grid toggle
- Cmd+K command palette

---

## Contracts to Lock Before Implementation

Read `docs/contracts/entities.ts` — all node/edge types already defined.

Frontend-specific types needed (add to `apps/web/src/types/canvas.types.ts`):

```typescript
// React Flow node data shape — what SynapseNode receives as `data`
interface SynapseNodeData {
  label: string
  category: NodeCategory
  status: NodeStatus
  priority: NodePriority
  effort_value?: number
  effort_unit?: EffortUnit
  deadline?: string
  color_override?: string
  ai_category_confidence?: number
  // Runtime state (not persisted)
  isConflictCritical?: boolean
  isConflictWarning?: boolean
  isOnCriticalPath?: boolean
  isRippleDimmed?: boolean
}

// React Flow edge data shape
interface SynapseEdgeData {
  edge_type: EdgeType
  label?: string
}
```

---

## Architecture Notes

### Canvas ↔ Store sync
```
React Flow internal state (useNodesState/useEdgesState)
    ↕  onNodesChange / onEdgesChange
Zustand canvasStore (source of truth for business logic)
    ↕  mutations (optimistic)
API (persisted)
```

React Flow owns rendering. Zustand owns business state. API owns persistence.
Never bypass Zustand to call the API directly from React Flow callbacks.

### Auto-save pattern
```typescript
// Debounce position saves — fire only after drag ends
const debouncedSave = useMemo(
  () => debounce((nodes: Node[]) => bulkUpdatePositions(nodes), 500),
  []
)
onNodesChange → filter for position changes → debouncedSave
```

### Edge type → visual mapping
| Type | Color | Style | Arrow |
|------|-------|-------|-------|
| dependency | #7B1FA2 | solid 2px | yes |
| related | #999999 | dashed 2px | no |
| blocks | #C62828 | solid 3px | yes |
| triggers | #1E7D34 | solid 2px | yes |
| informs | #999999 | dotted 2px | no |

---

## Definition of Done
- [ ] Canvas renders with pan + zoom + minimap
- [ ] Double-click creates a node that enters edit mode immediately
- [ ] `N` key creates node at viewport center
- [ ] Nodes display category color, effort badge, deadline badge
- [ ] Overdue nodes pulse red
- [ ] Single-click selects node, shows floating toolbar
- [ ] Drag moves node(s), snap guides appear near other nodes
- [ ] Delete key with confirmation removes node + connected edges
- [ ] Cmd+Z undoes last operation, Cmd+Shift+Z redoes
- [ ] Dragging from a handle creates an edge with type selector
- [ ] 5 edge types render with correct colors/styles
- [ ] Canvas state auto-saves within 500ms of change
- [ ] Works at 60fps with 50 nodes (baseline test before 500-node target)
- [ ] All tests passing
