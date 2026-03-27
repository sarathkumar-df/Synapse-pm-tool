# Synapse — Session Handoff
> Last updated: 2026-03-27

## What Was Completed This Session

### SYN-219 — Multi-select Polish ✅

**Files created/modified:**
- `apps/web/src/components/canvas/MultiSelectToolbar.tsx` — new
- `apps/web/src/components/canvas/SynapseCanvas.tsx` — wired multi-select logic

**Behavior:**
- `Shift+click` adds/removes nodes from selection (`multiSelectionKeyCode="Shift"`)
- `Shift+drag` on empty canvas = box selection (React Flow default)
- When 2+ nodes selected: floating `MultiSelectToolbar` at top-center shows count, Delete all, Deselect (×)
- `Delete`/`Backspace` key triggers batch delete in multi-select mode
- `Escape` deselects all
- Batch delete: optimistic Zustand removal → parallel API calls → conflict sync
- Single-node selection still works (detail panel opens, NodeToolbar shows)

**Architecture note:**
- `onSelectionChange` replaces per-change select handling in `onNodesChange`
- `onSelectionChange` does NOT call `setActivePanel(null)` for empty selection — only `onPaneClick` and `handleDeselect` do this explicitly (prevents panel closing on node data updates)

---

### SYN-220 — Snap-to-Grid ✅

**Files created/modified:**
- `apps/web/src/components/canvas/SnapGridToggle.tsx` — new
- `apps/web/src/components/canvas/SynapseCanvas.tsx` — snapToGrid props + background
- `apps/web/src/store/ui.store.ts` — `snapToGrid: boolean` + `setSnapToGrid`

**Behavior:**
- "Snap" button at bottom-left of canvas; press `G` to toggle
- Button turns blue when active
- `snapToGrid + snapGrid=[20,20]` passed to ReactFlow
- Background switches from dot pattern → 20px line grid when snap is on (visual guides)

---

### SYN-222 — Change History in Panel ✅

**Files created/modified:**
- `apps/api/src/routes/nodes.ts` — changelog writes + GET history endpoint
- `apps/web/src/services/api.client.ts` — `changeLogsApi.nodeHistory`
- `apps/web/src/components/panels/NodeDetailPanel.tsx` — History tab + HistoryTab component

**Behavior:**
- History tab added alongside Details and Connections in NodeDetailPanel
- Timeline shows CREATE / UPDATE / DELETE entries per node
- UPDATE shows per-field diff: `Status: todo → in_progress`
- Position-only saves (drag auto-save) are intentionally NOT logged
- History auto-refreshes after each save (`queryClient.invalidateQueries`)
- `GET /api/maps/:mapId/nodes/:nodeId/history` returns last 50 entries

**Critical fix — delete changelog ordering:**
- Changelog must be written BEFORE `prisma.node.delete()` — the `change_logs.node_id` FK references `nodes.id`; writing after delete causes P2003 FK violation

---

### Build fix ✅

Pre-existing TypeScript import path errors that broke `pnpm build` (dev server never type-checks):
- `packages/shared/src/types/index.ts` — fixed `../../../` → `../../../../` for both contract files
- `apps/web/src/store/canvas.store.ts` — switched from `docs/contracts` relative import to `@synapse/shared`
- `apps/web/src/store/ui.store.ts` — same
- `apps/web/src/components/panels/NodeDetailPanel.tsx` — same
- `docs/contracts/api.ts` — removed `map_id` from `CreateNodeRequest` (it's a URL param, not body); removed unused imports

---

## Current State

### What's working
- Full canvas CRUD: create (N key / double-click), delete (toolbar/context menu/keyboard), drag (position saved)
- Undo/redo (Cmd+Z / Cmd+Shift+Z, 50 steps)
- Edge creation (drag handle → pick type from EdgeTypePicker)
- Node Detail Panel (all fields, auto-save, connections tab, history tab)
- Right-click context menu (9 actions, sub-panels for category/effort/deadline)
- Cmd+K command palette (fuzzy search, zoom to node)
- Multi-select (Shift+click/drag, batch delete, toolbar)
- Snap-to-grid (toggle button + G key, 20px grid, visual guides)
- Change history per node (create/update/delete audit trail)
- Production build passing (`pnpm --filter web build`)

### Sprint 2b — Status
| Ticket | Feature | Status |
|--------|---------|--------|
| SYN-212–215 | Node Detail Panel + auto-save | ✅ Done |
| SYN-218 | Right-click context menu | ✅ Done |
| SYN-219 | Multi-select polish | ✅ Done |
| SYN-220 | Snap-to-grid | ✅ Done |
| SYN-221 | Cmd+K command palette | ✅ Done |
| SYN-222 | Change history in panel | ✅ Done |
| SYN-216/217 | Nested nodes | ⏳ Deferred — highest complexity |

**Recommended next session:** Start Sprint 3 (search, filter bar, workspace polish) OR tackle SYN-216/217 (nested nodes). Read this file first.

---

## Key Architecture Decisions

### onSelectionChange — do NOT close panel on empty selection
```tsx
const onSelectionChange = useCallback(({ nodes: selNodes }) => {
  const ids = selNodes.map(n => n.id)
  setSelectedNodeIds(ids)
  if (ids.length === 1) {
    selectNode(ids[0])
    setActivePanel('node-detail')
  } else if (ids.length > 1) {
    selectNode(null)
  }
  // ids.length === 0: do nothing here — RF fires spurious empty-selection
  // events when setConflicts causes setRfNodes to be called.
  // Panel close handled only by onPaneClick and handleDeselect.
}, [selectNode, setActivePanel])
```

### Changelog write order for DELETE
```ts
// CORRECT — write changelog while node still exists
const before = await prisma.node.findUnique(...)
await prisma.changeLog.create({ data: { node_id: nodeId, ... } })  // FK valid
await prisma.node.delete(...)

// WRONG — FK violation (node already gone)
await prisma.node.delete(...)
await prisma.changeLog.create({ data: { node_id: nodeId, ... } })  // P2003 error
```

### Batch delete pattern (multi-select)
```tsx
const { mutate: batchDeleteNodes } = useMutation({
  mutationFn: async (ids) => {
    const results = await Promise.all(ids.map(id => nodesApi.delete(mapId, id)))
    return results[results.length - 1]  // last result has final conflict state
  },
  onMutate: (ids) => {
    ids.forEach(id => deleteNode(id))   // optimistic — instant UI
    setSelectedNodeIds([])
    selectNode(null)
  },
  onSuccess: ({ conflicts, critical_path }) => setConflicts(conflicts, critical_path),
})
```

### Snap-to-grid state location
`snapToGrid` lives in `useUIStore` (not `useCanvasStore`) — it's a UI preference, not canvas data.

### Context menu pattern (unchanged)
- `position: fixed` at cursor coords, clamped to viewport
- Escape + mousedown-outside via `window` listeners in `useEffect`
- All mutations follow safe pattern: Zustand first, never `setQueryData`

### Command palette zoom pattern (unchanged)
```tsx
reactFlow.setCenter(node.position_x + 100, node.position_y + 40, { zoom: 1.2, duration: 400 })
```
Must be inside `SynapseCanvasInner` (needs `useReactFlow()`).

### Zustand ↔ React Flow sync pattern (unchanged)
```
Zustand store (nodes/edges)
  → useMemo (rfNodesFromStore / rfEdgesFromStore)  — excludes selectedNodeId
  → useLayoutEffect → setRfNodes / setRfEdges       — fires before paint
  → ReactFlow (controlled mode)
```

---

## Known Issues / Deferred
- Edge deletion from canvas keyboard shortcut not wired (delete via context menu or NodeToolbar)
- Edge rendering aesthetics need polish (deferred to Sprint 3)
- SYN-216/217 nested nodes deferred (highest complexity, tackle last or next sprint)
