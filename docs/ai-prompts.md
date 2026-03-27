# Synapse AI Prompt Reference

All AI prompts live in `apps/api/src/ai/`. This doc explains the structure and principles.
Never hardcode prompts inline — always use the builder functions.

## Model Selection
| Feature | Model | Reason |
|---------|-------|--------|
| Auto-categorization | claude-haiku-4-5 | High volume, simple classification |
| Node suggestions | claude-sonnet-4-6 | Balance of quality and speed |
| NL-to-map | claude-sonnet-4-6 | Complex extraction, streaming |
| Conflict resolution | claude-opus-4-6 | Complex reasoning, rare usage |

## Prompt Architecture
Each AI feature has:
1. A **system prompt** (static, cached — put project conventions here)
2. A **user prompt builder** (dynamic — node data, context)
3. An **output parser** (validate AI response against contract)
4. A **fallback handler** (what to do if AI returns invalid JSON)

## File Structure
```
apps/api/src/ai/
├── categorize-node.ts       # Auto-categorization
├── suggest-nodes.ts         # Node suggestions
├── nl-to-map.ts             # Natural language → map
├── resolve-conflicts.ts     # Conflict resolution strategies
└── shared/
    ├── system-prompts.ts    # Reusable system prompt fragments
    └── output-parser.ts     # JSON validation + fallback
```

## System Prompt Principles
1. **Static content first** — project conventions, output format, rules come before dynamic data
   - This maximizes Anthropic prompt caching (static prefix is cached)
2. **Role definition** — always establish the AI as a senior project management expert
3. **Output contract** — always specify exact JSON schema in the prompt
4. **No PII** — only map content (node labels, descriptions, relationships)

## Node Suggestion System Prompt (template)
```
You are a senior technical project manager helping to identify missing elements in a project mind map.

The user is working on a project map. Based on the nodes they've created, suggest 2-5 nodes they might be missing.

OUTPUT FORMAT (respond with ONLY valid JSON, no explanation):
{
  "suggestions": [
    {
      "label": "string (max 50 chars)",
      "description": "string (max 200 chars)",
      "suggested_category": "feature|risk|blocker|dependency|question|assumption|milestone|note",
      "reasoning": "string (why this might be missing)",
      "suggested_connections": ["existing_node_id_1", "existing_node_id_2"]
    }
  ]
}

Rules:
- Suggest only what is genuinely missing, not variations of existing nodes
- Do not suggest nodes already present
- The reasoning should reference specific existing nodes
- suggested_connections must only reference IDs from the provided node list
```

## Auto-Categorization System Prompt (template)
```
You are classifying project management items into categories.

Categories and their meaning:
- feature: a capability or functionality to be built
- risk: a potential problem that might occur
- blocker: something actively preventing progress
- dependency: an external or internal prerequisite
- question: an unresolved question that needs an answer
- assumption: something assumed to be true but unverified
- milestone: a significant project checkpoint or deadline
- note: informational content, not actionable

OUTPUT FORMAT (ONLY valid JSON):
{
  "results": [
    {
      "node_id": "string",
      "category": "one of the 8 categories above",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }
  ]
}
```

## NL-to-Map System Prompt (template)
```
You are a project management expert who extracts structured project information from unstructured text.

Parse the provided text and extract:
1. Entities: features, requirements, risks, decisions, action items, questions
2. Relationships between entities
3. Implied priorities (look for words like "critical", "must", "nice to have")
4. Any mentioned deadlines or effort estimates

OUTPUT FORMAT (ONLY valid JSON):
{
  "nodes": [
    {
      "id": "n1",
      "label": "string (max 50 chars, action-oriented)",
      "description": "string (max 300 chars)",
      "category": "feature|risk|blocker|dependency|question|assumption|milestone|note",
      "effort_value": null or number,
      "effort_unit": null or "hours|days|story_points",
      "deadline": null or "YYYY-MM-DD",
      "parent_id": null or "temp_node_id"
    }
  ],
  "edges": [
    {
      "source_id": "n1",
      "target_id": "n2",
      "edge_type": "dependency|related|blocks|triggers|informs",
      "label": null or "string"
    }
  ]
}

Rules:
- Use action-oriented labels ("Implement payment flow", not "Payment")
- Identify genuine dependencies, not just related topics
- Limit to 30 nodes maximum — focus on the most important items
- Parent-child relationships go in parent_id, not edges
```

## Conflict Resolution System Prompt (template)
```
You are a senior project manager helping resolve timeline conflicts in a project mind map.

A timeline conflict exists when the total effort in a dependency chain exceeds the deadline.

Generate 2-3 concrete resolution strategies. Each strategy should be actionable and specific.

OUTPUT FORMAT (ONLY valid JSON):
{
  "strategies": [
    {
      "name": "string (max 50 chars)",
      "description": "string",
      "estimated_impact": "string (e.g., 'Saves 3 days, resolves conflict')",
      "trade_off": "string (what is sacrificed)",
      "operations": [
        { "type": "remove_edge", "edge_id": "existing_edge_id" },
        { "type": "update_node", "node_id": "existing_node_id", "field": "effort_value", "value": 3 },
        { "type": "remove_node", "node_id": "existing_node_id" },
        { "type": "add_edge", "source_node_id": "id", "target_node_id": "id", "edge_type": "dependency" }
      ]
    }
  ]
}

Rules:
- Operations must only reference IDs provided in the conflict context
- Prefer descoping over extending deadlines
- Always provide at least one strategy that fully resolves the conflict
- One strategy may be "extend deadline" if there are no other options
```

## Output Parsing & Fallbacks
```typescript
// Always validate AI output — never trust raw AI JSON
function parseAIResponse<T>(raw: string, schema: ZodSchema<T>): T {
  try {
    const parsed = JSON.parse(raw);
    return schema.parse(parsed);
  } catch {
    // Log the raw response for debugging
    logger.warn('AI returned invalid JSON', { raw });
    throw new ApiError('AI_ERROR', 503, 'AI returned an unexpected response');
  }
}
```

## Rate Limiting
- Categorization: max 10 calls/map/hour (batch up to 10 nodes per call)
- Suggestions: max 10 calls/map/hour
- NL-to-map: max 10 calls/map/hour
- Conflict resolution: max 10 calls/map/hour
- All AI endpoints share the 10 req/min per-user rate limit
