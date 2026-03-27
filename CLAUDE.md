# Synapse — AI Development Constitution
> Version 1.0 | Updated: 2026-03-26

## What is Synapse?
AI-powered project mind mapping platform. Combines infinite canvas freedom with project intelligence: conflict detection, impact ripple analysis, and AI node suggestions. Built for project managers who need to think visually and stay ahead of change-driven chaos.

## The Non-Negotiables (Read Every Session)

### Workflow: Plan → Contract → Implement → Verify
1. **No implementation until contracts are locked.** Architect agent defines TypeScript interfaces in `docs/contracts/` first.
2. **No PR without tests.** Every feature ticket requires unit + integration tests.
3. **Pre-mortem before complex features.** Ask "what could go wrong?" before writing a single line.
4. **Boomerang validation.** First-pass output is always reviewed before accepting.

### Forbidden Patterns
- Never store share tokens or passwords in plaintext
- Never bypass rate limiting on AI endpoints
- Never render user-provided HTML (XSS risk — use DOMPurify or sanitize)
- Never accept `any` as a TypeScript type without a `// TODO: type this` comment
- Never create circular dependencies between packages
- Never commit `.env` files — use `.env.example` only
- Never mutate Zustand state directly — always use actions
- Never call the AI API from the frontend directly — always proxy through `/api/ai/`

### Architecture Rules
- **Canvas engine**: React Flow only. No raw SVG/Canvas hacks unless performance forces it.
- **State**: Zustand for client state. React Query for server state. No Redux, no Context for global state.
- **Styling**: TailwindCSS utility classes. No inline styles except for dynamic canvas positioning.
- **DB access**: Prisma only. No raw SQL except for complex analytics queries (document why).
- **AI calls**: Anthropic SDK only. All prompts live in `apps/api/src/ai/`. Never hardcode prompts inline.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + React Flow + Zustand + TailwindCSS |
| Backend | Node.js + Express + TypeScript + Prisma + PostgreSQL + Redis |
| AI | Anthropic Claude API (claude-sonnet-4-6 for drafts, claude-opus-4-6 for final) |
| Infra | Docker + Railway (API) + Vercel (Web) |
| Testing | Vitest + React Testing Library + Supertest |

## Project Structure
```
apps/web/     → React frontend (Vite)
apps/api/     → Express backend
packages/shared/ → Shared TypeScript types (source of truth)
docs/contracts/  → Interface definitions (lock before implementing)
docs/adr/        → Architecture Decision Records
.claude/agents/  → Specialist agent system prompts
.claude/commands/ → Custom slash commands
```

## Key Domain Concepts
- **Node**: Core building block. Has category, effort, deadline, status, priority.
- **Edge**: Relationship between nodes. Types: dependency, related, blocks, triggers, informs.
- **Map**: Canvas containing nodes + edges. Belongs to a Project.
- **Snapshot**: Immutable point-in-time copy of a map state (JSONB blob).
- **Conflict**: When cumulative effort in a dependency chain exceeds a deadline.
- **Critical Path**: Longest chain of dependent nodes. Computed from DAG of dependency/blocks edges.
- **Ripple**: Visual impact analysis — how one node change propagates through the graph.

## Node Categories & Colors
| Category | Color | Left Border |
|----------|-------|-------------|
| feature | #2E75B6 | Blue |
| risk | #E65100 | Orange |
| blocker | #C62828 | Red |
| dependency | #7B1FA2 | Purple |
| question | #F9A825 | Yellow |
| assumption | #00897B | Teal |
| milestone | #1B5E20 | Dark Green |
| note | #757575 | Gray |

## Performance Targets
- Canvas: 60fps with 500 nodes / 1000 edges
- API CRUD: < 200ms
- AI operations: < 2s (streaming for longer)
- Full map load (1000 nodes): < 1s
- Export: < 10s for 500 nodes

## Security Requirements
- bcrypt cost factor 12 for passwords
- Share tokens: 64-char crypto.randomUUID-based
- Rate limit: 100 req/min (standard), 10 req/min (AI endpoints)
- All user text fields: sanitize for XSS (DOMPurify on frontend, sanitize-html on backend)
- CORS: application domain only

## Naming Conventions
- **Files**: kebab-case for components (`synapse-node.tsx`), camelCase for hooks/services (`useConflictDetection.ts`)
- **Components**: PascalCase (`SynapseCanvas`)
- **DB tables**: snake_case (`change_log`, `share_token`)
- **API routes**: plural nouns (`/api/maps`, `/api/nodes`)
- **Zustand actions**: verb + noun (`addNode`, `updateEdge`, `setConflicts`)
- **AI functions**: verb + noun in `apps/api/src/ai/` (`categorizeNode`, `suggestNodes`)

## Sprint Status
| Sprint | Scope | Status |
|--------|-------|--------|
| Sprint 1 | Auth, projects, maps CRUD, workspace | ✅ Done — 146 tests passing |
| Sprint 2a | Canvas engine, nodes, edges, undo/redo, auto-save | ✅ Done |
| Sprint 2b | Node Detail Panel, nesting, context menu, Cmd+K | 🔨 In progress — SYN-212/213/214/215 done |
| Sprint 3 | Search, filter bar, workspace polish | ⏳ Pending |

Full sprint specs: `docs/sprints/`

## Delivery Phases (Reference)
- **Phase 1** (Weeks 1–4): Canvas engine, auth, workspace, search/filter
- **Phase 2** (Weeks 5–8): Timeline engine, conflict detection, ripple, snapshots, sharing, export
- **Phase 3** (Weeks 9–12): AI engine (all 4 features)
- **Phase 4** (Weeks 13–16): Polish, performance, security, launch

## Detailed Reference Docs
Read on demand — do NOT load into every session:
- `docs/db-schema.md` — Full data model with all fields
- `docs/api-conventions.md` — Endpoint patterns, error formats, pagination
- `docs/ai-prompts.md` — All AI prompt templates
- `docs/component-conventions.md` — React component patterns
- `docs/error-handling.md` — Error types, user messages, logging
- `docs/testing-strategy.md` — What to test, how, coverage targets
- `docs/contracts/entities.ts` — TypeScript interfaces for all entities
- `docs/contracts/api.ts` — API request/response types
- `docs/contracts/ai.ts` — AI prompt/response contracts
- `docs/adr/` — Architecture decisions and rationale

## Session Discipline
- Use `/compact` after every major milestone
- Write `HANDOFF.md` at end of complex sessions (use `/handoff` command)
- Start new sessions by reading `HANDOFF.md` if it exists
- Commit frequently with descriptive messages — `git log` is memory
