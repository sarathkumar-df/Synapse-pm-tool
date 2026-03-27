# ADR 002: State Management — Zustand + React Query

**Date**: 2026-03-26
**Status**: Accepted

## Decision
Use Zustand for client state and React Query (TanStack Query) for server state. No Redux.

## State Division

### Zustand (client state — ephemeral, interaction-driven)
- Canvas state: nodes[], edges[], viewport
- Selected node ID
- Active panel (detail | conflicts | snapshots | none)
- What-If mode flag + what-if state buffer
- Ripple mode: active node ID
- Filter state
- Toast queue
- Undo/redo stack

### React Query (server state — persisted, fetched from API)
- Project list
- Map list
- Full map detail (nodes + edges + conflicts + critical path)
- Snapshot list
- User profile

### Why Not Redux?
Redux is over-engineered for this use case. Zustand provides the same capability with 1/10th the boilerplate. The canvas interaction patterns (frequent small updates) benefit from Zustand's fine-grained subscriptions.

### Why Not Context API for Global State?
Context re-renders the entire subtree on every update. For a canvas with 500 nodes, this is unacceptable.

## The Sync Problem
Canvas operations need to:
1. Update Zustand immediately (optimistic UI)
2. Persist to API (React Query mutation)
3. Reconcile conflicts/critical path from API response

**Solution**: Mutations use optimistic updates in Zustand, then reconcile with API response.
If mutation fails, invalidate React Query cache → triggers re-fetch → overwrites Zustand.

## Undo/Redo
- Stored in Zustand: `undoStack: CanvasOperation[]` (max 50)
- Operations are stored as reversible commands, not snapshots
- What-If mode uses a separate state buffer (discarded on exit)
