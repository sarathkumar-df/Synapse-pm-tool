# Synapse Web App — Frontend Rules

Read `../../CLAUDE.md` first (project constitution). This file adds frontend-specific rules.

## Stack
- React 18 + TypeScript (strict mode)
- React Flow (`@xyflow/react`) — canvas engine
- Zustand — client state
- TanStack Query — server state
- TailwindCSS — styling
- Framer Motion — animations
- Vite — build

## Key Files
- `src/store/canvas.store.ts` — nodes, edges, canvas UI state
- `src/store/ui.store.ts` — panels, toasts, modals
- `src/services/api.client.ts` — typed API calls
- `src/constants/node-categories.ts` — category colors/icons

## Canvas Architecture
```
SynapseCanvas.tsx           → React Flow provider, event wiring
  ├── SynapseNode.tsx        → Custom node (memo'd)
  ├── SynapseEdge.tsx        → Custom edge (memo'd)
  ├── NodeToolbar.tsx        → Floating toolbar (position=absolute)
  ├── RippleOverlay.tsx      → Dims non-ripple nodes
  └── WhatIfBanner.tsx       → Top banner in what-if mode
```

## Panel Dimensions (from PRD)
- Node Detail Panel: 400px wide, right side
- Conflicts Panel: 350px wide, left side
- Snapshots Panel: right side (shares with detail panel)

## Canvas Keyboard Shortcuts
- `N` — create node at viewport center
- `Delete/Backspace` — delete selected node(s)
- `C` — connect mode (then click target)
- `R` — ripple mode on selected node
- `Cmd+Z` — undo (50 operations)
- `Cmd+Shift+Z` — redo
- `Cmd+K` — command palette

## Performance Rules
- `React.memo` on every canvas component
- `useCallback` on all React Flow event handlers
- Selector functions for Zustand: always pick minimum slice
  ```typescript
  // ✅ correct
  const addNode = useCanvasStore(s => s.addNode)
  // ❌ wrong — subscribes to entire store
  const store = useCanvasStore()
  ```
- Debounce: position saves 500ms, auto-save 500ms, AI suggestions 5s

## Conflict Color Coding
- Warning (within 20% of deadline): orange glow `shadow-[0_0_0_2px_#F9A825]`
- Critical (exceeds deadline): red glow `shadow-[0_0_0_2px_#C62828]`
- Critical path: `border-2 border-[#F57C00] shadow-[0_0_8px_rgba(245,124,0,0.4)]`

## What-If Mode
- Canvas gets translucent blue overlay
- All mutations go to a local buffer (not the server)
- `WhatIfBanner` shows Apply/Discard
- Apply: send all buffered mutations to API
- Discard: clear buffer, revert Zustand to pre-what-if snapshot

## Import Rules
- Types: always from `@synapse/shared` (shared package) or `../../docs/contracts/`
- Never import backend code into frontend
- API client: only via `src/services/api.client.ts`
