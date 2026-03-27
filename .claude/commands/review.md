Review the following Synapse code for correctness, security, and architecture compliance: $ARGUMENTS

If no arguments provided, review all files modified since the last commit (`git diff HEAD`).

Apply the full review checklist from `.claude/agents/review.md`.

Pay special attention to:
1. **Auth ownership checks** — does every route verify the user owns the resource?
2. **Canvas performance** — are React Flow components properly memoized?
3. **AI prompt safety** — are prompts stripping PII?
4. **Contract compliance** — are types from `docs/contracts/` used, not re-invented?
5. **Critical path correctness** — if timeline logic is touched, trace through a complex scenario manually

Output format:
```
## Review: [file or feature]

### 🔴 Blockers
### 🟡 Warnings
### 🟢 Approved

### Verdict: APPROVED | CHANGES REQUESTED
```

If CHANGES REQUESTED: implement the fixes immediately after the review, then re-review.
