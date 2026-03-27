# Sprint 2b — Node Detail Panel, Nesting & Canvas Polish

**Phase**: 1 — Foundation
**Depends on**: Sprint 2a (canvas engine) ✅
**Feeds into**: Sprint 3 (search, filter, workspace polish)

---

## Goal
The canvas becomes fully editable. A user can click any node and edit all its properties in a slide-out panel, organize nodes into parent-child hierarchies, right-click for contextual actions, and search the map with Cmd+K. The canvas feels complete and polished.

## Scope

### In
| Ticket | Feature | PRD |
|--------|---------|-----|
| SYN-212 | Node Detail Panel — right slide-out 400px, Framer Motion animation 200ms | §5.1.6 |
| SYN-213 | Panel fields — label, description (markdown), category, status, priority, effort, deadline, color, metadata | §5.1.6 |
| SYN-214 | Panel auto-save — 500ms debounce, 'Saved' indicator | §5.1.6 |
| SYN-215 | Panel relationships — parent link, children list, connected nodes grouped by edge type | §5.1.6 |
| SYN-216 | Nested nodes — Tab key, drag-onto-node, auto-layout inside parent, collapse toggle | §5.1.4 |
| SYN-217 | Nesting depth limit — max 4 levels, toast warning at limit | §5.1.4 |
| SYN-218 | Right-click context menu — Edit, Duplicate, Delete, Change Category, Set Effort, Set Deadline, Add Child, Connect To, Copy Link | §5.1.3 |
| SYN-219 | Multi-select polish — shared bounding box, drag handles, Shift+click | §5.1.3 |
| SYN-220 | Snap-to-grid — toggle in settings, 20px grid, snap guides | §5.1.3 |
| SYN-221 | Cmd+K command palette — search node labels + descriptions, zoom to result | §5.8 |
| SYN-222 | Change history in panel — ChangeLog entries for selected node | §5.1.6 |

### Out (Sprint 3)
- Filter bar (by category, status, priority, has-deadline, has-effort, has-conflicts)
- Global search across all maps
- Dashboard polish (project sidebar tree, map thumbnails)
- Archive/restore flows

---

## Contracts to Lock Before Implementation

No new API contracts needed — all panel operations use existing node PATCH endpoint.

New frontend types needed (add to `apps/web/src/types/canvas.types.ts`):
```typescript
interface ContextMenuState {
  nodeId: string
  x: number  // screen coordinates
  y: number
}

interface PanelTab {
  id: 'details' | 'history' | 'connections'
  label: string
}
```

---

## Architecture Notes

### Panel auto-save
```typescript
// Panel changes → debounce → optimistic Zustand update → API PATCH
// On API error → revert via React Query invalidation
const debouncedUpdate = useMemo(
  () => debounce((nodeId: string, updates: UpdateNodeRequest) => {
    updateNodeMutation.mutate({ nodeId, updates })
  }, 500),
  []
)
```

### Nesting implementation
- Parent node size: auto-expand with `ResizeObserver`
- Children positioned with vertical stack layout, 12px gap
- Collapse state: local component state (not persisted to DB)
- Drag-onto-node: use React Flow's `onNodeDrop` to detect parent assignment

### Context menu
- Rendered as a `position: fixed` div outside the canvas (avoids clipping)
- Closed on: Escape, click outside, canvas pan
- Keyboard accessible: Arrow keys navigate, Enter selects

---

## Definition of Done
- [ ] Clicking a node opens the detail panel with all fields populated
- [ ] Editing any field auto-saves within 500ms, shows 'Saved' indicator
- [ ] Description field supports bold, italic, links, code blocks (markdown)
- [ ] Tab on a selected node creates a child inside the parent
- [ ] Dragging a node onto another node reparents it
- [ ] Parent shows child count badge when collapsed
- [ ] Nesting beyond 4 levels shows toast warning
- [ ] Right-click shows context menu with all 9 actions
- [ ] Cmd+K opens palette, typing searches node labels, Enter zooms to node
- [ ] Multi-select shows shared bounding box with drag handles
- [ ] All tests passing
