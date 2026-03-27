# ADR 001: Canvas Engine — React Flow

**Date**: 2026-03-26
**Status**: Accepted

## Decision
Use React Flow as the canvas engine for Synapse.

## Alternatives Considered
1. **Raw SVG/Canvas with d3** — Maximum control, but enormous implementation cost for pan/zoom, node drag, edge routing, minimap, and performance optimization.
2. **Konva.js** — Good canvas performance but no built-in React integration, no edge routing.
3. **Cytoscape.js** — Strong for graph analysis, weak for interactive free-form node editing.
4. **React Flow** — Built for exactly this use case: interactive node-edge graphs in React.

## Rationale
React Flow provides:
- Built-in pan/zoom/drag with 60fps performance
- Custom node and edge renderers (we use these extensively)
- Minimap component
- Built-in virtualization for large graphs
- Active maintenance and React 18 support

## Constraints This Imposes
- Canvas state uses React Flow's `useNodesState`/`useEdgesState` hooks internally
- Node positions are React Flow's coordinate system (we store these in DB as-is)
- Edge routing uses bezier curves (React Flow default) — cannot use straight lines without custom edge renderer
- Performance target (500 nodes / 60fps) must be validated against React Flow's virtualization

## Mitigation for Performance
- `React.memo` on all custom node/edge components
- `useCallback` on all event handlers
- Debounce persistence (500ms after drag end)
- Test with 500 nodes in Phase 1 — if failing, evaluate `@xyflow/react` v12 upgrades
