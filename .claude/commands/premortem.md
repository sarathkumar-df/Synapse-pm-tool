Run a pre-mortem on this Synapse implementation plan: $ARGUMENTS

Imagine it is 4 weeks after this feature shipped and it has failed badly. Answer:

## 1. What Went Wrong?
List every plausible failure mode:
- Implementation bugs (logic errors, race conditions, off-by-one)
- Edge cases not handled (empty state, max limits, concurrent users)
- Performance issues (what breaks at scale)
- Security vulnerabilities (auth bypass, XSS, data exposure)
- Integration failures (AI API down, DB slow query, React Flow version conflict)

## 2. What Did We Miss?
- Which PRD acceptance criteria are ambiguous?
- Which dependencies weren't accounted for?
- Which user actions weren't considered?

## 3. What Contracts Are Missing?
- Which TypeScript interfaces need to be defined before implementation?
- Which API shapes are unclear?

## 4. Risk Mitigation
For each identified risk, propose a mitigation:
- [Risk] → [Mitigation]

## 5. Adjusted Implementation Plan
Based on the pre-mortem findings, what should we do differently?

Be pessimistic. The goal is to surface problems now, not after implementation.
