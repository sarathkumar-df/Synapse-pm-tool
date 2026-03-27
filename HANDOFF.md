# Synapse — Session Handoff
> Last updated: 2026-03-27

## What Was Completed This Session

### SYN-218 — Right-click Context Menu ✅

**Files created/modified:**
- `apps/web/src/components/canvas/NodeContextMenu.tsx` — new, ~260 lines
- `apps/web/src/components/canvas/SynapseCanvas.tsx` — added `onNodeContextMenu` handler + context menu state

**Behavior (9 actions):**
- Right-click any node → menu appears at cursor, auto-clamps to viewport edges
- **Edit details** — opens NodeDetailPanel
- **Duplicate** — creates copy offset 220px right, selects it
- **Change category** — inline sub-panel with 8 category pills (colored, checkmark on active)
- **Set effort** — inline number input + unit select (hours/days/pts) + Save button; Enter key submits
- **Set deadline** — inline date picker, saves on change; "Clear deadline" removes it
- **Add child** — creates node with `parent_id` set, offset 240/120px, auto-opens detail panel
- **Connect to…** — selects node + shows info toast to drag a handle
- **Copy link** — copies `{url}#node-{id}` to clipboard
- **Delete** — confirms if node has children or 3+ edges; removes immediately
- Escape / click-outside / pane-click all close the menu
- Browser default context menu suppressed on nodes

### SYN-221 — Cmd+K Command Palette ✅

**Files created/modified:**
- `apps/web/src/components/canvas/CommandPalette.tsx` — new, ~180 lines
- `apps/web/src/components/canvas/SynapseCanvas.tsx` — Cmd+K shortcut + `handlePaletteSelect` zoom callback
- `apps/web/src/pages/MapEditorPage.tsx` — added `⌘K search` hint to top bar

**Behavior:**
- `Cmd+K` (or `Ctrl+K`) opens palette; input auto-focused; query resets on each open
- Fuzzy search on node label + description; scoring: exact > starts-with > contains label > contains description
- Results show category color strip, category pill, status badge
- `↑` / `↓` navigates; `Enter` or click selects
- On select: palette closes → canvas smooth-zooms to node (`setCenter`, 400ms) → NodeDetailPanel opens
- Escape / click backdrop closes
- Footer shows result count and keyboard hints
- Rendered inside `SynapseCanvasInner` (needs `useReactFlow()` for `setCenter`)

---

## Current State

### What's working
- Full canvas CRUD: create (N key / double-click), delete (toolbar/context menu), drag (position saved)
- Undo/redo (Cmd+Z / Cmd+Shift+Z, 50 steps)
- Edge creation (drag handle → pick type from EdgeTypePicker)
- Node Detail Panel (all fields, auto-save, connections tab)
- Right-click context menu (9 actions, sub-panels for category/effort/deadline)
- Cmd+K command palette (fuzzy search, zoom to node)
- Fit-view on initial load

### Sprint 2b — Remaining (SYN-216/217/219/220/222)
| Ticket | Feature | Notes |
|--------|---------|-------|
| SYN-216/217 | Nested nodes — Tab key, drag-onto-node, collapse, 4-level limit | High complexity — tackle next sprint |
| SYN-219 | Multi-select polish | Shift+click, shared bounding box, drag handles |
| SYN-220 | Snap-to-grid | Toggle, 20px grid, snap guides |
| SYN-222 | Change history in panel | ChangeLog entries for selected node |

**Recommended next:** SYN-219 (multi-select polish) — lower complexity, high UX value.

---

## Key Architecture Decisions

### Context menu pattern
- Component renders at `position: fixed` at cursor coords; clamps to viewport
- Escape + click-outside handled via `window` listeners in `useEffect`
- Sub-panels (category/effort/deadline) are local state toggles — no routing
- All mutations follow the safe pattern: `updateNode()` Zustand + `setConflicts()`, never `setQueryData`

### Command palette zoom pattern
```tsx
// Inside SynapseCanvasInner — has access to useReactFlow()
const handlePaletteSelect = (node) => {
  selectNode(node.id)
  setActivePanel('node-detail')
  reactFlow.setCenter(node.position_x + 100, node.position_y + 40, { zoom: 1.2, duration: 400 })
}
```
Palette must be rendered inside `ReactFlowProvider` (i.e. inside `SynapseCanvasInner`) to use `setCenter`.

### Zustand ↔ React Flow sync pattern (unchanged)
```
Zustand store (nodes/edges)
  → useMemo (rfNodesFromStore / rfEdgesFromStore)
  → useLayoutEffect → setRfNodes / setRfEdges
  → ReactFlow (controlled mode: nodes={rfNodes} edges={rfEdges})
```

### Mutation pattern (no setQueryData — unchanged)
```tsx
onSuccess: ({ node, conflicts, critical_path }) => {
  updateNode(node.id, node)       // Zustand → triggers RF sync
  setConflicts(conflicts, critical_path)  // NOT setQueryData
}
```

---

## Known Issues / Deferred
- Edge rendering aesthetics need polish (deferred)
- Edge deletion from canvas not yet wired to `onEdgesChange` — delete via context menu (future: SYN-219 multi-select will add batch delete)
