Generate a session handoff document for the Synapse project.

Read the recent git log (`git log --oneline -20`) and any open TODO comments in recently modified files, then write a `HANDOFF.md` file at the project root with this structure:

---

# Synapse Session Handoff
**Date**: [today's date]
**Session focus**: [1-line summary of what this session worked on]

## What Was Done
[Bullet list of completed work with file paths and ticket IDs]

## Decisions Made
[Key architectural or implementation decisions and WHY — future sessions need to understand the reasoning]

## What's In Progress (if any)
[Anything started but not finished — be specific about current state]

## Next Steps
[Ordered list of what to tackle next session, with ticket IDs if applicable]

## Contracts Updated
[Any changes to docs/contracts/ — critical for other agents to know]

## Known Issues / Gotchas
[Anything that tripped us up, weird behavior, technical debt introduced]

---

After writing HANDOFF.md, commit it:
`git add HANDOFF.md && git commit -m "docs: session handoff - [brief description]"`
