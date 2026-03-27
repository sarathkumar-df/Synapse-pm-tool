# ADR 003: AI Integration — Anthropic Claude API

**Date**: 2026-03-26
**Status**: Accepted

## Decision
Use Anthropic Claude API for all AI features. All AI calls proxied through the backend.

## Models by Feature
| Feature | Model | Rationale |
|---------|-------|-----------|
| Auto-categorization | claude-haiku-4-5 | High-volume, simple task — minimize cost |
| Node suggestions | claude-sonnet-4-6 | Quality needed, moderate volume |
| NL-to-map | claude-sonnet-4-6 | Complex extraction, streaming output |
| Conflict resolution | claude-opus-4-6 | Complex reasoning, low volume, high value |

## Why Backend Proxy (No Frontend AI Calls)
1. **Security**: API key never exposed to browser
2. **Rate limiting**: Enforced server-side, not client-side (bypassable)
3. **Prompt caching**: Anthropic's prompt caching requires server-side batching
4. **Cost control**: Can monitor, limit, and log all AI usage

## Prompt Caching Strategy
Anthropic caches prompts when the same static prefix is reused. Structure:
1. System prompt (static conventions, output format) → cached
2. Dynamic data (node labels, descriptions) → not cached, appended after

## Streaming
NL-to-map and node suggestion responses use streaming:
- Backend streams AI response via Server-Sent Events
- Frontend `EventSource` or `fetch` with streaming reads
- Shows "Generating..." state with partial results

## Fallback Strategy
If AI is unavailable (503, timeout):
- Categorization: default to 'feature' category, show uncertainty badge
- Suggestions: silent failure (no ghost nodes shown)
- NL-to-map: show error in modal, offer retry
- Conflict resolution: show "AI suggestions unavailable" message

## Cost Controls
- Rate limit: 10 AI requests/min per user
- Batch categorization: up to 10 nodes per API call
- Auto-suggestion only triggers after 5s pause + 3+ node cluster
- Never call AI on every keystroke

## Privacy
AI prompts contain ONLY: node labels, descriptions, categories, relationships.
Never include: user email, user name, project descriptions with PII, metadata values.
