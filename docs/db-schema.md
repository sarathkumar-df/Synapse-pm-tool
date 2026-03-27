# Synapse Database Schema

Full data model. Read this when writing Prisma queries or migrations.
Source of truth for field names — always use snake_case.

## Prisma Schema Location
`apps/api/src/db/schema.prisma`

## Tables

### users
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| email | String | unique, lowercase |
| password_hash | String | bcrypt, cost 12 |
| name | String | |
| avatar_url | String? | |
| created_at | DateTime | default now() |
| updated_at | DateTime | @updatedAt |

### projects
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| user_id | String | FK → users |
| name | String | |
| description | String? | |
| color | String | default '#6366F1' |
| archived_at | DateTime? | null = active |
| created_at | DateTime | |
| updated_at | DateTime | |

**Indexes**: `user_id`, `(user_id, archived_at)`

### maps
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| user_id | String | FK → users |
| project_id | String? | FK → projects, nullable |
| name | String | |
| description | String? | |
| share_token | String? | unique, 36-char UUID, null = not shared |
| share_config | Json? | ShareConfig object |
| viewport_state | Json? | ViewportState object |
| thumbnail_svg | String? | auto-generated on save |
| archived_at | DateTime? | |
| created_at | DateTime | |
| updated_at | DateTime | |

**Indexes**: `user_id`, `project_id`, `share_token` (unique), `(user_id, archived_at)`

### nodes
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| map_id | String | FK → maps |
| parent_id | String? | FK → nodes (self-ref), max depth 4 |
| label | String | max 200 chars |
| description | String? | markdown |
| category | Enum NodeCategory | default 'feature' |
| status | Enum NodeStatus | default 'todo' |
| priority | Enum NodePriority | default 'medium' |
| position_x | Float | canvas coordinates |
| position_y | Float | |
| width | Int? | default 200 |
| height | Int? | default 80 |
| color_override | String? | hex color |
| effort_value | Float? | |
| effort_unit | Enum EffortUnit? | |
| deadline | DateTime? | date only, stored as UTC midnight |
| metadata | Json? | Record<string, string> |
| ai_category_confidence | Float? | 0.0 to 1.0 |
| created_at | DateTime | |
| updated_at | DateTime | |

**Indexes**: `map_id`, `parent_id`, `(map_id, category)`, `(map_id, status)`

### edges
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| map_id | String | FK → maps |
| source_node_id | String | FK → nodes |
| target_node_id | String | FK → nodes |
| edge_type | Enum EdgeType | |
| label | String? | |
| created_at | DateTime | |
| updated_at | DateTime | |

**Constraints**: unique `(source_node_id, target_node_id, edge_type)` — no duplicate connections
**Indexes**: `map_id`, `source_node_id`, `target_node_id`

### snapshots
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| map_id | String | FK → maps |
| name | String | |
| description | String? | |
| trigger | Enum SnapshotTrigger | |
| snapshot_data | Json | Full SnapshotData blob |
| node_count | Int | denormalized for display |
| thumbnail_svg | String? | |
| created_at | DateTime | |

**Indexes**: `map_id`, `(map_id, created_at)`
**Max per map**: 50 (enforced in service, not DB)

### change_logs
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| map_id | String | FK → maps |
| node_id | String? | FK → nodes |
| edge_id | String? | FK → edges |
| user_id | String | FK → users |
| action | Enum ('create', 'update', 'delete') | |
| entity_type | Enum ('node', 'edge', 'map') | |
| old_value | Json? | before state |
| new_value | Json? | after state |
| created_at | DateTime | |

**Indexes**: `map_id`, `node_id`, `(map_id, created_at)`

## Enums (Prisma)

```prisma
enum NodeCategory {
  feature
  risk
  blocker
  dependency
  question
  assumption
  milestone
  note
}

enum NodeStatus { todo in_progress done blocked cancelled }
enum NodePriority { critical high medium low }
enum EffortUnit { hours days story_points }
enum EdgeType { dependency related blocks triggers informs }
enum SnapshotTrigger { manual share_link_created bulk_add milestone_marked }
```

## Query Patterns

### Load full map for canvas
```prisma
const map = await prisma.map.findUnique({
  where: { id: mapId },
  include: {
    nodes: { orderBy: { created_at: 'asc' } },
    edges: true,
  }
})
```

### Check user ownership before any mutation
```typescript
const map = await prisma.map.findUnique({ where: { id: mapId, user_id: userId } })
if (!map) throw new ForbiddenError()
```

### Soft delete (archive)
```prisma
await prisma.map.update({ where: { id }, data: { archived_at: new Date() } })
```

### List active maps
```prisma
await prisma.map.findMany({ where: { user_id: userId, archived_at: null } })
```
