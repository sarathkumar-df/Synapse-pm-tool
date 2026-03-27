Implement the Synapse ticket: $ARGUMENTS

Follow this exact pipeline:

## Step 1: PRE-MORTEM
Before writing any code, answer:
- What could go wrong with this implementation?
- What edge cases exist?
- What dependencies or contracts need to be in place first?
- Does this ticket require DB schema changes? If yes, update Prisma schema first.

## Step 2: CHECK CONTRACTS
Read `docs/contracts/entities.ts` and `docs/contracts/api.ts`.
- If this ticket requires new types, add them to the contracts files FIRST.
- Do not proceed to implementation until contracts are defined.

## Step 3: IMPLEMENT
- Backend first (route + service), then frontend (component + store)
- Follow the agent-specific rules in `.claude/agents/backend.md` and `.claude/agents/frontend.md`
- Use surgical edits (specific functions) — do not rewrite entire files
- Reference the PRD spec in `Synapse_PRD_v1.0.docx` for exact behavior if unclear

## Step 4: VERIFY
After implementation:
- Write tests (see `.claude/agents/test.md` for patterns)
- Run tests and fix any failures
- Run TypeScript compiler check: `pnpm tsc --noEmit`
- Run lint: `pnpm lint`

## Step 5: REVIEW
Apply the review checklist from `.claude/agents/review.md` to your own implementation before declaring done.

## Done Criteria
- [ ] Implementation matches PRD acceptance criteria
- [ ] Tests written and passing
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Contracts updated if data model changed
- [ ] HANDOFF.md updated with what was done and any decisions made
