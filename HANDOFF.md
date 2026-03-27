# Synapse — Session Handoff
> Last updated: 2026-03-27

## What Was Completed This Session

### Sprint 2a — Canvas Engine ✅
All 6 bugs from manual testing were fixed:

1. **Visual updates without refresh** — Root cause: `queryClient.setQueryData(...)` in mutation `onSuccess` handlers was triggering `MapEditorPage`'s `useEffect` to re-run `initCanvas()` with stale server data, overwriting Zustand mutations. Fix: replaced all `setQueryData` calls with direct `setConflicts()` calls on the canvas store.

2. **React Flow ↔ Zustand sync** — Uses `useLayoutEffect` + `useNodesState`/`useEdgesState`. `rfNodesFromStore` (useMemo) feeds into `setRfNodes` via `useLayoutEffect`. Fires synchronously before browser paint → no refresh needed.

3. **Drag position saving** — Fixed Express route ordering: `PATCH /:mapId/nodes/bulk` must be registered BEFORE `PATCH /:mapId/nodes/:nodeId` (Express was matching 'bulk' as a nodeId).

4. **All 4 handles allow connections** — Changed all handles to `type="source"` + added `connectionMode={ConnectionMode.Loose}` to ReactFlow so source→source connections work.

5. **Undo/redo** — Was broken because `initCanvas()` clears both undo/redo stacks. Fixed by the setQueryData → setConflicts change above.

6. **onEdgesChange** — Added `handleEdgesChange` wired to `onEdgesChange` prop on ReactFlow for proper edge state management in controlled mode.

### Sprint 2b — Node Detail Panel ✅ (SYN-212/213/214/215)

**Files created/modified:**
- `apps/web/src/components/panels/NodeDetailPanel.tsx` — new, ~480 lines
- `apps/web/src/pages/MapEditorPage.tsx` — added panel to flex layout
- `apps/web/src/components/canvas/SynapseCanvas.tsx` — auto-opens panel on node select

**Behavior:**
- Clicking a node auto-opens the 400px panel (Framer Motion 200ms slide-in)
- Clicking empty canvas closes it
- Two tabs: Details | Connections
- Details: label (blur-save), description (blur-save), category/status/priority (instant), effort (blur-save), deadline (change-save), color override (instant)
- 500ms debounced API save with batching of concurrent field changes
- "Saving…" → "Saved ✓" (2s) indicator
- Flush-on-switch: pending changes saved immediately when switching nodes
- Connections tab: parent, children, edges grouped by type with direction arrows (→/←)

---

## Current State

### What's working
- Full canvas CRUD: create (N key / double-click), delete (toolbar), drag (position saved)
- Undo/redo (Cmd+Z / Cmd+Shift+Z, 50 steps)
- Edge creation (drag handle → pick type from EdgeTypePicker)
- Node Detail Panel (all fields, auto-save, connections)
- Fit-view on initial load

### Sprint 2b — Remaining (SYN-216 to 222)
| Ticket | Feature | Notes |
|--------|---------|-------|
| SYN-216/217 | Nested nodes — Tab key, drag-onto-node, collapse, 4-level limit | High complexity |
| SYN-218 | Right-click context menu | 9 actions |
| SYN-219 | Multi-select polish | Shift+click, bounding box |
| SYN-220 | Snap-to-grid | Toggle, 20px grid, guides |
| SYN-221 | Cmd+K command palette | Search nodes, zoom to result |
| SYN-222 | Change history in panel | ChangeLog entries |

**Recommended next:** SYN-218 (context menu) and SYN-221 (Cmd+K) — both high-value, low-complexity.

---

## Key Architecture Decisions (This Session)

### Zustand ↔ React Flow sync pattern
```
Zustand store (nodes/edges)
  → useMemo (rfNodesFromStore / rfEdgesFromStore)
  → useLayoutEffect → setRfNodes / setRfEdges
  → ReactFlow (controlled mode: nodes={rfNodes} edges={rfEdges})
```
- `useLayoutEffect` fires synchronously before browser paint — changes appear immediately
- During drag: `rfNodesFromStore` doesn't change (Zustand only written on dragStop) → no position snap
- `handleNodesChange` applied for ALL change types so drag stays smooth in controlled mode
- Selection changes additionally sync to Zustand via `selectNode`

### Mutation pattern (no setQueryData)
All canvas mutations follow this pattern:
```tsx
onSuccess: ({ node/edge, conflicts, critical_path }) => {
  addNode/addEdge/updateNode(...)  // Zustand update → triggers RF sync
  setConflicts(conflicts, critical_path)  // NOT setQueryData — avoids initCanvas reset
}
```
`initCanvas()` must ONLY be called once on initial map load. It clears undo/redo stacks.

### Panel auto-save pattern
```
Field change → updateNode() [optimistic] → accumulate pendingUpdates ref
             → 500ms debounce → nodesApi.update() [API]
             → flush immediately on node switch / panel close
```

---

## Known Issues / Deferred
- Edge rendering aesthetics need polish (mentioned by user, deferred)
- No `onEdgesChange` equivalent for edge deletion from canvas — edges can only be deleted via API (context menu will fix this in SYN-218)
