# Migration and audit completion — 2026-09-09

This records the final adopted implementation for issues #1–#23. The migration branch includes the earlier task-aware embedding and immutable archive implementation plus the audit fixes below.

| Issue | Completion |
| --- | --- |
| #1 | Implemented task-aware Qwen3 and EmbeddingGemma matching, deterministic aliases and provider-aware caches. Real browser WebGPU evaluation and identity regressions are recorded in docs/embedding-evaluation-2026-09-09.md. Thresholds are conservative small-sample operating points, not a general accuracy guarantee. |
| #2 | Completed separate stable archive and late dynamic entity/world/recall injection tiers, deterministic archive ordering, independent budgets and diagnostics. Production ST community selection now works even when recall is empty. |
| #3 | Completed immutable archive coverage, seal-before-hide persistence, hysteresis, frozen-source protection, recovery and bounded persisted archive projections. Final adopted schema v5 requires explicit full rebuild of older chats. Persisted projections and protected-overflow handling replace the illustrative automatic era-rollup proposal; sealed source segments are retained. |
| #4 | Converted keyed legacy nodes and edges, including existing encoded values and historical community summary embeddings. Production-shaped migration regressions pass. |
| #5 | Centralized canonical vector index text and completed exact old-hash deletion/new-content changesets for memory, entity and relationship mutations and merges. |
| #6 | Archived reflections now delete their previous vector hashes. Capacity victims are archived only after successful replacement generation so failed synthesis does not lose cleanup ownership. |
| #7 | Shared ST prefetch now feeds production world-context community selection across normal and empty-recall paths. Stale, dissolved, child and unknown IDs are excluded. |
| #8 | Aligned root, schema, archive, rebuild and embedding guidance with schema v5, narrator/world archives, explicit legacy rebuild and durable-state boundaries. |
| #9 | Captured chat/session guards now cover migration saves and rollback, vector dispatch/backfill, rebuild checkpoints and standalone Phase 2 enrichment. Deferred chat-switch regressions pass. |
| #10 | Added scoped CDN version parsing, deterministic mirror/importer overrides and cycle-safe bootstrap logging guidance, with behavioral tests. |
| #11 | Backfill and migration now include memories, nodes, relationships and communities for local embeddings and ST Vector, guarded against chat/session changes. |
| #12 | Failed reflection synthesis restores importance additively only in the originating session; cancellation and success behavior are explicit, with bounded cooldown and retry-failure suppression. |
| #13 | Removed the unreachable tiny-graph fallback; graphs below three nodes explicitly skip community detection and larger graphs use the normal detection path. |
| #14 | Updated graph guidance against current thresholds, relationship statuses, tiny-graph behavior and community summary validity. |
| #15 | Updated reflection guidance for token-budget candidates, evidence provenance, clamped importance, independent toggles, deferred archival and bounded retry restoration. |
| #16 | Replaced untyped relationship-impact validation with a structured schema and positive/negative validation regressions. |
| #17 | Aligned prompt guidance with paired reasoning tags, output-language policy, exact source coverage and deterministic fallback contracts. Removed brittle prose assertions. |
| #18 | Moved archive/rebuild configuration through settings/defaults boundaries and queue/CDN warnings through the appropriate logging boundary while avoiding a bootstrap import cycle. |
| #19 | Handled lazy UI import failures, modal Escape focus/default behavior and merge metadata; refreshed actual tabs and binding guidance with focused tests. |
| #20 | Replaced arbitrary suite limits and brittle prose/timer assertions with meaningful protocol, cancellation, migration and vector-boundary regressions. |
| #21 | Registered global synthesis performance timing and corrected performance persistence guidance, with a metric regression. |
| #22 | Repaired real documentation pointers and explicit fork/PowerShell issue-tracker examples. Ensured the five canonical triage labels exist in this repository. |
| #23 | Completed and verified the migration and all nineteen audit follow-ups. See docs/migration-remediation-2026-09-09.md for the issue-by-issue completion record and validation limits. |

## Verification

- Full Vitest suite and `npm run check` pass; the latter runs version synchronization, generated types, lint, JSDoc, CSS and TypeScript validation.
- Real browser WebGPU runs cover Qwen3 q8/1024-dimensional last-token output and EmbeddingGemma q4/768-dimensional mean-pooled output. See the recorded evaluation and rerunnable manual harness.
- Regression coverage includes stale saves/rollback, legacy keyed graphs, vector hash replacement/deletion, four-type backfill, reflection failure restoration, production ST world retrieval, archive coverage/recovery and rebuild readiness gates.

## Operational scope

No live SillyTavern chat was rewritten: the local host was unavailable. Older chats deliberately enter the schema-v5 rebuild gate and require the explicit full-rebuild action when opened. This completion describes the shipped migration implementation, not a claim that every user's stored chat has already been rebuilt.

The original archive issues contained illustrative legacy compatibility and automatic era-rollup options. The adopted design uses mandatory rebuild, retained immutable source segments, bounded persisted projections and protected-overflow handling. Automatic semantic era synthesis is not part of this implementation. Calibration is a small synthetic fixture and does not establish broad model accuracy.

