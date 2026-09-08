## Purpose

Priority index for the 2026-09-08 audit of all 13 converted AGENTS.md files. The 19 follow-ups below each contain evidence, a proposed fix, acceptance criteria, and validation expectations.

The fork's direction remains **world/story memory first**: an immutable archive, dynamic POV-aware recall, and evolving current-world state. Existing feature issues #1, #2, and #3 remain the design context; these are focused correctness and guidance follow-ups, not replacements for those features.

## Priority definitions

- **P1:** address first — migration/persistence/vector correctness and the architecture guidance protecting those contracts.
- **P2:** next — dependency reproducibility, retry/backfill behavior, validation, UI reliability, and supporting domain guidance.
- **P3:** follow-up — observability and agent-workflow accuracy.
- No P0 is assigned: the audit did not establish a universal outage or active unrecoverable data-loss incident.

## P1 — correctness and architecture

Recommended code order: #4 → #9 → #5 → #6 → #7. #8 can proceed alongside code work, but must identify outstanding bugs rather than document proposed fixes as already implemented.

- [ ] #4 — Legacy keyed-graph migration and edge conversion.
- [ ] #9 — Captured-chat persistence and cancellation guards.
- [ ] #5 — Entity/memory/edge ST Vector replacement and deletion changesets.
- [ ] #6 — Reflection vector cleanup on replacement and archival.
- [ ] #7 — Production ST Vector community retrieval wiring.
- [ ] #8 — Schema v5, archive/rebuild invariants, current vision, and accurate POV scope.

## P2 — reliability and domain guidance

- [ ] #10 — Scoped CDN pinning and current test-override workflow.
- [ ] #11 — Edge embedding/ST backfill.
- [ ] #12 — Restore failed reflection importance with bounded retry suppression.
- [ ] #16 — Typed relationship-impact schema; remove z.any.
- [ ] #18 — Settings/defaults and logging boundaries.
- [ ] #19 — UI promise handling, modal Escape, merge metadata, and tab/binding guide.
- [ ] #20 — Testing policy and meaningful boundary regressions.
- [ ] #13 — Explicit, reachable tiny-graph community behavior.
- [ ] #14 — Current graph thresholds, relationship status, and summary validity guidance.
- [ ] #15 — Reflection candidates, evidence, importance, and toggle guidance.
- [ ] #17 — Paired reasoning tags, language policy, and coverage-fallback prompt guidance.

## P3 — observability and workflow

- [ ] #21 — Global synthesis metric and accurate persistence documentation.
- [ ] #22 — Real documentation pointers, canonical labels, and safe tracker examples.

## Dependencies and work coordination

These are implementation-order recommendations unless explicitly stated as dependencies in a child issue.

- Stabilize shared vector text/hash replacement in #5 before reusing it in #6 and #11.
- Apply #9's originating-chat rules to #12's accumulator restoration; failed work must never update the newly selected chat.
- Resolve #13 before finalizing its description in #14.
- Finish #12 and #6 before finalizing the retry/archive claims in #15.
- Keep #8 and #17 aligned on exact source coverage and the fallback contract.
- Begin #20 early enough to guide regression tests, but do not block necessary bug-fix tests on a policy cleanup.
- The archive remains narrator/world reference data. A hard per-character archive secrecy mode would be a new product decision; no follow-up here authorizes regenerating the immutable prefix on POV changes.

## Coverage map

| Audited area | Follow-ups |
| --- | --- |
| Root vision and architecture | #8, #10, #18, #22 |
| Store and vector mutation contract | #5, #6, #9 |
| Schema/embedding migrations | #4, #8, #9, #11 |
| Graph and communities | #5, #7, #11, #13, #14 |
| Reflection | #6, #12, #15 |
| Extraction and fallback coverage | #8, #12, #16, #17 |
| Retrieval and POV scope | #7, #8 |
| Prompts and structured outputs | #16, #17 |
| ST Vector services | #5, #6, #7, #11 |
| UI | #19 |
| Utilities and dependency loading | #10, #18 |
| Performance | #21 |
| Testing | #20 plus regression criteria in each code issue |
| Linked agent-workflow documents | #22 |
| New archive/rebuild/embedding instruction gaps | #8, #11, #18 |

## Validation and completion

The original targeted audit checks passed 229 tests; their fixtures/composition did not cover every finding. Passing that baseline is not sufficient to close these issues.

For each code fix, add the smallest meaningful regression that exercises its boundary, run the relevant checks, and follow the existing pre-commit check requirement. For documentation-only changes, verify source references, current constants, and consistency rather than adding prose snapshot tests.

Close this index only after every follow-up is resolved or explicitly deferred with a reason. No code changes are claimed by issue creation. Priority is recorded in issue titles and this index; existing bug/documentation/improvement labels are used without inventing a new label taxonomy.
